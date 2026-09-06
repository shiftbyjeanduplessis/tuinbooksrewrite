-- TUINBOOKS V2 CORE INSTALLER
-- SQLFIX1: explicit non-keyword aliases in v4 route export query.
-- Generated from the frozen final codebase.
-- Additive migrations only. Run on QA/staging first. Stop on first SQL error.


-- ============================================================================
-- BEGIN migration-v2-schedule-mutations.sql
-- ============================================================================

-- TuinBooks v2 Milestone 2: small atomic Schedule mutation contract.
-- ADDITIVE ONLY. Does not drop or rewrite existing TuinBooks tables.
-- Run on QA before enabling live v2 calendar writes.

begin;

create table if not exists public.schedule_queue_items_v2 (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  client_id text not null,
  service_site_id text not null default '',
  source_schedule_job_id text not null default '',
  original_date date,
  original_team_id text not null default '',
  estimated_minutes integer not null default 0 check (estimated_minutes between 0 and 480),
  service_ids text[] not null default '{}',
  item_type text not null default 'routine',
  billing_disposition text not null default 'routine',
  reason text not null default '',
  status text not null default 'open',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint schedule_queue_v2_client_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete cascade
);
create index if not exists schedule_queue_items_v2_open_idx on public.schedule_queue_items_v2(business_id,status,created_at);

alter table public.schedule_queue_items_v2 enable row level security;
drop policy if exists schedule_queue_items_v2_select on public.schedule_queue_items_v2;
create policy schedule_queue_items_v2_select on public.schedule_queue_items_v2
for select to authenticated using (public.is_business_admin(business_id));
grant select on public.schedule_queue_items_v2 to authenticated;
revoke insert,update,delete on public.schedule_queue_items_v2 from authenticated;

create or replace function public.tuinbooks_v2_move_visit(
  p_business_id uuid,p_visit_id text,p_date date,p_team_id text,p_sort_order integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job public.schedule_jobs%rowtype;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;
  if not found then raise exception 'Visit not found'; end if;
  if lower(v_job.status) in ('completed','cancelled','canceled') then raise exception 'Completed/cancelled visits cannot be moved'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found'; end if;
  update public.schedule_jobs set visit_date=p_date,team_id=p_team_id,sort_order=coalesce(p_sort_order,99),updated_by=auth.uid(),updated_at=now(),
    payload=payload||jsonb_build_object('manualOverride',true,'autoAssigned',false,'v2LastMoveAt',now())
  where business_id=p_business_id and id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_visit_moved',jsonb_build_object('date',p_date,'team_id',p_team_id,'sort_order',p_sort_order));
  return jsonb_build_object('id',p_visit_id,'date',p_date,'team_id',p_team_id);
end;$$;

create or replace function public.tuinbooks_v2_resize_visit(
  p_business_id uuid,p_visit_id text,p_estimated_minutes integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_minutes integer:=least(480,greatest(15,round(coalesce(p_estimated_minutes,15)::numeric/15)::integer*15));v_status text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select status into v_status from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;
  if v_status is null then raise exception 'Visit not found'; end if;
  if lower(v_status) in ('completed','cancelled','canceled') then raise exception 'Completed/cancelled visits cannot be resized'; end if;
  update public.schedule_jobs set estimated_hours=v_minutes::numeric/60,updated_by=auth.uid(),updated_at=now(),
    payload=payload||jsonb_build_object('estimatedMinutes',v_minutes,'durationUnknownV59320',false,'durationOverrideV59320',true,'v2DurationAt',now())
  where business_id=p_business_id and id=p_visit_id;
  return jsonb_build_object('id',p_visit_id,'estimated_minutes',v_minutes);
end;$$;

create or replace function public.tuinbooks_v2_move_visit_to_basket(
  p_business_id uuid,p_visit_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job public.schedule_jobs%rowtype;v_queue_id text:='queue-job-'||p_visit_id;v_site text;v_type text;v_billing text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;
  if not found then raise exception 'Visit not found'; end if;
  if lower(v_job.status) in ('completed','cancelled','canceled') then raise exception 'Completed/cancelled visits cannot move to Basket'; end if;
  if exists(select 1 from public.work_records where business_id=p_business_id and schedule_job_id=p_visit_id) then raise exception 'A visit with field work cannot move to Basket'; end if;
  v_site:=coalesce(v_job.payload->>'serviceLocationId',v_job.payload->>'serviceSiteId',v_job.payload->>'siteId','');
  v_type:=case when lower(coalesce(v_job.payload->>'workKind',v_job.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(v_job.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end;
  v_billing:=case when v_type='additional' then 'additional' when v_type='quoted' then 'quoted' else 'routine' end;
  insert into public.schedule_queue_items_v2(business_id,id,client_id,service_site_id,source_schedule_job_id,original_date,original_team_id,estimated_minutes,service_ids,item_type,billing_disposition,reason,status,payload,created_by,updated_by)
  values(p_business_id,v_queue_id,v_job.client_id,v_site,v_job.id,v_job.visit_date,v_job.team_id,round(v_job.estimated_hours*60)::integer,coalesce(v_job.service_ids,'{}'),v_type,v_billing,'Moved from calendar','open',v_job.payload,auth.uid(),auth.uid())
  on conflict(business_id,id) do update set status='open',original_date=excluded.original_date,original_team_id=excluded.original_team_id,estimated_minutes=excluded.estimated_minutes,payload=excluded.payload,updated_by=auth.uid(),updated_at=now();
  delete from public.schedule_jobs where business_id=p_business_id and id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_visit_to_basket',jsonb_build_object('queue_id',v_queue_id));
  return jsonb_build_object('queue_id',v_queue_id,'visit_id',p_visit_id);
end;$$;

create or replace function public.tuinbooks_v2_schedule_queue_item(
  p_business_id uuid,p_queue_item_id text,p_date date,p_team_id text,p_sort_order integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item public.schedule_queue_items_v2%rowtype;v_job_id text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_item from public.schedule_queue_items_v2 where business_id=p_business_id and id=p_queue_item_id and status='open' for update;
  if not found then raise exception 'Basket item not found'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found'; end if;
  v_job_id:=case when nullif(v_item.source_schedule_job_id,'') is not null then v_item.source_schedule_job_id else 'sch-v2-'||replace(gen_random_uuid()::text,'-','') end;
  insert into public.schedule_jobs(business_id,id,visit_date,client_id,team_id,status,estimated_hours,sort_order,service_ids,payload,created_by,updated_by)
  values(p_business_id,v_job_id,p_date,v_item.client_id,p_team_id,'scheduled',v_item.estimated_minutes::numeric/60,coalesce(p_sort_order,99),coalesce(v_item.service_ids,'{}'),v_item.payload||jsonb_build_object('serviceLocationId',nullif(v_item.service_site_id,''),'v2RestoredFromQueue',true,'manualOverride',true,'autoAssigned',false),auth.uid(),auth.uid());
  update public.schedule_queue_items_v2 set status='scheduled',updated_by=auth.uid(),updated_at=now() where business_id=p_business_id and id=p_queue_item_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_job',v_job_id,'v2_basket_scheduled',jsonb_build_object('queue_id',p_queue_item_id,'date',p_date,'team_id',p_team_id));
  return jsonb_build_object('visit_id',v_job_id,'queue_id',p_queue_item_id);
end;$$;

create or replace function public.tuinbooks_v2_create_additional_visit(
  p_business_id uuid,p_visit_id text,p_date date,p_team_id text,p_sort_order integer,p_client_id text,p_service_site_id text,p_task text,p_notes text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_payload jsonb;v_task text:=trim(coalesce(p_task,''));v_notes text:=trim(coalesce(p_notes,''));
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.customers where business_id=p_business_id and id=p_client_id and lower(status)='active') then raise exception 'Active routine client not found'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found'; end if;
  if nullif(coalesce(p_service_site_id,''),'') is not null and not exists(select 1 from public.service_sites where business_id=p_business_id and id=p_service_site_id and customer_id=p_client_id) then raise exception 'Service location does not belong to this client'; end if;
  v_payload:=jsonb_build_object('visitType','additional','billingDisposition','additional','workKind','additional-visit','revenueType','Additional visit','workMarker','A','additionalVisitV2',true,'serviceLocationId',nullif(p_service_site_id,''),'serviceSiteId',nullif(p_service_site_id,''),'serviceDescription',v_task,'customTasks',v_task,'visitTasks',case when v_task='' then '[]'::jsonb else jsonb_build_array(v_task) end,'description',case when v_task='' then 'Additional visit' else v_task end,'reason',case when v_task='' then 'Additional visit' else v_task end,'officeNotes',v_notes,'notes',v_notes,'manualOverride',true,'autoGenerated',false,'autoAssigned',false,'durationUnknownV59320',true,'durationOverrideV59320',false,'createdAt',now(),'updatedAt',now());
  insert into public.schedule_jobs(business_id,id,visit_date,client_id,team_id,status,estimated_hours,sort_order,service_ids,payload,created_by,updated_by)
  values(p_business_id,p_visit_id,p_date,p_client_id,p_team_id,'scheduled',0,coalesce(p_sort_order,99),'{}',v_payload,auth.uid(),auth.uid());
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_additional_visit_created',jsonb_build_object('date',p_date,'team_id',p_team_id,'client_id',p_client_id,'service_site_id',p_service_site_id));
  return jsonb_build_object('id',p_visit_id,'visit_type','additional');
end;$$;

revoke all on function public.tuinbooks_v2_move_visit(uuid,text,date,text,integer) from public;
revoke all on function public.tuinbooks_v2_resize_visit(uuid,text,integer) from public;
revoke all on function public.tuinbooks_v2_move_visit_to_basket(uuid,text) from public;
revoke all on function public.tuinbooks_v2_schedule_queue_item(uuid,text,date,text,integer) from public;
revoke all on function public.tuinbooks_v2_create_additional_visit(uuid,text,date,text,integer,text,text,text,text) from public;
grant execute on function public.tuinbooks_v2_move_visit(uuid,text,date,text,integer) to authenticated;
grant execute on function public.tuinbooks_v2_resize_visit(uuid,text,integer) to authenticated;
grant execute on function public.tuinbooks_v2_move_visit_to_basket(uuid,text) to authenticated;
grant execute on function public.tuinbooks_v2_schedule_queue_item(uuid,text,date,text,integer) to authenticated;
grant execute on function public.tuinbooks_v2_create_additional_visit(uuid,text,date,text,integer,text,text,text,text) to authenticated;

commit;

-- ============================================================================
-- END migration-v2-schedule-mutations.sql
-- ============================================================================

-- ============================================================================
-- BEGIN migration-v2-recurrence-authority.sql
-- ============================================================================

-- TuinBooks v2 Milestone 3: authoritative recurrence model.
-- REQUIRES migration-v2-schedule-mutations.sql first.
-- ADDITIVE: creates v2 series/slot/occurrence tables and replaces only v2 RPCs.
-- It does not alter legacy recurrence/settings tables and does not auto-adopt legacy agreements.

begin;

create table if not exists public.schedule_series_v2 (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  client_id text not null,
  service_site_id text not null default '',
  status text not null default 'active',
  frequency text not null check (frequency in ('weekly','fortnightly','four-weekly','monthly')),
  anchor_date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint schedule_series_v2_client_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete cascade
);

create table if not exists public.schedule_series_slots_v2 (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  series_id text not null,
  weekday smallint not null check (weekday between 1 and 7),
  monthly_ordinal smallint check (monthly_ordinal between 1 and 5),
  default_team_id text not null,
  estimated_minutes integer not null default 60 check (estimated_minutes between 15 and 480),
  service_ids text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint schedule_series_slots_v2_series_fk foreign key (business_id,series_id)
    references public.schedule_series_v2(business_id,id) on delete cascade,
  constraint schedule_series_slots_v2_team_fk foreign key (business_id,default_team_id)
    references public.teams(business_id,id) on delete restrict
);

create table if not exists public.schedule_occurrences_v2 (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  series_id text not null,
  slot_id text not null,
  occurrence_date date not null,
  planned_date date,
  schedule_job_id text,
  queue_item_id text,
  status text not null default 'scheduled',
  manual_override boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  unique (business_id,series_id,slot_id,occurrence_date),
  constraint schedule_occurrences_v2_series_fk foreign key (business_id,series_id)
    references public.schedule_series_v2(business_id,id) on delete cascade,
  constraint schedule_occurrences_v2_slot_fk foreign key (business_id,slot_id)
    references public.schedule_series_slots_v2(business_id,id) on delete cascade,
  constraint schedule_occurrences_v2_job_fk foreign key (business_id,schedule_job_id)
    references public.schedule_jobs(business_id,id) on delete set null,
  constraint schedule_occurrences_v2_queue_fk foreign key (business_id,queue_item_id)
    references public.schedule_queue_items_v2(business_id,id) on delete set null
);

create index if not exists schedule_series_v2_client_idx on public.schedule_series_v2(business_id,client_id,status);
create index if not exists schedule_series_slots_v2_series_idx on public.schedule_series_slots_v2(business_id,series_id,weekday);
create unique index if not exists schedule_occurrences_v2_job_idx on public.schedule_occurrences_v2(business_id,schedule_job_id) where schedule_job_id is not null;
create unique index if not exists schedule_occurrences_v2_queue_idx on public.schedule_occurrences_v2(business_id,queue_item_id) where queue_item_id is not null;
create index if not exists schedule_occurrences_v2_range_idx on public.schedule_occurrences_v2(business_id,series_id,slot_id,occurrence_date,status);

alter table public.schedule_series_v2 enable row level security;
alter table public.schedule_series_slots_v2 enable row level security;
alter table public.schedule_occurrences_v2 enable row level security;

drop policy if exists schedule_series_v2_select on public.schedule_series_v2;
create policy schedule_series_v2_select on public.schedule_series_v2 for select to authenticated using (public.is_business_admin(business_id));
drop policy if exists schedule_series_slots_v2_select on public.schedule_series_slots_v2;
create policy schedule_series_slots_v2_select on public.schedule_series_slots_v2 for select to authenticated using (public.is_business_admin(business_id));
drop policy if exists schedule_occurrences_v2_select on public.schedule_occurrences_v2;
create policy schedule_occurrences_v2_select on public.schedule_occurrences_v2 for select to authenticated using (public.is_business_admin(business_id));
grant select on public.schedule_series_v2,public.schedule_series_slots_v2,public.schedule_occurrences_v2 to authenticated;
revoke insert,update,delete on public.schedule_series_v2,public.schedule_series_slots_v2,public.schedule_occurrences_v2 from authenticated;

create or replace function public.tuinbooks_v2_monthly_due_date(p_month date,p_weekday integer,p_ordinal integer)
returns date language plpgsql immutable set search_path=public as $$
declare v_first date:=date_trunc('month',p_month)::date;v_last date:=(date_trunc('month',p_month)+interval '1 month - 1 day')::date;v_day integer;v_offset integer;v_due date;
begin
  v_offset:=(p_weekday-extract(isodow from v_first)::integer+7)%7;
  v_day:=1+v_offset+(least(5,greatest(1,coalesce(p_ordinal,1)))-1)*7;
  v_due:=v_first+(v_day-1);
  while v_due>v_last loop v_due:=v_due-7; end loop;
  return v_due;
end;$$;

create or replace function public.tuinbooks_v2_series_slot_dates(p_business_id uuid,p_series_id text,p_slot_id text,p_from date,p_through date)
returns setof date language plpgsql stable set search_path=public as $$
declare v_series public.schedule_series_v2%rowtype;v_slot public.schedule_series_slots_v2%rowtype;v_date date;v_interval integer;v_weeks integer;v_due date;
begin
  select * into v_series from public.schedule_series_v2 where business_id=p_business_id and id=p_series_id and status='active';
  if not found then return; end if;
  select * into v_slot from public.schedule_series_slots_v2 where business_id=p_business_id and id=p_slot_id and series_id=p_series_id;
  if not found or p_through<p_from then return; end if;
  if v_series.frequency='monthly' then
    v_date:=date_trunc('month',p_from)::date;
    while v_date<=date_trunc('month',p_through)::date loop
      v_due:=public.tuinbooks_v2_monthly_due_date(v_date,v_slot.weekday,coalesce(v_slot.monthly_ordinal,least(5,ceil(extract(day from v_series.anchor_date)/7.0)::integer)));
      if v_due between p_from and p_through and v_due>=v_series.anchor_date then return next v_due; end if;
      v_date:=(v_date+interval '1 month')::date;
    end loop;
    return;
  end if;
  v_interval:=case v_series.frequency when 'fortnightly' then 2 when 'four-weekly' then 4 else 1 end;
  v_date:=p_from;
  while v_date<=p_through loop
    if v_date>=v_series.anchor_date and extract(isodow from v_date)::integer=v_slot.weekday then
      v_weeks:=(date_trunc('week',v_date)::date-date_trunc('week',v_series.anchor_date)::date)/7;
      if v_weeks>=0 and mod(v_weeks,v_interval)=0 then return next v_date; end if;
    end if;
    v_date:=v_date+1;
  end loop;
end;$$;

create or replace function public.tuinbooks_v2_ensure_series_horizon(p_business_id uuid,p_from date,p_through date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_series public.schedule_series_v2%rowtype;v_slot public.schedule_series_slots_v2%rowtype;v_due date;v_job_id text;v_occ_id text;v_sort integer;v_generated integer:=0;v_skipped integer:=0;v_payload jsonb;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if p_through<p_from then raise exception 'Invalid recurrence horizon'; end if;
  for v_series in select * from public.schedule_series_v2 where business_id=p_business_id and status='active' loop
    for v_slot in select * from public.schedule_series_slots_v2 where business_id=p_business_id and series_id=v_series.id loop
      if not exists(select 1 from public.teams where business_id=p_business_id and id=v_slot.default_team_id and active=true) then v_skipped:=v_skipped+1;continue;end if;
      for v_due in select * from public.tuinbooks_v2_series_slot_dates(p_business_id,v_series.id,v_slot.id,p_from,p_through) loop
        if exists(select 1 from public.schedule_occurrences_v2 where business_id=p_business_id and series_id=v_series.id and slot_id=v_slot.id and occurrence_date=v_due) then continue;end if;
        v_job_id:='sch-v2-'||replace(gen_random_uuid()::text,'-','');v_occ_id:='occ-v2-'||replace(gen_random_uuid()::text,'-','');
        select coalesce(max(sort_order),0)+100 into v_sort from public.schedule_jobs where business_id=p_business_id and visit_date=v_due and team_id=v_slot.default_team_id;
        v_payload:=coalesce(v_series.payload,'{}'::jsonb)||coalesce(v_slot.payload,'{}'::jsonb)||jsonb_build_object('visitType','routine','billingDisposition','routine','revenueType','Recurring contract','workMarker','R','scheduleSeriesId',v_series.id,'scheduleSeriesSlotId',v_slot.id,'occurrenceDate',v_due,'serviceLocationId',nullif(v_series.service_site_id,''),'serviceSiteId',nullif(v_series.service_site_id,''),'autoGenerated',true,'manualOverride',false,'autoAssigned',false,'v2Recurrence',true);
        insert into public.schedule_jobs(business_id,id,visit_date,client_id,team_id,status,estimated_hours,sort_order,service_ids,payload,created_by,updated_by)
        values(p_business_id,v_job_id,v_due,v_series.client_id,v_slot.default_team_id,'scheduled',v_slot.estimated_minutes::numeric/60,v_sort,coalesce(v_slot.service_ids,'{}'),v_payload,auth.uid(),auth.uid());
        insert into public.schedule_occurrences_v2(business_id,id,series_id,slot_id,occurrence_date,planned_date,schedule_job_id,status,manual_override,payload)
        values(p_business_id,v_occ_id,v_series.id,v_slot.id,v_due,v_due,v_job_id,'scheduled',false,jsonb_build_object('generatedAt',now()));
        v_generated:=v_generated+1;
      end loop;
    end loop;
  end loop;
  return jsonb_build_object('generated',v_generated,'skipped_slots',v_skipped,'from',p_from,'through',p_through);
end;$$;

-- A single-occurrence move becomes an explicit exception. The canonical occurrence date stays unchanged.
create or replace function public.tuinbooks_v2_move_visit(p_business_id uuid,p_visit_id text,p_date date,p_team_id text,p_sort_order integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job public.schedule_jobs%rowtype;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;if not found then raise exception 'Visit not found';end if;
  if lower(v_job.status) in ('completed','cancelled','canceled') then raise exception 'Completed/cancelled visits cannot be moved';end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found';end if;
  update public.schedule_jobs set visit_date=p_date,team_id=p_team_id,sort_order=coalesce(p_sort_order,99),updated_by=auth.uid(),updated_at=now(),payload=payload||jsonb_build_object('manualOverride',true,'autoAssigned',false,'v2LastMoveAt',now()) where business_id=p_business_id and id=p_visit_id;
  update public.schedule_occurrences_v2 set planned_date=p_date,manual_override=true,updated_at=now(),payload=payload||jsonb_build_object('exceptionMovedAt',now()) where business_id=p_business_id and schedule_job_id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_visit_moved',jsonb_build_object('date',p_date,'team_id',p_team_id,'sort_order',p_sort_order,'scope','one'));
  return jsonb_build_object('id',p_visit_id,'date',p_date,'team_id',p_team_id,'scope','one');
end;$$;

-- Move one recurrence slot from this occurrence onward. Other slots in 2x/3x weekly series are untouched.
create or replace function public.tuinbooks_v2_move_series_future(p_business_id uuid,p_visit_id text,p_date date,p_team_id text,p_sort_order integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_occ public.schedule_occurrences_v2%rowtype;v_series public.schedule_series_v2%rowtype;v_slot public.schedule_series_slots_v2%rowtype;v_old_date date;v_new_weekday integer;v_new_ordinal integer;v_deleted integer:=0;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_occ from public.schedule_occurrences_v2 where business_id=p_business_id and schedule_job_id=p_visit_id for update;if not found then raise exception 'This visit is not linked to a v2 recurring series';end if;
  select * into v_series from public.schedule_series_v2 where business_id=p_business_id and id=v_occ.series_id for update;if not found or v_series.status<>'active' then raise exception 'Recurring series is not active';end if;
  select * into v_slot from public.schedule_series_slots_v2 where business_id=p_business_id and id=v_occ.slot_id for update;if not found then raise exception 'Recurring slot not found';end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found';end if;
  if exists(select 1 from public.schedule_jobs where business_id=p_business_id and id=p_visit_id and lower(status) in ('completed','cancelled','canceled')) then raise exception 'Completed/cancelled visits cannot change recurrence';end if;
  v_old_date:=v_occ.occurrence_date;v_new_weekday:=extract(isodow from p_date)::integer;v_new_ordinal:=least(5,ceil(extract(day from p_date)/7.0)::integer);
  if v_series.frequency='weekly' and exists(select 1 from public.schedule_series_slots_v2 where business_id=p_business_id and series_id=v_series.id and id<>v_slot.id and weekday=v_new_weekday) then raise exception 'This recurring client already has another visit on that weekday';end if;
  if exists(select 1 from public.schedule_occurrences_v2 where business_id=p_business_id and series_id=v_series.id and slot_id=v_slot.id and occurrence_date=p_date and id<>v_occ.id and (manual_override=true or status<>'scheduled')) then raise exception 'A protected occurrence already exists on the target date';end if;
  delete from public.schedule_jobs where business_id=p_business_id and id in (select schedule_job_id from public.schedule_occurrences_v2 where business_id=p_business_id and series_id=v_series.id and slot_id=v_slot.id and occurrence_date>v_old_date and manual_override=false and status='scheduled' and schedule_job_id is not null);
  delete from public.schedule_occurrences_v2 where business_id=p_business_id and series_id=v_series.id and slot_id=v_slot.id and occurrence_date>v_old_date and manual_override=false and status='scheduled';get diagnostics v_deleted=row_count;
  if v_series.frequency in ('fortnightly','four-weekly','monthly') then update public.schedule_series_v2 set anchor_date=p_date,updated_by=auth.uid(),updated_at=now() where business_id=p_business_id and id=v_series.id;end if;
  update public.schedule_series_slots_v2 set weekday=v_new_weekday,monthly_ordinal=case when v_series.frequency='monthly' then v_new_ordinal else monthly_ordinal end,default_team_id=p_team_id,updated_at=now() where business_id=p_business_id and id=v_slot.id;
  update public.schedule_jobs set visit_date=p_date,team_id=p_team_id,sort_order=coalesce(p_sort_order,99),updated_by=auth.uid(),updated_at=now(),payload=payload||jsonb_build_object('manualOverride',false,'autoAssigned',false,'scheduleSeriesId',v_series.id,'scheduleSeriesSlotId',v_slot.id,'occurrenceDate',p_date,'v2SeriesMoveAt',now()) where business_id=p_business_id and id=p_visit_id;
  update public.schedule_occurrences_v2 set occurrence_date=p_date,planned_date=p_date,manual_override=false,status='scheduled',updated_at=now(),payload=payload||jsonb_build_object('patternMovedAt',now(),'previousOccurrenceDate',v_old_date) where business_id=p_business_id and id=v_occ.id;
  perform public.tuinbooks_v2_ensure_series_horizon(p_business_id,least(p_date,v_old_date),p_date+56);
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_series',v_series.id,'v2_series_future_moved',jsonb_build_object('slot_id',v_slot.id,'from_occurrence',v_old_date,'to_date',p_date,'team_id',p_team_id,'regenerated_after_removing',v_deleted));
  return jsonb_build_object('series_id',v_series.id,'slot_id',v_slot.id,'scope','future','date',p_date,'team_id',p_team_id);
end;$$;

-- Basket mutations preserve occurrence identity so rolling generation cannot recreate the same visit.
create or replace function public.tuinbooks_v2_move_visit_to_basket(p_business_id uuid,p_visit_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job public.schedule_jobs%rowtype;v_occ public.schedule_occurrences_v2%rowtype;v_queue_id text:='queue-job-'||p_visit_id;v_site text;v_type text;v_billing text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;if not found then raise exception 'Visit not found';end if;
  if lower(v_job.status) in ('completed','cancelled','canceled') then raise exception 'Completed/cancelled visits cannot move to Basket';end if;
  if exists(select 1 from public.work_records where business_id=p_business_id and schedule_job_id=p_visit_id) then raise exception 'A visit with field work cannot move to Basket';end if;
  select * into v_occ from public.schedule_occurrences_v2 where business_id=p_business_id and schedule_job_id=p_visit_id for update;
  v_site:=coalesce(v_job.payload->>'serviceLocationId',v_job.payload->>'serviceSiteId',v_job.payload->>'siteId','');v_type:=case when lower(coalesce(v_job.payload->>'workKind',v_job.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(v_job.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end;v_billing:=case when v_type='additional' then 'additional' when v_type='quoted' then 'quoted' else 'routine' end;
  insert into public.schedule_queue_items_v2(business_id,id,client_id,service_site_id,source_schedule_job_id,original_date,original_team_id,estimated_minutes,service_ids,item_type,billing_disposition,reason,status,payload,created_by,updated_by)
  values(p_business_id,v_queue_id,v_job.client_id,v_site,v_job.id,v_job.visit_date,v_job.team_id,round(v_job.estimated_hours*60)::integer,coalesce(v_job.service_ids,'{}'),v_type,v_billing,'Moved from calendar','open',v_job.payload,auth.uid(),auth.uid())
  on conflict(business_id,id) do update set status='open',original_date=excluded.original_date,original_team_id=excluded.original_team_id,estimated_minutes=excluded.estimated_minutes,payload=excluded.payload,updated_by=auth.uid(),updated_at=now();
  if v_occ.id is not null then update public.schedule_occurrences_v2 set schedule_job_id=null,queue_item_id=v_queue_id,status='basket',planned_date=v_job.visit_date,manual_override=true,updated_at=now() where business_id=p_business_id and id=v_occ.id;end if;
  delete from public.schedule_jobs where business_id=p_business_id and id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_visit_to_basket',jsonb_build_object('queue_id',v_queue_id,'recurring',v_occ.id is not null));
  return jsonb_build_object('queue_id',v_queue_id,'visit_id',p_visit_id);
end;$$;

create or replace function public.tuinbooks_v2_schedule_queue_item(p_business_id uuid,p_queue_item_id text,p_date date,p_team_id text,p_sort_order integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item public.schedule_queue_items_v2%rowtype;v_occ public.schedule_occurrences_v2%rowtype;v_job_id text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_item from public.schedule_queue_items_v2 where business_id=p_business_id and id=p_queue_item_id and status='open' for update;if not found then raise exception 'Basket item not found';end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found';end if;
  select * into v_occ from public.schedule_occurrences_v2 where business_id=p_business_id and queue_item_id=p_queue_item_id for update;
  v_job_id:=case when nullif(v_item.source_schedule_job_id,'') is not null then v_item.source_schedule_job_id else 'sch-v2-'||replace(gen_random_uuid()::text,'-','') end;
  insert into public.schedule_jobs(business_id,id,visit_date,client_id,team_id,status,estimated_hours,sort_order,service_ids,payload,created_by,updated_by)
  values(p_business_id,v_job_id,p_date,v_item.client_id,p_team_id,'scheduled',v_item.estimated_minutes::numeric/60,coalesce(p_sort_order,99),coalesce(v_item.service_ids,'{}'),v_item.payload||jsonb_build_object('serviceLocationId',nullif(v_item.service_site_id,''),'v2RestoredFromQueue',true,'manualOverride',true,'autoAssigned',false),auth.uid(),auth.uid());
  update public.schedule_queue_items_v2 set status='scheduled',updated_by=auth.uid(),updated_at=now() where business_id=p_business_id and id=p_queue_item_id;
  if v_occ.id is not null then update public.schedule_occurrences_v2 set schedule_job_id=v_job_id,queue_item_id=null,planned_date=p_date,status='scheduled',manual_override=true,updated_at=now() where business_id=p_business_id and id=v_occ.id;end if;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job',v_job_id,'v2_basket_scheduled',jsonb_build_object('queue_id',p_queue_item_id,'date',p_date,'team_id',p_team_id,'recurring',v_occ.id is not null));
  return jsonb_build_object('visit_id',v_job_id,'queue_id',p_queue_item_id);
end;$$;

revoke all on function public.tuinbooks_v2_monthly_due_date(date,integer,integer) from public,anon,authenticated;
revoke all on function public.tuinbooks_v2_series_slot_dates(uuid,text,text,date,date) from public,anon,authenticated;
revoke all on function public.tuinbooks_v2_ensure_series_horizon(uuid,date,date) from public;
revoke all on function public.tuinbooks_v2_move_series_future(uuid,text,date,text,integer) from public;
grant execute on function public.tuinbooks_v2_ensure_series_horizon(uuid,date,date) to authenticated;
grant execute on function public.tuinbooks_v2_move_series_future(uuid,text,date,text,integer) to authenticated;

commit;

-- ============================================================================
-- END migration-v2-recurrence-authority.sql
-- ============================================================================

-- ============================================================================
-- BEGIN migration-v2-operational-states.sql
-- ============================================================================

-- TuinBooks v2 Milestone 4: operational visit states, client service holds and day actions.
-- REQUIRES the Milestone 2 + 3 migrations first.
-- ADDITIVE ONLY. Does not modify legacy TuinBooks application code or tables except
-- schedule_jobs payload/status through explicit admin-only RPC calls.

begin;

create table if not exists public.client_service_holds_v2 (
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id text not null,
  active boolean not null default true,
  reason text not null default 'Do not service',
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,client_id),
  constraint client_service_holds_v2_client_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete cascade
);

create table if not exists public.schedule_day_actions_v2 (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  calendar_date date not null,
  team_id text not null,
  kind text not null check (kind in ('team_note','internal_event')),
  title text not null default '',
  detail text not null default '',
  calendar_time time,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint schedule_day_actions_v2_team_fk foreign key (business_id,team_id)
    references public.teams(business_id,id) on delete cascade
);
create index if not exists schedule_day_actions_v2_week_idx on public.schedule_day_actions_v2(business_id,calendar_date,team_id,status);

alter table public.client_service_holds_v2 enable row level security;
alter table public.schedule_day_actions_v2 enable row level security;
drop policy if exists client_service_holds_v2_select on public.client_service_holds_v2;
create policy client_service_holds_v2_select on public.client_service_holds_v2 for select to authenticated using (public.is_business_admin(business_id));
drop policy if exists schedule_day_actions_v2_select on public.schedule_day_actions_v2;
create policy schedule_day_actions_v2_select on public.schedule_day_actions_v2 for select to authenticated using (public.is_business_admin(business_id));
grant select on public.client_service_holds_v2,public.schedule_day_actions_v2 to authenticated;
revoke insert,update,delete on public.client_service_holds_v2,public.schedule_day_actions_v2 from authenticated;

create or replace function public.tuinbooks_v2_cancel_visit(p_business_id uuid,p_visit_id text,p_charge boolean,p_reason text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job public.schedule_jobs%rowtype;v_billing text:=case when p_charge then 'charge' else 'no-charge' end;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;
  if not found then raise exception 'Visit not found'; end if;
  if lower(v_job.status)='completed' then raise exception 'Completed visits cannot be cancelled'; end if;
  update public.schedule_jobs set status='cancelled',updated_by=auth.uid(),updated_at=now(),payload=payload||jsonb_build_object('cancellationBilling',v_billing,'billingDisposition',v_billing,'cancelReason',trim(coalesce(p_reason,'')),'cancelledV2',true,'cancelledAt',now()) where business_id=p_business_id and id=p_visit_id;
  update public.schedule_occurrences_v2 set status='cancelled',updated_at=now() where business_id=p_business_id and schedule_job_id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_visit_cancelled',jsonb_build_object('billing',v_billing,'reason',trim(coalesce(p_reason,''))));
  return jsonb_build_object('id',p_visit_id,'status','cancelled','billing',v_billing);
end;$$;

create or replace function public.tuinbooks_v2_undo_cancel_visit(p_business_id uuid,p_visit_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job public.schedule_jobs%rowtype;v_billing text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;
  if not found then raise exception 'Visit not found'; end if;
  if lower(v_job.status) not in ('cancelled','canceled') then raise exception 'Visit is not cancelled'; end if;
  v_billing:=case when lower(coalesce(v_job.payload->>'visitType',v_job.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(v_job.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end;
  update public.schedule_jobs set status='scheduled',updated_by=auth.uid(),updated_at=now(),payload=(payload-'cancellationBilling'-'cancelReason'-'cancelledV2'-'cancelledAt')||jsonb_build_object('billingDisposition',v_billing,'cancelUndoV2',true,'cancelUndoAt',now()) where business_id=p_business_id and id=p_visit_id;
  update public.schedule_occurrences_v2 set status='scheduled',updated_at=now() where business_id=p_business_id and schedule_job_id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_visit_cancel_undone','{}'::jsonb);
  return jsonb_build_object('id',p_visit_id,'status','scheduled');
end;$$;

create or replace function public.tuinbooks_v2_mark_visit_missed(p_business_id uuid,p_visit_id text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job public.schedule_jobs%rowtype;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;
  if not found then raise exception 'Visit not found'; end if;
  if lower(v_job.status) in ('completed','cancelled','canceled') then raise exception 'Completed/cancelled visits cannot be marked missed'; end if;
  update public.schedule_jobs set status='missed',updated_by=auth.uid(),updated_at=now(),payload=payload||jsonb_build_object('missedV2',true,'missedReason',trim(coalesce(p_reason,'')),'missedAt',now()) where business_id=p_business_id and id=p_visit_id;
  update public.schedule_occurrences_v2 set status='missed',updated_at=now() where business_id=p_business_id and schedule_job_id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_visit_missed',jsonb_build_object('reason',trim(coalesce(p_reason,''))));
  return jsonb_build_object('id',p_visit_id,'status','missed');
end;$$;

create or replace function public.tuinbooks_v2_reschedule_missed_visit(p_business_id uuid,p_visit_id text,p_new_visit_id text,p_date date,p_team_id text,p_sort_order integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_job public.schedule_jobs%rowtype;v_new_payload jsonb;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;
  if not found then raise exception 'Visit not found'; end if;
  if lower(v_job.status)<>'missed' then raise exception 'Only a missed visit can be rescheduled'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found'; end if;
  if exists(select 1 from public.schedule_jobs where business_id=p_business_id and id=p_new_visit_id) then raise exception 'Replacement visit id already exists'; end if;
  v_new_payload:=v_job.payload||jsonb_build_object('rescheduledVisitV2',true,'rescheduledFromVisitId',p_visit_id,'manualOverride',true,'autoGenerated',false,'autoAssigned',false,'v2RescheduledAt',now());
  insert into public.schedule_jobs(business_id,id,visit_date,client_id,team_id,status,estimated_hours,sort_order,service_ids,payload,created_by,updated_by) values(p_business_id,p_new_visit_id,p_date,v_job.client_id,p_team_id,'scheduled',v_job.estimated_hours,coalesce(p_sort_order,99),coalesce(v_job.service_ids,'{}'),v_new_payload,auth.uid(),auth.uid());
  update public.schedule_jobs set status='rescheduled',updated_by=auth.uid(),updated_at=now(),payload=payload||jsonb_build_object('resolvedMissedV2',true,'rescheduledToVisitId',p_new_visit_id,'resolvedAt',now()) where business_id=p_business_id and id=p_visit_id;
  update public.schedule_occurrences_v2 set status='rescheduled',updated_at=now() where business_id=p_business_id and schedule_job_id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_missed_rescheduled',jsonb_build_object('replacement_id',p_new_visit_id,'date',p_date,'team_id',p_team_id));
  return jsonb_build_object('original_id',p_visit_id,'replacement_id',p_new_visit_id,'date',p_date);
end;$$;

create or replace function public.tuinbooks_v2_set_visit_suspension(p_business_id uuid,p_visit_ids text[],p_suspended boolean,p_reason text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id text;v_changed integer:=0;v_status text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  foreach v_id in array coalesce(p_visit_ids,'{}'::text[]) loop
    select lower(status) into v_status from public.schedule_jobs where business_id=p_business_id and id=v_id for update;
    if v_status is null then raise exception 'Visit % not found',v_id; end if;
    if p_suspended and v_status in ('completed','cancelled','canceled','rescheduled') then raise exception 'Visit % cannot be suspended from status %',v_id,v_status; end if;
    if not p_suspended and v_status<>'suspended' then raise exception 'Visit % is not suspended',v_id; end if;
    update public.schedule_jobs set status=case when p_suspended then 'suspended' else 'scheduled' end,updated_by=auth.uid(),updated_at=now(),payload=payload||jsonb_build_object('suspendedV2',p_suspended,'suspensionReason',case when p_suspended then trim(coalesce(p_reason,'')) else '' end,'suspensionChangedAt',now()) where business_id=p_business_id and id=v_id;
    update public.schedule_occurrences_v2 set status=case when p_suspended then 'suspended' else 'scheduled' end,updated_at=now() where business_id=p_business_id and schedule_job_id=v_id;
    v_changed:=v_changed+1;
  end loop;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job','bulk',case when p_suspended then 'v2_visit_suspended' else 'v2_visit_resumed' end,jsonb_build_object('visit_ids',p_visit_ids,'reason',trim(coalesce(p_reason,''))));
  return jsonb_build_object('changed',v_changed,'suspended',p_suspended);
end;$$;

create or replace function public.tuinbooks_v2_set_client_service_hold(p_business_id uuid,p_client_id text,p_active boolean,p_reason text default 'Do not service',p_note text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.customers where business_id=p_business_id and id=p_client_id) then raise exception 'Client not found'; end if;
  insert into public.client_service_holds_v2(business_id,client_id,active,reason,note,created_by,updated_by) values(p_business_id,p_client_id,p_active,coalesce(nullif(trim(p_reason),''),'Do not service'),trim(coalesce(p_note,'')),auth.uid(),auth.uid()) on conflict(business_id,client_id) do update set active=excluded.active,reason=excluded.reason,note=excluded.note,updated_by=auth.uid(),updated_at=now();
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'customer',p_client_id,case when p_active then 'v2_do_not_service_set' else 'v2_do_not_service_cleared' end,jsonb_build_object('reason',p_reason,'note',p_note));
  return jsonb_build_object('client_id',p_client_id,'active',p_active);
end;$$;

create or replace function public.tuinbooks_v2_save_day_action(p_business_id uuid,p_action_id text,p_date date,p_team_id text,p_kind text,p_title text,p_detail text,p_time time default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if p_kind not in ('team_note','internal_event') then raise exception 'Unsupported action kind'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found'; end if;
  if p_kind='team_note' and trim(coalesce(p_detail,''))='' then raise exception 'Instruction is required'; end if;
  if p_kind='internal_event' and trim(coalesce(p_title,''))='' then raise exception 'Event title is required'; end if;
  insert into public.schedule_day_actions_v2(business_id,id,calendar_date,team_id,kind,title,detail,calendar_time,status,created_by,updated_by) values(p_business_id,p_action_id,p_date,p_team_id,p_kind,case when p_kind='team_note' then 'Day instruction' else trim(coalesce(p_title,'')) end,trim(coalesce(p_detail,'')),case when p_kind='team_note' then null else p_time end,'active',auth.uid(),auth.uid()) on conflict(business_id,id) do update set calendar_date=excluded.calendar_date,team_id=excluded.team_id,kind=excluded.kind,title=excluded.title,detail=excluded.detail,calendar_time=excluded.calendar_time,status='active',updated_by=auth.uid(),updated_at=now();
  return jsonb_build_object('id',p_action_id,'status','active');
end;$$;

create or replace function public.tuinbooks_v2_remove_day_action(p_business_id uuid,p_action_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  update public.schedule_day_actions_v2 set status='cancelled',updated_by=auth.uid(),updated_at=now() where business_id=p_business_id and id=p_action_id;
  if not found then raise exception 'Day action not found'; end if;
  return jsonb_build_object('id',p_action_id,'status','cancelled');
end;$$;

revoke all on function public.tuinbooks_v2_cancel_visit(uuid,text,boolean,text) from public;
revoke all on function public.tuinbooks_v2_undo_cancel_visit(uuid,text) from public;
revoke all on function public.tuinbooks_v2_mark_visit_missed(uuid,text,text) from public;
revoke all on function public.tuinbooks_v2_reschedule_missed_visit(uuid,text,text,date,text,integer) from public;
revoke all on function public.tuinbooks_v2_set_visit_suspension(uuid,text[],boolean,text) from public;
revoke all on function public.tuinbooks_v2_set_client_service_hold(uuid,text,boolean,text,text) from public;
revoke all on function public.tuinbooks_v2_save_day_action(uuid,text,date,text,text,text,text,time) from public;
revoke all on function public.tuinbooks_v2_remove_day_action(uuid,text) from public;
grant execute on function public.tuinbooks_v2_cancel_visit(uuid,text,boolean,text) to authenticated;
grant execute on function public.tuinbooks_v2_undo_cancel_visit(uuid,text) to authenticated;
grant execute on function public.tuinbooks_v2_mark_visit_missed(uuid,text,text) to authenticated;
grant execute on function public.tuinbooks_v2_reschedule_missed_visit(uuid,text,text,date,text,integer) to authenticated;
grant execute on function public.tuinbooks_v2_set_visit_suspension(uuid,text[],boolean,text) to authenticated;
grant execute on function public.tuinbooks_v2_set_client_service_hold(uuid,text,boolean,text,text) to authenticated;
grant execute on function public.tuinbooks_v2_save_day_action(uuid,text,date,text,text,text,text,time) to authenticated;
grant execute on function public.tuinbooks_v2_remove_day_action(uuid,text) to authenticated;

commit;

-- ============================================================================
-- END migration-v2-operational-states.sql
-- ============================================================================

-- ============================================================================
-- BEGIN migration-v2-client-authority.sql
-- ============================================================================

-- TuinBooks v2 Milestone 5: client/account, service-location and service-agreement authority.
-- REQUIRES migration-v2-recurrence-authority.sql first.
-- ADDITIVE. Existing customers/service_sites remain canonical account/location tables.
-- New service agreements are v2-owned and version future recurrence instead of rewriting history.

begin;

-- Milestone 5 adds an optional series end boundary; existing v2 series remain valid.
alter table public.schedule_series_v2 add column if not exists end_date date;

-- Replace the date generator so an agreement end date is authoritative.
create or replace function public.tuinbooks_v2_series_slot_dates(p_business_id uuid,p_series_id text,p_slot_id text,p_from date,p_through date)
returns setof date language plpgsql stable set search_path=public as $$
declare v_series public.schedule_series_v2%rowtype;v_slot public.schedule_series_slots_v2%rowtype;v_date date;v_interval integer;v_weeks integer;v_due date;v_through date;
begin
  select * into v_series from public.schedule_series_v2 where business_id=p_business_id and id=p_series_id and status='active';
  if not found then return; end if;
  select * into v_slot from public.schedule_series_slots_v2 where business_id=p_business_id and id=p_slot_id and series_id=p_series_id;
  if not found or p_through<p_from then return; end if;
  v_through:=least(p_through,coalesce(v_series.end_date,p_through));
  if v_through<p_from then return; end if;
  if v_series.frequency='monthly' then
    v_date:=date_trunc('month',p_from)::date;
    while v_date<=date_trunc('month',v_through)::date loop
      v_due:=public.tuinbooks_v2_monthly_due_date(v_date,v_slot.weekday,coalesce(v_slot.monthly_ordinal,least(5,ceil(extract(day from v_series.anchor_date)/7.0)::integer)));
      if v_due between p_from and v_through and v_due>=v_series.anchor_date then return next v_due; end if;
      v_date:=(v_date+interval '1 month')::date;
    end loop;
    return;
  end if;
  v_interval:=case v_series.frequency when 'fortnightly' then 2 when 'four-weekly' then 4 else 1 end;
  v_date:=p_from;
  while v_date<=v_through loop
    if v_date>=v_series.anchor_date and extract(isodow from v_date)::integer=v_slot.weekday then
      v_weeks:=(date_trunc('week',v_date)::date-date_trunc('week',v_series.anchor_date)::date)/7;
      if v_weeks>=0 and mod(v_weeks,v_interval)=0 then return next v_date; end if;
    end if;
    v_date:=v_date+1;
  end loop;
end;$$;

create table if not exists public.client_service_agreements_v2 (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  client_id text not null,
  service_site_id text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  start_date date not null,
  end_date date,
  frequency text not null check (frequency in ('weekly','fortnightly','four-weekly','monthly')),
  weekdays smallint[] not null default '{}',
  monthly_ordinal smallint check (monthly_ordinal between 1 and 5),
  default_team_id text not null,
  estimated_minutes integer not null default 60 check (estimated_minutes between 15 and 480),
  service_ids text[] not null default '{}',
  notes text not null default '',
  monthly_fee numeric(12,2),
  schedule_series_id text,
  version integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint client_service_agreements_v2_client_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete cascade,
  constraint client_service_agreements_v2_site_fk foreign key (business_id,service_site_id)
    references public.service_sites(business_id,id) on delete cascade,
  constraint client_service_agreements_v2_team_fk foreign key (business_id,default_team_id)
    references public.teams(business_id,id) on delete restrict
);
create index if not exists client_service_agreements_v2_client_idx on public.client_service_agreements_v2(business_id,client_id,status);
create index if not exists client_service_agreements_v2_site_idx on public.client_service_agreements_v2(business_id,service_site_id,status);

alter table public.client_service_agreements_v2 enable row level security;
drop policy if exists client_service_agreements_v2_select on public.client_service_agreements_v2;
create policy client_service_agreements_v2_select on public.client_service_agreements_v2 for select to authenticated using (public.is_business_admin(business_id));
grant select on public.client_service_agreements_v2 to authenticated;
revoke insert,update,delete on public.client_service_agreements_v2 from authenticated;

create or replace function public.tuinbooks_v2_save_account(
  p_business_id uuid,p_id text,p_name text,p_status text,p_contact_name text,p_phone text,p_email text
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if nullif(trim(p_id),'') is null or nullif(trim(p_name),'') is null then raise exception 'Account id and name are required'; end if;
  if coalesce(p_status,'active') not in ('active','paused','archived') then raise exception 'Invalid account status'; end if;
  insert into public.customers(business_id,id,name,status,contact_name,phone,email)
  values(p_business_id,trim(p_id),trim(p_name),coalesce(p_status,'active'),coalesce(trim(p_contact_name),''),coalesce(trim(p_phone),''),lower(coalesce(trim(p_email),'')))
  on conflict(business_id,id) do update set name=excluded.name,status=excluded.status,contact_name=excluded.contact_name,phone=excluded.phone,email=excluded.email,updated_at=now();
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'customer',trim(p_id),'v2_account_saved',jsonb_build_object('status',coalesce(p_status,'active')));
  return jsonb_build_object('id',trim(p_id));
end;$$;

create or replace function public.tuinbooks_v2_save_service_location(
  p_business_id uuid,p_id text,p_client_id text,p_site_name text,p_address text,p_suburb text,p_access_notes text,p_instructions text,p_active boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.customers where business_id=p_business_id and id=p_client_id) then raise exception 'Account not found'; end if;
  if nullif(trim(p_id),'') is null or nullif(trim(p_address),'') is null then raise exception 'Location id and street address are required'; end if;
  insert into public.service_sites(business_id,id,customer_id,site_name,address,suburb,access_notes,instructions,active)
  values(p_business_id,trim(p_id),p_client_id,coalesce(trim(p_site_name),''),trim(p_address),coalesce(trim(p_suburb),''),coalesce(trim(p_access_notes),''),coalesce(trim(p_instructions),''),coalesce(p_active,true))
  on conflict(business_id,id) do update set customer_id=excluded.customer_id,site_name=excluded.site_name,address=excluded.address,suburb=excluded.suburb,access_notes=excluded.access_notes,instructions=excluded.instructions,active=excluded.active,updated_at=now();
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'service_site',trim(p_id),'v2_service_location_saved',jsonb_build_object('client_id',p_client_id,'active',coalesce(p_active,true)));
  return jsonb_build_object('id',trim(p_id));
end;$$;

create or replace function public.tuinbooks_v2_save_service_agreement(
  p_business_id uuid,p_id text,p_client_id text,p_service_site_id text,p_status text,p_start_date date,p_end_date date,
  p_frequency text,p_weekdays smallint[],p_monthly_ordinal integer,p_default_team_id text,p_estimated_minutes integer,
  p_service_ids text[],p_notes text,p_monthly_fee numeric,p_effective_date date
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_existing public.client_service_agreements_v2%rowtype;
  v_old_series text;
  v_new_series text;
  v_version integer:=1;
  v_day smallint;
  v_slot text;
  v_anchor date;
  v_effective date:=coalesce(p_effective_date,current_date);
  v_removed integer:=0;
  v_pattern_changed boolean:=true;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if nullif(trim(p_id),'') is null then raise exception 'Agreement id is required'; end if;
  if p_status not in ('draft','active','paused','ended') then raise exception 'Invalid agreement status'; end if;
  if p_frequency not in ('weekly','fortnightly','four-weekly','monthly') then raise exception 'Invalid recurrence frequency'; end if;
  if p_start_date is null then raise exception 'Agreement start date is required'; end if;
  if p_end_date is not null and p_end_date<p_start_date then raise exception 'Agreement end date cannot precede start date'; end if;
  if coalesce(array_length(p_weekdays,1),0)=0 or exists(select 1 from unnest(p_weekdays) d where d<1 or d>7) then raise exception 'At least one valid service weekday is required'; end if;
  if p_frequency<>'weekly' and array_length(p_weekdays,1)<>1 then raise exception 'This frequency uses exactly one recurring weekday'; end if;
  if p_frequency='monthly' and coalesce(p_monthly_ordinal,0) not between 1 and 5 then raise exception 'Monthly week-of-month is required'; end if;
  if p_estimated_minutes not between 15 and 480 then raise exception 'Estimated minutes must be between 15 and 480'; end if;
  if not exists(select 1 from public.service_sites where business_id=p_business_id and id=p_service_site_id and customer_id=p_client_id) then raise exception 'Service location does not belong to this account'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_default_team_id and active=true) then raise exception 'Default team not found'; end if;

  select * into v_existing from public.client_service_agreements_v2 where business_id=p_business_id and id=p_id for update;
  if found then
    v_old_series:=nullif(v_existing.schedule_series_id,'');v_version:=v_existing.version+1;
    v_pattern_changed:=not (v_existing.status='active' and p_status='active' and v_old_series is not null
      and v_existing.client_id=p_client_id and v_existing.service_site_id=p_service_site_id
      and v_existing.start_date=p_start_date and v_existing.end_date is not distinct from p_end_date
      and v_existing.frequency=p_frequency and v_existing.weekdays=p_weekdays
      and v_existing.monthly_ordinal is not distinct from (case when p_frequency='monthly' then p_monthly_ordinal else null end)
      and v_existing.default_team_id=p_default_team_id and v_existing.estimated_minutes=p_estimated_minutes
      and v_existing.service_ids=coalesce(p_service_ids,'{}'));
  end if;
  v_anchor:=greatest(p_start_date,v_effective);

  -- Retire only the old v2 recurrence version. Protected/manual/past occurrences remain historical facts.
  if v_old_series is not null and v_pattern_changed then
    delete from public.schedule_jobs j
    using public.schedule_occurrences_v2 o
    where o.business_id=p_business_id and o.series_id=v_old_series and o.occurrence_date>=v_anchor
      and o.manual_override=false and o.status='scheduled' and o.schedule_job_id=j.id and j.business_id=p_business_id
      and lower(j.status)='scheduled';
    delete from public.schedule_occurrences_v2 where business_id=p_business_id and series_id=v_old_series and occurrence_date>=v_anchor and manual_override=false and status='scheduled';
    get diagnostics v_removed=row_count;
    update public.schedule_series_v2 set status='ended',updated_by=auth.uid(),updated_at=now(),payload=payload||jsonb_build_object('supersededByAgreement',p_id,'supersededAt',now(),'effectiveDate',v_anchor) where business_id=p_business_id and id=v_old_series;
  end if;

  if p_status='active' and not v_pattern_changed and v_old_series is not null then
    v_new_series:=v_old_series;
  elsif p_status='active' then
    v_new_series:='series-v2-'||replace(gen_random_uuid()::text,'-','');
    insert into public.schedule_series_v2(business_id,id,client_id,service_site_id,status,frequency,anchor_date,end_date,payload,created_by,updated_by)
    values(p_business_id,v_new_series,p_client_id,p_service_site_id,'active',p_frequency,v_anchor,p_end_date,jsonb_build_object('agreementId',p_id,'agreementVersion',v_version,'v2AgreementSeries',true),auth.uid(),auth.uid());
    foreach v_day in array p_weekdays loop
      v_slot:='slot-v2-'||replace(gen_random_uuid()::text,'-','');
      insert into public.schedule_series_slots_v2(business_id,id,series_id,weekday,monthly_ordinal,default_team_id,estimated_minutes,service_ids,payload)
      values(p_business_id,v_slot,v_new_series,v_day,case when p_frequency='monthly' then p_monthly_ordinal else null end,p_default_team_id,p_estimated_minutes,coalesce(p_service_ids,'{}'),jsonb_build_object('agreementId',p_id,'agreementVersion',v_version));
    end loop;
  else
    v_new_series:=null;
  end if;

  insert into public.client_service_agreements_v2(business_id,id,client_id,service_site_id,status,start_date,end_date,frequency,weekdays,monthly_ordinal,default_team_id,estimated_minutes,service_ids,notes,monthly_fee,schedule_series_id,version,created_by,updated_by)
  values(p_business_id,p_id,p_client_id,p_service_site_id,p_status,p_start_date,p_end_date,p_frequency,p_weekdays,case when p_frequency='monthly' then p_monthly_ordinal else null end,p_default_team_id,p_estimated_minutes,coalesce(p_service_ids,'{}'),coalesce(p_notes,''),p_monthly_fee,v_new_series,v_version,auth.uid(),auth.uid())
  on conflict(business_id,id) do update set client_id=excluded.client_id,service_site_id=excluded.service_site_id,status=excluded.status,start_date=excluded.start_date,end_date=excluded.end_date,frequency=excluded.frequency,weekdays=excluded.weekdays,monthly_ordinal=excluded.monthly_ordinal,default_team_id=excluded.default_team_id,estimated_minutes=excluded.estimated_minutes,service_ids=excluded.service_ids,notes=excluded.notes,monthly_fee=excluded.monthly_fee,schedule_series_id=excluded.schedule_series_id,version=excluded.version,updated_by=auth.uid(),updated_at=now();

  if v_new_series is not null then perform public.tuinbooks_v2_ensure_series_horizon(p_business_id,v_anchor,v_anchor+55);end if;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'service_agreement_v2',p_id,'v2_service_agreement_saved',jsonb_build_object('status',p_status,'version',v_version,'new_series_id',v_new_series,'retired_series_id',v_old_series,'effective_date',v_anchor,'removed_future_auto_occurrences',v_removed));
  return jsonb_build_object('id',p_id,'version',v_version,'schedule_series_id',v_new_series,'effective_date',v_anchor);
end;$$;

revoke all on function public.tuinbooks_v2_save_account(uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.tuinbooks_v2_save_service_location(uuid,text,text,text,text,text,text,text,boolean) from public,anon;
revoke all on function public.tuinbooks_v2_save_service_agreement(uuid,text,text,text,text,date,date,text,smallint[],integer,text,integer,text[],text,numeric,date) from public,anon;
grant execute on function public.tuinbooks_v2_save_account(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.tuinbooks_v2_save_service_location(uuid,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.tuinbooks_v2_save_service_agreement(uuid,text,text,text,text,date,date,text,smallint[],integer,text,integer,text[],text,numeric,date) to authenticated;

commit;

-- ============================================================================
-- END migration-v2-client-authority.sql
-- ============================================================================

-- ============================================================================
-- BEGIN migration-v2-work-mobile.sql
-- ============================================================================

-- TuinBooks v2 Milestone 6: Work + Field Mobile + Owner Mobile
-- Additive only. Depends on the existing TuinBooks operational tables and v2 M4 tables.
-- It does not replace business_members, team_assignments, work_records, field_opportunities or schedule_jobs.
begin;

create table if not exists public.work_submission_receipts_v2(
  business_id uuid not null references public.businesses(id) on delete cascade,
  submission_id text not null,
  work_record_id text not null,
  schedule_job_id text not null,
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(business_id,submission_id)
);
alter table public.work_submission_receipts_v2 enable row level security;
revoke all on public.work_submission_receipts_v2 from anon,authenticated;

create or replace function public.tuinbooks_v2_mobile_context()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user uuid:=auth.uid(); v_member public.business_members%rowtype; v_profile text; v_teams jsonb;
begin
  if v_user is null then return null; end if;
  select * into v_member from public.business_members
   where user_id=v_user and active=true
   order by case lower(role) when 'owner' then 1 when 'admin' then 2 when 'field' then 3 else 4 end
   limit 1;
  if not found then return null; end if;
  v_profile:=case when lower(v_member.role) in ('owner','admin','administrator','office_manager') then 'owner_mobile' else 'field_worker' end;
  if v_profile='owner_mobile' then
    select coalesce(jsonb_agg(t.id order by t.created_at),'[]'::jsonb) into v_teams from public.teams t where t.business_id=v_member.business_id and t.active=true;
  else
    select coalesce(jsonb_agg(ta.team_id order by ta.is_primary desc,ta.created_at),'[]'::jsonb) into v_teams
      from public.team_assignments ta join public.teams t on t.business_id=ta.business_id and t.id=ta.team_id and t.active=true
      where ta.business_id=v_member.business_id and ta.user_id=v_user and ta.active=true;
  end if;
  return jsonb_build_object(
    'business_id',v_member.business_id,
    'business_name',(select b.name from public.businesses b where b.id=v_member.business_id),
    'user_id',v_user,'display_name',coalesce(v_member.display_name,''),
    'profile',v_profile,'assigned_team_ids',v_teams
  );
end;$$;
revoke all on function public.tuinbooks_v2_mobile_context() from public;
grant execute on function public.tuinbooks_v2_mobile_context() to authenticated;

create or replace function public.tuinbooks_v2_load_work_day(p_business_id uuid,p_date date)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_role text; v_is_admin boolean:=false; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select lower(role) into v_role from public.business_members where business_id=p_business_id and user_id=auth.uid() and active=true limit 1;
  if v_role is null then raise exception 'Business access required'; end if;
  v_is_admin:=v_role in ('owner','admin','administrator','office_manager');
  with visible_teams as (
    select t.* from public.teams t
    where t.business_id=p_business_id and t.active=true
      and (v_is_admin or exists(select 1 from public.team_assignments ta where ta.business_id=p_business_id and ta.user_id=auth.uid() and ta.team_id=t.id and ta.active=true))
  ), visible_jobs as (
    select j.* from public.schedule_jobs j join visible_teams t on t.id=j.team_id
    where j.business_id=p_business_id and j.visit_date=p_date
  ), visible_clients as (select distinct client_id from visible_jobs),
  visible_sites as (
    select s.* from public.service_sites s join visible_clients c on c.client_id=s.customer_id
    where s.business_id=p_business_id and s.active=true
  )
  select jsonb_build_object(
    'teams',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from visible_teams t),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.customers c join visible_clients v on v.client_id=c.id where c.business_id=p_business_id),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from visible_sites s),'[]'::jsonb),
    'visits',coalesce((select jsonb_agg(to_jsonb(j) order by j.team_id,j.sort_order,j.id) from visible_jobs j),'[]'::jsonb),
    'work_records',coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at) from public.work_records w join visible_teams t on t.id=w.team_id where w.business_id=p_business_id and w.work_date=p_date),'[]'::jsonb),
    'opportunities',coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at desc) from public.field_opportunities o join visible_teams t on t.id=o.team_id where o.business_id=p_business_id and (o.schedule_job_id in (select id from visible_jobs) or (o.created_at at time zone 'Africa/Johannesburg')::date=p_date)),'[]'::jsonb),
    'holds',coalesce((select jsonb_agg(to_jsonb(h)) from public.client_service_holds_v2 h join visible_clients c on c.client_id=h.client_id where h.business_id=p_business_id and h.active=true),'[]'::jsonb),
    'day_actions',coalesce((select jsonb_agg(to_jsonb(a) order by a.team_id,a.calendar_time,a.created_at) from public.schedule_day_actions_v2 a join visible_teams t on t.id=a.team_id where a.business_id=p_business_id and a.calendar_date=p_date and a.status='active'),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;$$;
revoke all on function public.tuinbooks_v2_load_work_day(uuid,date) from public;
grant execute on function public.tuinbooks_v2_load_work_day(uuid,date) to authenticated;

create or replace function public.tuinbooks_v2_complete_visit(
  p_business_id uuid,p_submission_id text,p_work_record_id text,p_schedule_id text,
  p_task_outcomes jsonb,p_note text default '',p_photo_paths text[] default '{}'
) returns text
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_role text; v_job public.schedule_jobs%rowtype; v_existing text; v_done int:=0; v_failed int:=0; v_outcome text; v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_submission_id),'') is null or nullif(trim(p_work_record_id),'') is null then raise exception 'Submission and work record IDs are required'; end if;
  select work_record_id into v_existing from public.work_submission_receipts_v2 where business_id=p_business_id and submission_id=p_submission_id;
  if v_existing is not null then return v_existing; end if;
  select lower(role) into v_role from public.business_members where business_id=p_business_id and user_id=auth.uid() and active=true limit 1;
  if v_role is null then raise exception 'Business access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_schedule_id for update;
  if not found then raise exception 'Scheduled visit not found'; end if;
  if v_role not in ('owner','admin','administrator','office_manager') and not exists(select 1 from public.team_assignments ta where ta.business_id=p_business_id and ta.user_id=auth.uid() and ta.team_id=v_job.team_id and ta.active=true) then raise exception 'This phone is not assigned to this team'; end if;
  if jsonb_typeof(p_task_outcomes)<>'array' or jsonb_array_length(p_task_outcomes)=0 then raise exception 'Every visit needs a task checklist'; end if;
  if exists(select 1 from jsonb_array_elements(p_task_outcomes) x where nullif(trim(x->>'task'),'') is null or coalesce(x->>'outcome','') not in ('Done','Not required today','Could not complete','Client declined') or (x->>'outcome' in ('Could not complete','Client declined') and nullif(trim(x->>'note'),'') is null)) then raise exception 'Every task needs a valid outcome and incomplete tasks need a reason'; end if;
  select count(*) filter(where x->>'outcome' in ('Done','Not required today')),count(*) filter(where x->>'outcome' in ('Could not complete','Client declined')) into v_done,v_failed from jsonb_array_elements(p_task_outcomes) x;
  v_outcome:=case when v_failed=0 then 'Completed' when v_done>0 or nullif(trim(coalesce(p_note,'')),'') is not null then 'Partially completed' else 'Unable to complete' end;
  select id into v_existing from public.work_records where business_id=p_business_id and schedule_job_id=p_schedule_id limit 1;
  if v_existing is not null then
    insert into public.work_submission_receipts_v2(business_id,submission_id,work_record_id,schedule_job_id,submitted_by) values(p_business_id,p_submission_id,v_existing,p_schedule_id,auth.uid()) on conflict do nothing;
    return v_existing;
  end if;
  insert into public.work_records(business_id,id,schedule_job_id,client_id,team_id,work_date,work_done,extra_description,photo_paths,outcome,payload,created_by)
  values(p_business_id,p_work_record_id,p_schedule_id,v_job.client_id,v_job.team_id,v_job.visit_date,
    coalesce(array(select x->>'task' from jsonb_array_elements(p_task_outcomes) x where x->>'outcome'='Done'),'{}'),coalesce(p_note,''),coalesce(p_photo_paths,'{}'),v_outcome,
    jsonb_build_object('taskOutcomesV2',p_task_outcomes,'serviceSiteId',coalesce(v_job.payload->>'serviceSiteId',v_job.payload->>'service_site_id',''),'submissionIdV2',p_submission_id,'outcome',v_outcome),auth.uid());
  v_status:=case when v_outcome='Completed' then 'completed' when v_outcome='Partially completed' then 'attention' else 'missed' end;
  update public.schedule_jobs set status=v_status,updated_by=auth.uid(),updated_at=now(),payload=payload||jsonb_build_object('fieldOutcome',v_outcome,'completedAt',now(),'completedBy',auth.uid(),'fieldSubmissionIdV2',p_submission_id) where business_id=p_business_id and id=p_schedule_id;
  insert into public.work_submission_receipts_v2(business_id,submission_id,work_record_id,schedule_job_id,submitted_by) values(p_business_id,p_submission_id,p_work_record_id,p_schedule_id,auth.uid());
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'work_record',p_work_record_id,'v2_visit_completed',jsonb_build_object('schedule_job_id',p_schedule_id,'team_id',v_job.team_id,'outcome',v_outcome));
  return p_work_record_id;
end;$$;
revoke all on function public.tuinbooks_v2_complete_visit(uuid,text,text,text,jsonb,text,text[]) from public;
grant execute on function public.tuinbooks_v2_complete_visit(uuid,text,text,text,jsonb,text,text[]) to authenticated;

create or replace function public.tuinbooks_v2_create_opportunity(
  p_business_id uuid,p_id text,p_schedule_id text,p_work_record_id text,p_category text,p_note text,p_photo_paths text[] default '{}'
) returns text
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_role text; v_job public.schedule_jobs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select lower(role) into v_role from public.business_members where business_id=p_business_id and user_id=auth.uid() and active=true limit 1;
  if v_role is null then raise exception 'Business access required'; end if;
  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_schedule_id;
  if not found then raise exception 'Scheduled visit not found'; end if;
  if v_role not in ('owner','admin','administrator','office_manager') and not exists(select 1 from public.team_assignments ta where ta.business_id=p_business_id and ta.user_id=auth.uid() and ta.team_id=v_job.team_id and ta.active=true) then raise exception 'This phone is not assigned to this team'; end if;
  if nullif(trim(p_note),'') is null then raise exception 'Opportunity note is required'; end if;
  insert into public.field_opportunities(business_id,id,client_id,schedule_job_id,work_record_id,team_id,category,note,photo_paths,status,review_decision,payload,created_by)
  values(p_business_id,p_id,v_job.client_id,p_schedule_id,nullif(p_work_record_id,''),v_job.team_id,coalesce(nullif(trim(p_category),''),'Other'),trim(p_note),coalesce(p_photo_paths,'{}'),'new','new',jsonb_build_object('source','tuinbooks-v2-mobile'),auth.uid())
  on conflict(business_id,id) do nothing;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'opportunity',p_id,'v2_opportunity_created',jsonb_build_object('schedule_job_id',p_schedule_id,'team_id',v_job.team_id,'category',p_category));
  return p_id;
end;$$;
revoke all on function public.tuinbooks_v2_create_opportunity(uuid,text,text,text,text,text,text[]) from public;
grant execute on function public.tuinbooks_v2_create_opportunity(uuid,text,text,text,text,text,text[]) to authenticated;

notify pgrst,'reload schema';
commit;

-- ============================================================================
-- END migration-v2-work-mobile.sql
-- ============================================================================

-- ============================================================================
-- BEGIN migration-v2-money-quotes.sql
-- ============================================================================

-- TuinBooks v2 Milestone 7: Quotes + Billing authority.
-- ADDITIVE. Reuses existing public.quotes/public.invoices; adds relational lines/payments and explicit RPCs.
begin;

create table if not exists public.quote_lines_v2(
 business_id uuid not null references public.businesses(id) on delete cascade,quote_id text not null,id text not null,position integer not null default 0,
 description text not null,quantity numeric(12,3) not null default 1,unit_price numeric(12,2) not null default 0,vat_rate numeric(6,3) not null default 0,
 source_visit_id text,source_quote_id text,category text not null default 'manual',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(business_id,quote_id,id),foreign key(business_id,quote_id) references public.quotes(business_id,id) on delete cascade);
create table if not exists public.invoice_lines_v2(
 business_id uuid not null references public.businesses(id) on delete cascade,invoice_id text not null,id text not null,position integer not null default 0,
 description text not null,quantity numeric(12,3) not null default 1,unit_price numeric(12,2) not null default 0,vat_rate numeric(6,3) not null default 0,
 source_visit_id text,source_quote_id text,category text not null default 'manual',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(business_id,invoice_id,id),foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete cascade);
create unique index if not exists invoice_lines_v2_visit_unique on public.invoice_lines_v2(business_id,source_visit_id) where source_visit_id is not null;
create table if not exists public.payments_v2(
 business_id uuid not null references public.businesses(id) on delete cascade,id text not null,client_id text not null,invoice_id text not null,payment_date date not null,
 amount numeric(12,2) not null check(amount>0),method text not null default 'EFT',reference text not null default '',note text not null default '',
 reversed_at timestamptz,reversal_reason text not null default '',created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(business_id,id),foreign key(business_id,client_id) references public.customers(business_id,id) on delete restrict,foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict);
create index if not exists payments_v2_invoice_idx on public.payments_v2(business_id,invoice_id,payment_date);

alter table public.quote_lines_v2 enable row level security;alter table public.invoice_lines_v2 enable row level security;alter table public.payments_v2 enable row level security;
drop policy if exists quote_lines_v2_select on public.quote_lines_v2;create policy quote_lines_v2_select on public.quote_lines_v2 for select to authenticated using(public.is_business_admin(business_id));
drop policy if exists invoice_lines_v2_select on public.invoice_lines_v2;create policy invoice_lines_v2_select on public.invoice_lines_v2 for select to authenticated using(public.is_business_admin(business_id));
drop policy if exists payments_v2_select on public.payments_v2;create policy payments_v2_select on public.payments_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.quote_lines_v2,public.invoice_lines_v2,public.payments_v2 to authenticated;revoke insert,update,delete on public.quote_lines_v2,public.invoice_lines_v2,public.payments_v2 from authenticated;

create or replace function public.tuinbooks_v2_money_lines_json(p_business_id uuid,p_kind text,p_document_id text,p_fallback jsonb)
returns jsonb language plpgsql stable set search_path=public as $$declare v jsonb;begin
 if p_kind='quote' then select jsonb_agg(jsonb_build_object('id',id,'description',description,'quantity',quantity,'unitPrice',unit_price,'vatRate',vat_rate,'sourceVisitId',source_visit_id,'sourceQuoteId',source_quote_id,'category',category) order by position,id) into v from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_document_id;
 else select jsonb_agg(jsonb_build_object('id',id,'description',description,'quantity',quantity,'unitPrice',unit_price,'vatRate',vat_rate,'sourceVisitId',source_visit_id,'sourceQuoteId',source_quote_id,'category',category) order by position,id) into v from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_document_id;end if;
 return coalesce(v,case when jsonb_typeof(p_fallback->'lines')='array' then p_fallback->'lines' when jsonb_typeof(p_fallback->'lineItems')='array' then p_fallback->'lineItems' else '[]'::jsonb end);end$$;

create or replace function public.tuinbooks_v2_load_money_workspace(p_business_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_accounts jsonb;v_quotes jsonb;v_invoices jsonb;v_payments jsonb;v_facts jsonb;v_settings jsonb;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]') into v_accounts from public.customers c where c.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('payload',coalesce(q.payload,'{}')||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'quote',q.id,q.payload))) order by q.updated_at desc),'[]') into v_quotes from public.quotes q where q.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('payload',coalesce(i.payload,'{}')||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'invoice',i.id,i.payload))) order by i.updated_at desc),'[]') into v_invoices from public.invoices i where i.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.payment_date desc,p.created_at desc),'[]') into v_payments from public.payments_v2 p where p.business_id=p_business_id;
 select coalesce(jsonb_agg(x order by x->>'visit_date'),'[]') into v_facts from(
   select jsonb_build_object('visit_id',j.id,'client_id',j.client_id,'visit_date',j.visit_date,'visit_type',case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end,
    'status',lower(j.status),'billing_disposition',coalesce(j.payload->>'billingDisposition',case when lower(j.status)='cancelled' and coalesce((j.payload->>'cancellationCharge')::boolean,false) then 'charge' when lower(j.status)='cancelled' then 'no-charge' else case when lower(coalesce(j.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end end),
    'description',coalesce(nullif(j.payload->>'task',''),nullif(j.payload->>'serviceDescription',''),'Garden service'),'amount',case when coalesce(j.payload->>'billingAmountV2','')~'^-?[0-9]+([.][0-9]+)?$' then (j.payload->>'billingAmountV2')::numeric else null end,
    'already_invoiced',exists(select 1 from public.invoice_lines_v2 l where l.business_id=j.business_id and l.source_visit_id=j.id)) x
   from public.schedule_jobs j where j.business_id=p_business_id and lower(j.status) in('completed','cancelled','suspended','rescheduled')
 ) s;
 select coalesce(settings->'v2',settings,'{}'::jsonb) into v_settings from public.businesses where id=p_business_id;
 return jsonb_build_object('accounts',v_accounts,'quotes',v_quotes,'invoices',v_invoices,'payments',v_payments,'billing_facts',v_facts,'vat_registered',lower(coalesce(v_settings->>'vatRegistered',v_settings->>'vat_registered','no')) in('yes','true','1'),'vat_rate',coalesce(nullif(v_settings->>'vatRate','')::numeric,nullif(v_settings->>'vat_rate','')::numeric,15));end$$;

create or replace function public.tuinbooks_v2_replace_quote_lines(p_business_id uuid,p_quote_id text,p_lines jsonb) returns void language plpgsql security definer set search_path=public as $$declare r jsonb;n integer:=0;begin delete from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_quote_id;for r in select * from jsonb_array_elements(coalesce(p_lines,'[]')) loop n:=n+1;insert into public.quote_lines_v2 values(p_business_id,p_quote_id,coalesce(nullif(r->>'id',''),'line-'||n),n,coalesce(r->>'description',''),coalesce((r->>'quantity')::numeric,1),coalesce((r->>'unitPrice')::numeric,0),coalesce((r->>'vatRate')::numeric,0),nullif(r->>'sourceVisitId',''),nullif(r->>'sourceQuoteId',''),coalesce(nullif(r->>'category',''),'manual'),now(),now());end loop;end$$;
create or replace function public.tuinbooks_v2_replace_invoice_lines(p_business_id uuid,p_invoice_id text,p_lines jsonb) returns void language plpgsql security definer set search_path=public as $$declare r jsonb;n integer:=0;begin delete from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_invoice_id;for r in select * from jsonb_array_elements(coalesce(p_lines,'[]')) loop n:=n+1;insert into public.invoice_lines_v2 values(p_business_id,p_invoice_id,coalesce(nullif(r->>'id',''),'line-'||n),n,coalesce(r->>'description',''),coalesce((r->>'quantity')::numeric,1),coalesce((r->>'unitPrice')::numeric,0),coalesce((r->>'vatRate')::numeric,0),nullif(r->>'sourceVisitId',''),nullif(r->>'sourceQuoteId',''),coalesce(nullif(r->>'category',''),'manual'),now(),now());end loop;end$$;

create or replace function public.tuinbooks_v2_save_quote(p_business_id uuid,p_quote_id text,p_client_id text,p_quote_date date,p_valid_until date,p_status text,p_number text,p_lines jsonb,p_notes text) returns text language plpgsql security definer set search_path=public as $$declare old_status text;payload jsonb;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if not exists(select 1 from public.customers where business_id=p_business_id and id=p_client_id) then raise exception 'Client not found';end if;if p_status not in('Draft','Sent','Accepted','Declined','Expired','Cancelled') then raise exception 'Invalid quote status';end if;
 select status into old_status from public.quotes where business_id=p_business_id and id=p_quote_id for update;if old_status='Accepted' then raise exception 'Accepted quotes are historical documents and cannot be edited';end if;
 if nullif(trim(p_number),'') is not null and exists(select 1 from public.quotes where business_id=p_business_id and id<>p_quote_id and payload->>'number'=trim(p_number)) then raise exception 'Quote number already exists';end if;
 payload=jsonb_build_object('number',coalesce(nullif(trim(p_number),''),p_quote_id),'validUntil',p_valid_until,'notes',coalesce(p_notes,''),'lines',coalesce(p_lines,'[]'::jsonb),'v2Document',true);
 insert into public.quotes(business_id,id,client_id,quote_date,status,payload,created_by) values(p_business_id,p_quote_id,p_client_id,p_quote_date,p_status,payload,auth.uid()) on conflict(business_id,id) do update set client_id=excluded.client_id,quote_date=excluded.quote_date,status=excluded.status,payload=excluded.payload,updated_at=now();perform public.tuinbooks_v2_replace_quote_lines(p_business_id,p_quote_id,p_lines);return p_quote_id;end$$;
create or replace function public.tuinbooks_v2_set_quote_status(p_business_id uuid,p_quote_id text,p_status text) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if p_status not in('Draft','Sent','Accepted','Declined','Expired','Cancelled') then raise exception 'Invalid quote status';end if;update public.quotes set status=p_status,payload=payload||case when p_status='Accepted' then jsonb_build_object('acceptedAt',now()) else '{}'::jsonb end,updated_at=now() where business_id=p_business_id and id=p_quote_id;if not found then raise exception 'Quote not found';end if;end$$;
create or replace function public.tuinbooks_v2_queue_accepted_quote(p_business_id uuid,p_quote_id text) returns text language plpgsql security definer set search_path=public as $$declare q public.quotes%rowtype;qid text:='queue-quote-'||p_quote_id;desc_text text;total numeric;begin if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;select * into q from public.quotes where business_id=p_business_id and id=p_quote_id and status='Accepted';if not found then raise exception 'Only accepted quotes can be sent to Basket';end if;select string_agg(description,', '),sum(quantity*unit_price*(1+vat_rate/100)) into desc_text,total from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_quote_id;insert into public.schedule_queue_items_v2(business_id,id,client_id,estimated_minutes,item_type,billing_disposition,reason,status,payload,created_by,updated_by) values(p_business_id,qid,q.client_id,0,'quoted','quoted','Accepted quote','open',jsonb_build_object('sourceQuoteId',p_quote_id,'task',coalesce(desc_text,'Quoted work'),'quotedTotal',coalesce(total,0),'visitType','quoted','billingDisposition','quoted'),auth.uid(),auth.uid()) on conflict(business_id,id) do update set status='open',payload=excluded.payload,updated_by=auth.uid(),updated_at=now();return qid;end$$;

create or replace function public.tuinbooks_v2_save_invoice(p_business_id uuid,p_invoice_id text,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_status text,p_number text,p_lines jsonb,p_notes text) returns text language plpgsql security definer set search_path=public as $$declare old_status text;total numeric;payload jsonb;begin if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if p_status not in('Draft','Ready','Sent','Paid','Partially paid','Overdue','Credited','Void') then raise exception 'Invalid invoice status';end if;select status into old_status from public.invoices where business_id=p_business_id and id=p_invoice_id for update;if old_status is not null and old_status not in('Draft','Ready') then raise exception 'Issued invoices are immutable; use payment/credit flows instead';end if;if trim(coalesce(p_number,''))<>'Draft' and exists(select 1 from public.invoices where business_id=p_business_id and id<>p_invoice_id and invoice_number=trim(p_number)) then raise exception 'Invoice number already exists';end if;select coalesce(sum(coalesce((r->>'quantity')::numeric,1)*coalesce((r->>'unitPrice')::numeric,0)*(1+coalesce((r->>'vatRate')::numeric,0)/100)),0) into total from jsonb_array_elements(coalesce(p_lines,'[]')) r;payload=jsonb_build_object('issueDate',p_issue_date,'dueDate',p_due_date,'notes',coalesce(p_notes,''),'lines',coalesce(p_lines,'[]'::jsonb),'v2Document',true);insert into public.invoices(business_id,id,client_id,invoice_month,invoice_number,status,total,payload,created_by) values(p_business_id,p_invoice_id,p_client_id,p_invoice_month,coalesce(nullif(trim(p_number),''),'Draft'),p_status,round(total,2),payload,auth.uid()) on conflict(business_id,id) do update set client_id=excluded.client_id,invoice_month=excluded.invoice_month,invoice_number=excluded.invoice_number,status=excluded.status,total=excluded.total,payload=excluded.payload,updated_at=now();perform public.tuinbooks_v2_replace_invoice_lines(p_business_id,p_invoice_id,p_lines);return p_invoice_id;end$$;

create or replace function public.tuinbooks_v2_set_visit_billing_amount(p_business_id uuid,p_visit_id text,p_amount numeric) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if p_amount<0 then raise exception 'Amount cannot be negative';end if;update public.schedule_jobs set payload=payload||jsonb_build_object('billingAmountV2',round(p_amount,2),'billingAmountSetAtV2',now()),updated_at=now(),updated_by=auth.uid() where business_id=p_business_id and id=p_visit_id;if not found then raise exception 'Visit not found';end if;end$$;

create or replace function public.tuinbooks_v2_create_invoice_from_facts(p_business_id uuid,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_visit_ids text[]) returns text language plpgsql security definer set search_path=public as $$declare inv_id text:='inv-v2-'||replace(gen_random_uuid()::text,'-','');lines jsonb:='[]';v record;fee numeric;vat numeric:=0;routine_added boolean:=false;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if coalesce(array_length(p_visit_ids,1),0)=0 then raise exception 'Choose billable visits';end if;
 select case when lower(coalesce(settings->'v2'->>'vatRegistered',settings->>'vatRegistered','no')) in('yes','true','1') then coalesce(nullif(settings->'v2'->>'vatRate','')::numeric,nullif(settings->>'vatRate','')::numeric,15) else 0 end into vat from public.businesses where id=p_business_id;
 for v in select j.*,case when lower(coalesce(j.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end vt,coalesce(j.payload->>'billingDisposition','routine') bd from public.schedule_jobs j where j.business_id=p_business_id and j.client_id=p_client_id and j.id=any(p_visit_ids) loop
   if exists(select 1 from public.invoice_lines_v2 l where l.business_id=p_business_id and l.source_visit_id=v.id) then raise exception 'Visit % is already invoiced',v.id;end if;
   if lower(v.status)='cancelled' and v.bd='no-charge' then continue;end if;
   if v.vt='routine' and lower(v.status)='completed' then
     if not routine_added then select nullif(c.payload#>>'{v2Billing,billingAmount}','')::numeric into fee from public.customers c where c.business_id=p_business_id and c.id=p_client_id;if fee is null then select sum(a.monthly_fee) into fee from public.client_service_agreements_v2 a where a.business_id=p_business_id and a.client_id=p_client_id and a.status='active' and a.monthly_fee is not null;end if;if fee is null then raise exception 'Routine monthly fee is not configured for this client';end if;lines=lines||jsonb_build_array(jsonb_build_object('id','line-routine-'||p_invoice_month,'description','Routine garden service - '||p_invoice_month,'quantity',1,'unitPrice',fee,'vatRate',vat,'sourceVisitId',v.id,'sourceQuoteId',null,'category','routine'));routine_added:=true;end if;
   elsif v.vt='quoted' then
     if coalesce(v.payload->>'quotedTotal','')~'^[0-9]+([.][0-9]+)?$' then fee=(v.payload->>'quotedTotal')::numeric;elsif coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$' then fee=(v.payload->>'billingAmountV2')::numeric;else raise exception 'Quoted visit % has no billing amount',v.id;end if;lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description',coalesce(nullif(v.payload->>'task',''),'Quoted work'),'quantity',1,'unitPrice',fee,'vatRate',vat,'sourceVisitId',v.id,'sourceQuoteId',nullif(v.payload->>'sourceQuoteId',''),'category','quoted'));
   else
     if not(coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$') then raise exception 'Set the Billing amount for visit % before invoicing',v.id;end if;fee=(v.payload->>'billingAmountV2')::numeric;lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description',case when lower(v.status)='cancelled' then 'Chargeable cancellation' else coalesce(nullif(v.payload->>'task',''),'Additional visit') end,'quantity',1,'unitPrice',fee,'vatRate',vat,'sourceVisitId',v.id,'sourceQuoteId',null,'category',case when lower(v.status)='cancelled' then 'cancellation' else 'additional' end));
   end if;
 end loop;
 perform public.tuinbooks_v2_save_invoice(p_business_id,inv_id,p_client_id,p_invoice_month,p_issue_date,p_due_date,'Draft','Draft',lines,'Created from Billing review');return inv_id;end$$;

create or replace function public.tuinbooks_v2_record_payment(p_business_id uuid,p_payment_id text,p_invoice_id text,p_date date,p_amount numeric,p_method text,p_reference text,p_note text) returns text language plpgsql security definer set search_path=public as $$declare inv public.invoices%rowtype;paid numeric;begin if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;select * into inv from public.invoices where business_id=p_business_id and id=p_invoice_id for update;if not found then raise exception 'Invoice not found';end if;if p_amount<=0 then raise exception 'Payment must be positive';end if;select coalesce(sum(amount),0) into paid from public.payments_v2 where business_id=p_business_id and invoice_id=p_invoice_id and reversed_at is null;if p_amount>inv.total-paid+.01 then raise exception 'Payment exceeds outstanding balance';end if;insert into public.payments_v2(business_id,id,client_id,invoice_id,payment_date,amount,method,reference,note,created_by) values(p_business_id,p_payment_id,inv.client_id,p_invoice_id,p_date,round(p_amount,2),coalesce(nullif(trim(p_method),''),'Other'),coalesce(trim(p_reference),''),coalesce(trim(p_note),''),auth.uid());paid=paid+p_amount;update public.invoices set status=case when paid>=total-.01 then 'Paid' else 'Partially paid' end,updated_at=now() where business_id=p_business_id and id=p_invoice_id;return p_payment_id;end$$;
create or replace function public.tuinbooks_v2_reverse_payment(p_business_id uuid,p_payment_id text,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare iid text;paid numeric;tot numeric;begin if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;update public.payments_v2 set reversed_at=now(),reversal_reason=coalesce(nullif(trim(p_reason),''),'Reversed'),updated_at=now() where business_id=p_business_id and id=p_payment_id and reversed_at is null returning invoice_id into iid;if iid is null then raise exception 'Active payment not found';end if;select total into tot from public.invoices where business_id=p_business_id and id=iid;select coalesce(sum(amount),0) into paid from public.payments_v2 where business_id=p_business_id and invoice_id=iid and reversed_at is null;update public.invoices set status=case when paid>=tot-.01 then 'Paid' when paid>0 then 'Partially paid' else 'Sent' end,updated_at=now() where business_id=p_business_id and id=iid;end$$;


create or replace function public.tuinbooks_v2_set_invoice_status(p_business_id uuid,p_invoice_id text,p_status text) returns void language plpgsql security definer set search_path=public as $$declare inv public.invoices%rowtype;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if p_status not in('Ready','Sent','Void') then raise exception 'Invalid invoice transition';end if;select * into inv from public.invoices where business_id=p_business_id and id=p_invoice_id for update;if not found then raise exception 'Invoice not found';end if;if inv.status not in('Draft','Ready') then raise exception 'Issued invoices are immutable';end if;if p_status='Sent' and coalesce(inv.invoice_number,'Draft')='Draft' then raise exception 'Set an invoice number before sending';end if;update public.invoices set status=p_status,updated_at=now(),payload=payload||case when p_status='Sent' then jsonb_build_object('sentAt',now(),'deliveryStatus','Sent') else '{}'::jsonb end where business_id=p_business_id and id=p_invoice_id;end$$;

revoke all on function public.tuinbooks_v2_load_money_workspace(uuid) from public,anon;grant execute on function public.tuinbooks_v2_load_money_workspace(uuid) to authenticated;
revoke all on function public.tuinbooks_v2_save_quote(uuid,text,text,date,date,text,text,jsonb,text) from public,anon;grant execute on function public.tuinbooks_v2_save_quote(uuid,text,text,date,date,text,text,jsonb,text) to authenticated;
revoke all on function public.tuinbooks_v2_set_quote_status(uuid,text,text) from public,anon;grant execute on function public.tuinbooks_v2_set_quote_status(uuid,text,text) to authenticated;
revoke all on function public.tuinbooks_v2_queue_accepted_quote(uuid,text) from public,anon;grant execute on function public.tuinbooks_v2_queue_accepted_quote(uuid,text) to authenticated;
revoke all on function public.tuinbooks_v2_save_invoice(uuid,text,text,text,date,date,text,text,jsonb,text) from public,anon;grant execute on function public.tuinbooks_v2_save_invoice(uuid,text,text,text,date,date,text,text,jsonb,text) to authenticated;
revoke all on function public.tuinbooks_v2_set_invoice_status(uuid,text,text) from public,anon;grant execute on function public.tuinbooks_v2_set_invoice_status(uuid,text,text) to authenticated;
revoke all on function public.tuinbooks_v2_set_visit_billing_amount(uuid,text,numeric) from public,anon;grant execute on function public.tuinbooks_v2_set_visit_billing_amount(uuid,text,numeric) to authenticated;
revoke all on function public.tuinbooks_v2_create_invoice_from_facts(uuid,text,text,date,date,text[]) from public,anon;grant execute on function public.tuinbooks_v2_create_invoice_from_facts(uuid,text,text,date,date,text[]) to authenticated;
revoke all on function public.tuinbooks_v2_record_payment(uuid,text,text,date,numeric,text,text,text) from public,anon;grant execute on function public.tuinbooks_v2_record_payment(uuid,text,text,date,numeric,text,text,text) to authenticated;
revoke all on function public.tuinbooks_v2_reverse_payment(uuid,text,text) from public,anon;grant execute on function public.tuinbooks_v2_reverse_payment(uuid,text,text) to authenticated;
commit;

-- ============================================================================
-- END migration-v2-money-quotes.sql
-- ============================================================================

-- ============================================================================
-- BEGIN migration-v2-business-import-management.sql
-- ============================================================================

-- TuinBooks v2 Milestone 8: Business settings, v4 workbook import/export and Management support.
-- ADDITIVE. Requires M3-M7 v2 migrations. Does not remove or rewrite legacy tables.
begin;

create table if not exists public.business_services_v2(
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  name text not null,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(business_id,id)
);
alter table public.business_services_v2 enable row level security;
drop policy if exists business_services_v2_select on public.business_services_v2;
create policy business_services_v2_select on public.business_services_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.business_services_v2 to authenticated;
revoke insert,update,delete on public.business_services_v2 from authenticated;

create or replace function public.tuinbooks_v2_load_business_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
 select * into b from public.businesses where id=p_business_id;if not found then raise exception 'Business not found';end if;
 return jsonb_build_object(
  'business',jsonb_build_object('id',b.id,'name',b.name,'phone',b.phone,'email',b.email,'address',b.address),
  'settings',coalesce(b.settings->'v2','{}'::jsonb),
  'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'notes',s.notes,'active',s.active) order by s.name) from public.business_services_v2 s where s.business_id=p_business_id),'[]'::jsonb),
  'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'capacity_hours',t.capacity_hours,'buffer_hours',t.buffer_hours,'active',t.active) order by t.name) from public.teams t where t.business_id=p_business_id),'[]'::jsonb)
 );
end;$$;

create or replace function public.tuinbooks_v2_save_business_settings(p_business_id uuid,p_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare n text:=trim(coalesce(p_settings->>'name',''));
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;if n='' then raise exception 'Business name is required';end if;
 update public.businesses set name=n,phone=trim(coalesce(p_settings->>'phone','')),email=lower(trim(coalesce(p_settings->>'email',''))),address=trim(coalesce(p_settings->>'address','')),settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{v2}',p_settings-'name'-'phone'-'email'-'address',true),updated_at=now() where id=p_business_id;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'business',p_business_id::text,'v2_business_settings_saved',jsonb_build_object('mode',p_settings->>'mode'));
 return jsonb_build_object('ok',true);
end;$$;

create or replace function public.tuinbooks_v2_save_business_service(p_business_id uuid,p_id text,p_name text,p_notes text,p_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;if trim(coalesce(p_id,''))='' or trim(coalesce(p_name,''))='' then raise exception 'Service id and name are required';end if;
 insert into public.business_services_v2(business_id,id,name,notes,active) values(p_business_id,trim(p_id),trim(p_name),coalesce(trim(p_notes),''),coalesce(p_active,true)) on conflict(business_id,id) do update set name=excluded.name,notes=excluded.notes,active=excluded.active,updated_at=now();
 return jsonb_build_object('id',trim(p_id));
end;$$;

create or replace function public.tuinbooks_v2_save_business_team(p_business_id uuid,p_id text,p_name text,p_capacity_hours numeric,p_buffer_hours numeric,p_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;if trim(coalesce(p_id,''))='' or trim(coalesce(p_name,''))='' then raise exception 'Team id and name are required';end if;if coalesce(p_capacity_hours,0)<=0 or coalesce(p_capacity_hours,0)>24 then raise exception 'Capacity must be between 0 and 24 hours';end if;if coalesce(p_buffer_hours,0)<0 or coalesce(p_buffer_hours,0)>8 then raise exception 'Buffer must be between 0 and 8 hours';end if;
 insert into public.teams(business_id,id,name,capacity_hours,buffer_hours,active) values(p_business_id,trim(p_id),trim(p_name),p_capacity_hours,p_buffer_hours,coalesce(p_active,true)) on conflict(business_id,id) do update set name=excluded.name,capacity_hours=excluded.capacity_hours,buffer_hours=excluded.buffer_hours,active=excluded.active,updated_at=now();return jsonb_build_object('id',trim(p_id));
end;$$;

create or replace function public.tuinbooks_v2_import_v4_snapshot(p_business_id uuid,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;v_id text;v_client text;v_site text;v_team text;v_service text;v_weekdays smallint[];v_fee numeric;v_weeka date;v_day integer;v_stop integer;v_label text;v_routes jsonb;v_accounts integer:=0;v_sites integer:=0;v_teams integer:=0;v_services integer:=0;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
 if jsonb_typeof(p_snapshot)<>'object' then raise exception 'Invalid v4 snapshot';end if;
 if trim(coalesce(p_snapshot#>>'{business,name}',''))='' then raise exception 'Business Name is required';end if;
 v_weeka=nullif(p_snapshot#>>'{business,weekAStartsOn}','')::date;
 perform public.tuinbooks_v2_save_business_settings(p_business_id,coalesce(p_snapshot->'business','{}'::jsonb));
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'services','[]'::jsonb)) loop
   v_id=coalesce(nullif(r->>'id',''),'svc-v2-'||substr(md5(lower(r->>'name')),1,16));perform public.tuinbooks_v2_save_business_service(p_business_id,v_id,r->>'name',r->>'notes',coalesce((r->>'active')::boolean,true));v_services:=v_services+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'teams','[]'::jsonb)) loop
   v_id=coalesce(nullif(r->>'id',''),'team-v2-'||substr(md5(lower(r->>'name')),1,16));perform public.tuinbooks_v2_save_business_team(p_business_id,v_id,r->>'name',coalesce((r->>'capacityHours')::numeric,8),coalesce((r->>'bufferHours')::numeric,1),coalesce((r->>'active')::boolean,true));v_teams:=v_teams+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'accounts','[]'::jsonb)) loop
   select id into v_client from public.customers where business_id=p_business_id and lower(name)=lower(r->>'name') order by updated_at desc limit 1;v_client=coalesce(v_client,'client-v2-'||substr(md5(lower(r->>'name')),1,20));
   perform public.tuinbooks_v2_save_account(p_business_id,v_client,r->>'name','active',r->>'contactName',r->>'phone',r->>'email');
   update public.customers set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('v2Billing',jsonb_build_object('invoiceMethod',r->>'invoiceMethod','billingBasis',r->>'billingBasis','billingAmount',r->'billingAmount','invoiceDay',r->'invoiceDay','billingNotes',r->>'billingNotes')) where business_id=p_business_id and id=v_client;v_accounts:=v_accounts+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'locations','[]'::jsonb)) loop
   select id into v_client from public.customers where business_id=p_business_id and lower(name)=lower(r->>'accountName') limit 1;if v_client is null then raise exception 'Import account not found: %',r->>'accountName';end if;
   select id into v_team from public.teams where business_id=p_business_id and lower(name)=lower(r->>'team') limit 1;if v_team is null then raise exception 'Import team not found: %',r->>'team';end if;
   select id into v_service from public.business_services_v2 where business_id=p_business_id and lower(name)=lower(r->>'service') limit 1;if v_service is null then raise exception 'Import service not found: %',r->>'service';end if;
   select id into v_site from public.service_sites where business_id=p_business_id and customer_id=v_client and (lower(address)=lower(r->>'address') or (lower(site_name)=lower(r->>'locationName') and lower(coalesce(suburb,''))=lower(coalesce(r->>'suburb','')))) order by updated_at desc limit 1;v_site=coalesce(v_site,'site-v2-'||substr(md5(lower(v_client||'|'||coalesce(r->>'locationName','')||'|'||r->>'address')),1,20));
   perform public.tuinbooks_v2_save_service_location(p_business_id,v_site,v_client,r->>'locationName',r->>'address',r->>'suburb',r->>'accessNotes',r->>'routingNotes',true);
   v_routes=(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(p_snapshot->'routes','[]'::jsonb)) x where lower(x->>'accountName')=lower(r->>'accountName') and (lower(x->>'address')=lower(r->>'address') or lower(x->>'locationName')=lower(r->>'locationName')));
   update public.service_sites set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('v2Import',jsonb_build_object('routePreference',r->>'routePreference','locationBillingBasis',r->>'locationBillingBasis','locationBillingAmount',r->'locationBillingAmount','fortnightlyCycle',r->>'fortnightlyCycle','routes',v_routes)) where business_id=p_business_id and id=v_site;
   select array_agg(value::smallint order by ord) into v_weekdays from jsonb_array_elements_text(coalesce(r->'weekdays','[]'::jsonb)) with ordinality q(value,ord);v_fee=nullif(r->>'locationBillingAmount','')::numeric;
   perform public.tuinbooks_v2_save_service_agreement(p_business_id,'agr-v2-'||substr(md5(v_site),1,20),v_client,v_site,'active',(r->>'startDate')::date,null,r->>'frequency',coalesce(v_weekdays,'{}'::smallint[]),nullif(r->>'monthlyOrdinal','')::integer,v_team,60,array[v_service],coalesce(r->>'routingNotes',''),v_fee,current_date);v_sites:=v_sites+1;
 end loop;
 -- Apply approved route order to generated horizon without rewriting historical/completed work.
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'routes','[]'::jsonb)) loop
   select id into v_client from public.customers where business_id=p_business_id and lower(name)=lower(r->>'accountName') limit 1;select id into v_team from public.teams where business_id=p_business_id and lower(name)=lower(r->>'team') limit 1;select id into v_site from public.service_sites where business_id=p_business_id and customer_id=v_client and (lower(address)=lower(r->>'address') or lower(site_name)=lower(r->>'locationName')) limit 1;v_day=case lower(r->>'day') when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3 when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6 when 'sunday' then 7 else null end;v_stop=coalesce(nullif(r->>'approvedStop','')::integer,99);v_label=coalesce(r->>'week','');
   if v_client is not null and v_team is not null and v_site is not null and v_day is not null then update public.schedule_jobs j set sort_order=v_stop*100,updated_at=now() where j.business_id=p_business_id and j.client_id=v_client and j.team_id=v_team and j.payload->>'serviceLocationId'=v_site and lower(j.status)='scheduled' and j.visit_date>=current_date and extract(isodow from j.visit_date)::integer=v_day and (v_label='' or (lower(v_label)='week a' and v_weeka is not null and mod(((date_trunc('week',j.visit_date)::date-v_weeka)/7),2)=0) or (lower(v_label)='week b' and v_weeka is not null and mod(((date_trunc('week',j.visit_date)::date-v_weeka)/7),2)<>0) or (lower(v_label)~'^week [1-5]$' and ceil(extract(day from j.visit_date)/7.0)::integer=substring(v_label from '[1-5]')::integer));end if;
 end loop;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'business',p_business_id::text,'v2_v4_import',jsonb_build_object('accounts',v_accounts,'locations',v_sites,'teams',v_teams,'services',v_services));return jsonb_build_object('accounts',v_accounts,'locations',v_sites,'teams',v_teams,'services',v_services);
end;$$;

create or replace function public.tuinbooks_v2_export_v4_data(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype;v2 jsonb;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;select * into b from public.businesses where id=p_business_id;v2=coalesce(b.settings->'v2','{}'::jsonb);
 return jsonb_build_object(
 'business',jsonb_build_object('name',b.name,'phone',b.phone,'email',b.email,'address',b.address,'suburb',coalesce(v2->>'suburb',''),'province',coalesce(v2->>'province',''),'vatRegistered',coalesce((v2->>'vatRegistered')::boolean,false),'vatNumber',coalesce(v2->>'vatNumber',''),'mode',coalesce(v2->>'mode','financials'),'weekAStartsOn',v2->>'weekAStartsOn','invoiceDay',coalesce((v2->>'invoiceDay')::integer,28),'paymentTermsDays',coalesce((v2->>'paymentTermsDays')::integer,7),'invoicePrefix',coalesce(v2->>'invoicePrefix','INV-'),'statementMessage',coalesce(v2->>'statementMessage',''),'emailFromName',coalesce(v2->>'emailFromName',b.name),'whatsappMessage',coalesce(v2->>'whatsappMessage','')),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'notes',s.notes,'active',s.active) order by s.name) from public.business_services_v2 s where s.business_id=p_business_id),'[]'::jsonb),
 'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'capacityHours',t.capacity_hours,'bufferHours',t.buffer_hours,'active',t.active) order by t.name) from public.teams t where t.business_id=p_business_id),'[]'::jsonb),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'contactName',c.contact_name,'phone',c.phone,'email',c.email,'invoiceMethod',coalesce(c.payload#>>'{v2Billing,invoiceMethod}','By Account'),'billingBasis',coalesce(c.payload#>>'{v2Billing,billingBasis}','Monthly fixed fee'),'billingAmount',c.payload#>'{v2Billing,billingAmount}','invoiceDay',c.payload#>'{v2Billing,invoiceDay}','billingNotes',coalesce(c.payload#>>'{v2Billing,billingNotes}','')) order by c.name) from public.customers c where c.business_id=p_business_id and c.status<>'archived'),'[]'::jsonb),
 'locations',coalesce((select jsonb_agg(jsonb_build_object('accountName',c.name,'locationName',s.site_name,'address',s.address,'suburb',s.suburb,'team',t.name,'service',coalesce(bs.name,a.service_ids[1],'Garden service'),'frequency',a.frequency,'weekdays',a.weekdays,'fortnightlyCycle',s.payload#>>'{v2Import,fortnightlyCycle}','monthlyOrdinal',a.monthly_ordinal,'startDate',a.start_date,'locationBillingBasis',coalesce(s.payload#>>'{v2Import,locationBillingBasis}',''),'locationBillingAmount',s.payload#>'{v2Import,locationBillingAmount}','routePreference',coalesce(s.payload#>>'{v2Import,routePreference}','Normal'),'routingNotes',a.notes,'accessNotes',s.access_notes) order by c.name,s.site_name) from public.service_sites s join public.customers c on c.business_id=s.business_id and c.id=s.customer_id left join public.client_service_agreements_v2 a on a.business_id=s.business_id and a.service_site_id=s.id and a.status='active' left join public.teams t on t.business_id=s.business_id and t.id=a.default_team_id left join public.business_services_v2 bs on bs.business_id=s.business_id and bs.id=a.service_ids[1] where s.business_id=p_business_id and s.active=true),'[]'::jsonb),
 'routes',coalesce((
  select jsonb_agg(q.row_json order by q.team_name,q.day_num,q.week_label,q.stop_order)
  from (
    select distinct on (
      t.name,
      extract(isodow from j.visit_date),
      c.name,
      s.id,
      case
        when a.frequency='monthly' then 'Week '||ceil(extract(day from j.visit_date)/7.0)::integer::text
        else case
          when (v2->>'weekAStartsOn') is not null
           and mod(((date_trunc('week',j.visit_date)::date-(v2->>'weekAStartsOn')::date)/7),2)=0 then 'Week A'
          else 'Week B'
        end
      end
    )
      t.name as team_name,
      extract(isodow from j.visit_date)::integer as day_num,
      case extract(isodow from j.visit_date)::integer
        when 1 then 'Monday' when 2 then 'Tuesday' when 3 then 'Wednesday'
        when 4 then 'Thursday' when 5 then 'Friday' when 6 then 'Saturday'
        else 'Sunday'
      end as day_name,
      case
        when a.frequency='monthly' then 'Week '||ceil(extract(day from j.visit_date)/7.0)::integer::text
        else case
          when (v2->>'weekAStartsOn') is not null
           and mod(((date_trunc('week',j.visit_date)::date-(v2->>'weekAStartsOn')::date)/7),2)=0 then 'Week A'
          else 'Week B'
        end
      end as week_label,
      j.sort_order as stop_order,
      jsonb_build_object(
        'team',t.name,
        'day',case extract(isodow from j.visit_date)::integer
          when 1 then 'Monday' when 2 then 'Tuesday' when 3 then 'Wednesday'
          when 4 then 'Thursday' when 5 then 'Friday' when 6 then 'Saturday'
          else 'Sunday'
        end,
        'week',case
          when a.frequency='monthly' then 'Week '||ceil(extract(day from j.visit_date)/7.0)::integer::text
          else case
            when (v2->>'weekAStartsOn') is not null
             and mod(((date_trunc('week',j.visit_date)::date-(v2->>'weekAStartsOn')::date)/7),2)=0 then 'Week A'
            else 'Week B'
          end
        end,
        'approvedStop',greatest(1,round(j.sort_order/100.0)),
        'accountName',c.name,
        'locationName',s.site_name,
        'suburb',s.suburb,
        'address',s.address
      ) as row_json
    from public.schedule_jobs j
    join public.teams t on t.business_id=j.business_id and t.id=j.team_id
    join public.customers c on c.business_id=j.business_id and c.id=j.client_id
    join public.service_sites s on s.business_id=j.business_id and s.id::text=j.payload->>'serviceLocationId'
    left join public.client_service_agreements_v2 a on a.business_id=s.business_id and a.service_site_id=s.id and a.status='active'
    where j.business_id=p_business_id
      and j.visit_date between current_date and current_date+55
      and lower(j.status)='scheduled'
    order by
      t.name,
      extract(isodow from j.visit_date),
      c.name,
      s.id,
      case
        when a.frequency='monthly' then 'Week '||ceil(extract(day from j.visit_date)/7.0)::integer::text
        else case
          when (v2->>'weekAStartsOn') is not null
           and mod(((date_trunc('week',j.visit_date)::date-(v2->>'weekAStartsOn')::date)/7),2)=0 then 'Week A'
          else 'Week B'
        end
      end,
      j.visit_date
  ) q
),'[]'::jsonb)
 );
end;$$;

-- Management: uses the existing platform-staff/support-grant authority if installed.
create or replace function public.tuinbooks_v2_management_current_staff()
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record;begin if to_regclass('public.tuinbooks_platform_staff') is null then raise exception 'Platform staff authority is not installed';end if;select user_id,staff_role,active into r from public.tuinbooks_platform_staff where user_id=auth.uid() and active=true;if not found then raise exception 'Not authorised as platform staff';end if;return jsonb_build_object('userId',r.user_id,'staffRole',r.staff_role,'displayName',r.staff_role);end;$$;

create or replace function public.tuinbooks_v2_management_list_businesses(p_search text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare ok boolean;begin select exists(select 1 from public.tuinbooks_platform_staff where user_id=auth.uid() and active=true) into ok;if not ok then raise exception 'Not authorised as platform staff';end if;return coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'phone',b.phone,'email',b.email,'onboardingComplete',b.onboarding_complete,'createdAt',b.created_at,'support',case when g.business_id is null then null else jsonb_build_object('status',g.status,'expiresAt',g.expires_at,'operationalRead',g.allow_operational_read,'operationalEdit',g.allow_operational_edit,'financialRead',g.allow_financial_read,'financialEdit',g.allow_financial_edit) end,'health',jsonb_build_object('clients',(select count(*) from public.customers c where c.business_id=b.id and c.status<>'archived'),'locations',(select count(*) from public.service_sites s where s.business_id=b.id and s.active),'teams',(select count(*) from public.teams t where t.business_id=b.id and t.active),'futureVisits',(select count(*) from public.schedule_jobs j where j.business_id=b.id and j.visit_date>=current_date and lower(j.status)='scheduled'),'openInvoices',(select count(*) from public.invoices i where i.business_id=b.id and lower(i.status) not in('paid','void','credited')))) order by b.name) from public.businesses b left join lateral(select * from public.tuinbooks_support_grants x where x.business_id=b.id and x.support_user_id=auth.uid() order by x.expires_at desc nulls first limit 1) g on true where coalesce(p_search,'')='' or b.name ilike '%'||p_search||'%' or b.email ilike '%'||p_search||'%'),'[]'::jsonb);end;$$;

create or replace function public.tuinbooks_v2_management_set_support_grant(p_business_id uuid,p_status text,p_expires_at timestamptz,p_operational_read boolean,p_operational_edit boolean,p_financial_read boolean,p_financial_edit boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare role text;begin select staff_role into role from public.tuinbooks_platform_staff where user_id=auth.uid() and active=true;if role is null then raise exception 'Not authorised as platform staff';end if;if p_status not in('active','revoked') then raise exception 'Invalid support status';end if;update public.tuinbooks_support_grants set status=p_status,starts_at=case when p_status='active' then least(coalesce(starts_at,now()),now()) else starts_at end,expires_at=p_expires_at,allow_operational_read=coalesce(p_operational_read,false) or coalesce(p_operational_edit,false),allow_operational_edit=coalesce(p_operational_edit,false),allow_financial_read=coalesce(p_financial_read,false) or coalesce(p_financial_edit,false),allow_financial_edit=coalesce(p_financial_edit,false) where business_id=p_business_id and support_user_id=auth.uid();if not found then insert into public.tuinbooks_support_grants(business_id,support_user_id,status,reason,starts_at,expires_at,allow_operational_read,allow_operational_edit,allow_financial_read,allow_financial_edit) values(p_business_id,auth.uid(),p_status,'TuinBooks v2 support',now(),p_expires_at,coalesce(p_operational_read,false) or coalesce(p_operational_edit,false),coalesce(p_operational_edit,false),coalesce(p_financial_read,false) or coalesce(p_financial_edit,false),coalesce(p_financial_edit,false));end if;return jsonb_build_object('ok',true);end;$$;

revoke all on function public.tuinbooks_v2_load_business_workspace(uuid) from public,anon;
revoke all on function public.tuinbooks_v2_save_business_settings(uuid,jsonb) from public,anon;
revoke all on function public.tuinbooks_v2_save_business_service(uuid,text,text,text,boolean) from public,anon;
revoke all on function public.tuinbooks_v2_save_business_team(uuid,text,text,numeric,numeric,boolean) from public,anon;
revoke all on function public.tuinbooks_v2_import_v4_snapshot(uuid,jsonb) from public,anon;
revoke all on function public.tuinbooks_v2_export_v4_data(uuid) from public,anon;
revoke all on function public.tuinbooks_v2_management_current_staff() from public,anon;
revoke all on function public.tuinbooks_v2_management_list_businesses(text) from public,anon;
revoke all on function public.tuinbooks_v2_management_set_support_grant(uuid,text,timestamptz,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.tuinbooks_v2_load_business_workspace(uuid),public.tuinbooks_v2_save_business_settings(uuid,jsonb),public.tuinbooks_v2_save_business_service(uuid,text,text,text,boolean),public.tuinbooks_v2_save_business_team(uuid,text,text,numeric,numeric,boolean),public.tuinbooks_v2_import_v4_snapshot(uuid,jsonb),public.tuinbooks_v2_export_v4_data(uuid),public.tuinbooks_v2_management_current_staff(),public.tuinbooks_v2_management_list_businesses(text),public.tuinbooks_v2_management_set_support_grant(uuid,text,timestamptz,boolean,boolean,boolean,boolean) to authenticated;
commit;

-- ============================================================================
-- END migration-v2-business-import-management.sql
-- ============================================================================

-- ============================================================================
-- BEGIN migration-v2-release-completion.sql
-- ============================================================================

-- TuinBooks v2 Release Candidate completion migration.
-- ADDITIVE. Applied after M8 migrations.
-- Adds: fast auth/schedule RPCs, permanent admin-visible field PINs,
-- opportunity review workflow, and secure public document/quote-response links.

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- FAST AUTH CONTEXT: one backend round trip after Supabase session restore.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_auth_context()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_user uuid:=auth.uid(); v_member public.business_members%rowtype; v_business public.businesses%rowtype;
begin
  if v_user is null then return null; end if;
  select * into v_member from public.business_members
    where user_id=v_user and active=true
    order by case lower(role) when 'owner' then 0 when 'admin' then 1 else 2 end, updated_at desc
    limit 1;
  if not found then return null; end if;
  select * into v_business from public.businesses where id=v_member.business_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'user_id',v_user,
    'email',coalesce((select email from auth.users where id=v_user),''),
    'business_id',v_member.business_id,
    'business_name',v_business.name,
    'role',v_member.role,
    'display_name',coalesce(v_member.display_name,'')
  );
end;$$;
revoke all on function public.tuinbooks_v2_auth_context() from public,anon;
grant execute on function public.tuinbooks_v2_auth_context() to authenticated;

-- ---------------------------------------------------------------------------
-- FAST SCHEDULE LOAD: one RPC returns the complete week workspace.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_load_schedule_week(p_business_id uuid,p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_end date:=p_week_start+6; v_result jsonb;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  perform public.tuinbooks_v2_ensure_series_horizon(p_business_id,p_week_start,p_week_start+55);
  select jsonb_build_object(
    'week_start',p_week_start,'week_end',v_end,
    'teams',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.teams t where t.business_id=p_business_id and t.active=true),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(to_jsonb(c) order by c.name,c.id) from public.customers c where c.business_id=p_business_id and lower(coalesce(c.status,'active'))<>'archived'),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(to_jsonb(s) order by s.customer_id,s.created_at,s.id) from public.service_sites s where s.business_id=p_business_id and s.active=true),'[]'::jsonb),
    'visits',coalesce((select jsonb_agg(to_jsonb(j) order by j.visit_date,j.team_id,j.sort_order,j.id) from public.schedule_jobs j where j.business_id=p_business_id and j.visit_date between p_week_start and v_end),'[]'::jsonb),
    'queue_items',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at,q.id) from public.schedule_queue_items_v2 q where q.business_id=p_business_id and q.status='open'),'[]'::jsonb),
    'series',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at,s.id) from public.schedule_series_v2 s where s.business_id=p_business_id and s.status in ('active','paused')),'[]'::jsonb),
    'slots',coalesce((select jsonb_agg(to_jsonb(sl) order by sl.series_id,sl.weekday,sl.id) from public.schedule_series_slots_v2 sl where sl.business_id=p_business_id),'[]'::jsonb),
    'occurrences',coalesce((select jsonb_agg(to_jsonb(o) order by o.occurrence_date,o.id) from public.schedule_occurrences_v2 o where o.business_id=p_business_id and (o.occurrence_date between p_week_start and v_end or o.queue_item_id is not null)),'[]'::jsonb),
    'holds',coalesce((select jsonb_agg(to_jsonb(h) order by h.client_id) from public.client_service_holds_v2 h where h.business_id=p_business_id and h.active=true),'[]'::jsonb),
    'day_actions',coalesce((select jsonb_agg(to_jsonb(a) order by a.calendar_date,a.team_id,a.calendar_time,a.id) from public.schedule_day_actions_v2 a where a.business_id=p_business_id and a.status='active' and a.calendar_date between p_week_start and v_end),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;$$;
revoke all on function public.tuinbooks_v2_load_schedule_week(uuid,date) from public,anon;
grant execute on function public.tuinbooks_v2_load_schedule_week(uuid,date) to authenticated;

-- ---------------------------------------------------------------------------
-- FAST CLIENT WORKSPACE: one backend round trip for accounts, locations,
-- agreements and teams.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_load_client_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 return jsonb_build_object(
  'accounts',coalesce((select jsonb_agg(to_jsonb(c) order by c.name,c.id) from public.customers c where c.business_id=p_business_id and lower(coalesce(c.status,'active'))<>'archived'),'[]'::jsonb),
  'locations',coalesce((select jsonb_agg(to_jsonb(s) order by s.customer_id,s.site_name,s.id) from public.service_sites s where s.business_id=p_business_id),'[]'::jsonb),
  'agreements',coalesce((select jsonb_agg(to_jsonb(a) order by a.client_id,a.start_date,a.id) from public.client_service_agreements_v2 a where a.business_id=p_business_id),'[]'::jsonb),
  'teams',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.teams t where t.business_id=p_business_id and t.active=true),'[]'::jsonb)
 );
end;$$;
revoke all on function public.tuinbooks_v2_load_client_workspace(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_load_client_workspace(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PERMANENT FIELD PINS: one active globally unique 4-digit PIN per team.
-- Plain PIN is intentionally visible only through admin RLS/RPC because the
-- product requires the office to be able to view every active team PIN.
-- ---------------------------------------------------------------------------
create table if not exists public.mobile_team_pins_v2(
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_id text not null,
  pin text not null check(pin ~ '^[0-9]{4}$'),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(business_id,team_id),
  foreign key(business_id,team_id) references public.teams(business_id,id) on delete cascade
);
create unique index if not exists mobile_team_pins_v2_active_pin_unique on public.mobile_team_pins_v2(pin) where active=true;
alter table public.mobile_team_pins_v2 enable row level security;
drop policy if exists mobile_team_pins_v2_admin_select on public.mobile_team_pins_v2;
create policy mobile_team_pins_v2_admin_select on public.mobile_team_pins_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.mobile_team_pins_v2 to authenticated;
revoke insert,update,delete on public.mobile_team_pins_v2 from authenticated;

create table if not exists public.mobile_pin_attempts_v2(
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mobile_pin_attempts_v2 enable row level security;
revoke all on public.mobile_pin_attempts_v2 from anon,authenticated;

create or replace function public.tuinbooks_v2_list_field_pins(p_business_id uuid)
returns table(team_id text,team_name text,pin text,active boolean,updated_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 return query select t.id,t.name,p.pin,coalesce(p.active,false),p.updated_at
 from public.teams t left join public.mobile_team_pins_v2 p on p.business_id=t.business_id and p.team_id=t.id
 where t.business_id=p_business_id and t.active=true order by t.created_at,t.id;
end;$$;

create or replace function public.tuinbooks_v2_generate_field_pin(p_business_id uuid,p_team_id text)
returns table(team_id text,team_name text,pin text)
language plpgsql security definer set search_path=public,auth as $$
declare v_pin text; v_name text; n integer;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 select name into v_name from public.teams where business_id=p_business_id and id=p_team_id and active=true;
 if v_name is null then raise exception 'Active team not found';end if;
 for n in 1..100 loop
   v_pin:=lpad((floor(random()*10000))::integer::text,4,'0');
   begin
     insert into public.mobile_team_pins_v2(business_id,team_id,pin,active,created_by)
       values(p_business_id,p_team_id,v_pin,true,auth.uid())
       on conflict(business_id,team_id) do update set pin=excluded.pin,active=true,created_by=auth.uid(),updated_at=now();
     exit;
   exception when unique_violation then v_pin:=null;
   end;
 end loop;
 if v_pin is null then raise exception 'Could not generate a unique field PIN';end if;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(p_business_id,auth.uid(),'field_pin',p_team_id,'v2_field_pin_generated',jsonb_build_object('team_id',p_team_id));
 return query select p_team_id,v_name,v_pin;
end;$$;

create or replace function public.tuinbooks_v2_revoke_field_pin(p_business_id uuid,p_team_id text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 update public.mobile_team_pins_v2 set active=false,updated_at=now() where business_id=p_business_id and team_id=p_team_id;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(p_business_id,auth.uid(),'field_pin',p_team_id,'v2_field_pin_revoked',jsonb_build_object('team_id',p_team_id));
end;$$;

create or replace function public.tuinbooks_v2_claim_field_pin(p_pin text,p_device_name text default '')
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_pin text:=regexp_replace(coalesce(p_pin,''),'[^0-9]','','g'); v_row public.mobile_team_pins_v2%rowtype; v_team text; v_name text; v_lock timestamptz;
begin
 if v_user is null then raise exception 'A mobile browser session is required';end if;
 insert into public.mobile_pin_attempts_v2(user_id) values(v_user) on conflict(user_id) do update set
  attempt_count=case when mobile_pin_attempts_v2.window_started_at<now()-interval '10 minutes' then 0 else mobile_pin_attempts_v2.attempt_count end,
  window_started_at=case when mobile_pin_attempts_v2.window_started_at<now()-interval '10 minutes' then now() else mobile_pin_attempts_v2.window_started_at end,
  locked_until=case when mobile_pin_attempts_v2.locked_until<=now() then null else mobile_pin_attempts_v2.locked_until end,updated_at=now();
 select locked_until into v_lock from public.mobile_pin_attempts_v2 where user_id=v_user for update;
 if v_lock is not null and v_lock>now() then raise exception 'Too many incorrect PIN attempts. Try again later.';end if;
 if length(v_pin)<>4 then
  update public.mobile_pin_attempts_v2 set attempt_count=attempt_count+1,locked_until=case when attempt_count+1>=5 then now()+interval '10 minutes' else locked_until end,updated_at=now() where user_id=v_user;
  raise exception 'Enter the four-digit PIN';
 end if;
 select * into v_row from public.mobile_team_pins_v2 where pin=v_pin and active=true for update;
 if not found then
  update public.mobile_pin_attempts_v2 set attempt_count=attempt_count+1,locked_until=case when attempt_count+1>=5 then now()+interval '10 minutes' else locked_until end,updated_at=now() where user_id=v_user;
  raise exception 'PIN not recognised';
 end if;
 select name into v_team from public.teams where business_id=v_row.business_id and id=v_row.team_id and active=true;
 if v_team is null then raise exception 'The team assigned to this PIN is inactive';end if;
 v_name:=coalesce(nullif(trim(p_device_name),''),v_team||' phone');
 insert into public.business_members(business_id,user_id,role,display_name,active)
 values(v_row.business_id,v_user,'field',v_name,true)
 on conflict(business_id,user_id) do update set role='field',display_name=excluded.display_name,active=true,updated_at=now();
 delete from public.team_assignments where business_id=v_row.business_id and user_id=v_user;
 insert into public.team_assignments(business_id,user_id,team_id,is_primary,active) values(v_row.business_id,v_user,v_row.team_id,true,true);
 delete from public.mobile_pin_attempts_v2 where user_id=v_user;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(v_row.business_id,v_user,'field_device',v_user::text,'v2_field_phone_paired',jsonb_build_object('team_id',v_row.team_id,'device_name',v_name));
 return jsonb_build_object('business_id',v_row.business_id,'team_id',v_row.team_id,'team_name',v_team,'display_name',v_name);
end;$$;

revoke all on function public.tuinbooks_v2_list_field_pins(uuid) from public,anon;
revoke all on function public.tuinbooks_v2_generate_field_pin(uuid,text) from public,anon;
revoke all on function public.tuinbooks_v2_revoke_field_pin(uuid,text) from public,anon;
revoke all on function public.tuinbooks_v2_claim_field_pin(text,text) from public;
grant execute on function public.tuinbooks_v2_list_field_pins(uuid) to authenticated;
grant execute on function public.tuinbooks_v2_generate_field_pin(uuid,text) to authenticated;
grant execute on function public.tuinbooks_v2_revoke_field_pin(uuid,text) to authenticated;
grant execute on function public.tuinbooks_v2_claim_field_pin(text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- FIELD OPPORTUNITY OFFICE TRIAGE.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_review_opportunity(
 p_business_id uuid,p_opportunity_id text,p_decision text,p_linked_quote_id text default null,p_note text default ''
) returns void language plpgsql security definer set search_path=public,auth as $$
declare v_status text;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 if p_decision not in('quote-created','site-visit','design-consult','defer','closed') then raise exception 'Invalid opportunity decision';end if;
 v_status:=case when p_decision='defer' then 'deferred' when p_decision='closed' then 'closed' else 'reviewed' end;
 update public.field_opportunities set status=v_status,review_decision=p_decision,
  payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('linkedQuoteId',nullif(p_linked_quote_id,''),'reviewNote',coalesce(p_note,''),'reviewedAt',now(),'reviewedBy',auth.uid()),updated_at=now()
 where business_id=p_business_id and id=p_opportunity_id;
 if not found then raise exception 'Opportunity not found';end if;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(p_business_id,auth.uid(),'opportunity',p_opportunity_id,'v2_opportunity_reviewed',jsonb_build_object('decision',p_decision,'linked_quote_id',p_linked_quote_id));
end;$$;
revoke all on function public.tuinbooks_v2_review_opportunity(uuid,text,text,text,text) from public,anon;
grant execute on function public.tuinbooks_v2_review_opportunity(uuid,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- SECURE PUBLIC DOCUMENT LINKS + QUOTE RESPONSE.
-- Snapshot is immutable at link creation so a customer responds to exactly the
-- document version they were sent.
-- ---------------------------------------------------------------------------
create table if not exists public.public_documents_v2(
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_type text not null check(document_type in('quote','invoice','statement')),
  document_id text not null,
  client_id text not null,
  snapshot jsonb not null,
  status text not null default 'active' check(status in('active','responded','revoked','expired')),
  response text,
  responded_by_name text,
  response_note text,
  responded_at timestamptz,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists public_documents_v2_business_idx on public.public_documents_v2(business_id,document_type,document_id,created_at desc);
alter table public.public_documents_v2 enable row level security;
drop policy if exists public_documents_v2_admin_select on public.public_documents_v2;
create policy public_documents_v2_admin_select on public.public_documents_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.public_documents_v2 to authenticated;
revoke insert,update,delete on public.public_documents_v2 from authenticated,anon;

create or replace function public.tuinbooks_v2_create_public_document(
 p_business_id uuid,p_document_type text,p_document_id text,p_client_id text,p_snapshot jsonb,p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_token text:=encode(gen_random_bytes(24),'hex'); v_id uuid;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 if p_document_type not in('quote','invoice','statement') then raise exception 'Invalid document type';end if;
 if p_expires_at<=now() then raise exception 'Expiry must be in the future';end if;
 if jsonb_typeof(p_snapshot)<>'object' then raise exception 'Document snapshot is required';end if;
 insert into public.public_documents_v2(token_hash,business_id,document_type,document_id,client_id,snapshot,expires_at,created_by)
 values(encode(digest(v_token,'sha256'),'hex'),p_business_id,p_document_type,p_document_id,p_client_id,p_snapshot,p_expires_at,auth.uid()) returning id into v_id;
 return jsonb_build_object('id',v_id,'token',v_token,'expires_at',p_expires_at);
end;$$;

create or replace function public.tuinbooks_v2_get_public_document(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.public_documents_v2%rowtype;
begin
 select * into r from public.public_documents_v2 where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex');
 if not found then return jsonb_build_object('ok',false,'error','invalid');end if;
 if r.status='revoked' then return jsonb_build_object('ok',false,'error','revoked');end if;
 if r.expires_at<=now() then update public.public_documents_v2 set status='expired' where id=r.id and status='active';return jsonb_build_object('ok',false,'error','expired');end if;
 return jsonb_build_object('ok',true,'document_type',r.document_type,'document_id',r.document_id,'snapshot',r.snapshot,'status',r.status,'response',r.response,'responded_by_name',r.responded_by_name,'response_note',r.response_note,'responded_at',r.responded_at,'expires_at',r.expires_at);
end;$$;

create or replace function public.tuinbooks_v2_respond_public_quote(p_token text,p_decision text,p_customer_name text,p_note text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.public_documents_v2%rowtype; v_quote_status text;
begin
 if p_decision not in('accepted','changes_requested','declined') then raise exception 'Invalid response';end if;
 if nullif(trim(p_customer_name),'') is null then raise exception 'Your name is required';end if;
 select * into r from public.public_documents_v2 where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') for update;
 if not found or r.document_type<>'quote' then return jsonb_build_object('ok',false,'error','invalid');end if;
 if r.expires_at<=now() then update public.public_documents_v2 set status='expired' where id=r.id;return jsonb_build_object('ok',false,'error','expired');end if;
 if r.status='responded' then return jsonb_build_object('ok',true,'status',r.response,'already_recorded',true);end if;
 v_quote_status:=case when p_decision='accepted' then 'Accepted' when p_decision='declined' then 'Declined' else 'Sent' end;
 update public.public_documents_v2 set status='responded',response=p_decision,responded_by_name=trim(p_customer_name),response_note=coalesce(p_note,''),responded_at=now() where id=r.id;
 update public.quotes set status=v_quote_status,updated_at=now(),payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('customerResponse',p_decision,'acceptedAt',case when p_decision='accepted' then now() else null end,'acceptedBy',trim(p_customer_name),'customerResponseNote',coalesce(p_note,'')) where business_id=r.business_id and id=r.document_id;
 insert into public.audit_events(business_id,entity_type,entity_id,action,details)
 values(r.business_id,'quote',r.document_id,'v2_public_quote_response',jsonb_build_object('decision',p_decision,'customer_name',trim(p_customer_name),'public_document_id',r.id));
 return jsonb_build_object('ok',true,'status',p_decision);
end;$$;

revoke all on function public.tuinbooks_v2_create_public_document(uuid,text,text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.tuinbooks_v2_create_public_document(uuid,text,text,text,jsonb,timestamptz) to authenticated;
revoke all on function public.tuinbooks_v2_get_public_document(text) from public;
grant execute on function public.tuinbooks_v2_get_public_document(text) to anon,authenticated;
revoke all on function public.tuinbooks_v2_respond_public_quote(text,text,text,text) from public;
grant execute on function public.tuinbooks_v2_respond_public_quote(text,text,text,text) to anon,authenticated;


-- ---------------------------------------------------------------------------
-- FULL SUPPORT WORKSPACE: explicit full-scope grants may use v2 admin RPCs.
-- Customer owner/admin membership remains unchanged; support access expires and
-- never creates a business membership.
-- ---------------------------------------------------------------------------
create or replace function public.is_business_admin(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.business_members bm where bm.business_id=target_business_id and bm.user_id=auth.uid() and bm.active=true and lower(bm.role) in('owner','admin'))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_grants g on g.support_user_id=ps.user_id and g.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(g.status)='active' and coalesce(g.starts_at,now())<=now() and (g.expires_at is null or g.expires_at>now()) and g.allow_operational_read=true and g.allow_operational_edit=true and g.allow_financial_read=true and g.allow_financial_edit=true)
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_sessions s on s.support_user_id=ps.user_id and s.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(s.status)='active' and s.expires_at>now() and s.allow_operational_read=true and s.allow_operational_edit=true and s.allow_financial_read=true and s.allow_financial_edit=true);
$$;
revoke all on function public.is_business_admin(uuid) from public;
grant execute on function public.is_business_admin(uuid) to authenticated;

create or replace function public.tuinbooks_v2_support_context(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare b public.businesses%rowtype;ps record;
begin
 select staff_role into ps from public.tuinbooks_platform_staff where user_id=auth.uid() and active=true;if not found then raise exception 'Platform staff access required';end if;
 if not public.is_business_admin(p_business_id) then raise exception 'An active full-support grant is required';end if;
 select * into b from public.businesses where id=p_business_id;if not found then raise exception 'Business not found';end if;
 return jsonb_build_object('user_id',auth.uid(),'email',coalesce((select email from auth.users where id=auth.uid()),''),'business_id',b.id,'business_name',b.name,'role','support','display_name',coalesce(ps.staff_role,'Platform support'));
end;$$;
revoke all on function public.tuinbooks_v2_support_context(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_support_context(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- FINAL BILLING CORRECTNESS: discounts, visit links, automatic numbering,
-- payment terms in the Money workspace, and fixed-month duplicate prevention.
-- ---------------------------------------------------------------------------
alter table public.quote_lines_v2 add column if not exists discount_percent numeric(6,3) not null default 0 check(discount_percent between 0 and 100);
alter table public.invoice_lines_v2 add column if not exists discount_percent numeric(6,3) not null default 0 check(discount_percent between 0 and 100);
drop index if exists public.invoice_lines_v2_visit_unique;

create table if not exists public.invoice_visit_links_v2(
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id text not null,
  visit_id text not null,
  created_at timestamptz not null default now(),
  primary key(business_id,invoice_id,visit_id),
  unique(business_id,visit_id),
  foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete cascade
);
alter table public.invoice_visit_links_v2 enable row level security;
drop policy if exists invoice_visit_links_v2_select on public.invoice_visit_links_v2;
create policy invoice_visit_links_v2_select on public.invoice_visit_links_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.invoice_visit_links_v2 to authenticated;
revoke insert,update,delete on public.invoice_visit_links_v2 from authenticated,anon;

create table if not exists public.invoice_sequences_v2(
 business_id uuid primary key references public.businesses(id) on delete cascade,
 next_number bigint not null default 1 check(next_number>0),updated_at timestamptz not null default now()
);
alter table public.invoice_sequences_v2 enable row level security;
revoke all on public.invoice_sequences_v2 from anon,authenticated;

create or replace function public.tuinbooks_v2_next_invoice_number(p_business_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_prefix text;v_next bigint;v_seed bigint;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 select coalesce(nullif(settings->'v2'->>'invoicePrefix',''),nullif(settings->>'invoicePrefix',''),'INV-') into v_prefix from public.businesses where id=p_business_id;
 select coalesce(max((regexp_match(invoice_number,'([0-9]+)$'))[1]::bigint),0)+1 into v_seed from public.invoices where business_id=p_business_id and invoice_number like v_prefix||'%';
 insert into public.invoice_sequences_v2(business_id,next_number) values(p_business_id,greatest(1,v_seed)) on conflict(business_id) do nothing;
 select next_number into v_next from public.invoice_sequences_v2 where business_id=p_business_id for update;
 update public.invoice_sequences_v2 set next_number=v_next+1,updated_at=now() where business_id=p_business_id;
 return v_prefix||lpad(v_next::text,4,'0');
end;$$;

create or replace function public.tuinbooks_v2_money_lines_json(p_business_id uuid,p_kind text,p_document_id text,p_fallback jsonb)
returns jsonb language plpgsql stable set search_path=public as $$declare v jsonb;begin
 if p_kind='quote' then select jsonb_agg(jsonb_build_object('id',id,'description',description,'quantity',quantity,'unitPrice',unit_price,'vatRate',vat_rate,'discountPercent',discount_percent,'sourceVisitId',source_visit_id,'sourceQuoteId',source_quote_id,'category',category) order by position,id) into v from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_document_id;
 else select jsonb_agg(jsonb_build_object('id',id,'description',description,'quantity',quantity,'unitPrice',unit_price,'vatRate',vat_rate,'discountPercent',discount_percent,'sourceVisitId',source_visit_id,'sourceQuoteId',source_quote_id,'category',category) order by position,id) into v from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_document_id;end if;
 return coalesce(v,case when jsonb_typeof(p_fallback->'lines')='array' then p_fallback->'lines' when jsonb_typeof(p_fallback->'lineItems')='array' then p_fallback->'lineItems' else '[]'::jsonb end);end$$;

create or replace function public.tuinbooks_v2_replace_quote_lines(p_business_id uuid,p_quote_id text,p_lines jsonb) returns void language plpgsql security definer set search_path=public as $$declare r jsonb;n integer:=0;begin
 delete from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_quote_id;
 for r in select * from jsonb_array_elements(coalesce(p_lines,'[]')) loop n:=n+1;
  insert into public.quote_lines_v2(business_id,quote_id,id,position,description,quantity,unit_price,vat_rate,source_visit_id,source_quote_id,category,created_at,updated_at,discount_percent)
  values(p_business_id,p_quote_id,coalesce(nullif(r->>'id',''),'line-'||n),n,coalesce(r->>'description',''),coalesce((r->>'quantity')::numeric,1),coalesce((r->>'unitPrice')::numeric,0),coalesce((r->>'vatRate')::numeric,0),nullif(r->>'sourceVisitId',''),nullif(r->>'sourceQuoteId',''),coalesce(nullif(r->>'category',''),'manual'),now(),now(),greatest(0,least(100,coalesce((r->>'discountPercent')::numeric,0))));
 end loop;end$$;

create or replace function public.tuinbooks_v2_replace_invoice_lines(p_business_id uuid,p_invoice_id text,p_lines jsonb) returns void language plpgsql security definer set search_path=public as $$declare r jsonb;n integer:=0;begin
 delete from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_invoice_id;
 for r in select * from jsonb_array_elements(coalesce(p_lines,'[]')) loop n:=n+1;
  insert into public.invoice_lines_v2(business_id,invoice_id,id,position,description,quantity,unit_price,vat_rate,source_visit_id,source_quote_id,category,created_at,updated_at,discount_percent)
  values(p_business_id,p_invoice_id,coalesce(nullif(r->>'id',''),'line-'||n),n,coalesce(r->>'description',''),coalesce((r->>'quantity')::numeric,1),coalesce((r->>'unitPrice')::numeric,0),coalesce((r->>'vatRate')::numeric,0),nullif(r->>'sourceVisitId',''),nullif(r->>'sourceQuoteId',''),coalesce(nullif(r->>'category',''),'manual'),now(),now(),greatest(0,least(100,coalesce((r->>'discountPercent')::numeric,0))));
  if nullif(r->>'sourceVisitId','') is not null then insert into public.invoice_visit_links_v2(business_id,invoice_id,visit_id) values(p_business_id,p_invoice_id,r->>'sourceVisitId') on conflict do nothing;end if;
 end loop;end$$;

create or replace function public.tuinbooks_v2_save_invoice(p_business_id uuid,p_invoice_id text,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_status text,p_number text,p_lines jsonb,p_notes text) returns text language plpgsql security definer set search_path=public as $$
declare old_status text;total numeric;payload jsonb;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 if p_status not in('Draft','Ready','Sent','Paid','Partially paid','Overdue','Credited','Void') then raise exception 'Invalid invoice status';end if;
 if p_due_date<p_issue_date then raise exception 'Due date cannot be before invoice date';end if;
 select status into old_status from public.invoices where business_id=p_business_id and id=p_invoice_id for update;
 if old_status is not null and old_status not in('Draft','Ready') then raise exception 'Issued invoices are immutable; use payment/credit flows instead';end if;
 if trim(coalesce(p_number,''))<>'Draft' and exists(select 1 from public.invoices where business_id=p_business_id and id<>p_invoice_id and invoice_number=trim(p_number)) then raise exception 'Invoice number already exists';end if;
 select coalesce(sum(coalesce((r->>'quantity')::numeric,1)*coalesce((r->>'unitPrice')::numeric,0)*(1-greatest(0,least(100,coalesce((r->>'discountPercent')::numeric,0)))/100)*(1+coalesce((r->>'vatRate')::numeric,0)/100)),0) into total from jsonb_array_elements(coalesce(p_lines,'[]')) r;
 payload=jsonb_build_object('issueDate',p_issue_date,'dueDate',p_due_date,'notes',coalesce(p_notes,''),'lines',coalesce(p_lines,'[]'::jsonb),'v2Document',true);
 insert into public.invoices(business_id,id,client_id,invoice_month,invoice_number,status,total,payload,created_by) values(p_business_id,p_invoice_id,p_client_id,p_invoice_month,coalesce(nullif(trim(p_number),''),'Draft'),p_status,round(total,2),payload,auth.uid()) on conflict(business_id,id) do update set client_id=excluded.client_id,invoice_month=excluded.invoice_month,invoice_number=excluded.invoice_number,status=excluded.status,total=excluded.total,payload=excluded.payload,updated_at=now();
 perform public.tuinbooks_v2_replace_invoice_lines(p_business_id,p_invoice_id,p_lines);
 delete from public.invoice_visit_links_v2 l using public.schedule_jobs j where l.business_id=p_business_id and l.invoice_id=p_invoice_id and j.business_id=l.business_id and j.id=l.visit_id
  and not exists(select 1 from jsonb_array_elements(coalesce(p_lines,'[]')) r where nullif(r->>'sourceVisitId','')=l.visit_id)
  and not (exists(select 1 from jsonb_array_elements(coalesce(p_lines,'[]')) r where coalesce(r->>'category','')='routine') and lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','routine')) not like '%quote%');
 return p_invoice_id;end$$;

create or replace function public.tuinbooks_v2_queue_accepted_quote(p_business_id uuid,p_quote_id text) returns text language plpgsql security definer set search_path=public as $$declare q public.quotes%rowtype;qid text:='queue-quote-'||p_quote_id;desc_text text;total numeric;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;select * into q from public.quotes where business_id=p_business_id and id=p_quote_id and status='Accepted';if not found then raise exception 'Only accepted quotes can be sent to Basket';end if;
 select string_agg(description,', '),sum(quantity*unit_price*(1-discount_percent/100)*(1+vat_rate/100)) into desc_text,total from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_quote_id;
 insert into public.schedule_queue_items_v2(business_id,id,client_id,estimated_minutes,item_type,billing_disposition,reason,status,payload,created_by,updated_by) values(p_business_id,qid,q.client_id,0,'quoted','quoted','Accepted quote','open',jsonb_build_object('sourceQuoteId',p_quote_id,'task',coalesce(desc_text,'Quoted work'),'quotedTotal',coalesce(total,0),'visitType','quoted','billingDisposition','quoted'),auth.uid(),auth.uid()) on conflict(business_id,id) do update set status='open',payload=excluded.payload,updated_by=auth.uid(),updated_at=now();return qid;end$$;

create or replace function public.tuinbooks_v2_load_money_workspace(p_business_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_accounts jsonb;v_quotes jsonb;v_invoices jsonb;v_payments jsonb;v_facts jsonb;v_settings jsonb;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]') into v_accounts from public.customers c where c.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('payload',coalesce(q.payload,'{}')||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'quote',q.id,q.payload))) order by q.updated_at desc),'[]') into v_quotes from public.quotes q where q.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('payload',coalesce(i.payload,'{}')||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'invoice',i.id,i.payload))) order by i.updated_at desc),'[]') into v_invoices from public.invoices i where i.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.payment_date desc,p.created_at desc),'[]') into v_payments from public.payments_v2 p where p.business_id=p_business_id;
 select coalesce(jsonb_agg(x order by x->>'visit_date'),'[]') into v_facts from(
  select jsonb_build_object('visit_id',j.id,'client_id',j.client_id,'visit_date',j.visit_date,'visit_type',case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end,
   'status',lower(j.status),'billing_disposition',coalesce(j.payload->>'billingDisposition',case when lower(j.status)='cancelled' and coalesce((j.payload->>'cancellationCharge')::boolean,false) then 'charge' when lower(j.status)='cancelled' then 'no-charge' else case when lower(coalesce(j.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end end),
   'description',coalesce(nullif(j.payload->>'task',''),nullif(j.payload->>'serviceDescription',''),'Garden service'),'amount',case when coalesce(j.payload->>'billingAmountV2','')~'^-?[0-9]+([.][0-9]+)?$' then (j.payload->>'billingAmountV2')::numeric else null end,
   'already_invoiced',exists(select 1 from public.invoice_visit_links_v2 l join public.invoices li on li.business_id=l.business_id and li.id=l.invoice_id where l.business_id=j.business_id and l.visit_id=j.id and lower(li.status) not in('void','credited'))
     or (lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','routine')) not like '%quote%' and exists(select 1 from public.invoices i join public.invoice_lines_v2 il on il.business_id=i.business_id and il.invoice_id=i.id and il.category='routine' where i.business_id=j.business_id and i.client_id=j.client_id and i.invoice_month=to_char(j.visit_date,'YYYY-MM') and lower(i.status) not in('void','credited')))) x
  from public.schedule_jobs j where j.business_id=p_business_id and lower(j.status) in('completed','cancelled','suspended','rescheduled')
 ) s;
 select coalesce(settings->'v2',settings,'{}'::jsonb) into v_settings from public.businesses where id=p_business_id;
 return jsonb_build_object('accounts',v_accounts,'quotes',v_quotes,'invoices',v_invoices,'payments',v_payments,'billing_facts',v_facts,'vat_registered',lower(coalesce(v_settings->>'vatRegistered',v_settings->>'vat_registered','no')) in('yes','true','1'),'vat_rate',coalesce(nullif(v_settings->>'vatRate','')::numeric,nullif(v_settings->>'vat_rate','')::numeric,15),'payment_terms_days',coalesce(nullif(v_settings->>'paymentTermsDays','')::integer,7),'invoice_prefix',coalesce(nullif(v_settings->>'invoicePrefix',''),'INV-'));end$$;

create or replace function public.tuinbooks_v2_create_invoice_from_facts(p_business_id uuid,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_visit_ids text[]) returns text language plpgsql security definer set search_path=public as $$
declare inv_id text:='inv-v2-'||replace(gen_random_uuid()::text,'-','');lines jsonb:='[]';v record;fee numeric;vat numeric:=0;routine_added boolean:=false;eligible_ids text[]:='{}';begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if coalesce(array_length(p_visit_ids,1),0)=0 then raise exception 'Choose billable visits';end if;
 select case when lower(coalesce(settings->'v2'->>'vatRegistered',settings->>'vatRegistered','no')) in('yes','true','1') then coalesce(nullif(settings->'v2'->>'vatRate','')::numeric,nullif(settings->>'vatRate','')::numeric,15) else 0 end into vat from public.businesses where id=p_business_id;
 for v in select j.*,case when lower(coalesce(j.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end vt,coalesce(j.payload->>'billingDisposition','routine') bd from public.schedule_jobs j where j.business_id=p_business_id and j.client_id=p_client_id and j.id=any(p_visit_ids) order by j.visit_date,j.id loop
  if exists(select 1 from public.invoice_visit_links_v2 l join public.invoices li on li.business_id=l.business_id and li.id=l.invoice_id where l.business_id=p_business_id and l.visit_id=v.id and lower(li.status) not in('void','credited')) then raise exception 'Visit % is already invoiced',v.id;end if;
  if lower(v.status)='cancelled' and v.bd='no-charge' then continue;end if;
  if v.vt='routine' and lower(v.status)='completed' then
    if exists(select 1 from public.invoices i join public.invoice_lines_v2 il on il.business_id=i.business_id and il.invoice_id=i.id and il.category='routine' where i.business_id=p_business_id and i.client_id=p_client_id and i.invoice_month=p_invoice_month and lower(i.status) not in('void','credited')) then raise exception 'Routine service for % is already invoiced for %',p_client_id,p_invoice_month;end if;
    if not routine_added then select nullif(c.payload#>>'{v2Billing,billingAmount}','')::numeric into fee from public.customers c where c.business_id=p_business_id and c.id=p_client_id;if fee is null then select sum(a.monthly_fee) into fee from public.client_service_agreements_v2 a where a.business_id=p_business_id and a.client_id=p_client_id and a.status='active' and a.monthly_fee is not null;end if;if fee is null then raise exception 'Routine monthly fee is not configured for this client';end if;lines=lines||jsonb_build_array(jsonb_build_object('id','line-routine-'||p_invoice_month,'description','Routine garden service - '||p_invoice_month,'quantity',1,'unitPrice',fee,'vatRate',vat,'discountPercent',0,'sourceVisitId',v.id,'sourceQuoteId',null,'category','routine'));routine_added:=true;end if;
  elsif v.vt='quoted' then
    if coalesce(v.payload->>'quotedTotal','')~'^[0-9]+([.][0-9]+)?$' then fee=(v.payload->>'quotedTotal')::numeric;elsif coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$' then fee=(v.payload->>'billingAmountV2')::numeric;else raise exception 'Quoted visit % has no billing amount',v.id;end if;lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description',coalesce(nullif(v.payload->>'task',''),'Quoted work'),'quantity',1,'unitPrice',fee,'vatRate',vat,'discountPercent',0,'sourceVisitId',v.id,'sourceQuoteId',nullif(v.payload->>'sourceQuoteId',''),'category','quoted'));
  else
    if not(coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$') then raise exception 'Set the Billing amount for visit % before invoicing',v.id;end if;fee=(v.payload->>'billingAmountV2')::numeric;lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description',case when lower(v.status)='cancelled' then 'Chargeable cancellation' else coalesce(nullif(v.payload->>'task',''),'Additional visit') end,'quantity',1,'unitPrice',fee,'vatRate',vat,'discountPercent',0,'sourceVisitId',v.id,'sourceQuoteId',null,'category',case when lower(v.status)='cancelled' then 'cancellation' else 'additional' end));
  end if;
  eligible_ids:=array_append(eligible_ids,v.id);
 end loop;
 if jsonb_array_length(lines)=0 then raise exception 'No billable work selected';end if;
 perform public.tuinbooks_v2_save_invoice(p_business_id,inv_id,p_client_id,p_invoice_month,p_issue_date,p_due_date,'Draft','Draft',lines,'Created from Billing review');
 insert into public.invoice_visit_links_v2(business_id,invoice_id,visit_id) select p_business_id,inv_id,x from unnest(eligible_ids) x on conflict do nothing;
 return inv_id;end$$;

create or replace function public.tuinbooks_v2_set_invoice_status(p_business_id uuid,p_invoice_id text,p_status text) returns void language plpgsql security definer set search_path=public as $$declare inv public.invoices%rowtype;v_number text;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if p_status not in('Ready','Sent','Void') then raise exception 'Invalid invoice transition';end if;
 select * into inv from public.invoices where business_id=p_business_id and id=p_invoice_id for update;if not found then raise exception 'Invoice not found';end if;
 if p_status='Ready' then
  if inv.status not in('Draft','Ready') then raise exception 'Only draft invoices can be marked ready';end if;
  v_number:=inv.invoice_number;if coalesce(v_number,'Draft')='Draft' then v_number:=public.tuinbooks_v2_next_invoice_number(p_business_id);end if;
  update public.invoices set status='Ready',invoice_number=v_number,updated_at=now() where business_id=p_business_id and id=p_invoice_id;
 elsif p_status='Sent' then
  if inv.status<>'Ready' then raise exception 'Only ready invoices can be sent';end if;if coalesce(inv.invoice_number,'Draft')='Draft' then raise exception 'Invoice number was not assigned';end if;
  update public.invoices set status='Sent',updated_at=now(),payload=payload||jsonb_build_object('sentAt',now(),'deliveryStatus','Sent') where business_id=p_business_id and id=p_invoice_id;
 else
  if inv.status not in('Draft','Ready') then raise exception 'Only unissued invoices can be voided here';end if;update public.invoices set status='Void',updated_at=now() where business_id=p_business_id and id=p_invoice_id;delete from public.invoice_visit_links_v2 where business_id=p_business_id and invoice_id=p_invoice_id;
 end if;
end$$;

notify pgrst,'reload schema';
commit;

-- ============================================================================
-- END migration-v2-release-completion.sql
-- ============================================================================
