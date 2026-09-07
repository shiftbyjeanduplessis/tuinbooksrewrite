# TuinBooks v55.3 — Deploy First

This release merges the current v55.2 app with client marketing, WhatsApp response-to-work flow, vehicles, route logs, mileage and fuel-cost intelligence.

The public sales page is unchanged. The operational app is under `/app/`.

## What works without Meta/WhatsApp setup

After the SQL migration and frontend deploy, the owner can:

- record and review marketing permission per active client;
- build a filtered audience and see exclusions before any paid send;
- estimate message cost and likely bookings;
- check likely campaign work against suitable team capacity;
- save and approve campaign drafts;
- record accepted offers and link them to a visit, a separate job or office follow-up;
- configure vehicles and working fuel consumption;
- log planned distance, odometers, actual kilometres and fuel price;
- view team/month mileage, fuel cost and route exceptions;
- use route estimates from saved coordinates or a configured fallback.

Actual WhatsApp sending remains blocked until the secured Edge Functions, a connected WhatsApp Business number and approved Meta templates are configured.

## Safe deployment order

### 1. Back up

Before changing production:

- create a Supabase database backup;
- keep the current v55.2 GitHub commit available for rollback;
- use a staging Supabase project first where possible.

### 2. Run the migration once

Open Supabase **SQL Editor**, create a new query, paste the complete contents of:

`app/supabase/migration-v553-marketing-mileage.sql`

Run it after the v55.2 migration. It is designed to be safe to re-run, but do not repeatedly run a successful production migration without a reason.

The migration intentionally contains no current fuel price. Enter the business fuel rate in the Mileage & Fleet screen or load a verified reference rate later.

### 3. Verify the database

Run this read-only check:

```sql
select
  to_regclass('public.marketing_campaigns') as marketing_campaigns,
  to_regclass('public.marketing_campaign_recipients') as marketing_campaign_recipients,
  to_regclass('public.marketing_responses') as marketing_responses,
  to_regclass('public.marketing_work_links') as marketing_work_links,
  to_regclass('public.whatsapp_connections') as whatsapp_connections,
  to_regclass('public.vehicles') as vehicles,
  to_regclass('public.route_matrix_cache') as route_matrix_cache,
  to_regclass('public.team_route_logs') as team_route_logs,
  to_regprocedure('public.tuinbooks_has_business_permission(uuid,text)')
    as permission_helper;
```

Every result should be non-null.

### 4. Deploy the frontend

Upload everything inside the release folder to the existing GitHub repository. Do not upload the outer folder itself.

Suggested commit message:

`Deploy v55.3 marketing and mileage merge`

Wait for Render to report a successful live deployment. Then open `/app/` and use a hard refresh.

### 5. Verify the frontend

Open the live `/app/app.js` and search for:

- `TUINBOOKS_VERSION_V553`
- `marketingAudienceV553`
- `routeFuelCalculationV553`

In the owner app confirm that the navigation contains:

- **Marketing**
- **Mileage & Fleet**

### 6. Configure route and mileage first

In **Mileage & Fleet**:

1. Enter a verified fuel price per litre.
2. Add each vehicle and its realistic working consumption in L/100 km.
3. Assign vehicles to teams.
4. Enter the business base coordinates or a conservative planning fallback in kilometres per visit.
5. Start recording beginning and ending odometers for every team-day.

Odometers are the authoritative actual-mileage evidence. Coordinate-based estimates are planning aids, not a replacement for actual distance.

### 7. Review marketing permission

In **Marketing → Consent and eligibility**:

- permission defaults to off for ordinary production clients;
- an explicit opt-out remains protected;
- invalid and duplicate mobile numbers are excluded;
- a client contacted inside the configured cooldown is excluded;
- visit-report communication and marketing permission remain separate.

Do not mass-enable marketing permission without a valid recorded basis.

## Enabling actual WhatsApp sending

This is a separate server-side setup. Drafting and audience review do not require it.

Deploy these Edge Functions from `app/supabase/functions/`:

- `send-whatsapp-campaign`
- `whatsapp-webhook`
- `update-fuel-prices`

Configure the required Supabase secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_SYSTEM_USER_TOKEN`
- `META_APP_SECRET`
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `PLATFORM_ADMIN_USER_IDS`

Then create the business WhatsApp connection and load approved Meta templates in the new marketing tables. Do not place the service-role key or Meta token in frontend code, GitHub or Render public environment variables.

The packaged sender currently expects a platform-controlled Meta token with access to the connected number. Per-business Vault token management should be completed before broad multi-tenant WhatsApp rollout.

## Rollback

If the frontend fails, redeploy the previous v55.2 GitHub commit. Do not delete the new tables as part of a frontend rollback; they are additive and old frontend code does not depend on them.
