-- TUINBOOKS RELEASE R24 — MINI STRESS CHECKPOINT BLOCKERS
-- Apply AFTER the existing v2 core/R4/R6/R17 migrations.
-- This is an additive create-or-replace hotfix. It does not delete customer data.
-- Fixes: support read/edit authority, read-only Schedule horizon mutation, Work support access,
-- fresh-account client/agreement writes, business contact persistence, quote payload ambiguity,
-- and the Settings Recent activity reader.

begin;

create or replace function public.tuinbooks_v2_can_operational_read(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.business_members bm where bm.business_id=target_business_id and bm.user_id=auth.uid() and bm.active=true and lower(bm.role) in('owner','admin','administrator','office_manager'))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_grants g on g.support_user_id=ps.user_id and g.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(g.status)='active' and coalesce(g.starts_at,now())<=now() and (g.expires_at is null or g.expires_at>now()) and (coalesce(g.allow_operational_read,false) or coalesce(g.allow_operational_edit,false)))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_sessions s on s.support_user_id=ps.user_id and s.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(s.status)='active' and s.expires_at>now() and (coalesce(s.allow_operational_read,false) or coalesce(s.allow_operational_edit,false)));
$$;
create or replace function public.tuinbooks_v2_can_operational_edit(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.business_members bm where bm.business_id=target_business_id and bm.user_id=auth.uid() and bm.active=true and lower(bm.role) in('owner','admin','administrator','office_manager'))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_grants g on g.support_user_id=ps.user_id and g.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(g.status)='active' and coalesce(g.starts_at,now())<=now() and (g.expires_at is null or g.expires_at>now()) and coalesce(g.allow_operational_edit,false))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_sessions s on s.support_user_id=ps.user_id and s.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(s.status)='active' and s.expires_at>now() and coalesce(s.allow_operational_edit,false));
$$;
create or replace function public.tuinbooks_v2_can_financial_read(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.business_members bm where bm.business_id=target_business_id and bm.user_id=auth.uid() and bm.active=true and lower(bm.role) in('owner','admin','administrator','office_manager'))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_grants g on g.support_user_id=ps.user_id and g.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(g.status)='active' and coalesce(g.starts_at,now())<=now() and (g.expires_at is null or g.expires_at>now()) and (coalesce(g.allow_financial_read,false) or coalesce(g.allow_financial_edit,false)))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_sessions s on s.support_user_id=ps.user_id and s.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(s.status)='active' and s.expires_at>now() and (coalesce(s.allow_financial_read,false) or coalesce(s.allow_financial_edit,false)));
$$;
create or replace function public.tuinbooks_v2_can_financial_edit(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.business_members bm where bm.business_id=target_business_id and bm.user_id=auth.uid() and bm.active=true and lower(bm.role) in('owner','admin','administrator','office_manager'))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_grants g on g.support_user_id=ps.user_id and g.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(g.status)='active' and coalesce(g.starts_at,now())<=now() and (g.expires_at is null or g.expires_at>now()) and coalesce(g.allow_financial_edit,false))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_sessions s on s.support_user_id=ps.user_id and s.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(s.status)='active' and s.expires_at>now() and coalesce(s.allow_financial_edit,false));
$$;

create or replace function public.tuinbooks_v2_financials_enabled(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select lower(coalesce(b.settings->'v2'->>'mode',b.settings->>'mode','financials'))<>'planning' from public.businesses b where b.id=target_business_id),false);
$$;

create or replace function public.tuinbooks_v2_load_schedule_week(p_business_id uuid,p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_end date:=p_week_start+6; v_result jsonb;
begin
  if not public.tuinbooks_v2_can_operational_read(p_business_id) then raise exception 'Operational read access required'; end if;
  if public.tuinbooks_v2_can_operational_edit(p_business_id) then
    perform public.tuinbooks_v2_ensure_series_horizon(p_business_id,p_week_start,p_week_start+55);
  end if;
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

create or replace function public.tuinbooks_v2_load_client_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.tuinbooks_v2_can_operational_read(p_business_id) then raise exception 'Operational read access required';end if;
 return jsonb_build_object(
  'accounts',coalesce((select jsonb_agg(to_jsonb(c) order by c.name,c.id) from public.customers c where c.business_id=p_business_id and lower(coalesce(c.status,'active'))<>'archived'),'[]'::jsonb),
  'locations',coalesce((select jsonb_agg(to_jsonb(s) order by s.customer_id,s.site_name,s.id) from public.service_sites s where s.business_id=p_business_id),'[]'::jsonb),
  'agreements',coalesce((select jsonb_agg(to_jsonb(a) order by a.client_id,a.start_date,a.id) from public.client_service_agreements_v2 a where a.business_id=p_business_id),'[]'::jsonb),
  'teams',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.teams t where t.business_id=p_business_id and t.active=true),'[]'::jsonb)
 );
end;$$;

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
  if v_role is null then
    if not public.tuinbooks_v2_can_operational_read(p_business_id) then raise exception 'Operational read access required'; end if;
    v_is_admin:=true;
  else
    v_is_admin:=v_role in ('owner','admin','administrator','office_manager');
  end if;
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

create or replace function public.tuinbooks_v2_ensure_series_horizon(p_business_id uuid,p_from date,p_through date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_series public.schedule_series_v2%rowtype;v_slot public.schedule_series_slots_v2%rowtype;v_due date;v_job_id text;v_occ_id text;v_sort integer;v_generated integer:=0;v_skipped integer:=0;v_payload jsonb;
begin
  if not public.tuinbooks_v2_can_operational_edit(p_business_id) then raise exception 'Operational edit access required'; end if;
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

create or replace function public.tuinbooks_v2_save_account(
  p_business_id uuid,p_id text,p_name text,p_status text,p_contact_name text,p_phone text,p_email text
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.tuinbooks_v2_can_operational_edit(p_business_id) then raise exception 'Operational edit access required'; end if;
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
  if not public.tuinbooks_v2_can_operational_edit(p_business_id) then raise exception 'Operational edit access required'; end if;
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
  if not public.tuinbooks_v2_can_operational_edit(p_business_id) then raise exception 'Operational edit access required'; end if;
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
  if v_role is null and public.tuinbooks_v2_can_operational_edit(p_business_id) then v_role:='owner'; end if;
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
  if v_role is null and public.tuinbooks_v2_can_operational_edit(p_business_id) then v_role:='owner'; end if;
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

create or replace function public.tuinbooks_v2_load_business_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype; v2 jsonb;
begin
 if not (public.tuinbooks_v2_can_operational_read(p_business_id) or public.tuinbooks_v2_can_financial_read(p_business_id)) then raise exception 'Business read access required'; end if;
 select * into b from public.businesses where id=p_business_id;if not found then raise exception 'Business not found';end if;
 v2:=coalesce(b.settings->'v2','{}'::jsonb);
 return jsonb_build_object(
  'business',jsonb_build_object(
    'id',b.id,'name',coalesce(nullif(b.name,''),v2->>'name','TuinBooks business'),
    'phone',coalesce(nullif(b.phone,''),v2->>'phone',''),
    'email',coalesce(nullif(b.email,''),v2->>'email',''),
    'address',coalesce(nullif(b.address,''),v2->>'address','')
  ),
  'settings',v2,
  'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'notes',s.notes,'active',s.active) order by s.name) from public.business_services_v2 s where s.business_id=p_business_id),'[]'::jsonb),
  'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'capacity_hours',t.capacity_hours,'buffer_hours',t.buffer_hours,'active',t.active) order by t.name) from public.teams t where t.business_id=p_business_id),'[]'::jsonb)
 );
end;$$;

create or replace function public.tuinbooks_v2_save_business_settings(p_business_id uuid,p_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare n text:=trim(coalesce(p_settings->>'name','')); v2 jsonb;
begin
 if not (public.tuinbooks_v2_can_operational_edit(p_business_id) or public.tuinbooks_v2_can_financial_edit(p_business_id)) then raise exception 'Business edit access required'; end if;
 if n='' then raise exception 'Business name is required';end if;
 v2:=(coalesce(p_settings,'{}'::jsonb)-'name') || jsonb_build_object(
   'phone',trim(coalesce(p_settings->>'phone','')),
   'email',lower(trim(coalesce(p_settings->>'email',''))),
   'address',trim(coalesce(p_settings->>'address',''))
 );
 update public.businesses set
   name=n,
   phone=trim(coalesce(p_settings->>'phone','')),
   email=lower(trim(coalesce(p_settings->>'email',''))),
   address=trim(coalesce(p_settings->>'address','')),
   settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{v2}',v2,true),
   updated_at=now()
 where id=p_business_id;
 if not found then raise exception 'Business not found'; end if;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(p_business_id,auth.uid(),'business',p_business_id::text,'v2_business_settings_saved',jsonb_build_object('mode',p_settings->>'mode','phone_saved',true,'email_saved',true,'sender_name',p_settings->>'emailFromName'));
 return jsonb_build_object('ok',true,'name',n,'phone',p_settings->>'phone','email',p_settings->>'email','emailFromName',p_settings->>'emailFromName');
end;$$;

create or replace function public.tuinbooks_v2_save_quote(
 p_business_id uuid,p_quote_id text,p_client_id text,p_quote_date date,p_valid_until date,
 p_status text,p_number text,p_lines jsonb,p_notes text
) returns text language plpgsql security definer set search_path=public,auth as $$
declare old_status text;v_payload jsonb;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not exists(select 1 from public.customers c where c.business_id=p_business_id and c.id=p_client_id) then raise exception 'Client not found';end if;
 if p_status not in('Draft','Sent','Accepted','Declined','Expired','Cancelled') then raise exception 'Invalid quote status';end if;
 select q.status into old_status from public.quotes q where q.business_id=p_business_id and q.id=p_quote_id for update;
 if old_status='Accepted' then raise exception 'Accepted quotes are historical documents and cannot be edited';end if;
 if nullif(trim(p_number),'') is not null and exists(
   select 1 from public.quotes q
   where q.business_id=p_business_id and q.id<>p_quote_id and q.payload->>'number'=trim(p_number)
 ) then raise exception 'Quote number already exists';end if;
 v_payload:=jsonb_build_object('number',coalesce(nullif(trim(p_number),''),p_quote_id),'validUntil',p_valid_until,'notes',coalesce(p_notes,''),'lines',coalesce(p_lines,'[]'::jsonb),'v2Document',true);
 insert into public.quotes(business_id,id,client_id,quote_date,status,payload,created_by)
 values(p_business_id,p_quote_id,p_client_id,p_quote_date,p_status,v_payload,auth.uid())
 on conflict(business_id,id) do update set client_id=excluded.client_id,quote_date=excluded.quote_date,status=excluded.status,payload=excluded.payload,updated_at=now();
 perform public.tuinbooks_v2_replace_quote_lines(p_business_id,p_quote_id,p_lines);
 return p_quote_id;
end;$$;



-- Planning-only is enforced at the database write boundary as well as the UI.
create or replace function public.tuinbooks_v2_save_invoice(p_business_id uuid,p_invoice_id text,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_status text,p_number text,p_lines jsonb,p_notes text) returns text language plpgsql security definer set search_path=public as $$declare old_status text;total numeric;payload jsonb;begin if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;if p_status not in('Draft','Ready','Sent','Paid','Partially paid','Overdue','Credited','Void') then raise exception 'Invalid invoice status';end if;select status into old_status from public.invoices where business_id=p_business_id and id=p_invoice_id for update;if old_status is not null and old_status not in('Draft','Ready') then raise exception 'Issued invoices are immutable; use payment/credit flows instead';end if;if trim(coalesce(p_number,''))<>'Draft' and exists(select 1 from public.invoices where business_id=p_business_id and id<>p_invoice_id and invoice_number=trim(p_number)) then raise exception 'Invoice number already exists';end if;select coalesce(sum(coalesce((r->>'quantity')::numeric,1)*coalesce((r->>'unitPrice')::numeric,0)*(1+coalesce((r->>'vatRate')::numeric,0)/100)),0) into total from jsonb_array_elements(coalesce(p_lines,'[]')) r;payload=jsonb_build_object('issueDate',p_issue_date,'dueDate',p_due_date,'notes',coalesce(p_notes,''),'lines',coalesce(p_lines,'[]'::jsonb),'v2Document',true);insert into public.invoices(business_id,id,client_id,invoice_month,invoice_number,status,total,payload,created_by) values(p_business_id,p_invoice_id,p_client_id,p_invoice_month,coalesce(nullif(trim(p_number),''),'Draft'),p_status,round(total,2),payload,auth.uid()) on conflict(business_id,id) do update set client_id=excluded.client_id,invoice_month=excluded.invoice_month,invoice_number=excluded.invoice_number,status=excluded.status,total=excluded.total,payload=excluded.payload,updated_at=now();perform public.tuinbooks_v2_replace_invoice_lines(p_business_id,p_invoice_id,p_lines);return p_invoice_id;end$$;

create or replace function public.tuinbooks_v2_set_visit_billing_amount(p_business_id uuid,p_visit_id text,p_amount numeric) returns void language plpgsql security definer set search_path=public as $$begin if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;if p_amount<0 then raise exception 'Amount cannot be negative';end if;update public.schedule_jobs set payload=payload||jsonb_build_object('billingAmountV2',round(p_amount,2),'billingAmountSetAtV2',now()),updated_at=now(),updated_by=auth.uid() where business_id=p_business_id and id=p_visit_id;if not found then raise exception 'Visit not found';end if;end$$;

create or replace function public.tuinbooks_v2_create_invoice_from_facts(p_business_id uuid,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_visit_ids text[]) returns text language plpgsql security definer set search_path=public as $$declare inv_id text:='inv-v2-'||replace(gen_random_uuid()::text,'-','');lines jsonb:='[]';v record;fee numeric;vat numeric:=0;routine_added boolean:=false;begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;if coalesce(array_length(p_visit_ids,1),0)=0 then raise exception 'Choose billable visits';end if;
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

create or replace function public.tuinbooks_v2_record_payment(p_business_id uuid,p_payment_id text,p_invoice_id text,p_date date,p_amount numeric,p_method text,p_reference text,p_note text) returns text language plpgsql security definer set search_path=public as $$declare inv public.invoices%rowtype;paid numeric;begin if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;select * into inv from public.invoices where business_id=p_business_id and id=p_invoice_id for update;if not found then raise exception 'Invoice not found';end if;if p_amount<=0 then raise exception 'Payment must be positive';end if;select coalesce(sum(amount),0) into paid from public.payments_v2 where business_id=p_business_id and invoice_id=p_invoice_id and reversed_at is null;if p_amount>inv.total-paid+.01 then raise exception 'Payment exceeds outstanding balance';end if;insert into public.payments_v2(business_id,id,client_id,invoice_id,payment_date,amount,method,reference,note,created_by) values(p_business_id,p_payment_id,inv.client_id,p_invoice_id,p_date,round(p_amount,2),coalesce(nullif(trim(p_method),''),'Other'),coalesce(trim(p_reference),''),coalesce(trim(p_note),''),auth.uid());paid=paid+p_amount;update public.invoices set status=case when paid>=total-.01 then 'Paid' else 'Partially paid' end,updated_at=now() where business_id=p_business_id and id=p_invoice_id;return p_payment_id;end$$;

create or replace function public.tuinbooks_v2_reverse_payment(p_business_id uuid,p_payment_id text,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare iid text;paid numeric;tot numeric;begin if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;update public.payments_v2 set reversed_at=now(),reversal_reason=coalesce(nullif(trim(p_reason),''),'Reversed'),updated_at=now() where business_id=p_business_id and id=p_payment_id and reversed_at is null returning invoice_id into iid;if iid is null then raise exception 'Active payment not found';end if;select total into tot from public.invoices where business_id=p_business_id and id=iid;select coalesce(sum(amount),0) into paid from public.payments_v2 where business_id=p_business_id and invoice_id=iid and reversed_at is null;update public.invoices set status=case when paid>=tot-.01 then 'Paid' when paid>0 then 'Partially paid' else 'Sent' end,updated_at=now() where business_id=p_business_id and id=iid;end$$;

create or replace function public.tuinbooks_v2_set_invoice_status(p_business_id uuid,p_invoice_id text,p_status text) returns void language plpgsql security definer set search_path=public as $$declare inv public.invoices%rowtype;begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;if p_status not in('Ready','Sent','Void') then raise exception 'Invalid invoice transition';end if;select * into inv from public.invoices where business_id=p_business_id and id=p_invoice_id for update;if not found then raise exception 'Invoice not found';end if;if inv.status not in('Draft','Ready') then raise exception 'Issued invoices are immutable';end if;if p_status='Sent' and coalesce(inv.invoice_number,'Draft')='Draft' then raise exception 'Set an invoice number before sending';end if;update public.invoices set status=p_status,updated_at=now(),payload=payload||case when p_status='Sent' then jsonb_build_object('sentAt',now(),'deliveryStatus','Sent') else '{}'::jsonb end where business_id=p_business_id and id=p_invoice_id;end$$;

create or replace function public.tuinbooks_v2_next_invoice_number(p_business_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_prefix text;v_next bigint;v_seed bigint;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;
 select coalesce(nullif(settings->'v2'->>'invoicePrefix',''),nullif(settings->>'invoicePrefix',''),'INV-') into v_prefix from public.businesses where id=p_business_id;
 select coalesce(max((regexp_match(invoice_number,'([0-9]+)$'))[1]::bigint),0)+1 into v_seed from public.invoices where business_id=p_business_id and invoice_number like v_prefix||'%';
 insert into public.invoice_sequences_v2(business_id,next_number) values(p_business_id,greatest(1,v_seed)) on conflict(business_id) do nothing;
 select next_number into v_next from public.invoice_sequences_v2 where business_id=p_business_id for update;
 update public.invoice_sequences_v2 set next_number=v_next+1,updated_at=now() where business_id=p_business_id;
 return v_prefix||lpad(v_next::text,4,'0');
end;$$;

create or replace function public.tuinbooks_v2_list_audit_log_r17(
  p_business_id uuid,
  p_limit integer default 80
)
returns table(
  created_at timestamptz,
  actor_user_id uuid,
  actor_label text,
  entity_type text,
  entity_id text,
  action text,
  details jsonb
)
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.tuinbooks_v2_can_operational_read(p_business_id) or public.tuinbooks_v2_can_financial_read(p_business_id)) then raise exception 'Business read access required'; end if;

  return query
  select
    a.created_at,
    a.actor_user_id,
    coalesce(
      nullif(bm.display_name,''),
      nullif(u.email,''),
      case when a.actor_user_id is null then 'System' else 'User' end
    )::text as actor_label,
    a.entity_type,
    a.entity_id,
    a.action,
    coalesce(a.details,'{}'::jsonb)
  from public.audit_events a
  left join public.business_members bm
    on bm.business_id=a.business_id and bm.user_id=a.actor_user_id
  left join auth.users u on u.id=a.actor_user_id
  where a.business_id=p_business_id
  order by a.created_at desc
  limit greatest(1,least(coalesce(p_limit,80),250));
end;
$$;


revoke all on function public.tuinbooks_v2_can_operational_read(uuid) from public;
revoke all on function public.tuinbooks_v2_can_operational_edit(uuid) from public;
revoke all on function public.tuinbooks_v2_can_financial_read(uuid) from public;
revoke all on function public.tuinbooks_v2_can_financial_edit(uuid) from public;
grant execute on function public.tuinbooks_v2_can_operational_read(uuid) to authenticated;
grant execute on function public.tuinbooks_v2_can_operational_edit(uuid) to authenticated;
grant execute on function public.tuinbooks_v2_can_financial_read(uuid) to authenticated;
grant execute on function public.tuinbooks_v2_can_financial_edit(uuid) to authenticated;
revoke all on function public.tuinbooks_v2_load_schedule_week(uuid,date) from public,anon;
grant execute on function public.tuinbooks_v2_load_schedule_week(uuid,date) to authenticated;
revoke all on function public.tuinbooks_v2_load_client_workspace(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_load_client_workspace(uuid) to authenticated;
revoke all on function public.tuinbooks_v2_load_work_day(uuid,date) from public;
grant execute on function public.tuinbooks_v2_load_work_day(uuid,date) to authenticated;
revoke all on function public.tuinbooks_v2_ensure_series_horizon(uuid,date,date) from public;
grant execute on function public.tuinbooks_v2_ensure_series_horizon(uuid,date,date) to authenticated;
revoke all on function public.tuinbooks_v2_save_account(uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.tuinbooks_v2_save_service_location(uuid,text,text,text,text,text,text,text,boolean) from public,anon;
revoke all on function public.tuinbooks_v2_save_service_agreement(uuid,text,text,text,text,date,date,text,smallint[],integer,text,integer,text[],text,numeric,date) from public,anon;
grant execute on function public.tuinbooks_v2_save_account(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.tuinbooks_v2_save_service_location(uuid,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.tuinbooks_v2_save_service_agreement(uuid,text,text,text,text,date,date,text,smallint[],integer,text,integer,text[],text,numeric,date) to authenticated;
revoke all on function public.tuinbooks_v2_complete_visit(uuid,text,text,text,jsonb,text,text[]) from public;
grant execute on function public.tuinbooks_v2_complete_visit(uuid,text,text,text,jsonb,text,text[]) to authenticated;
revoke all on function public.tuinbooks_v2_create_opportunity(uuid,text,text,text,text,text,text[]) from public;
grant execute on function public.tuinbooks_v2_create_opportunity(uuid,text,text,text,text,text,text[]) to authenticated;
revoke all on function public.tuinbooks_v2_load_business_workspace(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_load_business_workspace(uuid) to authenticated;
revoke all on function public.tuinbooks_v2_save_business_settings(uuid,jsonb) from public,anon;
grant execute on function public.tuinbooks_v2_save_business_settings(uuid,jsonb) to authenticated;
revoke all on function public.tuinbooks_v2_save_quote(uuid,text,text,date,date,text,text,jsonb,text) from public,anon;
grant execute on function public.tuinbooks_v2_save_quote(uuid,text,text,date,date,text,text,jsonb,text) to authenticated;
revoke all on function public.tuinbooks_v2_list_audit_log_r17(uuid,integer) from public,anon;
grant execute on function public.tuinbooks_v2_list_audit_log_r17(uuid,integer) to authenticated;
revoke all on function public.tuinbooks_v2_financials_enabled(uuid) from public;
grant execute on function public.tuinbooks_v2_financials_enabled(uuid) to authenticated;
revoke all on function public.tuinbooks_v2_save_invoice(uuid,text,text,text,date,date,text,text,jsonb,text) from public,anon;
grant execute on function public.tuinbooks_v2_save_invoice(uuid,text,text,text,date,date,text,text,jsonb,text) to authenticated;
revoke all on function public.tuinbooks_v2_set_visit_billing_amount(uuid,text,numeric) from public,anon;
grant execute on function public.tuinbooks_v2_set_visit_billing_amount(uuid,text,numeric) to authenticated;
revoke all on function public.tuinbooks_v2_create_invoice_from_facts(uuid,text,text,date,date,text[]) from public,anon;
grant execute on function public.tuinbooks_v2_create_invoice_from_facts(uuid,text,text,date,date,text[]) to authenticated;
revoke all on function public.tuinbooks_v2_record_payment(uuid,text,text,date,numeric,text,text,text) from public,anon;
grant execute on function public.tuinbooks_v2_record_payment(uuid,text,text,date,numeric,text,text,text) to authenticated;
revoke all on function public.tuinbooks_v2_reverse_payment(uuid,text,text) from public,anon;
grant execute on function public.tuinbooks_v2_reverse_payment(uuid,text,text) to authenticated;
revoke all on function public.tuinbooks_v2_set_invoice_status(uuid,text,text) from public,anon;
grant execute on function public.tuinbooks_v2_set_invoice_status(uuid,text,text) to authenticated;
revoke all on function public.tuinbooks_v2_next_invoice_number(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_next_invoice_number(uuid) to authenticated;
notify pgrst,'reload schema';

commit;
