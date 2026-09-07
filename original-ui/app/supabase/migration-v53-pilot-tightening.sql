-- TuinBooks v53: pilot reliability, optimistic concurrency and API-ready billing
-- Run once after schema.sql, migration-v30-users-teams.sql and
-- migration-v42-operational-sync.sql. Safe to re-run.

begin;

alter table public.businesses
  add column if not exists core_revision bigint not null default 0;

alter table public.operational_meta
  add column if not exists revision bigint not null default 0;

alter table public.customers
  add column if not exists external_accounting_id text not null default '';

alter table public.invoices
  add column if not exists billing_batch_id text not null default '',
  add column if not exists external_invoice_id text not null default '',
  add column if not exists external_invoice_number text not null default '',
  add column if not exists sync_status text not null default 'not-connected',
  add column if not exists sync_error text not null default '',
  add column if not exists last_synced_at timestamptz;

-- Refuse to hide pre-existing billing duplicates. If either check fails, resolve
-- the reported rows before applying this migration again.
do $$
begin
  if exists (
    select 1 from public.invoices
    where status <> 'Credited'
    group by business_id,client_id,invoice_month having count(*) > 1
  ) then
    raise exception 'V53_INVOICE_DUPLICATE: more than one active invoice exists for a client and month';
  end if;
  if exists (
    select 1 from public.invoices
    where invoice_number <> 'Draft' and status <> 'Credited'
    group by business_id,invoice_number having count(*) > 1
  ) then
    raise exception 'V53_INVOICE_NUMBER_DUPLICATE: an invoice number is already used more than once';
  end if;
end $$;

create unique index if not exists invoices_one_active_client_month_v53
  on public.invoices(business_id,client_id,invoice_month)
  where status <> 'Credited';

create unique index if not exists invoices_number_unique_v53
  on public.invoices(business_id,invoice_number)
  where invoice_number <> 'Draft' and status <> 'Credited';

create unique index if not exists invoices_billing_batch_unique_v53
  on public.invoices(business_id,billing_batch_id)
  where billing_batch_id <> '';

create unique index if not exists schedule_jobs_recurrence_unique_v53
  on public.schedule_jobs(business_id,(payload->>'recurrenceKey'))
  where nullif(payload->>'recurrenceKey','') is not null
    and status not in ('cancelled','missed','deferred');

-- The v28 snapshot implementation remains the single write implementation.
-- This checked wrapper locks the business revision before invoking it, so an
-- older browser cannot overwrite a newer core-data snapshot.
create or replace function public.save_core_snapshot_v53(
  p_business_id uuid,
  p_business jsonb,
  p_teams jsonb,
  p_clusters jsonb,
  p_customers jsonb,
  p_sites jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision bigint;
  v_saved_at timestamptz;
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  select core_revision into v_revision
  from public.businesses
  where id=p_business_id
  for update;

  if not found then raise exception 'Business not found'; end if;
  if coalesce(p_expected_revision,-1) <> v_revision then
    raise exception using
      errcode='40001',
      message=format('CORE_CONFLICT expected %s current %s',p_expected_revision,v_revision);
  end if;

  v_saved_at := public.save_core_snapshot(
    p_business_id,p_business,p_teams,p_clusters,p_customers,p_sites
  );

  update public.customers
  set external_accounting_id=coalesce(payload->>'externalAccountingId','')
  where business_id=p_business_id;

  update public.businesses
  set core_revision=v_revision+1
  where id=p_business_id;

  return jsonb_build_object('saved_at',v_saved_at,'revision',v_revision+1);
end;
$$;

revoke all on function public.save_core_snapshot(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) from public,authenticated;
revoke all on function public.save_core_snapshot_v53(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,bigint) from public;
grant execute on function public.save_core_snapshot_v53(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,bigint) to authenticated;

-- The v42 writer protects completed work from deletion. This wrapper adds a
-- locked revision check around that writer and returns the new revision.
create or replace function public.save_operational_snapshot_v53(
  p_business_id uuid,
  p_schedules jsonb,
  p_work_records jsonb,
  p_opportunities jsonb,
  p_quotes jsonb,
  p_invoices jsonb,
  p_client_reports jsonb,
  p_meta jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision bigint;
  v_saved_at timestamptz;
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  insert into public.operational_meta(business_id,payload,updated_by,revision)
  values(p_business_id,'{}'::jsonb,auth.uid(),0)
  on conflict (business_id) do nothing;

  select revision into v_revision
  from public.operational_meta
  where business_id=p_business_id
  for update;

  if coalesce(p_expected_revision,-1) <> v_revision then
    raise exception using
      errcode='40001',
      message=format('OPERATIONS_CONFLICT expected %s current %s',p_expected_revision,v_revision);
  end if;

  v_saved_at := public.save_operational_snapshot(
    p_business_id,p_schedules,p_work_records,p_opportunities,p_quotes,
    p_invoices,p_client_reports,p_meta
  );

  update public.invoices
  set billing_batch_id=coalesce(payload->>'billingBatchId',''),
      external_invoice_id=coalesce(payload->>'externalInvoiceId',''),
      external_invoice_number=coalesce(payload->>'externalInvoiceNumber',''),
      sync_status=coalesce(nullif(payload->>'syncStatus',''),'not-connected'),
      sync_error=coalesce(payload->>'syncError',''),
      last_synced_at=nullif(payload->>'lastSyncedAt','')::timestamptz
  where business_id=p_business_id;

  update public.operational_meta
  set revision=v_revision+1
  where business_id=p_business_id;

  return jsonb_build_object('saved_at',v_saved_at,'revision',v_revision+1);
end;
$$;

revoke all on function public.save_operational_snapshot(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,authenticated;
revoke all on function public.save_operational_snapshot_v53(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,bigint) from public;
grant execute on function public.save_operational_snapshot_v53(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,bigint) to authenticated;

-- Retry-safe photo attachment. Completion is recorded before uploads; a failed
-- upload can therefore retry without creating another work record.
create or replace function public.set_work_record_photos_v53(
  p_business_id uuid,
  p_work_record_id text,
  p_photo_paths text[]
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.work_records%rowtype;
begin
  select * into v_record
  from public.work_records
  where business_id=p_business_id and id=p_work_record_id
  for update;

  if not found then raise exception 'Work record not found'; end if;
  if not public.is_assigned_to_business_team(p_business_id,v_record.team_id) then
    raise exception 'This work record is not assigned to your team';
  end if;

  if cardinality(v_record.photo_paths)>0 and v_record.photo_paths<>coalesce(p_photo_paths,'{}') then
    raise exception 'Work record photos were already attached';
  end if;

  update public.work_records
  set photo_paths=coalesce(p_photo_paths,'{}'),
      payload=payload || jsonb_build_object('photoPaths',to_jsonb(coalesce(p_photo_paths,'{}'::text[])),'syncStatus','synced'),
      updated_at=now()
  where business_id=p_business_id and id=p_work_record_id;

  return p_work_record_id;
end;
$$;

revoke all on function public.set_work_record_photos_v53(uuid,text,text[]) from public;
grant execute on function public.set_work_record_photos_v53(uuid,text,text[]) to authenticated;

-- Field-created clients increment the core revision so a stale office snapshot
-- cannot immediately delete the new record.
create or replace function public.create_field_client_v53(
  p_business_id uuid,
  p_customer jsonb,
  p_site jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  v_id := public.create_field_client(p_business_id,p_customer,p_site);
  update public.businesses
  set core_revision=core_revision+1
  where id=p_business_id;
  return v_id;
end;
$$;

revoke all on function public.create_field_client_v53(uuid,jsonb,jsonb) from public;
grant execute on function public.create_field_client_v53(uuid,jsonb,jsonb) to authenticated;
revoke execute on function public.create_field_client(uuid,jsonb,jsonb) from authenticated;

-- One-time, office-generated pairing codes for anonymous field-phone sessions.
-- Only a bcrypt hash is stored; codes expire and can be claimed once.
create table if not exists public.mobile_access_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_id text not null,
  device_name text not null default '',
  code_hash text not null,
  expires_at timestamptz not null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint mobile_access_codes_team_fk foreign key (business_id,team_id)
    references public.teams(business_id,id) on delete cascade
);

create index if not exists mobile_access_codes_open_v53
  on public.mobile_access_codes(expires_at,created_at desc)
  where claimed_at is null and revoked_at is null;

alter table public.mobile_access_codes enable row level security;
revoke all on public.mobile_access_codes from anon,authenticated;

create or replace function public.create_mobile_access_code(
  p_business_id uuid,
  p_team_id text,
  p_device_name text
)
returns table(access_code text,expires_at timestamptz,team_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_expires timestamptz := now()+interval '15 minutes';
  v_team_name text;
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  select name into v_team_name
  from public.teams
  where business_id=p_business_id and id=p_team_id and active=true;
  if not found then raise exception 'Choose an active team'; end if;
  if nullif(trim(coalesce(p_device_name,'')),'') is null then
    raise exception 'Give this phone a name';
  end if;

  update public.mobile_access_codes
  set revoked_at=now()
  where business_id=p_business_id and team_id=p_team_id
    and device_name=trim(p_device_name)
    and claimed_at is null and revoked_at is null;

  v_code:=lpad(floor(random()*1000000)::integer::text,6,'0');
  insert into public.mobile_access_codes(
    business_id,team_id,device_name,code_hash,expires_at,created_by
  ) values (
    p_business_id,p_team_id,trim(p_device_name),crypt(v_code,gen_salt('bf',8)),v_expires,auth.uid()
  );

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'field_device',p_team_id,'mobile_pairing_code_created',jsonb_build_object('device_name',trim(p_device_name),'expires_at',v_expires));

  return query select v_code,v_expires,v_team_name;
end;
$$;

revoke all on function public.create_mobile_access_code(uuid,text,text) from public;
grant execute on function public.create_mobile_access_code(uuid,text,text) to authenticated;

create or replace function public.claim_mobile_access_code(
  p_code text,
  p_device_name text default ''
)
returns table(business_id uuid,team_id text,team_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.mobile_access_codes%rowtype;
  v_team_name text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(p_code,'') !~ '^[0-9]{6}$' then raise exception 'Enter a valid six-digit code'; end if;

  select row_value.* into v_code
  from public.mobile_access_codes row_value
  where row_value.claimed_at is null
    and row_value.revoked_at is null
    and row_value.expires_at>now()
    and crypt(p_code,row_value.code_hash)=row_value.code_hash
  order by row_value.created_at desc
  limit 1
  for update skip locked;

  if not found then raise exception 'This code is invalid, expired or already used'; end if;
  if exists (
    select 1 from public.business_members member
    where member.user_id=auth.uid() and member.active=true
      and member.business_id<>v_code.business_id
  ) then raise exception 'This phone session already belongs to another business'; end if;

  select name into v_team_name from public.teams
  where business_id=v_code.business_id and id=v_code.team_id and active=true;
  if not found then raise exception 'The assigned team is no longer active'; end if;

  v_name:=coalesce(nullif(trim(p_device_name),''),v_code.device_name,'Field phone');
  insert into public.business_members(business_id,user_id,role,display_name,active)
  values(v_code.business_id,auth.uid(),'field',v_name,true)
  on conflict (business_id,user_id) do update set
    role='field',display_name=excluded.display_name,active=true,updated_at=now();

  update public.team_assignments
  set active=false,is_primary=false,updated_at=now()
  where business_id=v_code.business_id and user_id=auth.uid();

  insert into public.team_assignments(business_id,user_id,team_id,is_primary,active)
  values(v_code.business_id,auth.uid(),v_code.team_id,true,true)
  on conflict (business_id,user_id,team_id) do update set
    is_primary=true,active=true,updated_at=now();

  update public.mobile_access_codes
  set claimed_by=auth.uid(),claimed_at=now()
  where id=v_code.id;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(v_code.business_id,auth.uid(),'field_device',v_code.id::text,'mobile_phone_paired',jsonb_build_object('team_id',v_code.team_id,'device_name',v_name));

  return query select v_code.business_id,v_code.team_id,v_team_name;
end;
$$;

revoke all on function public.claim_mobile_access_code(text,text) from public;
grant execute on function public.claim_mobile_access_code(text,text) to authenticated;

notify pgrst, 'reload schema';

commit;
