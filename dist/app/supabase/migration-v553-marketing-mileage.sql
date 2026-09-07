-- TuinBooks v55.3: Marketing, Mileage and Route Intelligence
-- Run after migration-v552-capacity-commitments.sql. Safe to re-run.
-- No current fuel price is hard-coded; configure a business rate or current rate card.

begin;

-- TuinBooks V2: Marketing Intelligence + Financial / Route Intelligence
-- Designed to extend the existing multi-tenant schema without replacing core scheduling or invoicing.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Existing customer enrichment
-- ---------------------------------------------------------------------------

alter table public.customers add column if not exists active boolean not null default true;
alter table public.customers add column if not exists whatsapp_number text;
alter table public.customers add column if not exists preferred_language text not null default 'en';
alter table public.customers add column if not exists visit_reports_enabled boolean not null default true;
alter table public.customers add column if not exists marketing_allowed boolean not null default false;
alter table public.customers add column if not exists marketing_permission_source text;
alter table public.customers add column if not exists marketing_permission_at timestamptz;
alter table public.customers add column if not exists marketing_opt_out_at timestamptz;
alter table public.customers add column if not exists last_marketing_at timestamptz;
alter table public.customers add column if not exists property_tags text[] not null default '{}';
alter table public.customers add column if not exists communication_notes text;

create index if not exists customers_business_active_idx
  on public.customers (business_id, active);
create index if not exists customers_business_whatsapp_idx
  on public.customers (business_id, whatsapp_number);
create index if not exists customers_property_tags_gin_idx
  on public.customers using gin (property_tags);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.tuinbooks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.tuinbooks_is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and coalesce(bm.active, true) = true
  );
$$;

create or replace function public.tuinbooks_is_business_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and coalesce(bm.active, true) = true
      and lower(coalesce(bm.role, '')) in ('owner', 'admin', 'administrator', 'office_manager')
  );
$$;

create or replace function public.normalize_za_mobile(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '[^0-9]', '', 'g');
  if digits like '00%' then digits := substr(digits, 3); end if;
  if length(digits) = 10 and left(digits, 1) = '0' then
    digits := '27' || substr(digits, 2);
  end if;
  if length(digits) = 11 and left(digits, 2) = '27' then
    return digits;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- WhatsApp connection and templates
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  verified_name text,
  connection_status text not null default 'pending'
    check (connection_status in ('pending','connected','disconnected','error')),
  embedded_signup_config_id text,
  token_secret_ref text,
  metadata jsonb not null default '{}',
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id),
  unique (phone_number_id)
);

create table if not exists public.marketing_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  meta_template_name text not null,
  category text not null default 'marketing',
  language_code text not null default 'en',
  body_preview text not null,
  button_config jsonb not null default '[]',
  approval_status text not null default 'draft'
    check (approval_status in ('draft','pending','approved','rejected','paused')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, meta_template_name, language_code)
);

create table if not exists public.marketing_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  service_category text,
  description text,
  price_type text not null default 'fixed'
    check (price_type in ('fixed','from','range','quote_required','per_square_metre','custom')),
  price_amount numeric(12,2),
  price_min numeric(12,2),
  price_max numeric(12,2),
  suitable_months int[] not null default '{}',
  required_property_tags text[] not null default '{}',
  add_to_next_visit boolean not null default true,
  requires_office_approval boolean not null default true,
  requires_site_inspection boolean not null default false,
  active boolean not null default true,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Campaigns, recipients, messages and responses
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  campaign_type text not null default 'broadcast'
    check (campaign_type in ('broadcast','targeted','visit_triggered','opportunity_triggered')),
  audience_mode text not null default 'all_active'
    check (audience_mode in ('all_active','targeted_active','manual')),
  offer_id uuid references public.marketing_offers(id) on delete set null,
  template_id uuid references public.marketing_templates(id) on delete set null,
  audience_filters jsonb not null default '{}',
  exclusion_rules jsonb not null default '{"exclude_opt_out":true,"deduplicate_phone":true}',
  status text not null default 'draft'
    check (status in ('draft','awaiting_approval','approved','scheduled','sending','active','paused','completed','cancelled','failed')),
  expected_recipient_count int not null default 0,
  estimated_message_cost numeric(12,2),
  message_currency text not null default 'ZAR',
  scheduled_for timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  customer_id text not null,
  service_site_id text,
  normalized_phone text,
  language_code text not null default 'en',
  eligibility_status text not null default 'eligible'
    check (eligibility_status in ('eligible','excluded','selected','queued','sent','delivered','read','replied','failed','cancelled')),
  exclusion_reason text,
  selected boolean not null default true,
  personalized_variables jsonb not null default '{}',
  message_cost numeric(12,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create index if not exists campaign_recipients_send_idx
  on public.marketing_campaign_recipients (campaign_id, selected, eligibility_status);
create index if not exists campaign_recipients_phone_idx
  on public.marketing_campaign_recipients (business_id, normalized_phone);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  campaign_recipient_id uuid references public.marketing_campaign_recipients(id) on delete set null,
  customer_id text,
  related_entity_type text,
  related_entity_id text,
  direction text not null check (direction in ('outbound','inbound')),
  message_type text not null default 'template',
  template_name text,
  normalized_phone text,
  external_message_id text,
  status text not null default 'created'
    check (status in ('created','queued','sent','delivered','read','replied','failed','deleted')),
  status_at timestamptz,
  error_code text,
  error_message text,
  message_cost numeric(12,4),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_message_id)
);

create index if not exists whatsapp_messages_campaign_idx
  on public.whatsapp_messages (business_id, campaign_id, status);
create index if not exists whatsapp_messages_external_idx
  on public.whatsapp_messages (external_message_id);

create table if not exists public.marketing_responses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  campaign_recipient_id uuid references public.marketing_campaign_recipients(id) on delete set null,
  customer_id text,
  whatsapp_message_id uuid references public.whatsapp_messages(id) on delete set null,
  response_type text not null
    check (response_type in ('accepted','more_info','declined','opt_out','free_text','unknown')),
  response_text text,
  external_message_id text,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  processed_by uuid,
  processed_at timestamptz,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_work_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  response_id uuid references public.marketing_responses(id) on delete set null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  customer_id text not null,
  service_site_id text,
  scheduled_visit_id text,
  work_record_id text,
  invoice_reference text,
  accepted_value numeric(12,2),
  completed_value numeric(12,2),
  invoice_ready_value numeric(12,2),
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','scheduled','completed','invoice_ready','invoiced','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Marketing audience: active clients first, then safeguards and exclusions
-- ---------------------------------------------------------------------------

create or replace function public.get_marketing_audience(
  p_business_id uuid,
  p_filters jsonb default '{}'::jsonb
)
returns table (
  customer_id text,
  customer_name text,
  contact_name text,
  normalized_phone text,
  preferred_language text,
  suburb text,
  property_tags text[],
  eligible boolean,
  exclusion_reason text
)
language sql
stable
security definer
set search_path = public
as $$
with source as (
  select
    c.id::text as customer_id,
    c.name as customer_name,
    c.contact_name,
    public.normalize_za_mobile(
      coalesce(
        nullif(c.whatsapp_number, ''),
        nullif(c.payload->>'whatsapp_number', ''),
        nullif(c.payload->>'mobile', ''),
        nullif(c.payload->>'phone', '')
      )
    ) as normalized_phone,
    coalesce(nullif(c.preferred_language, ''), 'en') as preferred_language,
    coalesce(c.payload->>'suburb', c.payload->>'area', '') as suburb,
    coalesce(c.property_tags, '{}') as property_tags,
    c.active,
    c.marketing_allowed,
    c.marketing_opt_out_at,
    c.last_marketing_at,
    row_number() over (
      partition by public.normalize_za_mobile(
        coalesce(
          nullif(c.whatsapp_number, ''),
          nullif(c.payload->>'whatsapp_number', ''),
          nullif(c.payload->>'mobile', ''),
          nullif(c.payload->>'phone', '')
        )
      )
      order by c.id
    ) as phone_rank
  from public.customers c
  where c.business_id = p_business_id
    and c.active = true
), evaluated as (
  select
    s.*,
    case
      when s.normalized_phone is null then false
      when coalesce((p_filters->>'require_marketing_permission')::boolean, true) and not s.marketing_allowed then false
      when s.marketing_opt_out_at is not null then false
      when s.phone_rank > 1 then false
      when s.last_marketing_at is not null
        and s.last_marketing_at > now() - make_interval(days => coalesce((p_filters->>'minimum_days_since_last')::int, 21)) then false
      when jsonb_array_length(coalesce(p_filters->'required_property_tags', '[]'::jsonb)) > 0
        and not s.property_tags && array(select jsonb_array_elements_text(p_filters->'required_property_tags')) then false
      when coalesce(p_filters->>'suburb', '') <> '' and lower(s.suburb) <> lower(p_filters->>'suburb') then false
      else true
    end as eligible,
    case
      when s.normalized_phone is null then 'No valid WhatsApp number'
      when coalesce((p_filters->>'require_marketing_permission')::boolean, true) and not s.marketing_allowed then 'Marketing permission not recorded'
      when s.marketing_opt_out_at is not null then 'Marketing opted out'
      when s.phone_rank > 1 then 'Duplicate number'
      when s.last_marketing_at is not null
        and s.last_marketing_at > now() - make_interval(days => coalesce((p_filters->>'minimum_days_since_last')::int, 21)) then 'Frequency limit reached'
      when jsonb_array_length(coalesce(p_filters->'required_property_tags', '[]'::jsonb)) > 0
        and not s.property_tags && array(select jsonb_array_elements_text(p_filters->'required_property_tags')) then 'Offer not relevant to property'
      when coalesce(p_filters->>'suburb', '') <> '' and lower(s.suburb) <> lower(p_filters->>'suburb') then 'Outside selected suburb'
      else null
    end as exclusion_reason
  from source s
)
select
  e.customer_id,
  e.customer_name,
  e.contact_name,
  e.normalized_phone,
  e.preferred_language,
  e.suburb,
  e.property_tags,
  e.eligible,
  e.exclusion_reason
from evaluated e
where public.tuinbooks_is_business_member(p_business_id)
order by e.eligible desc, e.customer_name;
$$;

create or replace function public.populate_campaign_audience(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_active int;
  v_eligible int;
  v_excluded int;
begin
  select * into v_campaign
  from public.marketing_campaigns
  where id = p_campaign_id;

  if v_campaign.id is null then
    raise exception 'Campaign not found';
  end if;
  if not public.tuinbooks_is_business_admin(v_campaign.business_id) then
    raise exception 'Not authorised';
  end if;

  delete from public.marketing_campaign_recipients where campaign_id = p_campaign_id;

  insert into public.marketing_campaign_recipients (
    business_id, campaign_id, customer_id, normalized_phone, language_code,
    eligibility_status, exclusion_reason, selected, personalized_variables
  )
  select
    v_campaign.business_id,
    p_campaign_id,
    a.customer_id,
    a.normalized_phone,
    a.preferred_language,
    case when a.eligible then 'selected' else 'excluded' end,
    a.exclusion_reason,
    a.eligible,
    jsonb_build_object(
      'first_name', coalesce(nullif(split_part(coalesce(a.contact_name, a.customer_name), ' ', 1), ''), a.customer_name),
      'customer_name', a.customer_name,
      'suburb', a.suburb
    )
  from public.get_marketing_audience(v_campaign.business_id, v_campaign.audience_filters) a;

  select count(*) into v_active
  from public.customers
  where business_id = v_campaign.business_id and active = true;

  select count(*) filter (where selected), count(*) filter (where not selected)
  into v_eligible, v_excluded
  from public.marketing_campaign_recipients
  where campaign_id = p_campaign_id;

  update public.marketing_campaigns
  set expected_recipient_count = v_eligible,
      updated_at = now(),
      payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
        'active_client_count', v_active,
        'eligible_count', v_eligible,
        'excluded_count', v_excluded
      )
  where id = p_campaign_id;

  return jsonb_build_object(
    'active_clients', v_active,
    'eligible', v_eligible,
    'excluded', v_excluded
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Vehicles, routes and fuel
-- ---------------------------------------------------------------------------

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_id text,
  name text not null,
  registration text,
  make text,
  model text,
  model_year int,
  engine_variant text,
  fuel_type text not null default 'petrol_95'
    check (fuel_type in ('petrol_93','petrol_95','diesel_500ppm','diesel_50ppm','other')),
  transmission text,
  manufacturer_l_per_100km numeric(7,3),
  working_l_per_100km numeric(7,3) not null,
  consumption_source text not null default 'manual'
    check (consumption_source in ('manufacturer','adjusted_estimate','actual_average','manual')),
  load_profile text not null default 'normal'
    check (load_profile in ('light','normal','heavy','trailer','custom')),
  active boolean not null default true,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_prices (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('coastal','inland','custom')),
  fuel_type text not null check (fuel_type in ('petrol_93','petrol_95','diesel_500ppm','diesel_50ppm','other')),
  price_per_litre numeric(10,4) not null,
  currency text not null default 'ZAR',
  effective_from date not null,
  effective_to date,
  source_name text,
  source_url text,
  is_reference_price boolean not null default true,
  created_at timestamptz not null default now(),
  unique (region, fuel_type, effective_from)
);

-- Fuel prices are intentionally not seeded. Configure a current reference or business override.

alter table public.businesses add column if not exists fuel_region text not null default 'coastal';
alter table public.businesses add column if not exists fuel_price_overrides jsonb not null default '{}';
alter table public.businesses add column if not exists route_base_lat numeric(10,7);
alter table public.businesses add column if not exists route_base_lng numeric(10,7);

create table if not exists public.route_matrix_cache (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  origin_site_id text not null,
  destination_site_id text not null,
  origin_lat numeric(10,7),
  origin_lng numeric(10,7),
  destination_lat numeric(10,7),
  destination_lng numeric(10,7),
  driving_distance_metres int not null,
  driving_duration_seconds int,
  provider text not null,
  provider_route_id text,
  calculated_at timestamptz not null default now(),
  expires_at timestamptz,
  payload jsonb not null default '{}',
  unique (business_id, origin_site_id, destination_site_id, provider)
);

create table if not exists public.team_route_estimates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  schedule_date date not null,
  team_id text not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  schedule_version_id text,
  visit_count int not null default 0,
  estimated_distance_km numeric(10,2) not null default 0,
  estimated_travel_minutes int not null default 0,
  estimated_litres numeric(10,3) not null default 0,
  fuel_price_per_litre numeric(10,4),
  estimated_fuel_cost numeric(12,2) not null default 0,
  scheduled_value numeric(12,2),
  completed_value numeric(12,2),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, schedule_date, team_id, schedule_version_id)
);

create or replace function public.calculate_route_fuel_cost(
  p_distance_km numeric,
  p_l_per_100km numeric,
  p_price_per_litre numeric
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'distance_km', round(coalesce(p_distance_km,0), 2),
    'estimated_litres', round((coalesce(p_distance_km,0) * coalesce(p_l_per_100km,0) / 100.0), 3),
    'estimated_fuel_cost', round((coalesce(p_distance_km,0) * coalesce(p_l_per_100km,0) / 100.0) * coalesce(p_price_per_litre,0), 2)
  );
$$;

-- ---------------------------------------------------------------------------
-- Reporting views
-- ---------------------------------------------------------------------------

create or replace view public.marketing_campaign_financial_summary as
select
  c.business_id,
  c.id as campaign_id,
  c.name,
  c.status,
  count(r.id) filter (where r.selected) as selected_recipients,
  count(r.id) filter (where r.eligibility_status in ('delivered','read','replied')) as delivered_recipients,
  count(resp.id) filter (where resp.response_type = 'accepted') as accepted_responses,
  coalesce(sum(w.accepted_value), 0) as accepted_value,
  coalesce(sum(w.completed_value), 0) as completed_value,
  coalesce(sum(w.invoice_ready_value), 0) as invoice_ready_value,
  coalesce(sum(r.message_cost), 0) as message_cost
from public.marketing_campaigns c
left join public.marketing_campaign_recipients r on r.campaign_id = c.id
left join public.marketing_responses resp on resp.campaign_recipient_id = r.id
left join public.marketing_work_links w on w.response_id = resp.id
group by c.business_id, c.id, c.name, c.status;

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'whatsapp_connections','marketing_templates','marketing_offers','marketing_campaigns',
    'marketing_campaign_recipients','whatsapp_messages','marketing_work_links','vehicles','team_route_estimates'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || t, t);
    execute format('create trigger %I before update on public.%I for each row execute function public.tuinbooks_set_updated_at()', 'set_updated_at_' || t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'whatsapp_connections','marketing_templates','marketing_offers','marketing_campaigns',
    'marketing_campaign_recipients','whatsapp_messages','marketing_responses','marketing_work_links',
    'vehicles','route_matrix_cache','team_route_estimates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_member_select', t);
    execute format('create policy %I on public.%I for select using (public.tuinbooks_is_business_member(business_id))', t || '_member_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for insert with check (public.tuinbooks_is_business_admin(business_id))', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('create policy %I on public.%I for update using (public.tuinbooks_is_business_admin(business_id)) with check (public.tuinbooks_is_business_admin(business_id))', t || '_admin_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format('create policy %I on public.%I for delete using (public.tuinbooks_is_business_admin(business_id))', t || '_admin_delete', t);
  end loop;
end $$;

alter table public.fuel_prices enable row level security;
drop policy if exists fuel_prices_read on public.fuel_prices;
create policy fuel_prices_read on public.fuel_prices for select using (true);

-- ---------------------------------------------------------------------------
-- Explicit permissions instead of relying only on guessed role names.
-- Business creators always retain access. Existing roles are a fallback only;
-- member.permissions and businesses.settings.permission_roles can override it.
-- ---------------------------------------------------------------------------

alter table public.business_members
  add column if not exists permissions jsonb not null default '{}'::jsonb;

create or replace function public.tuinbooks_has_business_permission(
  p_business_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_created_by uuid;
  v_settings jsonb;
  v_role text;
  v_active boolean;
  v_permissions jsonb;
  v_configured_roles jsonb;
  v_explicit text;
begin
  if v_uid is null or p_business_id is null or coalesce(trim(p_permission), '') = '' then
    return false;
  end if;

  select b.created_by, coalesce(b.settings, '{}'::jsonb)
    into v_created_by, v_settings
  from public.businesses b
  where b.id = p_business_id;

  if not found then
    return false;
  end if;

  if v_created_by = v_uid then
    return true;
  end if;

  select lower(coalesce(bm.role, '')), coalesce(bm.active, true), coalesce(bm.permissions, '{}'::jsonb)
    into v_role, v_active, v_permissions
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.user_id = v_uid
  limit 1;

  if not found or not v_active then
    return false;
  end if;

  if v_permissions ? p_permission then
    v_explicit := lower(coalesce(v_permissions ->> p_permission, 'false'));
    return v_explicit in ('true', '1', 'yes');
  end if;

  v_configured_roles := v_settings -> 'permission_roles' -> p_permission;
  if jsonb_typeof(v_configured_roles) = 'array' then
    return exists (
      select 1
      from jsonb_array_elements_text(v_configured_roles) configured(role_name)
      where lower(configured.role_name) = v_role
    );
  end if;

  if p_permission = 'manage_marketing' then
    return v_role in ('owner', 'admin', 'administrator', 'office_manager');
  elsif p_permission = 'manage_financials' then
    return v_role in ('owner', 'admin', 'administrator', 'office_manager');
  elsif p_permission = 'manage_business' then
    return v_role in ('owner', 'admin', 'administrator', 'office_manager');
  end if;

  return false;
end;
$$;

create or replace function public.tuinbooks_is_business_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tuinbooks_has_business_permission(p_business_id, 'manage_business');
$$;

revoke all on function public.tuinbooks_has_business_permission(uuid, text) from public;
grant execute on function public.tuinbooks_has_business_permission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Canonical phone storage and compliance suppression.
-- ---------------------------------------------------------------------------

alter table public.customers
  add column if not exists whatsapp_normalized text generated always as (
    public.normalize_za_mobile(
      coalesce(
        nullif(whatsapp_number, ''),
        nullif(payload ->> 'whatsapp_number', ''),
        nullif(payload ->> 'mobile', ''),
        nullif(payload ->> 'phone', '')
      )
    )
  ) stored;

create index if not exists customers_business_whatsapp_normalized_idx
  on public.customers (business_id, whatsapp_normalized);

create table if not exists public.marketing_suppressions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  normalized_phone text not null,
  reason text not null default 'opt_out',
  source text not null default 'whatsapp_reply',
  active boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, normalized_phone)
);

alter table public.marketing_suppressions enable row level security;
drop policy if exists marketing_suppressions_member_select on public.marketing_suppressions;
create policy marketing_suppressions_member_select on public.marketing_suppressions
  for select using (public.tuinbooks_is_business_member(business_id));
drop policy if exists marketing_suppressions_admin_insert on public.marketing_suppressions;
create policy marketing_suppressions_admin_insert on public.marketing_suppressions
  for insert with check (public.tuinbooks_has_business_permission(business_id, 'manage_marketing'));
drop policy if exists marketing_suppressions_admin_update on public.marketing_suppressions;
create policy marketing_suppressions_admin_update on public.marketing_suppressions
  for update using (public.tuinbooks_has_business_permission(business_id, 'manage_marketing'))
  with check (public.tuinbooks_has_business_permission(business_id, 'manage_marketing'));

-- ---------------------------------------------------------------------------
-- Template contracts: sending now follows stored parameter/button definitions.
-- Example parameter_config: {"header":[],"body":["first_name","price"]}
-- Example button_config: [{"index":"0","sub_type":"quick_reply","action":"accept"}]
-- ---------------------------------------------------------------------------

alter table public.marketing_templates
  add column if not exists parameter_config jsonb not null
  default '{"header":[],"body":[]}'::jsonb;

-- ---------------------------------------------------------------------------
-- Atomic recipient claiming and dispatch state.
-- ---------------------------------------------------------------------------

alter table public.marketing_campaign_recipients
  add column if not exists send_claim_id uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists estimated_message_cost numeric(12,4),
  add column if not exists rated_message_cost numeric(12,4),
  add column if not exists invoice_reconciled_cost numeric(12,4),
  add column if not exists cost_status text not null default 'unpriced',
  add column if not exists pricing_category text,
  add column if not exists pricing_model text;

alter table public.marketing_campaign_recipients
  drop constraint if exists marketing_campaign_recipients_eligibility_status_check;
alter table public.marketing_campaign_recipients
  add constraint marketing_campaign_recipients_eligibility_status_check
  check (eligibility_status in (
    'eligible','excluded','selected','queued','claimed','sent','delivered','read','replied','failed','cancelled'
  ));

alter table public.whatsapp_messages
  add column if not exists dispatch_key uuid,
  add column if not exists estimated_message_cost numeric(12,4),
  add column if not exists rated_message_cost numeric(12,4),
  add column if not exists invoice_reconciled_cost numeric(12,4),
  add column if not exists cost_status text not null default 'unpriced',
  add column if not exists pricing_category text,
  add column if not exists pricing_model text;

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_status_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_status_check
  check (status in ('created','queued','dispatching','sent','delivered','read','replied','failed','deleted'));

create unique index if not exists whatsapp_messages_one_live_outbound_per_recipient
  on public.whatsapp_messages (campaign_recipient_id)
  where direction = 'outbound'
    and campaign_recipient_id is not null
    and status in ('dispatching','sent','delivered','read','replied');

create unique index if not exists marketing_responses_external_message_uidx
  on public.marketing_responses (external_message_id)
  where external_message_id is not null;

create unique index if not exists marketing_work_links_response_uidx
  on public.marketing_work_links (response_id)
  where response_id is not null;

create or replace function public.claim_campaign_recipients(
  p_campaign_id uuid,
  p_limit integer,
  p_claim_id uuid
)
returns setof public.marketing_campaign_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_status text;
begin
  select business_id, status
    into v_business_id, v_status
  from public.marketing_campaigns
  where id = p_campaign_id;

  if not found then
    raise exception 'Campaign not found';
  end if;

  if not public.tuinbooks_has_business_permission(v_business_id, 'manage_marketing') then
    raise exception 'Marketing send permission required';
  end if;

  if v_status not in ('approved', 'sending') then
    raise exception 'Campaign must be approved before recipients can be claimed';
  end if;

  return query
  with picked as (
    select r.id
    from public.marketing_campaign_recipients r
    where r.campaign_id = p_campaign_id
      and r.selected = true
      and r.eligibility_status in ('selected', 'queued')
      and r.send_claim_id is null
    order by r.created_at, r.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  )
  update public.marketing_campaign_recipients r
  set eligibility_status = 'claimed',
      send_claim_id = p_claim_id,
      claimed_at = now(),
      updated_at = now()
  from picked
  where r.id = picked.id
  returning r.*;
end;
$$;

revoke all on function public.claim_campaign_recipients(uuid, integer, uuid) from public;
grant execute on function public.claim_campaign_recipients(uuid, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Audience calculation now also honours phone-level suppressions.
-- ---------------------------------------------------------------------------

create or replace function public.get_marketing_audience(
  p_business_id uuid,
  p_filters jsonb default '{}'::jsonb
)
returns table (
  customer_id text,
  customer_name text,
  contact_name text,
  normalized_phone text,
  preferred_language text,
  suburb text,
  property_tags text[],
  eligible boolean,
  exclusion_reason text
)
language sql
stable
security definer
set search_path = public
as $$
with source as (
  select
    c.id::text as customer_id,
    c.name as customer_name,
    c.contact_name,
    c.whatsapp_normalized as normalized_phone,
    coalesce(nullif(c.preferred_language, ''), 'en') as preferred_language,
    coalesce(c.payload ->> 'suburb', c.payload ->> 'area', '') as suburb,
    coalesce(c.property_tags, '{}') as property_tags,
    c.marketing_allowed,
    c.marketing_opt_out_at,
    c.last_marketing_at,
    exists (
      select 1
      from public.marketing_suppressions s
      where s.business_id = c.business_id
        and s.normalized_phone = c.whatsapp_normalized
        and s.active = true
    ) as phone_suppressed,
    row_number() over (
      partition by c.whatsapp_normalized
      order by c.id
    ) as phone_rank
  from public.customers c
  where c.business_id = p_business_id
    and c.active = true
), evaluated as (
  select
    s.*,
    case
      when s.normalized_phone is null then false
      when s.phone_suppressed then false
      when coalesce((p_filters ->> 'require_marketing_permission')::boolean, true)
        and not s.marketing_allowed then false
      when s.marketing_opt_out_at is not null then false
      when s.phone_rank > 1 then false
      when s.last_marketing_at is not null
        and s.last_marketing_at > now() - make_interval(days => coalesce((p_filters ->> 'minimum_days_since_last')::int, 21)) then false
      when jsonb_array_length(coalesce(p_filters -> 'required_property_tags', '[]'::jsonb)) > 0
        and not s.property_tags && array(select jsonb_array_elements_text(p_filters -> 'required_property_tags')) then false
      when coalesce(p_filters ->> 'suburb', '') <> ''
        and lower(s.suburb) <> lower(p_filters ->> 'suburb') then false
      else true
    end as eligible,
    case
      when s.normalized_phone is null then 'No valid WhatsApp number'
      when s.phone_suppressed then 'Phone number is suppressed'
      when coalesce((p_filters ->> 'require_marketing_permission')::boolean, true)
        and not s.marketing_allowed then 'Marketing permission not recorded'
      when s.marketing_opt_out_at is not null then 'Marketing opted out'
      when s.phone_rank > 1 then 'Duplicate number'
      when s.last_marketing_at is not null
        and s.last_marketing_at > now() - make_interval(days => coalesce((p_filters ->> 'minimum_days_since_last')::int, 21)) then 'Frequency limit reached'
      when jsonb_array_length(coalesce(p_filters -> 'required_property_tags', '[]'::jsonb)) > 0
        and not s.property_tags && array(select jsonb_array_elements_text(p_filters -> 'required_property_tags')) then 'Offer not relevant to property'
      when coalesce(p_filters ->> 'suburb', '') <> ''
        and lower(s.suburb) <> lower(p_filters ->> 'suburb') then 'Outside selected suburb'
      else null
    end as exclusion_reason
  from source s
)
select
  e.customer_id,
  e.customer_name,
  e.contact_name,
  e.normalized_phone,
  e.preferred_language,
  e.suburb,
  e.property_tags,
  e.eligible,
  e.exclusion_reason
from evaluated e
where public.tuinbooks_is_business_member(p_business_id)
order by e.eligible desc, e.customer_name;
$$;

-- ---------------------------------------------------------------------------
-- Cost model: estimated, rate-card calculated, and invoice-reconciled are kept
-- separate so reports cannot present a stale estimate as actual spend.
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_rate_cards (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  message_category text not null,
  currency text not null default 'ZAR',
  rate_per_message numeric(12,6) not null,
  effective_from date not null,
  effective_to date,
  source_name text,
  source_url text,
  created_at timestamptz not null default now(),
  unique (country_code, message_category, currency, effective_from)
);

alter table public.whatsapp_rate_cards enable row level security;
drop policy if exists whatsapp_rate_cards_read on public.whatsapp_rate_cards;
create policy whatsapp_rate_cards_read on public.whatsapp_rate_cards for select using (true);

alter table public.marketing_campaigns
  add column if not exists estimated_message_rate numeric(12,6);

create or replace view public.marketing_campaign_financial_summary as
select
  c.business_id,
  c.id as campaign_id,
  c.name,
  c.status,
  count(r.id) filter (where r.selected) as selected_recipients,
  count(r.id) filter (where r.eligibility_status in ('delivered','read','replied')) as delivered_recipients,
  count(resp.id) filter (where resp.response_type = 'accepted') as accepted_responses,
  coalesce(sum(w.accepted_value), 0) as accepted_value,
  coalesce(sum(w.completed_value), 0) as completed_value,
  coalesce(sum(w.invoice_ready_value), 0) as invoice_ready_value,
  coalesce(
    sum(coalesce(r.invoice_reconciled_cost, r.rated_message_cost, r.estimated_message_cost, r.message_cost, 0)),
    0
  ) as message_cost,
  coalesce(sum(r.estimated_message_cost), 0) as estimated_message_cost,
  coalesce(sum(r.rated_message_cost), 0) as rated_message_cost,
  coalesce(sum(r.invoice_reconciled_cost), 0) as invoice_reconciled_cost,
  coalesce(
    sum(coalesce(r.invoice_reconciled_cost, r.rated_message_cost, r.estimated_message_cost, r.message_cost, 0)),
    0
  ) as best_available_message_cost
from public.marketing_campaigns c
left join public.marketing_campaign_recipients r on r.campaign_id = c.id
left join public.marketing_responses resp on resp.campaign_recipient_id = r.id
left join public.marketing_work_links w on w.response_id = resp.id
group by c.business_id, c.id, c.name, c.status;

-- ---------------------------------------------------------------------------
-- Referential integrity for the known live customer contract. Other entity
-- links remain blocked from production until their actual table/id types are
-- mapped in the host TuinBooks schema.
-- ---------------------------------------------------------------------------

create unique index if not exists customers_business_id_id_uidx
  on public.customers (business_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_recipients_customer_fk'
  ) then
    alter table public.marketing_campaign_recipients
      add constraint campaign_recipients_customer_fk
      foreign key (business_id, customer_id)
      references public.customers (business_id, id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_messages_customer_fk'
  ) then
    alter table public.whatsapp_messages
      add constraint whatsapp_messages_customer_fk
      foreign key (business_id, customer_id)
      references public.customers (business_id, id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'marketing_responses_customer_fk'
  ) then
    alter table public.marketing_responses
      add constraint marketing_responses_customer_fk
      foreign key (business_id, customer_id)
      references public.customers (business_id, id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'marketing_work_links_customer_fk'
  ) then
    alter table public.marketing_work_links
      add constraint marketing_work_links_customer_fk
      foreign key (business_id, customer_id)
      references public.customers (business_id, id)
      on delete restrict not valid;
  end if;
end $$;

create or replace function public.tuinbooks_v2_integration_readiness()
returns table (severity text, area text, issue text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.service_sites') is null then
    return query select 'blocker', 'referential_integrity', 'service_sites table mapping is not configured';
  end if;
  if to_regclass('public.scheduled_visits') is null then
    return query select 'blocker', 'referential_integrity', 'scheduled_visits table mapping is not configured';
  end if;
  if to_regclass('public.work_records') is null then
    return query select 'blocker', 'referential_integrity', 'work_records table mapping is not configured';
  end if;
  if not exists (select 1 from public.whatsapp_rate_cards) then
    return query select 'warning', 'costing', 'No WhatsApp rate card is configured; campaign costs remain estimates';
  end if;
end;
$$;

revoke all on function public.tuinbooks_v2_integration_readiness() from public;
grant execute on function public.tuinbooks_v2_integration_readiness() to authenticated;

-- Updated-at trigger for suppression records.
drop trigger if exists set_updated_at_marketing_suppressions on public.marketing_suppressions;
create trigger set_updated_at_marketing_suppressions
before update on public.marketing_suppressions
for each row execute function public.tuinbooks_set_updated_at();

-- ---------------------------------------------------------------------------
-- v55.3 integration with the current TuinBooks snapshot and route evidence
-- ---------------------------------------------------------------------------

alter table public.service_sites add column if not exists latitude numeric(10,7);
alter table public.service_sites add column if not exists longitude numeric(10,7);

alter table public.businesses add column if not exists route_planning_fallback_km_per_visit numeric(10,2) not null default 0;
alter table public.businesses add column if not exists default_fuel_price_per_litre numeric(10,4) not null default 0;

create or replace function public.tuinbooks_sync_customer_marketing_v553()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_payload_changed boolean := true;
begin
  if tg_op = 'UPDATE' then
    v_payload_changed := new.payload is distinct from old.payload;
  end if;

  if v_payload_changed then
    -- Normal TuinBooks saves write the client payload. Reflect those fields into
    -- the structured columns used by audience queries and secured sending.
    new.active := coalesce((new.payload ->> 'active')::boolean, lower(coalesce(new.status,'')) = 'active', new.active, true);
    new.whatsapp_number := coalesce(
      nullif(new.payload ->> 'whatsappNumber',''),
      nullif(new.payload ->> 'whatsapp_number',''),
      nullif(new.whatsapp_number,''),
      nullif(new.phone,'')
    );
    new.preferred_language := coalesce(
      nullif(new.payload ->> 'preferredLanguage',''),
      nullif(new.payload ->> 'preferred_language',''),
      nullif(new.preferred_language,''),
      'en'
    );
    new.marketing_allowed := coalesce(
      (new.payload ->> 'marketingAllowed')::boolean,
      (new.payload ->> 'marketing_allowed')::boolean,
      new.marketing_allowed,
      false
    );
    new.marketing_permission_source := coalesce(
      nullif(new.payload ->> 'marketingPermissionSource',''),
      nullif(new.payload ->> 'marketing_permission_source',''),
      new.marketing_permission_source
    );
    new.marketing_permission_at := coalesce(
      nullif(new.payload ->> 'marketingPermissionAt','')::timestamptz,
      nullif(new.payload ->> 'marketing_permission_at','')::timestamptz,
      new.marketing_permission_at
    );
    new.marketing_opt_out_at := coalesce(
      nullif(new.payload ->> 'marketingOptOutAt','')::timestamptz,
      nullif(new.payload ->> 'marketing_opt_out_at','')::timestamptz,
      new.marketing_opt_out_at
    );
    new.last_marketing_at := coalesce(
      nullif(new.payload ->> 'lastMarketingAt','')::timestamptz,
      nullif(new.payload ->> 'last_marketing_at','')::timestamptz,
      new.last_marketing_at
    );
    new.visit_reports_enabled := coalesce(
      (new.payload ->> 'visitReportsEnabled')::boolean,
      (new.payload ->> 'visit_reports_enabled')::boolean,
      new.visit_reports_enabled,
      true
    );
    if jsonb_typeof(new.payload -> 'customTags') = 'array' then
      new.property_tags := array(select jsonb_array_elements_text(new.payload -> 'customTags'));
    elsif jsonb_typeof(new.payload -> 'propertyTags') = 'array' then
      new.property_tags := array(select jsonb_array_elements_text(new.payload -> 'propertyTags'));
    end if;
  else
    -- Server-side webhook and office updates write the structured columns.
    -- Reflect them back into the payload so a later operational snapshot cannot
    -- resurrect an old permission or undo an explicit WhatsApp opt-out.
    new.active := coalesce(new.active, lower(coalesce(new.status,'')) = 'active', true);
    new.whatsapp_number := coalesce(nullif(new.whatsapp_number,''), nullif(new.phone,''));
    new.preferred_language := coalesce(nullif(new.preferred_language,''), 'en');
    new.marketing_allowed := coalesce(new.marketing_allowed, false);
    new.visit_reports_enabled := coalesce(new.visit_reports_enabled, true);
    new.payload := coalesce(new.payload,'{}'::jsonb) || jsonb_build_object(
      'active', new.active,
      'whatsappNumber', coalesce(new.whatsapp_number,''),
      'preferredLanguage', new.preferred_language,
      'marketingAllowed', new.marketing_allowed,
      'marketingPermissionSource', coalesce(new.marketing_permission_source,''),
      'marketingPermissionAt', case when new.marketing_permission_at is null then '' else new.marketing_permission_at::text end,
      'marketingOptOutAt', case when new.marketing_opt_out_at is null then '' else new.marketing_opt_out_at::text end,
      'lastMarketingAt', case when new.last_marketing_at is null then '' else new.last_marketing_at::text end,
      'visitReportsEnabled', new.visit_reports_enabled,
      'customTags', to_jsonb(coalesce(new.property_tags,'{}'::text[]))
    );
  end if;
  return new;
end;
$$;
drop trigger if exists customers_sync_marketing_v553 on public.customers;
create trigger customers_sync_marketing_v553
before insert or update of payload, phone, status, whatsapp_number, preferred_language,
  marketing_allowed, marketing_permission_source, marketing_permission_at,
  marketing_opt_out_at, last_marketing_at, visit_reports_enabled
on public.customers
for each row execute function public.tuinbooks_sync_customer_marketing_v553();

-- Backfill the new columns from the authoritative payload without granting a second write path.
update public.customers set payload = payload;

-- v55.3 audience override: the secured server-side audience must apply the
-- same service, client-type, cluster and language targets shown in the app.
create or replace function public.get_marketing_audience(
  p_business_id uuid,
  p_filters jsonb default '{}'::jsonb
)
returns table (
  customer_id text,
  customer_name text,
  contact_name text,
  normalized_phone text,
  preferred_language text,
  suburb text,
  property_tags text[],
  eligible boolean,
  exclusion_reason text
)
language sql
stable
security definer
set search_path = public
as $$
with source as (
  select
    c.id::text as customer_id,
    c.name as customer_name,
    c.contact_name,
    c.whatsapp_normalized as normalized_phone,
    case
      when lower(coalesce(c.preferred_language,'')) like 'af%'
        or lower(coalesce(c.preferred_language,'')) like '%afrikaans%' then 'af'
      else 'en'
    end as preferred_language,
    coalesce(c.payload ->> 'suburb', c.payload ->> 'area', '') as suburb,
    coalesce(c.property_tags, '{}') as property_tags,
    case
      when jsonb_typeof(c.payload -> 'serviceIds') = 'array'
        then array(select jsonb_array_elements_text(c.payload -> 'serviceIds'))
      when jsonb_typeof(c.payload -> 'service_ids') = 'array'
        then array(select jsonb_array_elements_text(c.payload -> 'service_ids'))
      else '{}'::text[]
    end as service_ids,
    case
      when lower(coalesce(c.payload ->> 'clientTypeId', c.payload ->> 'customerType', '')) ~ '(private|home|residen)' then 'Residential'
      when lower(coalesce(c.payload ->> 'clientTypeId', c.payload ->> 'customerType', '')) ~ 'body corporate' then 'Body corporate'
      when lower(coalesce(c.payload ->> 'clientTypeId', c.payload ->> 'customerType', '')) ~ 'estate' then 'Estate'
      when lower(coalesce(c.payload ->> 'clientTypeId', c.payload ->> 'customerType', '')) ~ '(school|institution|church|clinic|medical)' then 'School or institution'
      when lower(coalesce(c.payload ->> 'clientTypeId', c.payload ->> 'customerType', '')) ~ '(government|municip)' then 'Government or municipal'
      when lower(coalesce(c.payload ->> 'clientTypeId', c.payload ->> 'customerType', '')) ~ '(business|commercial|office|workshop|restaurant|hotel|contractor|property manager|landlord)' then 'Business'
      when lower(coalesce(c.payload ->> 'clientTypeId', c.payload ->> 'customerType', '')) like '%not classified%' then 'Not classified'
      when coalesce(c.payload ->> 'clientTypeId', c.payload ->> 'customerType', '') <> '' then 'Other'
      else 'Not classified'
    end as client_type,
    coalesce(c.payload ->> 'clusterId', c.payload ->> 'cluster_id', '') as cluster_id,
    c.marketing_allowed,
    c.marketing_opt_out_at,
    c.last_marketing_at,
    exists (
      select 1
      from public.marketing_suppressions s
      where s.business_id = c.business_id
        and s.normalized_phone = c.whatsapp_normalized
        and s.active = true
    ) as phone_suppressed
  from public.customers c
  where c.business_id = p_business_id
    and c.active = true
), targeted as (
  select
    s.*,
    (
      coalesce(p_filters ->> 'mode','all') <> 'targeted'
      or (
        (coalesce(p_filters ->> 'serviceId','all') = 'all' or coalesce(p_filters ->> 'serviceId','') = any(s.service_ids))
        and (coalesce(p_filters ->> 'clientType','all') = 'all' or s.client_type = p_filters ->> 'clientType')
        and (coalesce(p_filters ->> 'clusterId','all') = 'all' or s.cluster_id = p_filters ->> 'clusterId')
        and (coalesce(p_filters ->> 'language','all') = 'all' or s.preferred_language = p_filters ->> 'language')
      )
    ) as target_match
  from source s
), ranked as (
  select
    t.*,
    count(*) filter (where t.target_match) over (
      partition by t.normalized_phone
      order by t.customer_id
      rows between unbounded preceding and current row
    ) as target_phone_rank
  from targeted t
), evaluated as (
  select
    r.*,
    case
      when not r.target_match then false
      when r.normalized_phone is null then false
      when r.phone_suppressed then false
      when coalesce((p_filters ->> 'require_marketing_permission')::boolean, true)
        and not r.marketing_allowed then false
      when r.marketing_opt_out_at is not null then false
      when r.target_phone_rank > 1 then false
      when r.last_marketing_at is not null
        and r.last_marketing_at > now() - make_interval(days => coalesce(
          nullif(p_filters ->> 'cooldownDays','')::int,
          nullif(p_filters ->> 'minimum_days_since_last','')::int,
          21
        )) then false
      when jsonb_array_length(coalesce(p_filters -> 'required_property_tags', '[]'::jsonb)) > 0
        and not r.property_tags && array(select jsonb_array_elements_text(p_filters -> 'required_property_tags')) then false
      when coalesce(p_filters ->> 'suburb', '') <> ''
        and lower(r.suburb) <> lower(p_filters ->> 'suburb') then false
      else true
    end as eligible,
    case
      when not r.target_match then 'Outside selected target'
      when r.normalized_phone is null then 'No valid WhatsApp number'
      when r.phone_suppressed then 'Phone number is suppressed'
      when coalesce((p_filters ->> 'require_marketing_permission')::boolean, true)
        and not r.marketing_allowed then 'Marketing permission not recorded'
      when r.marketing_opt_out_at is not null then 'Marketing opted out'
      when r.target_phone_rank > 1 then 'Duplicate number'
      when r.last_marketing_at is not null
        and r.last_marketing_at > now() - make_interval(days => coalesce(
          nullif(p_filters ->> 'cooldownDays','')::int,
          nullif(p_filters ->> 'minimum_days_since_last','')::int,
          21
        )) then 'Frequency limit reached'
      when jsonb_array_length(coalesce(p_filters -> 'required_property_tags', '[]'::jsonb)) > 0
        and not r.property_tags && array(select jsonb_array_elements_text(p_filters -> 'required_property_tags')) then 'Offer not relevant to property'
      when coalesce(p_filters ->> 'suburb', '') <> ''
        and lower(r.suburb) <> lower(p_filters ->> 'suburb') then 'Outside selected suburb'
      else null
    end as exclusion_reason
  from ranked r
)
select
  e.customer_id,
  e.customer_name,
  e.contact_name,
  e.normalized_phone,
  e.preferred_language,
  e.suburb,
  e.property_tags,
  e.eligible,
  e.exclusion_reason
from evaluated e
where public.tuinbooks_is_business_member(p_business_id)
order by e.eligible desc, e.customer_name;
$$;

create table if not exists public.team_route_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  schedule_date date not null,
  team_id text not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  planned_distance_km numeric(10,2) not null default 0,
  actual_distance_km numeric(10,2) not null default 0,
  planned_travel_minutes integer not null default 0,
  odometer_start numeric(12,1),
  odometer_end numeric(12,1),
  fuel_price_per_litre numeric(10,4) not null default 0,
  estimated_litres numeric(10,3) not null default 0,
  estimated_fuel_cost numeric(12,2) not null default 0,
  fuel_purchased_litres numeric(10,3) not null default 0,
  visit_count integer not null default 0,
  notes text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_route_logs_team_v553_fk foreign key (business_id,team_id)
    references public.teams(business_id,id) on delete cascade,
  constraint team_route_logs_odometer_v553_check check (
    odometer_start is null or odometer_end is null or odometer_end >= odometer_start
  ),
  unique (business_id,schedule_date,team_id)
);

create index if not exists team_route_logs_business_month_v553_idx
  on public.team_route_logs (business_id,schedule_date desc);

alter table public.team_route_logs enable row level security;
drop policy if exists team_route_logs_member_select_v553 on public.team_route_logs;
create policy team_route_logs_member_select_v553 on public.team_route_logs
  for select using (public.tuinbooks_is_business_member(business_id));
drop policy if exists team_route_logs_admin_insert_v553 on public.team_route_logs;
create policy team_route_logs_admin_insert_v553 on public.team_route_logs
  for insert with check (public.tuinbooks_has_business_permission(business_id,'manage_operations'));
drop policy if exists team_route_logs_admin_update_v553 on public.team_route_logs;
create policy team_route_logs_admin_update_v553 on public.team_route_logs
  for update using (public.tuinbooks_has_business_permission(business_id,'manage_operations'))
  with check (public.tuinbooks_has_business_permission(business_id,'manage_operations'));
drop policy if exists team_route_logs_admin_delete_v553 on public.team_route_logs;
create policy team_route_logs_admin_delete_v553 on public.team_route_logs
  for delete using (public.tuinbooks_has_business_permission(business_id,'manage_operations'));

-- The current role model uses owner/admin/field. Give owners/admins the explicit
-- permissions needed by the hardened marketing and mileage policies.
update public.business_members
set permissions = coalesce(permissions,'{}'::jsonb)
  || case when role in ('owner','admin') then
       '{"manage_marketing":true,"manage_operations":true,"view_financials":true}'::jsonb
     else '{}'::jsonb end
where active = true;

create or replace view public.team_route_monthly_summary_v553 as
select
  business_id,
  date_trunc('month',schedule_date)::date as month_start,
  team_id,
  count(*) as logged_team_days,
  round(sum(planned_distance_km),2) as planned_distance_km,
  round(sum(actual_distance_km),2) as actual_distance_km,
  round(sum(estimated_litres),3) as estimated_litres,
  round(sum(estimated_fuel_cost),2) as estimated_fuel_cost,
  sum(visit_count) as visit_count,
  round(sum(estimated_fuel_cost) / nullif(sum(visit_count),0),2) as fuel_cost_per_visit
from public.team_route_logs
group by business_id,date_trunc('month',schedule_date),team_id;

grant select on public.team_route_monthly_summary_v553 to authenticated;

-- Explicit grants; RLS and permission helpers still enforce the tenant boundary.
grant select,insert,update,delete on public.team_route_logs to authenticated;
grant select,insert,update,delete on public.vehicles to authenticated;
grant select on public.fuel_prices to authenticated;


commit;
