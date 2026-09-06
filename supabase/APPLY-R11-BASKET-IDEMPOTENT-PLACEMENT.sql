-- TuinBooks R11 — Basket placement must be idempotent and must not fail when the
-- original schedule job row still exists. No customer/schedule rows are bulk changed.

begin;

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
  v_existing_business uuid;
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  select * into v_item
  from public.schedule_queue_items_v2
  where business_id=p_business_id and id=p_queue_item_id
  for update;

  if not found then
    raise exception 'Basket item not found';
  end if;

  if not exists(
    select 1 from public.teams
    where business_id=p_business_id and id=p_team_id and active=true
  ) then
    raise exception 'Team not found';
  end if;

  select * into v_occ
  from public.schedule_occurrences_v2
  where business_id=p_business_id and queue_item_id=p_queue_item_id
  for update;

  v_job_id := case
    when nullif(v_item.source_schedule_job_id,'') is not null then v_item.source_schedule_job_id
    else 'sch-v2-'||replace(gen_random_uuid()::text,'-','')
  end;

  select business_id into v_existing_business
  from public.schedule_jobs
  where id=v_job_id
  for update;

  if found then
    if v_existing_business<>p_business_id then
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
          'manualOverride',true,
          'autoAssigned',false,
          'v2BasketPlacedAt',now()
        ),
        updated_by=auth.uid(),
        updated_at=now()
    where business_id=p_business_id and id=v_job_id;
  else
    insert into public.schedule_jobs(
      business_id,id,visit_date,client_id,team_id,status,
      estimated_hours,sort_order,service_ids,payload,created_by,updated_by
    ) values (
      p_business_id,v_job_id,p_date,v_item.client_id,p_team_id,'scheduled',
      v_item.estimated_minutes::numeric/60,coalesce(p_sort_order,99),coalesce(v_item.service_ids,'{}'),
      v_item.payload||jsonb_build_object(
        'serviceLocationId',nullif(v_item.service_site_id,''),
        'v2RestoredFromQueue',true,
        'manualOverride',true,
        'autoAssigned',false,
        'v2BasketPlacedAt',now()
      ),
      auth.uid(),auth.uid()
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

  insert into public.audit_events(
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    p_business_id,auth.uid(),'schedule_job',v_job_id,'v2_basket_scheduled',
    jsonb_build_object(
      'queue_id',p_queue_item_id,
      'date',p_date,
      'team_id',p_team_id,
      'recurring',v_occ.id is not null,
      'reused_existing_job',v_existing_business is not null
    )
  );

  return jsonb_build_object(
    'visit_id',v_job_id,
    'queue_id',p_queue_item_id,
    'reused_existing_job',v_existing_business is not null
  );
end;
$$;

revoke all on function public.tuinbooks_v2_schedule_queue_item(uuid,text,date,text,integer) from public;
grant execute on function public.tuinbooks_v2_schedule_queue_item(uuid,text,date,text,integer) to authenticated;

commit;
