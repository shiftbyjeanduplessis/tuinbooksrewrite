// Supabase Edge Function: whatsapp-webhook
// Handles Meta verification, signed webhook events, delivery/read statuses,
// reply attribution, STOP suppression and accepted-offer creation.
//
// Required secrets:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// WHATSAPP_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN")!;
const metaAppSecret = Deno.env.get("META_APP_SECRET")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

function classifyResponse(text: string, action?: string | null) {
  const normalizedAction = String(action ?? "").trim().toLowerCase();
  if (["opt_out", "stop", "unsubscribe"].includes(normalizedAction)) return "opt_out";
  if (["accept", "accepted", "yes", "add"].includes(normalizedAction)) return "accepted";
  if (["more_info", "info", "details"].includes(normalizedAction)) return "more_info";
  if (["decline", "declined", "no"].includes(normalizedAction)) return "declined";

  const clean = text.trim().toLowerCase();
  if (["stop", "unsubscribe", "opt out", "opt-out", "remove me"].includes(clean)) return "opt_out";
  if (["yes", "yes, add it", "ja", "ja, voeg dit by", "add it"].includes(clean)) return "accepted";
  if (["tell me more", "more info", "meer inligting", "info"].includes(clean)) return "more_info";
  if (["no thanks", "no", "nee dankie", "nee"].includes(clean)) return "declined";
  return clean ? "free_text" : "unknown";
}

function bytesFromHex(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyMetaSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!metaAppSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const supplied = bytesFromHex(signatureHeader.slice("sha256=".length));
  if (!supplied) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(metaAppSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  return constantTimeEqual(expected, supplied);
}

function parseTuinBooksButtonPayload(payload: string | null | undefined): { recipientId: string; action: string } | null {
  const match = String(payload ?? "").match(/^tb\|([0-9a-f-]{36})\|([a-z0-9_]+)$/i);
  if (!match) return null;
  return { recipientId: match[1], action: match[2].toLowerCase() };
}

function countryCodeFromPhone(phone: string | null | undefined): string | null {
  if (String(phone ?? "").startsWith("27")) return "ZA";
  return null;
}

async function rateMessage(
  normalizedPhone: string | null,
  category: string | null,
  timestampIso: string,
  billable: boolean | null,
): Promise<{ cost: number | null; status: string }> {
  if (billable === false) return { cost: 0, status: "rated" };
  const countryCode = countryCodeFromPhone(normalizedPhone);
  if (!countryCode || !category) return { cost: null, status: "unpriced" };

  const day = timestampIso.slice(0, 10);
  const { data: rate } = await admin
    .from("whatsapp_rate_cards")
    .select("rate_per_message")
    .eq("country_code", countryCode)
    .eq("message_category", category)
    .eq("currency", "ZAR")
    .lte("effective_from", day)
    .or(`effective_to.is.null,effective_to.gte.${day}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  return rate?.rate_per_message == null
    ? { cost: null, status: "unpriced" }
    : { cost: Number(rate.rate_per_message), status: "rated" };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === verifyToken) return new Response(challenge ?? "", { status: 200 });
    return new Response("Verification failed", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!metaAppSecret) return new Response("Webhook secret is not configured", { status: 500 });
  const rawBody = await req.text();
  const signatureValid = await verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"));
  if (!signatureValid) return new Response("Invalid webhook signature", { status: 401 });

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = value.metadata?.phone_number_id;
      const { data: connection } = await admin.from("whatsapp_connections")
        .select("business_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (!connection) continue;

      for (const status of value.statuses ?? []) {
        const mappedStatus = ["sent", "delivered", "read", "failed", "deleted"].includes(status.status)
          ? status.status
          : "sent";
        const error = status.errors?.[0];
        const statusAt = new Date(Number(status.timestamp) * 1000).toISOString();

        const { data: existingMessage } = await admin.from("whatsapp_messages")
          .select("id,campaign_recipient_id,normalized_phone,payload")
          .eq("external_message_id", status.id)
          .maybeSingle();
        if (!existingMessage) continue;

        const pricingCategory = status.pricing?.category ?? null;
        const pricingModel = status.pricing?.pricing_model ?? null;
        const billable = typeof status.pricing?.billable === "boolean" ? status.pricing.billable : null;
        const rated = await rateMessage(existingMessage.normalized_phone, pricingCategory, statusAt, billable);

        await admin.from("whatsapp_messages").update({
          status: mappedStatus,
          status_at: statusAt,
          error_code: error?.code ? String(error.code) : null,
          error_message: error?.message ?? null,
          rated_message_cost: rated.cost,
          cost_status: rated.status,
          pricing_category: pricingCategory,
          pricing_model: pricingModel,
          payload: { ...(existingMessage.payload ?? {}), status_webhook: status },
        }).eq("id", existingMessage.id);

        if (existingMessage.campaign_recipient_id) {
          const recipientUpdate: Record<string, unknown> = {
            rated_message_cost: rated.cost,
            cost_status: rated.status,
            pricing_category: pricingCategory,
            pricing_model: pricingModel,
          };
          if (["delivered", "read", "failed"].includes(mappedStatus)) {
            recipientUpdate.eligibility_status = mappedStatus;
          }
          await admin.from("marketing_campaign_recipients")
            .update(recipientUpdate)
            .eq("id", existingMessage.campaign_recipient_id);
        }
      }

      for (const incoming of value.messages ?? []) {
        const text = incoming.text?.body
          ?? incoming.button?.text
          ?? incoming.interactive?.button_reply?.title
          ?? incoming.interactive?.list_reply?.title
          ?? "";
        const normalizedPhone = String(incoming.from ?? "").replace(/\D/g, "");
        const buttonPayload = incoming.button?.payload
          ?? incoming.interactive?.button_reply?.id
          ?? incoming.interactive?.list_reply?.id
          ?? null;
        const parsedButton = parseTuinBooksButtonPayload(buttonPayload);

        let recipient: { id: string; campaign_id: string; customer_id: string } | null = null;

        if (parsedButton) {
          const { data } = await admin.from("marketing_campaign_recipients")
            .select("id,campaign_id,customer_id")
            .eq("business_id", connection.business_id)
            .eq("id", parsedButton.recipientId)
            .maybeSingle();
          recipient = data ?? null;
        }

        if (!recipient && incoming.context?.id) {
          const { data: contextMessage } = await admin.from("whatsapp_messages")
            .select("campaign_recipient_id")
            .eq("business_id", connection.business_id)
            .eq("external_message_id", incoming.context.id)
            .maybeSingle();
          if (contextMessage?.campaign_recipient_id) {
            const { data } = await admin.from("marketing_campaign_recipients")
              .select("id,campaign_id,customer_id")
              .eq("business_id", connection.business_id)
              .eq("id", contextMessage.campaign_recipient_id)
              .maybeSingle();
            recipient = data ?? null;
          }
        }

        if (!recipient) {
          const { data } = await admin.from("marketing_campaign_recipients")
            .select("id,campaign_id,customer_id")
            .eq("business_id", connection.business_id)
            .eq("normalized_phone", normalizedPhone)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          recipient = data ?? null;
        }

        const responseType = classifyResponse(text, parsedButton?.action);
        const statusAt = new Date(Number(incoming.timestamp) * 1000).toISOString();

        const { data: inboundMessage, error: inboundError } = await admin.from("whatsapp_messages").upsert({
          business_id: connection.business_id,
          campaign_id: recipient?.campaign_id ?? null,
          campaign_recipient_id: recipient?.id ?? null,
          customer_id: recipient?.customer_id ?? null,
          direction: "inbound",
          message_type: incoming.type ?? "text",
          normalized_phone: normalizedPhone,
          external_message_id: incoming.id,
          status: "replied",
          status_at: statusAt,
          payload: incoming,
        }, { onConflict: "external_message_id" }).select("id").single();

        if (inboundError) continue;

        const { data: responseRecord } = await admin.from("marketing_responses").upsert({
          business_id: connection.business_id,
          campaign_id: recipient?.campaign_id ?? null,
          campaign_recipient_id: recipient?.id ?? null,
          customer_id: recipient?.customer_id ?? null,
          whatsapp_message_id: inboundMessage?.id ?? null,
          response_type: responseType,
          response_text: text,
          external_message_id: incoming.id,
          payload: { ...incoming, tuinbooks_button_action: parsedButton?.action ?? null },
        }, { onConflict: "external_message_id" }).select("id").single();

        if (recipient?.id) {
          await admin.from("marketing_campaign_recipients")
            .update({ eligibility_status: "replied" })
            .eq("id", recipient.id);
        }

        if (responseType === "opt_out") {
          await admin.from("marketing_suppressions").upsert({
            business_id: connection.business_id,
            normalized_phone: normalizedPhone,
            reason: "opt_out",
            source: "whatsapp_reply",
            active: true,
            details: { external_message_id: incoming.id, response_text: text },
            updated_at: new Date().toISOString(),
          }, { onConflict: "business_id,normalized_phone" });

          await admin.from("customers").update({
            marketing_allowed: false,
            marketing_opt_out_at: new Date().toISOString(),
          })
            .eq("business_id", connection.business_id)
            .eq("whatsapp_normalized", normalizedPhone);
        }

        if (responseType === "accepted" && recipient?.customer_id && responseRecord?.id) {
          const { data: existingLink } = await admin.from("marketing_work_links")
            .select("id")
            .eq("response_id", responseRecord.id)
            .maybeSingle();
          if (!existingLink) {
            await admin.from("marketing_work_links").insert({
              business_id: connection.business_id,
              response_id: responseRecord.id,
              campaign_id: recipient.campaign_id,
              customer_id: recipient.customer_id,
              status: "pending_approval",
              payload: {
                source_message_id: incoming.id,
                response_text: text,
                button_action: parsedButton?.action ?? null,
              },
            });
          }
        }
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
});
