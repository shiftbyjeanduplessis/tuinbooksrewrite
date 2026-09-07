-- TuinBooks v54: blocker repairs for billing, field security and reliable sync.
-- Apply after migration-v53-pilot-tightening.sql.

begin;

-- A client can legitimately receive a supplemental invoice when work arrives
-- after the month's first invoice was sent.
drop index if exists public.invoices_one_active_client_month_v53;
create index if not exists invoices_client_month_lookup_v54
  on public.invoices(business_id,client_id,invoice_month,updated_at desc);

-- Credit notes are accounting documents too: their numbers and idempotency
-- keys must be distinct from the source invoice.
drop index if exists public.invoices_number_unique_v53;
create unique index if not exists invoices_number_unique_v54
  on public.invoices(business_id,invoice_number)
  where invoice_number <> 'Draft';

drop index if exists public.invoices_billing_batch_unique_v53;
update public.invoices
set billing_batch_id='TB-CN-'||id,
    payload=payload||jsonb_build_object('billingBatchId','TB-CN-'||id)
where (status='Credited' or payload->>'transactionType'='Credit Note')
  and (billing_batch_id='' or exists (
    select 1 from public.invoices source
    where source.business_id=invoices.business_id
      and source.id<>invoices.id
      and source.billing_batch_id=invoices.billing_batch_id
  ));
create unique index if not exists invoices_billing_batch_unique_v54
  on public.invoices(business_id,billing_batch_id)
  where billing_batch_id <> '';

-- Invoice numbers are reserved while both the business and invoice rows are
-- locked. Browser tabs therefore cannot issue the same number.
create or replace function public.reserve_invoice_number_v54(
  p_business_id uuid,
  p_invoice_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_business public.businesses%rowtype;
  v_meta_revision bigint;
  v_settings jsonb;
  v_prefix text;
  v_next bigint;
  v_number text;
  v_credit boolean;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;

  select * into v_invoice from public.invoices
  where business_id=p_business_id and id=p_invoice_id for update;
  if not found then raise exception 'Invoice must be saved before its number is reserved'; end if;

  insert into public.operational_meta(business_id,payload,updated_by,revision)
  values(p_business_id,'{}'::jsonb,auth.uid(),0)
  on conflict (business_id) do nothing;
  select revision into v_meta_revision from public.operational_meta
  where business_id=p_business_id for update;

  select * into v_business from public.businesses where id=p_business_id for update;
  if not found then raise exception 'Business not found'; end if;

  if v_invoice.invoice_number<>'Draft' then
    return jsonb_build_object('invoice_number',v_invoice.invoice_number,
      'next_invoice',coalesce((v_business.settings->>'nextInvoice')::bigint,1),
      'core_revision',v_business.core_revision,'operational_revision',v_meta_revision);
  end if;

  v_settings:=coalesce(v_business.settings,'{}'::jsonb);
  v_prefix:=coalesce(nullif(trim(v_settings->>'invoicePrefix'),''),'INV');
  v_next:=greatest(1,coalesce(nullif(v_settings->>'nextInvoice','')::bigint,1));
  v_credit:=v_invoice.status='Credited' or v_invoice.payload->>'transactionType'='Credit Note';
  loop
    v_number:=v_prefix||case when v_credit then '-CN-' else '-' end||lpad(v_next::text,5,'0');
    exit when not exists (
      select 1 from public.invoices
      where business_id=p_business_id and invoice_number=v_number
    );
    v_next:=v_next+1;
  end loop;

  update public.businesses
  set settings=v_settings||jsonb_build_object('nextInvoice',v_next+1),
      core_revision=core_revision+1,updated_at=now()
  where id=p_business_id;

  update public.invoices
  set invoice_number=v_number,payload=payload||jsonb_build_object('number',v_number),
      updated_at=now()
  where business_id=p_business_id and id=p_invoice_id;

  update public.operational_meta set revision=revision+1,updated_by=auth.uid(),updated_at=now()
  where business_id=p_business_id;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'invoice',p_invoice_id,'invoice_number_reserved',jsonb_build_object('invoice_number',v_number));

  return jsonb_build_object('invoice_number',v_number,'next_invoice',v_next+1,
    'core_revision',v_business.core_revision+1,'operational_revision',v_meta_revision+1);
end;
$$;
revoke all on function public.reserve_invoice_number_v54(uuid,text) from public;
grant execute on function public.reserve_invoice_number_v54(uuid,text) to authenticated;

-- Pairing uses an indexed lookup hash, a high-entropy one-time code and a
-- per-account attempt window. Existing owner/admin memberships are immutable.
alter table public.mobile_access_codes
  add column if not exists revoked_at timestamptz,
  add column if not exists code_lookup_hash bytea;
update public.mobile_access_codes set revoked_at=coalesce(revoked_at,now())
where claimed_at is null;
create unique index if not exists mobile_access_codes_lookup_v54
  on public.mobile_access_codes(code_lookup_hash)
  where claimed_at is null and revoked_at is null;

create table if not exists public.mobile_pairing_attempts_v54 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.mobile_pairing_attempts_v54 enable row level security;
revoke all on public.mobile_pairing_attempts_v54 from anon,authenticated;

create or replace function public.create_mobile_access_code(
  p_business_id uuid,p_team_id text,p_device_name text
)
returns table(access_code text,expires_at timestamptz,team_name text)
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_code text;
  v_expires timestamptz:=now()+interval '15 minutes';
  v_team_name text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select name into v_team_name from public.teams
  where business_id=p_business_id and id=p_team_id and active=true;
  if not found then raise exception 'Choose an active team'; end if;
  if nullif(trim(coalesce(p_device_name,'')),'') is null then raise exception 'Give this phone a name'; end if;

  update public.mobile_access_codes set revoked_at=now()
  where business_id=p_business_id and team_id=p_team_id
    and device_name=trim(p_device_name) and claimed_at is null and revoked_at is null;

  loop
    v_code:=upper(encode(gen_random_bytes(5),'hex'));
    exit when not exists (
      select 1 from public.mobile_access_codes
      where code_lookup_hash=digest(v_code,'sha256') and claimed_at is null and revoked_at is null
    );
  end loop;

  insert into public.mobile_access_codes(
    business_id,team_id,device_name,code_hash,code_lookup_hash,expires_at,created_by
  ) values (
    p_business_id,p_team_id,trim(p_device_name),crypt(v_code,gen_salt('bf',10)),
    digest(v_code,'sha256'),v_expires,auth.uid()
  );
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'field_device',p_team_id,'mobile_pairing_code_created',jsonb_build_object('device_name',trim(p_device_name),'expires_at',v_expires));
  return query select v_code,v_expires,v_team_name;
end;
$$;
revoke all on function public.create_mobile_access_code(uuid,text,text) from public;
grant execute on function public.create_mobile_access_code(uuid,text,text) to authenticated;

create or replace function public.claim_mobile_access_code(
  p_code text,p_device_name text default ''
)
returns table(business_id uuid,team_id text,team_name text)
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_code public.mobile_access_codes%rowtype;
  v_team_name text;
  v_name text;
  v_normalized text:=upper(trim(coalesce(p_code,'')));
  v_attempts integer;
  v_existing_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.mobile_pairing_attempts_v54(user_id,window_started_at,attempts,updated_at)
  values(auth.uid(),now(),1,now())
  on conflict(user_id) do update set
    attempts=case when mobile_pairing_attempts_v54.window_started_at<now()-interval '15 minutes' then 1 else mobile_pairing_attempts_v54.attempts+1 end,
    window_started_at=case when mobile_pairing_attempts_v54.window_started_at<now()-interval '15 minutes' then now() else mobile_pairing_attempts_v54.window_started_at end,
    updated_at=now()
  returning attempts into v_attempts;
  if v_attempts>10 or v_normalized!~'^[A-F0-9]{10}$' then return; end if;

  select row_value.* into v_code from public.mobile_access_codes row_value
  where row_value.code_lookup_hash=digest(v_normalized,'sha256')
    and row_value.claimed_at is null and row_value.revoked_at is null
    and row_value.expires_at>now()
  limit 1 for update skip locked;
  if not found or crypt(v_normalized,v_code.code_hash)<>v_code.code_hash then return; end if;

  select role into v_existing_role from public.business_members
  where business_id=v_code.business_id and user_id=auth.uid() and active=true;
  if v_existing_role in ('owner','admin') then raise exception 'Existing owner or admin access cannot be paired as a field phone'; end if;
  if exists(select 1 from public.business_members where user_id=auth.uid() and active=true and business_id<>v_code.business_id)
    then raise exception 'This phone session already belongs to another business'; end if;
  select name into v_team_name from public.teams
  where business_id=v_code.business_id and id=v_code.team_id and active=true;
  if not found then raise exception 'The assigned team is no longer active'; end if;

  v_name:=coalesce(nullif(trim(p_device_name),''),v_code.device_name,'Field phone');
  insert into public.business_members(business_id,user_id,role,display_name,active)
  values(v_code.business_id,auth.uid(),'field',v_name,true)
  on conflict(business_id,user_id) do update set display_name=excluded.display_name,active=true,updated_at=now()
  where business_members.role='field';
  if not exists(select 1 from public.business_members where business_id=v_code.business_id and user_id=auth.uid() and role='field' and active=true)
    then raise exception 'Existing account role cannot be changed by pairing'; end if;

  update public.team_assignments set active=false,is_primary=false,updated_at=now()
  where business_id=v_code.business_id and user_id=auth.uid();
  insert into public.team_assignments(business_id,user_id,team_id,is_primary,active)
  values(v_code.business_id,auth.uid(),v_code.team_id,true,true)
  on conflict(business_id,user_id,team_id) do update set is_primary=true,active=true,updated_at=now();
  update public.mobile_access_codes set claimed_by=auth.uid(),claimed_at=now() where id=v_code.id;
  delete from public.mobile_pairing_attempts_v54 where user_id=auth.uid();
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(v_code.business_id,auth.uid(),'field_device',v_code.id::text,'mobile_phone_paired',jsonb_build_object('team_id',v_code.team_id,'device_name',v_name));
  return query select v_code.business_id,v_code.team_id,v_team_name;
end;
$$;
revoke all on function public.claim_mobile_access_code(text,text) from public;
grant execute on function public.claim_mobile_access_code(text,text) to authenticated;

-- Field writes advance the operational revision. A desktop browser holding an
-- older snapshot can then detect the change instead of deleting field work.
create or replace function public.touch_operational_revision_v54(p_business_id uuid)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare v_revision bigint;
begin
  insert into public.operational_meta(business_id,payload,updated_by,revision)
  values(p_business_id,'{}'::jsonb,auth.uid(),0) on conflict(business_id) do nothing;
  update public.operational_meta set revision=revision+1,updated_by=auth.uid(),updated_at=now()
  where business_id=p_business_id returning revision into v_revision;
  return v_revision;
end;
$$;
revoke all on function public.touch_operational_revision_v54(uuid) from public,authenticated;

create or replace function public.complete_schedule_job_v54(
  p_business_id uuid,p_schedule_id text,p_work_record jsonb
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_job public.schedule_jobs%rowtype;
  v_existing text;
  v_record_id text:=p_work_record->>'id';
  v_outcome text:=coalesce(nullif(p_work_record->>'outcome',''),'Completed');
  v_schedule_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_outcome not in ('Completed','Partially completed','Access failed','Weather delay','Unable to complete') then raise exception 'Invalid visit outcome'; end if;
  select * into v_job from public.schedule_jobs
  where business_id=p_business_id and id=p_schedule_id for update;
  if not found then raise exception 'Scheduled job not found'; end if;
  if not public.is_assigned_to_business_team(p_business_id,v_job.team_id) then raise exception 'This job is not assigned to your team'; end if;
  select id into v_existing from public.work_records
  where business_id=p_business_id and schedule_job_id=p_schedule_id limit 1;
  if v_existing is not null then return v_existing; end if;
  if nullif(v_record_id,'') is null then raise exception 'Work record id is required'; end if;

  insert into public.work_records(
    business_id,id,schedule_job_id,client_id,team_id,work_date,work_done,
    extra_description,photo_paths,outcome,payload,created_by
  ) values(
    p_business_id,v_record_id,p_schedule_id,v_job.client_id,v_job.team_id,
    coalesce(nullif(p_work_record->>'work_date','')::date,v_job.visit_date),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_work_record->'work_done','[]'::jsonb))),'{}'),
    coalesce(p_work_record->>'extra_description',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_work_record->'photo_paths','[]'::jsonb))),'{}'),
    v_outcome,coalesce(p_work_record->'payload','{}'::jsonb),auth.uid()
  );
  v_schedule_status:=case when v_outcome in ('Completed','Partially completed') then 'completed' when v_outcome='Weather delay' then 'deferred' else 'missed' end;
  update public.schedule_jobs set status=v_schedule_status,updated_by=auth.uid(),updated_at=now(),
    payload=payload||jsonb_build_object('outcome',v_outcome,'outcomeAt',now(),'outcomeBy',auth.uid())
  where business_id=p_business_id and id=p_schedule_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_job',p_schedule_id,'visit_outcome_recorded',jsonb_build_object('work_record_id',v_record_id,'team_id',v_job.team_id,'outcome',v_outcome));
  perform public.touch_operational_revision_v54(p_business_id);
  return v_record_id;
end;
$$;

create or replace function public.create_unscheduled_work_record_v54(
  p_business_id uuid,p_work_record jsonb
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare v_exists boolean;v_result text;
begin
  select exists(select 1 from public.work_records where business_id=p_business_id and id=p_work_record->>'id') into v_exists;
  v_result:=public.create_unscheduled_work_record(p_business_id,p_work_record);
  if not v_exists then perform public.touch_operational_revision_v54(p_business_id); end if;
  return v_result;
end;
$$;

create or replace function public.create_field_opportunity_v54(
  p_business_id uuid,p_opportunity jsonb
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare v_exists boolean;v_result text;v_team text:=p_opportunity->>'team_id';v_client text:=p_opportunity->>'client_id';v_path text;
begin
  if not exists(select 1 from public.customers where business_id=p_business_id and id=v_client) then
    raise exception 'Client does not belong to this business';
  end if;
  if nullif(p_opportunity->>'schedule_job_id','') is not null and not exists(
    select 1 from public.schedule_jobs where business_id=p_business_id
      and id=p_opportunity->>'schedule_job_id' and client_id=v_client and team_id=v_team
  ) then raise exception 'Linked visit, client and team do not match'; end if;
  for v_path in select jsonb_array_elements_text(coalesce(p_opportunity->'photo_paths','[]'::jsonb)) loop
    if v_path not like p_business_id::text||'/'||v_team||'/opportunities/%' then raise exception 'Invalid opportunity photo path'; end if;
  end loop;
  select exists(select 1 from public.field_opportunities where business_id=p_business_id and id=p_opportunity->>'id') into v_exists;
  v_result:=public.create_field_opportunity(p_business_id,p_opportunity);
  if not v_exists then perform public.touch_operational_revision_v54(p_business_id); end if;
  return v_result;
end;
$$;

create or replace function public.set_work_record_photos_v54(
  p_business_id uuid,p_work_record_id text,p_photo_paths text[]
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare v_record public.work_records%rowtype;v_path text;v_changed boolean;
begin
  select * into v_record from public.work_records
  where business_id=p_business_id and id=p_work_record_id for update;
  if not found then raise exception 'Work record not found'; end if;
  if not public.is_assigned_to_business_team(p_business_id,v_record.team_id) then raise exception 'This work record is not assigned to your team'; end if;
  foreach v_path in array coalesce(p_photo_paths,'{}'::text[]) loop
    if v_path not like p_business_id::text||'/'||v_record.team_id||'/visits/%' then raise exception 'Invalid work photo path'; end if;
  end loop;
  v_changed:=v_record.photo_paths is distinct from coalesce(p_photo_paths,'{}'::text[]);
  perform public.set_work_record_photos_v53(p_business_id,p_work_record_id,p_photo_paths);
  if v_changed then perform public.touch_operational_revision_v54(p_business_id); end if;
  return p_work_record_id;
end;
$$;

create or replace function public.create_field_client_v54(
  p_business_id uuid,p_customer jsonb,p_site jsonb,p_team_id text
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare v_customer jsonb;v_site jsonb;
begin
  if not public.is_assigned_to_business_team(p_business_id,p_team_id) then raise exception 'This phone is not assigned to that team'; end if;
  v_customer:=jsonb_set(coalesce(p_customer,'{}'::jsonb),'{payload}',coalesce(p_customer->'payload','{}'::jsonb)||jsonb_build_object('fieldTeamId',p_team_id),true);
  v_site:=jsonb_set(coalesce(p_site,'{}'::jsonb),'{payload}',coalesce(p_site->'payload','{}'::jsonb)||jsonb_build_object('fieldTeamId',p_team_id),true);
  return public.create_field_client_v53(p_business_id,v_customer,v_site);
end;
$$;

revoke all on function public.complete_schedule_job_v54(uuid,text,jsonb) from public;
revoke all on function public.create_unscheduled_work_record_v54(uuid,jsonb) from public;
revoke all on function public.create_field_opportunity_v54(uuid,jsonb) from public;
revoke all on function public.set_work_record_photos_v54(uuid,text,text[]) from public;
revoke all on function public.create_field_client_v54(uuid,jsonb,jsonb,text) from public;
grant execute on function public.complete_schedule_job_v54(uuid,text,jsonb) to authenticated;
grant execute on function public.create_unscheduled_work_record_v54(uuid,jsonb) to authenticated;
grant execute on function public.create_field_opportunity_v54(uuid,jsonb) to authenticated;
grant execute on function public.set_work_record_photos_v54(uuid,text,text[]) to authenticated;
grant execute on function public.create_field_client_v54(uuid,jsonb,jsonb,text) to authenticated;
revoke execute on function public.complete_schedule_job(uuid,text,jsonb) from authenticated;
revoke execute on function public.create_unscheduled_work_record(uuid,jsonb) from authenticated;
revoke execute on function public.create_field_opportunity(uuid,jsonb) from authenticated;
revoke execute on function public.set_work_record_photos_v53(uuid,text,text[]) from authenticated;
revoke execute on function public.create_field_client_v53(uuid,jsonb,jsonb) from authenticated;

-- Field users receive a minimal workspace containing only their teams and the
-- customers connected to those teams. Business accounting settings and other
-- customers remain office-only.
create or replace function public.can_access_customer_v54(p_business_id uuid,p_customer_id text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_business_admin(p_business_id) or exists(
    select 1 from public.schedule_jobs job
    where job.business_id=p_business_id and job.client_id=p_customer_id
      and public.is_assigned_to_business_team(p_business_id,job.team_id)
  ) or exists(
    select 1 from public.work_records record
    where record.business_id=p_business_id and record.client_id=p_customer_id
      and public.is_assigned_to_business_team(p_business_id,record.team_id)
  ) or exists(
    select 1 from public.customers customer
    where customer.business_id=p_business_id and customer.id=p_customer_id
      and public.is_assigned_to_business_team(p_business_id,customer.payload->>'fieldTeamId')
  );
$$;
revoke all on function public.can_access_customer_v54(uuid,text) from public;
grant execute on function public.can_access_customer_v54(uuid,text) to authenticated;

create or replace function public.load_field_workspace_v54(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.business_members where business_id=p_business_id and user_id=auth.uid() and role='field' and active=true)
    then raise exception 'Field access required'; end if;
  select jsonb_build_object(
    'business',jsonb_build_object('id',business.id,'name',business.name,'phone',business.phone,'email',business.email,'address',business.address,'onboarding_complete',true,'core_revision',business.core_revision,'settings','{}'::jsonb),
    'teams',coalesce((select jsonb_agg(to_jsonb(team) order by team.created_at) from public.teams team
      where team.business_id=p_business_id and team.active=true and public.is_assigned_to_business_team(p_business_id,team.id)),'[]'::jsonb),
    'clusters',coalesce((select jsonb_agg(to_jsonb(cluster) order by cluster.created_at) from public.clusters cluster
      where cluster.business_id=p_business_id and cluster.active=true and exists(
        select 1 from public.service_sites site where site.business_id=p_business_id and site.cluster_id=cluster.id and public.can_access_customer_v54(p_business_id,site.customer_id)
      )),'[]'::jsonb),
    'customers',coalesce((select jsonb_agg(to_jsonb(customer) order by customer.created_at) from public.customers customer
      where customer.business_id=p_business_id and public.can_access_customer_v54(p_business_id,customer.id)),'[]'::jsonb),
    'sites',coalesce((select jsonb_agg(to_jsonb(site) order by site.created_at) from public.service_sites site
      where site.business_id=p_business_id and public.can_access_customer_v54(p_business_id,site.customer_id)),'[]'::jsonb)
  ) into v_result from public.businesses business where business.id=p_business_id;
  return v_result;
end;
$$;
revoke all on function public.load_field_workspace_v54(uuid) from public;
grant execute on function public.load_field_workspace_v54(uuid) to authenticated;

drop policy if exists businesses_select_member on public.businesses;
drop policy if exists businesses_select_admin_v54 on public.businesses;
create policy businesses_select_admin_v54 on public.businesses for select to authenticated
using(public.is_business_admin(id));
drop policy if exists members_select_same_business on public.business_members;
drop policy if exists members_select_self_or_admin_v54 on public.business_members;
create policy members_select_self_or_admin_v54 on public.business_members for select to authenticated
using(user_id=auth.uid() or public.is_business_admin(business_id));
drop policy if exists teams_select_member on public.teams;
drop policy if exists teams_select_assigned_v54 on public.teams;
create policy teams_select_assigned_v54 on public.teams for select to authenticated
using(public.is_business_admin(business_id) or public.is_assigned_to_business_team(business_id,id));
drop policy if exists clusters_select_member on public.clusters;
drop policy if exists clusters_select_relevant_v54 on public.clusters;
create policy clusters_select_relevant_v54 on public.clusters for select to authenticated
using(public.is_business_admin(business_id) or exists(
  select 1 from public.service_sites site where site.business_id=clusters.business_id and site.cluster_id=clusters.id
    and public.can_access_customer_v54(site.business_id,site.customer_id)
));
drop policy if exists customers_select_member on public.customers;
drop policy if exists customers_select_relevant_v54 on public.customers;
create policy customers_select_relevant_v54 on public.customers for select to authenticated
using(public.can_access_customer_v54(business_id,id));
drop policy if exists sites_select_member on public.service_sites;
drop policy if exists sites_select_relevant_v54 on public.service_sites;
create policy sites_select_relevant_v54 on public.service_sites for select to authenticated
using(public.can_access_customer_v54(business_id,customer_id));

drop policy if exists tuinbooks_media_select on storage.objects;
drop policy if exists tuinbooks_media_select_v54 on storage.objects;
create policy tuinbooks_media_select_v54 on storage.objects for select to authenticated using(
  bucket_id='tuinbooks-media' and (
    public.is_business_admin(((storage.foldername(name))[1])::uuid) or
    public.is_assigned_to_business_team(((storage.foldername(name))[1])::uuid,(storage.foldername(name))[2])
  )
);
drop policy if exists tuinbooks_media_insert on storage.objects;
drop policy if exists tuinbooks_media_insert_v54 on storage.objects;
create policy tuinbooks_media_insert_v54 on storage.objects for insert to authenticated with check(
  bucket_id='tuinbooks-media' and (
    public.is_business_admin(((storage.foldername(name))[1])::uuid) or
    public.is_assigned_to_business_team(((storage.foldername(name))[1])::uuid,(storage.foldername(name))[2])
  ) and (storage.foldername(name))[3] in ('visits','opportunities')
);

notify pgrst,'reload schema';
commit;
