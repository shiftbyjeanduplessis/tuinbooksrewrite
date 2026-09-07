-- TuinBooks R25 — Schedule Basket release blockers
-- 1) Basket placement accepts audited operational-edit Support authority.
-- 2) Calendar -> Basket accepts the same authority.
-- 3) Basket placement is hardened against repeat placement.
-- 4) Multiple selected Basket cards can be placed atomically on one team/day.
-- 5) Existing R13 multi-card calendar -> Basket also accepts operational-edit Support authority.

begin;

create or replace function public.tuinbooks_v2_move_visit_to_basket(
  p_business_id uuid,
  p_visit_id text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_job public.schedule_jobs%rowtype;
  v_occ public.schedule_occurrences_v2%rowtype;
  v_queue_id text:='queue-job-'||p_visit_id;
  v_site text;
  v_type text;
  v_billing text;
begin
  if not public.tuinbooks_v2_can_operational_edit(p_business_id) then
    raise exception 'Operational edit access required';
  end if;

  select * into v_job
  from public.schedule_jobs
  where business_id=p_business_id and id=p_visit_id
  for update;

  if not found then raise exception 'Visit not found'; end if;
  if lower(v_job.status) in ('completed','cancelled','canceled','rescheduled','suspended') then
    raise exception 'This visit cannot move to Basket';
  end if;
  if exists(select 1 from public.work_records where business_id=p_business_id and schedule_job_id=p_visit_id) then
    raise exception 'A visit with field work cannot move to Basket';
  end if;

  select * into v_occ
  from public.schedule_occurrences_v2
  where business_id=p_business_id and schedule_job_id=p_visit_id
  for update;

  v_site:=coalesce(v_job.payload->>'serviceLocationId',v_job.payload->>'serviceSiteId',v_job.payload->>'siteId','');
  v_type:=case
    when lower(coalesce(v_job.payload->>'workKind',v_job.payload->>'visitType','')) like '%additional%' then 'additional'
    when lower(coalesce(v_job.payload->>'revenueType','')) like '%quote%' then 'quoted'
    else 'routine'
  end;
  v_billing:=case when v_type='additional' then 'additional' when v_type='quoted' then 'quoted' else 'routine' end;

  insert into public.schedule_queue_items_v2(
    business_id,id,client_id,service_site_id,source_schedule_job_id,original_date,original_team_id,
    estimated_minutes,service_ids,item_type,billing_disposition,reason,status,payload,created_by,updated_by
  ) values (
    p_business_id,v_queue_id,v_job.client_id,v_site,v_job.id,v_job.visit_date,v_job.team_id,
    round(v_job.estimated_hours*60)::integer,coalesce(v_job.service_ids,'{}'),v_type,v_billing,
    'Moved from calendar','open',v_job.payload||jsonb_build_object('v2QueueItemId',v_queue_id),auth.uid(),auth.uid()
  )
  on conflict(business_id,id) do update set
    client_id=excluded.client_id,
    service_site_id=excluded.service_site_id,
    source_schedule_job_id=excluded.source_schedule_job_id,
    original_date=excluded.original_date,
    original_team_id=excluded.original_team_id,
    estimated_minutes=excluded.estimated_minutes,
    service_ids=excluded.service_ids,
    item_type=excluded.item_type,
    billing_disposition=excluded.billing_disposition,
    reason=excluded.reason,
    status='open',
    payload=excluded.payload,
    updated_by=auth.uid(),
    updated_at=now();

  if v_occ.id is not null then
    update public.schedule_occurrences_v2
    set schedule_job_id=null,
        queue_item_id=v_queue_id,
        status='basket',
        planned_date=v_job.visit_date,
        manual_override=true,
        updated_at=now()
    where business_id=p_business_id and id=v_occ.id;
  end if;

  delete from public.schedule_jobs
  where business_id=p_business_id and id=p_visit_id;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_visit_to_basket',jsonb_build_object('queue_id',v_queue_id,'recurring',v_occ.id is not null,'r25',true));

  return jsonb_build_object('queue_id',v_queue_id,'visit_id',p_visit_id);
end;
$$;

create or replace function public.tuinbooks_v2_schedule_queue_item(
  p_business_id uuid,
  p_queue_item_id text,
  p_date date,
  p_team_id text,
  p_sort_order integer
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item public.schedule_queue_items_v2%rowtype;
  v_occ public.schedule_occurrences_v2%rowtype;
  v_job_id text;
  v_existing_job_id text;
  v_collision_business uuid;
begin
  if not public.tuinbooks_v2_can_operational_edit(p_business_id) then
    raise exception 'Operational edit access required';
  end if;

  select * into v_item
  from public.schedule_queue_items_v2
  where business_id=p_business_id and id=p_queue_item_id
  for update;

  if not found then raise exception 'Basket item not found'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then
    raise exception 'Team not found';
  end if;

  select j.id into v_existing_job_id
  from public.schedule_jobs j
  where j.business_id=p_business_id
    and (
      (nullif(v_item.source_schedule_job_id,'') is not null and j.id=v_item.source_schedule_job_id)
      or j.payload->>'v2QueueItemId'=p_queue_item_id
    )
  order by case when j.id=v_item.source_schedule_job_id then 0 else 1 end,j.updated_at desc nulls last
  limit 1
  for update;

  -- A duplicate pointer-up/network retry must never create a second visit.
  if lower(coalesce(v_item.status,'open'))<>'open' then
    if v_existing_job_id is not null then
      return jsonb_build_object('visit_id',v_existing_job_id,'queue_id',p_queue_item_id,'already_scheduled',true);
    end if;
    raise exception 'Basket item is no longer open';
  end if;

  select * into v_occ
  from public.schedule_occurrences_v2
  where business_id=p_business_id and queue_item_id=p_queue_item_id
  for update;

  v_job_id:=coalesce(
    nullif(v_item.source_schedule_job_id,''),
    v_existing_job_id,
    'sch-v2-'||replace(gen_random_uuid()::text,'-','')
  );

  select business_id into v_collision_business
  from public.schedule_jobs
  where id=v_job_id
  for update;

  if found then
    if v_collision_business<>p_business_id then
      raise exception 'Schedule job ID collision for another business';
    end if;
    update public.schedule_jobs
    set visit_date=p_date,
        client_id=v_item.client_id,
        team_id=p_team_id,
        status='scheduled',
        estimated_hours=v_item.estimated_minutes::numeric/60,
        sort_order=coalesce(p_sort_order,99),
        service_ids=coalesce(v_item.service_ids,'{}'),
        payload=v_item.payload||jsonb_build_object(
          'serviceLocationId',nullif(v_item.service_site_id,''),
          'v2RestoredFromQueue',true,
          'v2QueueItemId',p_queue_item_id,
          'manualOverride',true,
          'autoAssigned',false,
          'v2BasketPlacedAt',now()
        ),
        updated_by=auth.uid(),
        updated_at=now()
    where business_id=p_business_id and id=v_job_id;
  else
    insert into public.schedule_jobs(
      business_id,id,visit_date,client_id,team_id,status,estimated_hours,sort_order,service_ids,payload,created_by,updated_by
    ) values (
      p_business_id,v_job_id,p_date,v_item.client_id,p_team_id,'scheduled',v_item.estimated_minutes::numeric/60,
      coalesce(p_sort_order,99),coalesce(v_item.service_ids,'{}'),
      v_item.payload||jsonb_build_object(
        'serviceLocationId',nullif(v_item.service_site_id,''),
        'v2RestoredFromQueue',true,
        'v2QueueItemId',p_queue_item_id,
        'manualOverride',true,
        'autoAssigned',false,
        'v2BasketPlacedAt',now()
      ),auth.uid(),auth.uid()
    );
  end if;

  update public.schedule_queue_items_v2
  set status='scheduled',updated_by=auth.uid(),updated_at=now()
  where business_id=p_business_id and id=p_queue_item_id;

  if v_occ.id is not null then
    update public.schedule_occurrences_v2
    set schedule_job_id=v_job_id,
        queue_item_id=null,
        planned_date=p_date,
        status='scheduled',
        manual_override=true,
        updated_at=now()
    where business_id=p_business_id and id=v_occ.id;
  end if;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(
    p_business_id,auth.uid(),'schedule_job',v_job_id,'v2_basket_scheduled',
    jsonb_build_object('queue_id',p_queue_item_id,'date',p_date,'team_id',p_team_id,'recurring',v_occ.id is not null,'r25',true)
  );

  return jsonb_build_object('visit_id',v_job_id,'queue_id',p_queue_item_id,'already_scheduled',false);
end;
$$;

create or replace function public.tuinbooks_v2_move_visits_to_basket_r13(
  p_business_id uuid,
  p_visit_ids text[]
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text;
  v_count integer:=0;
begin
  if not public.tuinbooks_v2_can_operational_edit(p_business_id) then
    raise exception 'Operational edit access required';
  end if;
  if coalesce(array_length(p_visit_ids,1),0)<1 then raise exception 'No visits selected'; end if;
  if array_length(p_visit_ids,1)>100 then raise exception 'At most 100 visits can be moved together'; end if;

  foreach v_id in array p_visit_ids loop
    if not exists(
      select 1 from public.schedule_jobs
      where business_id=p_business_id and id=v_id
        and lower(status) not in ('completed','cancelled','canceled','rescheduled','suspended')
    ) then raise exception 'Visit % cannot move to Basket',v_id; end if;
    if exists(select 1 from public.work_records where business_id=p_business_id and schedule_job_id=v_id) then
      raise exception 'Visit % already has field work and cannot move to Basket',v_id;
    end if;
  end loop;

  foreach v_id in array p_visit_ids loop
    perform public.tuinbooks_v2_move_visit_to_basket(p_business_id,v_id);
    v_count:=v_count+1;
  end loop;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule',p_business_id::text,'v2_group_visit_to_basket_r13',jsonb_build_object('count',v_count,'visit_ids',to_jsonb(p_visit_ids),'r25',true));
  return jsonb_build_object('queued',v_count);
end;
$$;

create or replace function public.tuinbooks_v2_schedule_queue_items_group_r25(
  p_business_id uuid,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item jsonb;
  v_queue_id text;
  v_date date;
  v_team text;
  v_sort integer;
  v_count integer:=0;
begin
  if not public.tuinbooks_v2_can_operational_edit(p_business_id) then
    raise exception 'Operational edit access required';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Items must be a JSON array'; end if;
  if jsonb_array_length(p_items)<1 then raise exception 'No Basket items selected'; end if;
  if jsonb_array_length(p_items)>100 then raise exception 'At most 100 Basket items can be placed together'; end if;

  -- Preflight the whole group before changing anything.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_queue_id:=nullif(trim(v_item->>'queue_item_id'),'');
    v_team:=nullif(trim(v_item->>'team_id'),'');
    if v_queue_id is null or v_team is null or nullif(v_item->>'date','') is null then
      raise exception 'Each Basket placement needs queue_item_id, date and team_id';
    end if;
    begin v_date:=(v_item->>'date')::date; exception when others then raise exception 'Invalid target date for Basket item %',v_queue_id; end;
    if not exists(select 1 from public.schedule_queue_items_v2 where business_id=p_business_id and id=v_queue_id and lower(status)='open') then
      raise exception 'Basket item % is no longer available',v_queue_id;
    end if;
    if not exists(select 1 from public.teams where business_id=p_business_id and id=v_team and active=true) then
      raise exception 'Team % not found',v_team;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_queue_id:=trim(v_item->>'queue_item_id');
    v_date:=(v_item->>'date')::date;
    v_team:=trim(v_item->>'team_id');
    v_sort:=coalesce(nullif(v_item->>'sort_order','')::integer,99);
    perform public.tuinbooks_v2_schedule_queue_item(p_business_id,v_queue_id,v_date,v_team,v_sort);
    v_count:=v_count+1;
  end loop;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule',p_business_id::text,'v2_group_basket_placement_r25',jsonb_build_object('count',v_count,'items',p_items));

  return jsonb_build_object('scheduled',v_count);
end;
$$;

revoke all on function public.tuinbooks_v2_move_visit_to_basket(uuid,text) from public;
revoke all on function public.tuinbooks_v2_schedule_queue_item(uuid,text,date,text,integer) from public;
revoke all on function public.tuinbooks_v2_move_visits_to_basket_r13(uuid,text[]) from public;
revoke all on function public.tuinbooks_v2_schedule_queue_items_group_r25(uuid,jsonb) from public;

grant execute on function public.tuinbooks_v2_move_visit_to_basket(uuid,text) to authenticated;
grant execute on function public.tuinbooks_v2_schedule_queue_item(uuid,text,date,text,integer) to authenticated;
grant execute on function public.tuinbooks_v2_move_visits_to_basket_r13(uuid,text[]) to authenticated;
grant execute on function public.tuinbooks_v2_schedule_queue_items_group_r25(uuid,jsonb) to authenticated;

commit;
