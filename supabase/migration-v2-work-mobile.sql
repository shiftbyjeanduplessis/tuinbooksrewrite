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
