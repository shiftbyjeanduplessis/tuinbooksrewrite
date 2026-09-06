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

-- R11 basket placement hardening: if the source schedule row still exists, reuse/update
-- it instead of attempting a duplicate primary-key insert.
begin;
create or replace function public.tuinbooks_v2_schedule_queue_item(
  p_business_id uuid,p_queue_item_id text,p_date date,p_team_id text,p_sort_order integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item public.schedule_queue_items_v2%rowtype;v_occ public.schedule_occurrences_v2%rowtype;v_job_id text;v_existing_business uuid;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  select * into v_item from public.schedule_queue_items_v2 where business_id=p_business_id and id=p_queue_item_id for update;
  if not found then raise exception 'Basket item not found'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found'; end if;
  select * into v_occ from public.schedule_occurrences_v2 where business_id=p_business_id and queue_item_id=p_queue_item_id for update;
  v_job_id:=case when nullif(v_item.source_schedule_job_id,'') is not null then v_item.source_schedule_job_id else 'sch-v2-'||replace(gen_random_uuid()::text,'-','') end;
  select business_id into v_existing_business from public.schedule_jobs where id=v_job_id for update;
  if found then
    if v_existing_business<>p_business_id then raise exception 'Schedule job ID collision for another business'; end if;
    update public.schedule_jobs set visit_date=p_date,client_id=v_item.client_id,team_id=p_team_id,status='scheduled',estimated_hours=v_item.estimated_minutes::numeric/60,sort_order=coalesce(p_sort_order,99),service_ids=coalesce(v_item.service_ids,'{}'),payload=v_item.payload||jsonb_build_object('serviceLocationId',nullif(v_item.service_site_id,''),'v2RestoredFromQueue',true,'manualOverride',true,'autoAssigned',false,'v2BasketPlacedAt',now()),updated_by=auth.uid(),updated_at=now() where business_id=p_business_id and id=v_job_id;
  else
    insert into public.schedule_jobs(business_id,id,visit_date,client_id,team_id,status,estimated_hours,sort_order,service_ids,payload,created_by,updated_by) values(p_business_id,v_job_id,p_date,v_item.client_id,p_team_id,'scheduled',v_item.estimated_minutes::numeric/60,coalesce(p_sort_order,99),coalesce(v_item.service_ids,'{}'),v_item.payload||jsonb_build_object('serviceLocationId',nullif(v_item.service_site_id,''),'v2RestoredFromQueue',true,'manualOverride',true,'autoAssigned',false,'v2BasketPlacedAt',now()),auth.uid(),auth.uid());
  end if;
  update public.schedule_queue_items_v2 set status='scheduled',updated_by=auth.uid(),updated_at=now() where business_id=p_business_id and id=p_queue_item_id;
  if v_occ.id is not null then update public.schedule_occurrences_v2 set schedule_job_id=v_job_id,queue_item_id=null,planned_date=p_date,status='scheduled',manual_override=true,updated_at=now() where business_id=p_business_id and id=v_occ.id; end if;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'schedule_job',v_job_id,'v2_basket_scheduled',jsonb_build_object('queue_id',p_queue_item_id,'date',p_date,'team_id',p_team_id,'recurring',v_occ.id is not null,'reused_existing_job',v_existing_business is not null));
  return jsonb_build_object('visit_id',v_job_id,'queue_id',p_queue_item_id,'reused_existing_job',v_existing_business is not null);
end;$$;
revoke all on function public.tuinbooks_v2_schedule_queue_item(uuid,text,date,text,integer) from public;
grant execute on function public.tuinbooks_v2_schedule_queue_item(uuid,text,date,text,integer) to authenticated;
commit;
