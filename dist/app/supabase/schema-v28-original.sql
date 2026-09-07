-- TuinBooks Supabase foundation v28
-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- It creates authentication-linked businesses, memberships, teams, clusters,
-- customers and service sites with Row Level Security.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  onboarding_complete boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'field' check (role in ('owner','admin','field')),
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create unique index if not exists business_members_one_active_business_per_user
  on public.business_members(user_id)
  where active = true;

create table if not exists public.teams (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  name text not null,
  leader_name text not null default '',
  capacity_hours numeric(8,2) not null default 8,
  buffer_hours numeric(8,2) not null default 1,
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, id)
);

create table if not exists public.clusters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  name text not null,
  color text not null default '#2e8b68',
  suburbs text[] not null default '{}',
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, id)
);

create table if not exists public.customers (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  name text not null,
  customer_type text not null default 'Private homeowner',
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  billing_address text not null default '',
  status text not null default 'active' check (status in ('active','paused','archived')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, id)
);

create table if not exists public.service_sites (
  business_id uuid not null,
  id text not null,
  customer_id text not null,
  site_name text not null default '',
  address text not null default '',
  suburb text not null default '',
  cluster_id text,
  access_notes text not null default '',
  pet_notes text not null default '',
  instructions text not null default '',
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, id),
  constraint service_sites_customer_fk
    foreign key (business_id, customer_id)
    references public.customers(business_id, id)
    on delete cascade
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text not null default '',
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Updated-at triggers

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();

drop trigger if exists business_members_set_updated_at on public.business_members;
create trigger business_members_set_updated_at before update on public.business_members
for each row execute function public.set_updated_at();

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists clusters_set_updated_at on public.clusters;
create trigger clusters_set_updated_at before update on public.clusters
for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists service_sites_set_updated_at on public.service_sites;
create trigger service_sites_set_updated_at before update on public.service_sites
for each row execute function public.set_updated_at();

-- Security helper functions. These are SECURITY DEFINER so policies can safely
-- check membership without recursively querying an RLS-protected table.

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.active = true
  );
$$;

create or replace function public.is_business_admin(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.active = true
      and bm.role in ('owner','admin')
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
revoke all on function public.is_business_admin(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_admin(uuid) to authenticated;

-- First workspace creation. One authenticated user gets one active business in
-- this MVP. The function creates the business, owner membership, first team and
-- first service area in one transaction.

create or replace function public.create_business_workspace(
  p_business jsonb,
  p_team jsonb,
  p_cluster jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business_id uuid;
  v_existing uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select business_id into v_existing
  from public.business_members
  where user_id = v_user and active = true
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.businesses (
    name, phone, email, address, onboarding_complete, settings, created_by
  ) values (
    coalesce(nullif(trim(p_business->>'name'), ''), 'TuinBooks business'),
    coalesce(p_business->>'phone', ''),
    coalesce(p_business->>'email', ''),
    coalesce(p_business->>'address', ''),
    true,
    coalesce(p_business->'settings', '{}'::jsonb),
    v_user
  ) returning id into v_business_id;

  insert into public.business_members (
    business_id, user_id, role, display_name, active
  ) values (
    v_business_id,
    v_user,
    'owner',
    coalesce(p_business->>'display_name', ''),
    true
  );

  insert into public.clusters (
    business_id, id, name, color, suburbs, active, payload
  ) values (
    v_business_id,
    coalesce(nullif(p_cluster->>'id',''), 'cluster-1'),
    coalesce(nullif(p_cluster->>'name',''), 'First service area'),
    coalesce(nullif(p_cluster->>'color',''), '#2e8b68'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_cluster->'suburbs','[]'::jsonb))), '{}'),
    coalesce((p_cluster->>'active')::boolean, true),
    coalesce(p_cluster->'payload', p_cluster, '{}'::jsonb)
  );

  insert into public.teams (
    business_id, id, name, leader_name, capacity_hours, buffer_hours, active, payload
  ) values (
    v_business_id,
    coalesce(nullif(p_team->>'id',''), 'team-1'),
    coalesce(nullif(p_team->>'name',''), 'Team 1'),
    coalesce(p_team->>'leader_name', ''),
    coalesce((p_team->>'capacity_hours')::numeric, 8),
    coalesce((p_team->>'buffer_hours')::numeric, 1),
    coalesce((p_team->>'active')::boolean, true),
    coalesce(p_team->'payload', p_team, '{}'::jsonb)
  );

  insert into public.audit_events (
    business_id, actor_user_id, entity_type, entity_id, action, details
  ) values (
    v_business_id, v_user, 'business', v_business_id::text,
    'workspace_created', jsonb_build_object('source','onboarding')
  );

  return v_business_id;
end;
$$;

revoke all on function public.create_business_workspace(jsonb,jsonb,jsonb) from public;
grant execute on function public.create_business_workspace(jsonb,jsonb,jsonb) to authenticated;

-- Save the current core-data snapshot. This keeps the existing frontend simple
-- while making business details, teams, clusters, customers and sites persistent.
-- Scheduling, field records, quotes and invoices are connected in the next phase.

create or replace function public.save_core_snapshot(
  p_business_id uuid,
  p_business jsonb,
  p_teams jsonb,
  p_clusters jsonb,
  p_customers jsonb,
  p_sites jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved_at timestamptz := now();
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  update public.businesses
  set name = coalesce(nullif(trim(p_business->>'name'), ''), name),
      phone = coalesce(p_business->>'phone', ''),
      email = coalesce(p_business->>'email', ''),
      address = coalesce(p_business->>'address', ''),
      onboarding_complete = coalesce((p_business->>'onboarding_complete')::boolean, onboarding_complete),
      settings = coalesce(p_business->'settings', settings),
      updated_at = v_saved_at
  where id = p_business_id;

  delete from public.service_sites s
  where s.business_id = p_business_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_sites, '[]'::jsonb)) x
      where x->>'id' = s.id
    );

  delete from public.customers c
  where c.business_id = p_business_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_customers, '[]'::jsonb)) x
      where x->>'id' = c.id
    );

  delete from public.teams t
  where t.business_id = p_business_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_teams, '[]'::jsonb)) x
      where x->>'id' = t.id
    );

  delete from public.clusters c
  where c.business_id = p_business_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_clusters, '[]'::jsonb)) x
      where x->>'id' = c.id
    );

  insert into public.clusters (business_id,id,name,color,suburbs,active,payload,updated_at)
  select
    p_business_id,
    x->>'id',
    coalesce(nullif(x->>'name',''), 'Service area'),
    coalesce(nullif(x->>'color',''), '#2e8b68'),
    coalesce(array(select jsonb_array_elements_text(coalesce(x->'suburbs','[]'::jsonb))), '{}'),
    coalesce((x->>'active')::boolean, true),
    coalesce(x->'payload', '{}'::jsonb),
    v_saved_at
  from jsonb_array_elements(coalesce(p_clusters, '[]'::jsonb)) x
  where nullif(x->>'id','') is not null
  on conflict (business_id,id) do update set
    name=excluded.name, color=excluded.color, suburbs=excluded.suburbs,
    active=excluded.active, payload=excluded.payload, updated_at=v_saved_at;

  insert into public.teams (business_id,id,name,leader_name,capacity_hours,buffer_hours,active,payload,updated_at)
  select
    p_business_id,
    x->>'id',
    coalesce(nullif(x->>'name',''), 'Team'),
    coalesce(x->>'leader_name',''),
    coalesce((x->>'capacity_hours')::numeric,8),
    coalesce((x->>'buffer_hours')::numeric,1),
    coalesce((x->>'active')::boolean,true),
    coalesce(x->'payload','{}'::jsonb),
    v_saved_at
  from jsonb_array_elements(coalesce(p_teams, '[]'::jsonb)) x
  where nullif(x->>'id','') is not null
  on conflict (business_id,id) do update set
    name=excluded.name, leader_name=excluded.leader_name,
    capacity_hours=excluded.capacity_hours, buffer_hours=excluded.buffer_hours,
    active=excluded.active, payload=excluded.payload, updated_at=v_saved_at;

  insert into public.customers (
    business_id,id,name,customer_type,contact_name,email,phone,billing_address,status,payload,updated_at
  )
  select
    p_business_id,
    x->>'id',
    coalesce(nullif(x->>'name',''), 'Client'),
    coalesce(nullif(x->>'customer_type',''), 'Private homeowner'),
    coalesce(x->>'contact_name',''),
    coalesce(x->>'email',''),
    coalesce(x->>'phone',''),
    coalesce(x->>'billing_address',''),
    coalesce(nullif(x->>'status',''),'active'),
    coalesce(x->'payload','{}'::jsonb),
    v_saved_at
  from jsonb_array_elements(coalesce(p_customers, '[]'::jsonb)) x
  where nullif(x->>'id','') is not null
  on conflict (business_id,id) do update set
    name=excluded.name, customer_type=excluded.customer_type,
    contact_name=excluded.contact_name, email=excluded.email, phone=excluded.phone,
    billing_address=excluded.billing_address, status=excluded.status,
    payload=excluded.payload, updated_at=v_saved_at;

  insert into public.service_sites (
    business_id,id,customer_id,site_name,address,suburb,cluster_id,
    access_notes,pet_notes,instructions,active,payload,updated_at
  )
  select
    p_business_id,
    x->>'id',
    x->>'customer_id',
    coalesce(x->>'site_name',''),
    coalesce(x->>'address',''),
    coalesce(x->>'suburb',''),
    nullif(x->>'cluster_id',''),
    coalesce(x->>'access_notes',''),
    coalesce(x->>'pet_notes',''),
    coalesce(x->>'instructions',''),
    coalesce((x->>'active')::boolean,true),
    coalesce(x->'payload','{}'::jsonb),
    v_saved_at
  from jsonb_array_elements(coalesce(p_sites, '[]'::jsonb)) x
  where nullif(x->>'id','') is not null
    and nullif(x->>'customer_id','') is not null
  on conflict (business_id,id) do update set
    customer_id=excluded.customer_id, site_name=excluded.site_name,
    address=excluded.address, suburb=excluded.suburb, cluster_id=excluded.cluster_id,
    access_notes=excluded.access_notes, pet_notes=excluded.pet_notes,
    instructions=excluded.instructions, active=excluded.active,
    payload=excluded.payload, updated_at=v_saved_at;

  insert into public.audit_events (
    business_id, actor_user_id, entity_type, entity_id, action, details
  ) values (
    p_business_id, auth.uid(), 'workspace', p_business_id::text,
    'core_snapshot_saved',
    jsonb_build_object(
      'teams', jsonb_array_length(coalesce(p_teams,'[]'::jsonb)),
      'clusters', jsonb_array_length(coalesce(p_clusters,'[]'::jsonb)),
      'customers', jsonb_array_length(coalesce(p_customers,'[]'::jsonb)),
      'sites', jsonb_array_length(coalesce(p_sites,'[]'::jsonb))
    )
  );

  return v_saved_at;
end;
$$;

revoke all on function public.save_core_snapshot(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_core_snapshot(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.reset_business_workspace(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  delete from public.service_sites where business_id = p_business_id;
  delete from public.customers where business_id = p_business_id;
  delete from public.teams where business_id = p_business_id;
  delete from public.clusters where business_id = p_business_id;

  update public.businesses
  set onboarding_complete = false,
      name = 'TuinBooks business',
      phone = '', email = '', address = '', settings = '{}'::jsonb
  where id = p_business_id;

  insert into public.audit_events (
    business_id, actor_user_id, entity_type, entity_id, action, details
  ) values (
    p_business_id, auth.uid(), 'workspace', p_business_id::text,
    'workspace_reset', '{}'::jsonb
  );
end;
$$;

revoke all on function public.reset_business_workspace(uuid) from public;
grant execute on function public.reset_business_workspace(uuid) to authenticated;

-- Row Level Security

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.teams enable row level security;
alter table public.clusters enable row level security;
alter table public.customers enable row level security;
alter table public.service_sites enable row level security;
alter table public.audit_events enable row level security;

-- Recreate policies safely.

drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member on public.businesses
for select to authenticated
using (public.is_business_member(id));

drop policy if exists businesses_update_admin on public.businesses;
create policy businesses_update_admin on public.businesses
for update to authenticated
using (public.is_business_admin(id))
with check (public.is_business_admin(id));

drop policy if exists members_select_same_business on public.business_members;
create policy members_select_same_business on public.business_members
for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists members_admin_all on public.business_members;
create policy members_admin_all on public.business_members
for all to authenticated
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists teams_select_member on public.teams;
create policy teams_select_member on public.teams
for select to authenticated using (public.is_business_member(business_id));

drop policy if exists teams_admin_all on public.teams;
create policy teams_admin_all on public.teams
for all to authenticated
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists clusters_select_member on public.clusters;
create policy clusters_select_member on public.clusters
for select to authenticated using (public.is_business_member(business_id));

drop policy if exists clusters_admin_all on public.clusters;
create policy clusters_admin_all on public.clusters
for all to authenticated
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists customers_select_member on public.customers;
create policy customers_select_member on public.customers
for select to authenticated using (public.is_business_member(business_id));

drop policy if exists customers_admin_all on public.customers;
create policy customers_admin_all on public.customers
for all to authenticated
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists sites_select_member on public.service_sites;
create policy sites_select_member on public.service_sites
for select to authenticated using (public.is_business_member(business_id));

drop policy if exists sites_admin_all on public.service_sites;
create policy sites_admin_all on public.service_sites
for all to authenticated
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists audit_select_admin on public.audit_events;
create policy audit_select_admin on public.audit_events
for select to authenticated using (public.is_business_admin(business_id));

drop policy if exists audit_insert_member on public.audit_events;
create policy audit_insert_member on public.audit_events
for insert to authenticated with check (
  public.is_business_member(business_id) and actor_user_id = auth.uid()
);

-- Explicit table privileges for the Data API.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, update, delete on public.business_members to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.clusters to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.service_sites to authenticated;
grant select, insert on public.audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;
