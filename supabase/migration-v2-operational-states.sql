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
