// Supabase Edge Function: send-whatsapp-campaign
// Production hardening:
// - explicit manage_marketing permission check
// - atomic recipient claiming (FOR UPDATE SKIP LOCKED in SQL)
// - template contract validation and dynamic body/header/button components
// - send-time eligibility and suppression revalidation
// - separate estimated/rated/invoice-reconciled cost fields
//
// Required secrets:
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// META_SYSTEM_USER_TOKEN (single-tenant only; replace with per-business Vault tokens before multi-tenant launch)
// WHATSAPP_GRAPH_API_VERSION

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = { campaign_id?: string; limit?: number };
type ParameterSpec = string | { key?: string; fallback?: string };
type ButtonSpec = {
  index?: string | number;
  sub_type?: "quick_reply" | "url";
  action?: string;
  parameter_key?: string;
  payload?: string;
};
type TemplateRecord = {
  meta_template_name: string;
  language_code: string;
  approval_status: string;
  body_preview: string;
  parameter_config: { header?: ParameterSpec[]; body?: ParameterSpec[] } | null;
  button_config: ButtonSpec[] | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bodyPlaceholderCount(preview: string): number {
  const matches = [...String(preview ?? "").matchAll(/\{\{(\d+)\}\}/g)];
  return matches.reduce((max, match) => Math.max(max, Number(match[1] ?? 0)), 0);
}

function normalizeSpecs(value: unknown): ParameterSpec[] {
  return Array.isArray(value) ? value as ParameterSpec[] : [];
}

function specKey(spec: ParameterSpec): string {
  return typeof spec === "string" ? spec : String(spec.key ?? "");
}

function resolveSpec(spec: ParameterSpec, context: Record<string, unknown>): string {
  const key = specKey(spec);
  const fallback = typeof spec === "string" ? undefined : spec.fallback;
  const value = key ? context[key] : undefined;
  if (value == null || value === "") {
    if (fallback != null) return String(fallback);
    throw new Error(`Missing template value for '${key || "unnamed parameter"}'`);
  }
  return String(value);
}

function validateTemplateContract(template: TemplateRecord): string | null {
  const bodySpecs = normalizeSpecs(template.parameter_config?.body);
  const expectedBodyCount = bodyPlaceholderCount(template.body_preview);
  if (bodySpecs.length !== expectedBodyCount) {
    return `Template contract mismatch: body preview expects ${expectedBodyCount} parameter(s), but parameter_config.body defines ${bodySpecs.length}`;
  }

  for (const spec of [...normalizeSpecs(template.parameter_config?.header), ...bodySpecs]) {
    if (!specKey(spec)) return "Template contract contains a parameter without a key";
  }

  for (const button of Array.isArray(template.button_config) ? template.button_config : []) {
    const subType = button.sub_type ?? "quick_reply";
    if (button.index == null) return "Template button is missing an index";
    if (subType === "quick_reply" && !button.action && !button.payload) {
      return `Quick-reply button ${button.index} is missing an action or payload`;
    }
    if (subType === "url" && !button.parameter_key) {
      return `Dynamic URL button ${button.index} is missing parameter_key`;
    }
  }
  return null;
}

function buildTemplateComponents(
  template: TemplateRecord,
  context: Record<string, unknown>,
  recipientId: string,
): unknown[] {
  const components: unknown[] = [];
  const headerSpecs = normalizeSpecs(template.parameter_config?.header);
  const bodySpecs = normalizeSpecs(template.parameter_config?.body);

  if (headerSpecs.length) {
    components.push({
      type: "header",
      parameters: headerSpecs.map((spec) => ({ type: "text", text: resolveSpec(spec, context) })),
    });
  }

  if (bodySpecs.length) {
    components.push({
      type: "body",
      parameters: bodySpecs.map((spec) => ({ type: "text", text: resolveSpec(spec, context) })),
    });
  }

  for (const rawButton of Array.isArray(template.button_config) ? template.button_config : []) {
    const index = String(rawButton.index);
    const subType = rawButton.sub_type ?? "quick_reply";
    if (subType === "quick_reply") {
      const action = String(rawButton.action ?? "reply");
      const payload = rawButton.payload ?? `tb|${recipientId}|${action}`;
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index,
        parameters: [{ type: "payload", payload }],
      });
    } else if (subType === "url") {
      const value = context[String(rawButton.parameter_key)];
      if (value == null || value === "") throw new Error(`Missing URL button value for '${rawButton.parameter_key}'`);
      components.push({
        type: "button",
        sub_type: "url",
        index,
        parameters: [{ type: "text", text: String(value) }],
      });
    }
  }

  return components;
}

function countryCodeFromPhone(phone: string): string | null {
  if (phone.startsWith("27")) return "ZA";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const metaToken = Deno.env.get("META_SYSTEM_USER_TOKEN");
  const graphVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !metaToken || !graphVersion) {
    return jsonResponse({ error: "Server configuration is incomplete" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: "Unauthorised" }, 401);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const campaignId = body.campaign_id;
  const limit = Math.max(1, Math.min(Number(body.limit ?? 100), 500));
  if (!campaignId) return jsonResponse({ error: "campaign_id is required" }, 400);

  const { data: campaign, error: campaignError } = await userClient
    .from("marketing_campaigns")
    .select("id,business_id,name,status,template_id,offer_id,payload,estimated_message_rate")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaign) return jsonResponse({ error: "Campaign not found or inaccessible" }, 404);

  const { data: canSend, error: permissionError } = await userClient.rpc("tuinbooks_has_business_permission", {
    p_business_id: campaign.business_id,
    p_permission: "manage_marketing",
  });
  if (permissionError) {
    return jsonResponse({ error: "Marketing permission check failed", detail: permissionError.message }, 500);
  }
  if (!canSend) {
    const { data: membership } = await admin
      .from("business_members")
      .select("role,active,permissions")
      .eq("business_id", campaign.business_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    return jsonResponse({
      error: "Marketing send permission required",
      role: membership?.role ?? null,
      active: membership?.active ?? null,
      guidance: "Configure business_members.permissions.manage_marketing or businesses.settings.permission_roles.manage_marketing.",
    }, 403);
  }

  if (!["approved", "sending"].includes(campaign.status)) {
    return jsonResponse({ error: "Campaign must be approved before sending" }, 409);
  }

  const [{ data: connection }, { data: template }, { data: offer }] = await Promise.all([
    userClient.from("whatsapp_connections")
      .select("phone_number_id,connection_status")
      .eq("business_id", campaign.business_id)
      .single(),
    campaign.template_id
      ? userClient.from("marketing_templates")
        .select("meta_template_name,language_code,approval_status,body_preview,parameter_config,button_config")
        .eq("id", campaign.template_id)
        .single()
      : Promise.resolve({ data: null }),
    campaign.offer_id
      ? userClient.from("marketing_offers")
        .select("name,price_amount,price_min,price_max,price_type")
        .eq("id", campaign.offer_id)
        .single()
      : Promise.resolve({ data: null }),
  ]);

  if (!connection || connection.connection_status !== "connected" || !connection.phone_number_id) {
    return jsonResponse({ error: "WhatsApp Business is not connected" }, 409);
  }
  if (!template || template.approval_status !== "approved") {
    return jsonResponse({ error: "An approved Meta template is required" }, 409);
  }

  const templateContractError = validateTemplateContract(template as TemplateRecord);
  if (templateContractError) return jsonResponse({ error: templateContractError }, 409);

  const claimId = crypto.randomUUID();
  const { data: recipients, error: claimError } = await userClient.rpc("claim_campaign_recipients", {
    p_campaign_id: campaignId,
    p_limit: limit,
    p_claim_id: claimId,
  });
  if (claimError) return jsonResponse({ error: claimError.message }, 409);
  if (!recipients?.length) return jsonResponse({ sent: 0, failed: 0, message: "No queued recipients" });

  await admin.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);

  let sent = 0;
  let failed = 0;
  const failures: Array<{ recipient_id: string; error: string }> = [];

  for (const recipient of recipients) {
    const { data: customer } = await admin
      .from("customers")
      .select("active,marketing_allowed,marketing_opt_out_at,whatsapp_normalized")
      .eq("business_id", campaign.business_id)
      .eq("id", recipient.customer_id)
      .maybeSingle();

    const { data: suppression } = await admin
      .from("marketing_suppressions")
      .select("id")
      .eq("business_id", campaign.business_id)
      .eq("normalized_phone", recipient.normalized_phone)
      .eq("active", true)
      .maybeSingle();

    if (
      !customer?.active ||
      !customer.marketing_allowed ||
      customer.marketing_opt_out_at ||
      suppression ||
      customer.whatsapp_normalized !== recipient.normalized_phone
    ) {
      await admin.from("marketing_campaign_recipients").update({
        selected: false,
        eligibility_status: "excluded",
        exclusion_reason: suppression || customer?.marketing_opt_out_at
          ? "Marketing opted out or phone suppressed"
          : "No longer eligible",
        send_claim_id: null,
        claimed_at: null,
      }).eq("id", recipient.id).eq("send_claim_id", claimId);
      continue;
    }

    const countryCode = countryCodeFromPhone(recipient.normalized_phone);
    let estimatedRate = campaign.estimated_message_rate == null
      ? null
      : Number(campaign.estimated_message_rate);

    if (estimatedRate == null && countryCode) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: rateCard } = await admin
        .from("whatsapp_rate_cards")
        .select("rate_per_message")
        .eq("country_code", countryCode)
        .eq("message_category", "marketing")
        .eq("currency", "ZAR")
        .lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      estimatedRate = rateCard?.rate_per_message == null ? null : Number(rateCard.rate_per_message);
    }

    const variables = recipient.personalized_variables ?? {};
    const context: Record<string, unknown> = {
      ...variables,
      first_name: variables.first_name ?? variables.customer_name ?? "there",
      customer_name: variables.customer_name,
      customer_id: recipient.customer_id,
      campaign_name: campaign.name,
      offer_name: offer?.name,
      price: offer?.price_amount,
      price_min: offer?.price_min,
      price_max: offer?.price_max,
      price_type: offer?.price_type,
    };

    let components: unknown[];
    try {
      components = buildTemplateComponents(template as TemplateRecord, context, recipient.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin.from("marketing_campaign_recipients").update({
        eligibility_status: "failed",
        exclusion_reason: message,
        send_claim_id: null,
        claimed_at: null,
      }).eq("id", recipient.id).eq("send_claim_id", claimId);
      failures.push({ recipient_id: recipient.id, error: message });
      failed += 1;
      continue;
    }

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient.normalized_phone,
      type: "template",
      template: {
        name: template.meta_template_name,
        language: { code: recipient.language_code || template.language_code },
        ...(components.length ? { components } : {}),
      },
    };

    const { data: dispatchMessage, error: dispatchError } = await admin
      .from("whatsapp_messages")
      .insert({
        business_id: campaign.business_id,
        campaign_id: campaignId,
        campaign_recipient_id: recipient.id,
        customer_id: recipient.customer_id,
        direction: "outbound",
        message_type: "template",
        template_name: template.meta_template_name,
        normalized_phone: recipient.normalized_phone,
        status: "dispatching",
        status_at: new Date().toISOString(),
        dispatch_key: claimId,
        estimated_message_cost: estimatedRate,
        cost_status: estimatedRate == null ? "unpriced" : "estimated",
        pricing_category: "marketing",
        payload: { request: payload },
      })
      .select("id")
      .single();

    if (dispatchError || !dispatchMessage) {
      const message = dispatchError?.message ?? "Could not create dispatch record";
      await admin.from("marketing_campaign_recipients").update({
        eligibility_status: "failed",
        exclusion_reason: `Dispatch blocked: ${message}`,
        send_claim_id: null,
        claimed_at: null,
      }).eq("id", recipient.id).eq("send_claim_id", claimId);
      failures.push({ recipient_id: recipient.id, error: message });
      failed += 1;
      continue;
    }

    await admin.from("marketing_campaign_recipients").update({
      estimated_message_cost: estimatedRate,
      cost_status: estimatedRate == null ? "unpriced" : "estimated",
      pricing_category: "marketing",
    }).eq("id", recipient.id).eq("send_claim_id", claimId);

    try {
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseJson = await response.json();
      if (!response.ok) throw new Error(responseJson?.error?.message ?? `Meta HTTP ${response.status}`);
      const externalMessageId = responseJson?.messages?.[0]?.id ?? null;

      await admin.from("whatsapp_messages").update({
        external_message_id: externalMessageId,
        status: "sent",
        status_at: new Date().toISOString(),
        payload: { request: payload, response: responseJson },
      }).eq("id", dispatchMessage.id);

      await admin.from("marketing_campaign_recipients").update({
        eligibility_status: "sent",
        send_claim_id: null,
        claimed_at: null,
      }).eq("id", recipient.id).eq("send_claim_id", claimId);

      await admin.from("customers").update({ last_marketing_at: new Date().toISOString() })
        .eq("business_id", campaign.business_id)
        .eq("id", recipient.customer_id);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ recipient_id: recipient.id, error: message });
      await admin.from("marketing_campaign_recipients").update({
        eligibility_status: "failed",
        exclusion_reason: message,
        send_claim_id: null,
        claimed_at: null,
      }).eq("id", recipient.id).eq("send_claim_id", claimId);
      await admin.from("whatsapp_messages").update({
        status: "failed",
        status_at: new Date().toISOString(),
        error_message: message,
      }).eq("id", dispatchMessage.id);
      failed += 1;
    }
  }

  const { count: remaining } = await admin
    .from("marketing_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("selected", true)
    .in("eligibility_status", ["selected", "queued", "claimed"]);

  await admin.from("marketing_campaigns").update({
    status: remaining ? "sending" : "active",
    sent_at: remaining ? null : new Date().toISOString(),
  }).eq("id", campaignId);

  return jsonResponse({ sent, failed, remaining: remaining ?? 0, claim_id: claimId, failures });
});
