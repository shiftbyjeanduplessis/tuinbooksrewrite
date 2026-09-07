-- TuinBooks v56.0.0 — pre-pilot security and administrative hardening
-- Run after all existing TuinBooks migrations, including v55.5.0.
-- This migration is intentionally idempotent.

begin;

create extension if not exists pgcrypto;


-- v55.5.0 uses these columns for persistent four-digit device pairing. Keep
-- the migration safe even when an older pairing schema is still live.
alter table if exists public.mobile_access_codes
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();
update public.mobile_access_codes
set status=case
  when revoked_at is not null then 'revoked'
  when claimed_at is not null then 'used'
  when expires_at<=now() then 'expired'
  else coalesce(nullif(status,''),'active')
end,
updated_at=coalesce(updated_at,created_at,now());


-- ---------------------------------------------------------------------------
-- Authoritative access helpers
-- ---------------------------------------------------------------------------

create or replace function public.tuinbooks_active_role_v56(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(bm.role)
  from public.business_members bm
  where bm.business_id=p_business_id
    and bm.user_id=auth.uid()
    and bm.active=true
  order by case lower(bm.role) when 'owner' then 1 when 'admin' then 2 when 'field' then 3 else 4 end
  limit 1;
$$;

create or replace function public.tuinbooks_is_business_member_v56(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.tuinbooks_active_role_v56(p_business_id) is not null;
$$;

create or replace function public.tuinbooks_is_business_admin_v56(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.tuinbooks_active_role_v56(p_business_id) in ('owner','admin','administrator','office_manager'),false);
$$;

create or replace function public.tuinbooks_is_assigned_team_v56(p_business_id uuid,p_team_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.tuinbooks_is_business_admin_v56(p_business_id)
    or exists(
      select 1
      from public.team_assignments ta
      join public.business_members bm
        on bm.business_id=ta.business_id and bm.user_id=ta.user_id
      where ta.business_id=p_business_id
        and ta.user_id=auth.uid()
        and ta.team_id=p_team_id
        and ta.active=true
        and bm.active=true
        and lower(bm.role)='field'
    );
$$;

-- Keep legacy helpers aligned so older RPCs use the same active-membership rule.
create or replace function public.is_business_member(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$ select public.tuinbooks_is_business_member_v56(target_business_id); $$;

create or replace function public.is_business_admin(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$ select public.tuinbooks_is_business_admin_v56(target_business_id); $$;

create or replace function public.is_assigned_to_business_team(target_business_id uuid,target_team_id text)
returns boolean language sql stable security definer set search_path=public,auth
as $$ select public.tuinbooks_is_assigned_team_v56(target_business_id,target_team_id); $$;

create or replace function public.tuinbooks_is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$ select public.tuinbooks_is_business_member_v56(p_business_id); $$;

create or replace function public.tuinbooks_is_business_admin(p_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$ select public.tuinbooks_is_business_admin_v56(p_business_id); $$;

revoke all on function public.tuinbooks_active_role_v56(uuid) from public;
revoke all on function public.tuinbooks_is_business_member_v56(uuid) from public;
revoke all on function public.tuinbooks_is_business_admin_v56(uuid) from public;
revoke all on function public.tuinbooks_is_assigned_team_v56(uuid,text) from public;
grant execute on function public.tuinbooks_active_role_v56(uuid) to authenticated;
grant execute on function public.tuinbooks_is_business_member_v56(uuid) to authenticated;
grant execute on function public.tuinbooks_is_business_admin_v56(uuid) to authenticated;
grant execute on function public.tuinbooks_is_assigned_team_v56(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS normalisation. Existing permissive policies are removed from TuinBooks
-- tenant tables so access is decided by the rules below, not by JavaScript.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  p record;
  tenant_tables text[] := array[
    'businesses','business_members','teams','team_assignments','business_invites',
    'clusters','customers','service_sites','audit_events','schedule_jobs','work_records',
    'field_opportunities','quotes','invoices','client_reports','operational_meta',
    'mobile_access_codes','mobile_pairing_attempts','mobile_pairing_attempts_v54',
    'whatsapp_connections','marketing_templates','marketing_offers','marketing_campaigns',
    'marketing_campaign_recipients','whatsapp_messages','marketing_responses',
    'marketing_work_links','marketing_suppressions','vehicles','route_matrix_cache',
    'team_route_estimates','team_route_logs'
  ];
begin
  foreach t in array tenant_tables loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
  end loop;
end $$;

-- Business and membership records.
create policy businesses_v56_select on public.businesses for select to authenticated
  using(public.tuinbooks_is_business_member_v56(id));
create policy businesses_v56_update on public.businesses for update to authenticated
  using(public.tuinbooks_is_business_admin_v56(id))
  with check(public.tuinbooks_is_business_admin_v56(id));

create policy business_members_v56_select on public.business_members for select to authenticated
  using(user_id=auth.uid() or public.tuinbooks_is_business_admin_v56(business_id));
create policy business_members_v56_insert on public.business_members for insert to authenticated
  with check(public.tuinbooks_is_business_admin_v56(business_id));
create policy business_members_v56_update on public.business_members for update to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));
create policy business_members_v56_delete on public.business_members for delete to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id));

create policy team_assignments_v56_select on public.team_assignments for select to authenticated
  using(user_id=auth.uid() or public.tuinbooks_is_business_admin_v56(business_id));
create policy team_assignments_v56_admin on public.team_assignments for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

create policy business_invites_v56_admin on public.business_invites for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

-- Team and route data.
create policy teams_v56_select on public.teams for select to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id) or public.tuinbooks_is_assigned_team_v56(business_id,id));
create policy teams_v56_admin on public.teams for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

create policy clusters_v56_select on public.clusters for select to authenticated
  using(public.tuinbooks_is_business_member_v56(business_id));
create policy clusters_v56_admin on public.clusters for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

-- Customers and sites remain readable to an active field device because the
-- field portal supports authorised unscheduled work/search inside its tenant.
create policy customers_v56_select on public.customers for select to authenticated
  using(public.tuinbooks_is_business_member_v56(business_id));
create policy customers_v56_admin on public.customers for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

create policy service_sites_v56_select on public.service_sites for select to authenticated
  using(public.tuinbooks_is_business_member_v56(business_id));
create policy service_sites_v56_admin on public.service_sites for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

-- Operational rows. Field devices read only their assigned team; all writes go
-- through audited RPCs. Office admins retain direct read/write access.
create policy schedule_jobs_v56_select on public.schedule_jobs for select to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id) or public.tuinbooks_is_assigned_team_v56(business_id,team_id));
create policy schedule_jobs_v56_admin on public.schedule_jobs for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

create policy work_records_v56_select on public.work_records for select to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id) or public.tuinbooks_is_assigned_team_v56(business_id,team_id));
create policy work_records_v56_admin on public.work_records for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

create policy field_opportunities_v56_select on public.field_opportunities for select to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id) or public.tuinbooks_is_assigned_team_v56(business_id,team_id));
create policy field_opportunities_v56_admin on public.field_opportunities for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

create policy quotes_v56_admin on public.quotes for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));
create policy invoices_v56_admin on public.invoices for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));
create policy client_reports_v56_admin on public.client_reports for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));
create policy operational_meta_v56_admin on public.operational_meta for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

create policy audit_events_v56_select on public.audit_events for select to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id));
create policy audit_events_v56_insert on public.audit_events for insert to authenticated
  with check(public.tuinbooks_is_business_member_v56(business_id) and actor_user_id=auth.uid());

-- Pairing tables have no direct field-device access. The security-definer RPCs
-- are the only supported path.
create policy mobile_access_codes_v56_admin on public.mobile_access_codes for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

-- Admin-only policies for optional Marketing/Mileage tables that exist.
do $$
declare t text;
begin
  foreach t in array array[
    'whatsapp_connections','marketing_templates','marketing_offers','marketing_campaigns',
    'marketing_campaign_recipients','whatsapp_messages','marketing_responses','marketing_work_links',
    'marketing_suppressions','vehicles','route_matrix_cache','team_route_estimates','team_route_logs'
  ] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('create policy %I on public.%I for all to authenticated using (public.tuinbooks_is_business_admin_v56(business_id)) with check (public.tuinbooks_is_business_admin_v56(business_id))',t||'_v56_admin',t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Durable idempotency receipt for field submissions.
-- ---------------------------------------------------------------------------
create table if not exists public.field_submission_receipts_v56(
  business_id uuid not null references public.businesses(id) on delete cascade,
  submission_id text not null,
  record_id text not null,
  schedule_job_id text,
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(business_id,submission_id)
);
alter table public.field_submission_receipts_v56 enable row level security;
drop policy if exists field_receipts_v56_admin_select on public.field_submission_receipts_v56;
create policy field_receipts_v56_admin_select on public.field_submission_receipts_v56 for select to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id));

create or replace function public.complete_field_visit_v56(
  p_business_id uuid,
  p_submission_id text,
  p_schedule_id text,
  p_work_record jsonb
)
returns text
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_existing text;
  v_job public.schedule_jobs%rowtype;
  v_record_id text:=nullif(p_work_record->>'id','');
  v_tasks jsonb:=coalesce(
    p_work_record->'payload'->'taskOutcomesV56',
    p_work_record->'task_outcomes',
    '[]'::jsonb
  );
  v_extra text:=coalesce(p_work_record->>'extra_description','');
  v_completed integer:=0;
  v_failed integer:=0;
  v_outcome text;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_submission_id),'') is null then raise exception 'Submission id is required'; end if;
  if v_record_id is null then raise exception 'Work record id is required'; end if;

  select record_id into v_existing
  from public.field_submission_receipts_v56
  where business_id=p_business_id and submission_id=p_submission_id;
  if v_existing is not null then return v_existing; end if;

  if jsonb_typeof(v_tasks)<>'array' or jsonb_array_length(v_tasks)=0 then
    raise exception 'Every field visit requires a task checklist';
  end if;
  if exists(
    select 1 from jsonb_array_elements(v_tasks) task
    where nullif(trim(task->>'task'),'') is null
       or coalesce(task->>'outcome','') not in ('Done','Not required today','Could not complete','Client declined')
       or (
         coalesce(task->>'outcome','') in ('Could not complete','Client declined')
         and nullif(trim(task->>'note'),'') is null
       )
  ) then
    raise exception 'Every task needs a valid outcome and incomplete tasks need a reason';
  end if;

  select
    count(*) filter(where task->>'outcome' in ('Done','Not required today')),
    count(*) filter(where task->>'outcome' in ('Could not complete','Client declined'))
  into v_completed,v_failed
  from jsonb_array_elements(v_tasks) task;

  v_outcome:=case
    when v_failed=0 then 'Completed'
    when v_completed>0 or nullif(trim(v_extra),'') is not null then 'Partially completed'
    else 'Unable to complete'
  end;

  if nullif(p_schedule_id,'') is not null then
    select * into v_job from public.schedule_jobs
    where business_id=p_business_id and id=p_schedule_id for update;
    if not found then raise exception 'Scheduled job not found'; end if;
    if not public.tuinbooks_is_assigned_team_v56(p_business_id,v_job.team_id) then
      raise exception 'This field phone is no longer assigned to this team';
    end if;
    if nullif(p_work_record->>'client_id','') is not null
       and p_work_record->>'client_id'<>v_job.client_id then
      raise exception 'The submitted client does not match the scheduled job';
    end if;
    if nullif(p_work_record->>'team_id','') is not null
       and p_work_record->>'team_id'<>v_job.team_id then
      raise exception 'The submitted team does not match the scheduled job';
    end if;
    select id into v_existing from public.work_records
      where business_id=p_business_id and schedule_job_id=p_schedule_id limit 1;
    if v_existing is not null then
      insert into public.field_submission_receipts_v56(business_id,submission_id,record_id,schedule_job_id,submitted_by)
      values(p_business_id,p_submission_id,v_existing,p_schedule_id,auth.uid()) on conflict do nothing;
      return v_existing;
    end if;
  else
    if not public.tuinbooks_is_assigned_team_v56(p_business_id,p_work_record->>'team_id') then
      raise exception 'This field phone is no longer assigned to this team';
    end if;
    if not exists(
      select 1 from public.customers c
      where c.business_id=p_business_id and c.id=p_work_record->>'client_id'
    ) then raise exception 'Client does not belong to this business'; end if;
  end if;

  insert into public.work_records(
    business_id,id,schedule_job_id,client_id,team_id,work_date,work_done,
    extra_description,photo_paths,outcome,payload,created_by
  ) values(
    p_business_id,v_record_id,nullif(p_schedule_id,''),
    coalesce(v_job.client_id,p_work_record->>'client_id'),
    coalesce(v_job.team_id,p_work_record->>'team_id'),
    coalesce(nullif(p_work_record->>'work_date','')::date,v_job.visit_date,current_date),
    coalesce(array(
      select task->>'task' from jsonb_array_elements(v_tasks) task
      where task->>'outcome'='Done'
    ),'{}'),
    v_extra,'{}',v_outcome,
    coalesce(p_work_record->'payload','{}'::jsonb)||jsonb_build_object(
      'taskOutcomesV56',v_tasks,
      'outcome',v_outcome,
      'submissionId',p_submission_id
    ),auth.uid()
  ) on conflict(business_id,id) do nothing;

  if nullif(p_schedule_id,'') is not null then
    v_status:=case
      when v_outcome='Completed' then 'completed'
      when v_outcome='Partially completed' then 'attention'
      else 'missed'
    end;
    update public.schedule_jobs
      set status=v_status,updated_by=auth.uid(),updated_at=now(),
          payload=payload||jsonb_build_object(
            'completedAt',now(),
            'completedBy',auth.uid(),
            'fieldOutcome',v_outcome,
            'fieldSubmissionId',p_submission_id
          )
      where business_id=p_business_id and id=p_schedule_id;
  end if;

  insert into public.field_submission_receipts_v56(business_id,submission_id,record_id,schedule_job_id,submitted_by)
  values(p_business_id,p_submission_id,v_record_id,nullif(p_schedule_id,''),auth.uid());

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'work_record',v_record_id,'field_submission_saved',
    jsonb_build_object(
      'schedule_job_id',nullif(p_schedule_id,''),
      'submission_id',p_submission_id,
      'outcome',v_outcome,
      'task_count',jsonb_array_length(v_tasks)
    ));

  perform public.touch_operational_revision_v54(p_business_id);
  return v_record_id;
end;
$$;
revoke all on function public.complete_field_visit_v56(uuid,text,text,jsonb) from public;
grant execute on function public.complete_field_visit_v56(uuid,text,text,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Office-managed field devices.
-- ---------------------------------------------------------------------------
create table if not exists public.field_device_status_v56(
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id text,
  status text not null default 'active',
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoke_reason text not null default '',
  updated_at timestamptz not null default now(),
  primary key(business_id,user_id)
);
alter table public.field_device_status_v56 enable row level security;
drop policy if exists field_device_status_v56_admin on public.field_device_status_v56;
create policy field_device_status_v56_admin on public.field_device_status_v56 for all to authenticated
  using(public.tuinbooks_is_business_admin_v56(business_id))
  with check(public.tuinbooks_is_business_admin_v56(business_id));

insert into public.field_device_status_v56(business_id,user_id,team_id,status,paired_at,last_seen_at,updated_at)
select bm.business_id,bm.user_id,ta.team_id,
       case when bm.active then 'active' else 'revoked' end,
       coalesce(mac.claimed_at,bm.created_at),bm.updated_at,now()
from public.business_members bm
left join public.team_assignments ta
  on ta.business_id=bm.business_id and ta.user_id=bm.user_id and ta.active=true
left join lateral(
  select c.claimed_at from public.mobile_access_codes c
  where c.business_id=bm.business_id and c.claimed_by=bm.user_id
  order by c.claimed_at desc nulls last limit 1
) mac on true
where lower(bm.role)='field'
on conflict(business_id,user_id) do update set
  team_id=excluded.team_id,
  status=excluded.status,
  paired_at=least(public.field_device_status_v56.paired_at,excluded.paired_at),
  updated_at=now();

create or replace function public.list_field_devices_v56(p_business_id uuid)
returns table(
  user_id uuid,
  display_name text,
  active boolean,
  team_id text,
  team_name text,
  paired_at timestamptz,
  last_seen_at timestamptz
)
language sql
security definer
set search_path=public,auth
as $$
  select bm.user_id,bm.display_name,bm.active,ta.team_id,t.name,
         coalesce(ds.paired_at,mac.claimed_at,bm.created_at) as paired_at,
         coalesce(ds.last_seen_at,bm.updated_at,mac.updated_at,mac.claimed_at,bm.created_at) as last_seen_at
  from public.business_members bm
  left join public.team_assignments ta
    on ta.business_id=bm.business_id and ta.user_id=bm.user_id and ta.active=true
  left join public.teams t on t.business_id=ta.business_id and t.id=ta.team_id
  left join public.field_device_status_v56 ds
    on ds.business_id=bm.business_id and ds.user_id=bm.user_id
  left join lateral(
    select c.claimed_at,c.updated_at from public.mobile_access_codes c
    where c.business_id=bm.business_id and c.claimed_by=bm.user_id
    order by c.claimed_at desc nulls last limit 1
  ) mac on true
  where bm.business_id=p_business_id
    and lower(bm.role)='field'
    and public.tuinbooks_is_business_admin_v56(p_business_id)
  order by bm.active desc,bm.display_name;
$$;

create or replace function public.revoke_field_device_v56(p_business_id uuid,p_user_id uuid,p_reason text default '')
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.tuinbooks_is_business_admin_v56(p_business_id) then raise exception 'Owner or admin access is required'; end if;
  update public.business_members set active=false,updated_at=now()
    where business_id=p_business_id and user_id=p_user_id and lower(role)='field';
  if not found then return false; end if;
  update public.team_assignments set active=false,updated_at=now()
    where business_id=p_business_id and user_id=p_user_id;
  update public.mobile_access_codes set status='revoked',updated_at=now()
    where business_id=p_business_id and claimed_by=p_user_id and status in ('active','used');
  insert into public.field_device_status_v56(business_id,user_id,status,revoked_at,revoked_by,revoke_reason,updated_at)
    values(p_business_id,p_user_id,'revoked',now(),auth.uid(),coalesce(p_reason,''),now())
    on conflict(business_id,user_id) do update set status='revoked',revoked_at=now(),revoked_by=auth.uid(),revoke_reason=coalesce(p_reason,''),updated_at=now();
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
    values(p_business_id,auth.uid(),'field_device',p_user_id::text,'revoked',jsonb_build_object('reason',coalesce(p_reason,'')));
  return true;
end;
$$;

create or replace function public.reassign_field_device_v56(p_business_id uuid,p_user_id uuid,p_team_id text)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_name text;
begin
  if not public.tuinbooks_is_business_admin_v56(p_business_id) then raise exception 'Owner or admin access is required'; end if;
  select name into v_name from public.teams where business_id=p_business_id and id=p_team_id and active=true;
  if v_name is null then raise exception 'Choose an active team'; end if;
  if not exists(select 1 from public.business_members where business_id=p_business_id and user_id=p_user_id and lower(role)='field') then
    raise exception 'Field phone not found';
  end if;
  update public.business_members set active=true,updated_at=now() where business_id=p_business_id and user_id=p_user_id;
  update public.team_assignments set active=false,updated_at=now() where business_id=p_business_id and user_id=p_user_id;
  insert into public.team_assignments(business_id,user_id,team_id,is_primary,active)
    values(p_business_id,p_user_id,p_team_id,true,true)
    on conflict(business_id,user_id,team_id) do update set active=true,is_primary=true,updated_at=now();
  insert into public.field_device_status_v56(business_id,user_id,team_id,status,paired_at,last_seen_at,updated_at)
    values(p_business_id,p_user_id,p_team_id,'active',now(),now(),now())
    on conflict(business_id,user_id) do update set team_id=p_team_id,status='active',revoked_at=null,revoked_by=null,revoke_reason='',updated_at=now();
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
    values(p_business_id,auth.uid(),'field_device',p_user_id::text,'reassigned',jsonb_build_object('team_id',p_team_id,'team_name',v_name));
  return true;
end;
$$;

create or replace function public.validate_field_device_v56(p_business_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_team text;
begin
  select ta.team_id into v_team
  from public.business_members bm
  left join public.team_assignments ta
    on ta.business_id=bm.business_id and ta.user_id=bm.user_id and ta.active=true
  where bm.business_id=p_business_id
    and bm.user_id=auth.uid()
    and bm.active=true
    and lower(bm.role)='field'
  limit 1;
  if v_team is null then return false; end if;
  insert into public.field_device_status_v56(business_id,user_id,team_id,status,paired_at,last_seen_at,updated_at)
  values(p_business_id,auth.uid(),v_team,'active',now(),now(),now())
  on conflict(business_id,user_id) do update set
    team_id=excluded.team_id,status='active',last_seen_at=now(),updated_at=now();
  return true;
end;
$$;

revoke all on function public.list_field_devices_v56(uuid) from public;
revoke all on function public.revoke_field_device_v56(uuid,uuid,text) from public;
revoke all on function public.reassign_field_device_v56(uuid,uuid,text) from public;
revoke all on function public.validate_field_device_v56(uuid) from public;
grant execute on function public.list_field_devices_v56(uuid) to authenticated;
grant execute on function public.revoke_field_device_v56(uuid,uuid,text) to authenticated;
grant execute on function public.reassign_field_device_v56(uuid,uuid,text) to authenticated;
grant execute on function public.validate_field_device_v56(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Destructive reset gate. The legacy reset function is replaced with an
-- always-deny implementation for ordinary businesses. Training reset stays in
-- its separate demo-only RPC.
-- ---------------------------------------------------------------------------
create or replace function public.reset_business_workspace(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.tuinbooks_is_business_admin_v56(p_business_id) then raise exception 'Owner or admin access is required'; end if;
  if not exists(
    select 1 from public.businesses b
    where b.id=p_business_id
      and (coalesce((b.settings->>'demoMode')::boolean,false)=true
        or coalesce((b.settings->>'demo_mode')::boolean,false)=true
        or b.name ilike '%TuinBooks Training%')
  ) then
    insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
      values(p_business_id,auth.uid(),'business',p_business_id::text,'reset_blocked',jsonb_build_object('reason','real_business'));
    raise exception 'Business data reset is disabled for live businesses';
  end if;
  raise exception 'Use the dedicated training-demo reset function';
end;
$$;
revoke all on function public.reset_business_workspace(uuid) from public;
grant execute on function public.reset_business_workspace(uuid) to authenticated;

notify pgrst,'reload schema';
commit;

-- Verification output
select
  to_regprocedure('public.complete_field_visit_v56(uuid,text,text,jsonb)') as field_visit_rpc,
  to_regprocedure('public.list_field_devices_v56(uuid)') as device_list_rpc,
  to_regprocedure('public.revoke_field_device_v56(uuid,uuid,text)') as device_revoke_rpc,
  to_regprocedure('public.reassign_field_device_v56(uuid,uuid,text)') as device_reassign_rpc,
  to_regprocedure('public.validate_field_device_v56(uuid)') as device_validate_rpc,
  to_regclass('public.field_submission_receipts_v56') as field_receipts,
  to_regclass('public.field_device_status_v56') as field_device_status;
