// Supabase Edge Function: update-fuel-prices
// Global reference fuel prices are platform data, not tenant data.
// Only explicitly configured platform administrators may update them.
//
// Required secrets:
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// PLATFORM_ADMIN_USER_IDS (comma-separated Supabase auth user UUIDs)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function response(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "POST required" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const platformAdminIds = new Set(
    String(Deno.env.get("PLATFORM_ADMIN_USER_IDS") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (!url || !anon || !service) return response({ error: "Server configuration is incomplete" }, 500);
  if (!platformAdminIds.size) return response({ error: "No platform administrators are configured" }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, service);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return response({ error: "Unauthorised" }, 401);
  if (!platformAdminIds.has(userData.user.id)) {
    return response({ error: "Platform administrator permission required" }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return response({ error: "Invalid JSON" }, 400);
  }

  const rows = Array.isArray(body.prices) ? body.prices : [];
  if (!rows.length) return response({ error: "prices[] is required" }, 400);

  const allowedRegions = new Set(["coastal", "inland", "custom"]);
  const allowedTypes = new Set(["petrol_93", "petrol_95", "diesel_500ppm", "diesel_50ppm", "other"]);
  const clean = rows.map((row: Record<string, unknown>) => ({
    region: String(row.region),
    fuel_type: String(row.fuel_type),
    price_per_litre: Number(row.price_per_litre),
    effective_from: String(row.effective_from),
    effective_to: row.effective_to ? String(row.effective_to) : null,
    source_name: String(row.source_name ?? "Manual verified import"),
    source_url: row.source_url ? String(row.source_url) : null,
    is_reference_price: row.is_reference_price !== false,
  })).filter((row: any) =>
    allowedRegions.has(row.region) &&
    allowedTypes.has(row.fuel_type) &&
    Number.isFinite(row.price_per_litre) &&
    row.price_per_litre > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.effective_from) &&
    (row.effective_to == null || /^\d{4}-\d{2}-\d{2}$/.test(row.effective_to))
  );

  if (clean.length !== rows.length) return response({ error: "One or more price rows are invalid" }, 400);

  const { data, error } = await admin.from("fuel_prices")
    .upsert(clean, { onConflict: "region,fuel_type,effective_from" })
    .select();

  if (error) return response({ error: error.message }, 500);
  return response({ updated: data.length, prices: data, updated_by: userData.user.id }, 200);
});
