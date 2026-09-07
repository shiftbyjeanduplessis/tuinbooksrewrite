# TuinBooks v55.3 — Implementation Notes

## Release boundary

v55.3 merges the hardened marketing and route/fuel prototype into the current v55.2 operational app. It does not add background GPS tracking, a hard-wired road-routing provider or unrestricted live WhatsApp sending.

## Marketing

The owner app now provides:

- active-client audience building;
- structured permission and opt-out handling;
- South African mobile normalization;
- duplicate and cooldown suppression;
- service, client-type, cluster and language filters;
- pre-send cost and capacity estimates;
- campaign draft/approval states;
- webhook-created accepted replies synchronized into the office queue;
- accepted-response conversion into operational work;
- campaign-value indicators in Reports.

The sender revalidates eligibility on the server. Live sends require a connected WhatsApp Business number, approved Meta templates and deployed Edge Functions.

## Mileage and route intelligence

The owner app now provides:

- vehicle profiles and team assignment;
- realistic working fuel consumption;
- planned distance and travel time;
- beginning/ending odometer evidence;
- actual distance, estimated litres and fuel cost;
- cost per visit and monthly team totals;
- route variance and isolated/high-cost warnings;
- straight-line planning minimums from saved coordinates;
- configured fallback when coordinates are incomplete.

No road-distance vendor is hard-wired. `route_matrix_cache` and route-estimate tables are included for a future provider. Until then, actual odometers are authoritative.

## Data authority

The current operational snapshot remains authoritative for the existing app arrays. Structured marketing/fleet tables support secured sending, webhooks, reporting and route evidence. Customer marketing fields are synchronized from the existing client payload so the release does not create an unrelated client store.

## Fuel price

No current fuel price is embedded in the migration or release. The business enters a verified working rate. The optional platform fuel-price Edge Function accepts only authenticated platform administrators and validated dated rows.

## Security

All new business records use `business_id` and RLS. Marketing sends require explicit `manage_marketing`; fleet/route writes require `manage_operations`. Tokens and service-role credentials remain server-side.

## Known external dependencies

These require external configuration rather than frontend code:

- Meta Business/WhatsApp Business access;
- approved templates;
- webhook URL and verification;
- Supabase Edge Function secrets;
- optional road-distance provider;
- per-business secret/Vault design for large multi-tenant WhatsApp rollout.
