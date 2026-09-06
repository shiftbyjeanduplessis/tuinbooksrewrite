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
