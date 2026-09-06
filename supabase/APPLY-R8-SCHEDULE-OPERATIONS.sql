-- TUINBOOKS UI-RESTORED RELEASE R8
-- Schedule operations polish: visit-specific DO NOT SERVICE + durable event responses.
-- Safe/idempotent after the already-installed v2 core + R4/R6 bridges.

begin;

-- Keep event outcomes instead of forcing the user to delete the event to clear it.
alter table public.schedule_day_actions_v2
  add column if not exists response text not null default '',
  add column if not exists resolved_at timestamptz;

alter table public.schedule_day_actions_v2
  drop constraint if exists schedule_day_actions_v2_status_check;
alter table public.schedule_day_actions_v2
  add constraint schedule_day_actions_v2_status_check
  check (status in ('active','resolved','cancelled'));

create or replace function public.tuinbooks_v2_save_day_action_r8(
  p_business_id uuid,
  p_action_id text,
  p_date date,
  p_team_id text,
  p_kind text,
  p_title text,
  p_detail text,
  p_time time default null,
  p_response text default '',
  p_status text default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if p_kind not in ('team_note','internal_event') then raise exception 'Unsupported action kind'; end if;
  if p_status not in ('active','resolved') then raise exception 'Unsupported action status'; end if;
  if not exists(select 1 from public.teams where business_id=p_business_id and id=p_team_id and active=true) then raise exception 'Team not found'; end if;
  if p_kind='team_note' and trim(coalesce(p_detail,''))='' then raise exception 'Note is required'; end if;
  if p_kind='internal_event' and trim(coalesce(p_title,''))='' then raise exception 'Event title is required'; end if;

  insert into public.schedule_day_actions_v2(
    business_id,id,calendar_date,team_id,kind,title,detail,calendar_time,status,response,resolved_at,created_by,updated_by
  ) values(
    p_business_id,p_action_id,p_date,p_team_id,p_kind,
    case when p_kind='team_note' then 'Day instruction' else trim(coalesce(p_title,'')) end,
    trim(coalesce(p_detail,'')),case when p_kind='team_note' then null else p_time end,
    p_status,case when p_kind='team_note' then '' else trim(coalesce(p_response,'')) end,
    case when p_status='resolved' then now() else null end,
    auth.uid(),auth.uid()
  )
  on conflict(business_id,id) do update set
    calendar_date=excluded.calendar_date,
    team_id=excluded.team_id,
    kind=excluded.kind,
    title=excluded.title,
    detail=excluded.detail,
    calendar_time=excluded.calendar_time,
    status=excluded.status,
    response=excluded.response,
    resolved_at=excluded.resolved_at,
    updated_by=auth.uid(),
    updated_at=now();

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_day_action',p_action_id,
    case when p_status='resolved' then 'v2_day_event_resolved' else 'v2_day_action_saved' end,
    jsonb_build_object('kind',p_kind,'date',p_date,'team_id',p_team_id,'response',trim(coalesce(p_response,''))));

  return jsonb_build_object('id',p_action_id,'status',p_status);
end;
$$;

-- Visit-specific DO NOT SERVICE is deliberately stored on the schedule job.
-- It does not pause the client, alter recurrence or make a billing decision.
create or replace function public.tuinbooks_v2_set_visit_do_not_service(
  p_business_id uuid,
  p_visit_id text,
  p_active boolean,
  p_reason text default 'Do not service this visit',
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  update public.schedule_jobs
     set payload=payload||jsonb_build_object(
       'doNotServiceVisitV2',p_active,
       'doNotServiceVisitReasonV2',case when p_active then coalesce(nullif(trim(p_reason),''),'Do not service this visit') else '' end,
       'doNotServiceVisitNoteV2',case when p_active then trim(coalesce(p_note,'')) else '' end,
       'doNotServiceVisitChangedAtV2',now()
     ),
     updated_by=auth.uid(),updated_at=now()
   where business_id=p_business_id and id=p_visit_id;
  if not found then raise exception 'Visit not found'; end if;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_job',p_visit_id,
    case when p_active then 'v2_visit_do_not_service_set' else 'v2_visit_do_not_service_cleared' end,
    jsonb_build_object('reason',p_reason,'note',p_note));

  return jsonb_build_object('id',p_visit_id,'active',p_active);
end;
$$;

revoke all on function public.tuinbooks_v2_save_day_action_r8(uuid,text,date,text,text,text,text,time,text,text) from public;
revoke all on function public.tuinbooks_v2_set_visit_do_not_service(uuid,text,boolean,text,text) from public;
grant execute on function public.tuinbooks_v2_save_day_action_r8(uuid,text,date,text,text,text,text,time,text,text) to authenticated;
grant execute on function public.tuinbooks_v2_set_visit_do_not_service(uuid,text,boolean,text,text) to authenticated;

commit;
