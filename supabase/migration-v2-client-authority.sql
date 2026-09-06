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
