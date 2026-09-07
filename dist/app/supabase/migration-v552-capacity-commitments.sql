-- TuinBooks v55.2: Capacity and Commitment Control
-- Run after migration-v55-layered-operations.sql.
-- Safe to re-run. The live app keeps these structures in operational_meta;
-- this migration creates tenant-scoped relational mirrors for reporting,
-- auditability and later server-side scheduling logic.

begin;

create table if not exists public.service_agreements (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  client_id text not null,
  service_site_id text not null default '',
  name text not null default '',
  status text not null default 'Draft',
  start_date date,
  end_date date,
  billing_period text not null default 'Monthly',
  billing_arrangement text not null default 'Not classified',
  monthly_fee numeric(12,2) not null default 0,
  default_team_id text not null default '',
  preferred_days text[] not null default '{}'::text[],
  cluster_id text not null default '',
  catch_up_policy text not null default 'review',
  credit_policy text not null default 'review',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint service_agreements_client_v552_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete cascade
);

create table if not exists public.service_agreement_lines (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  agreement_id text not null,
  service_id text not null,
  quantity numeric(10,2) not null default 1,
  frequency text not null default 'Monthly',
  period_type text not null default 'Monthly',
  estimated_duration_minutes integer not null default 30,
  minimum_interval_days integer not null default 0,
  maximum_interval_days integer not null default 35,
  flexibility_rule text not null default 'Within month',
  priority text not null default 'Core recurring maintenance',
  required_capability text not null default 'general',
  required_equipment text not null default '',
  catch_up_rule text not null default 'review',
  credit_rule text not null default 'review',
  included_in_fee boolean not null default true,
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint service_agreement_lines_agreement_v552_fk foreign key (business_id,agreement_id)
    references public.service_agreements(business_id,id) on delete cascade
);

create table if not exists public.service_commitments (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  agreement_id text not null,
  agreement_line_id text not null,
  client_id text not null,
  service_site_id text not null default '',
  service_id text not null,
  period_key text not null,
  earliest_date date,
  preferred_date date,
  latest_date date,
  estimated_duration_minutes integer not null default 30,
  priority text not null default 'Core recurring maintenance',
  required_capability text not null default 'general',
  status text not null default 'Forecast',
  risk_level text not null default 'none',
  risk_reasons text[] not null default '{}'::text[],
  schedule_job_id text not null default '',
  work_record_id text not null default '',
  catch_up_record_id text not null default '',
  fulfilled_at timestamptz,
  resolution_type text not null default '',
  resolution_note text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint service_commitments_agreement_v552_fk foreign key (business_id,agreement_id)
    references public.service_agreements(business_id,id) on delete cascade,
  constraint service_commitments_client_v552_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete cascade
);

create table if not exists public.team_capacity_profiles (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  team_id text not null,
  weekday smallint not null check (weekday between 0 and 6),
  paid_minutes integer not null default 480,
  break_minutes integer not null default 30,
  loading_admin_minutes integer not null default 25,
  default_travel_minutes integer not null default 45,
  recovery_buffer_minutes integer not null default 30,
  max_service_minutes integer not null default 350,
  capabilities text[] not null default '{}'::text[],
  equipment_categories text[] not null default '{}'::text[],
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint team_capacity_profiles_team_v552_fk foreign key (business_id,team_id)
    references public.teams(business_id,id) on delete cascade
);

create table if not exists public.capacity_exceptions (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  team_id text not null,
  start_date date not null,
  end_date date not null,
  exception_type text not null,
  capacity_delta_minutes integer not null default 0,
  reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint capacity_exceptions_team_v552_fk foreign key (business_id,team_id)
    references public.teams(business_id,id) on delete cascade
);

create table if not exists public.capacity_overrides (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  team_id text not null,
  schedule_job_id text not null default '',
  period_key text not null default '',
  override_type text not null,
  reason text not null,
  approved_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint capacity_overrides_team_v552_fk foreign key (business_id,team_id)
    references public.teams(business_id,id) on delete cascade
);

create table if not exists public.visit_photos (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  source_kind text not null,
  schedule_job_id text not null default '',
  work_record_id text not null default '',
  client_id text not null default '',
  service_site_id text not null default '',
  category text not null default 'After',
  storage_path text not null default '',
  upload_state text not null default 'saved',
  caption text not null default '',
  uploaded_by uuid references auth.users(id) on delete set null,
  captured_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  primary key (business_id,id)
);

create table if not exists public.fulfilment_periods (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  period_key text not null,
  status text not null default 'Open',
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  unique (business_id,period_key)
);

create index if not exists service_agreements_v552_client_idx
  on public.service_agreements(business_id,client_id,status);
create index if not exists service_agreements_v552_status_idx
  on public.service_agreements(business_id,status,start_date);
create index if not exists service_agreement_lines_v552_service_idx
  on public.service_agreement_lines(business_id,service_id,active);
create index if not exists service_commitments_v552_period_status_idx
  on public.service_commitments(business_id,period_key,status);
create index if not exists service_commitments_v552_deadline_idx
  on public.service_commitments(business_id,latest_date,risk_level);
create index if not exists service_commitments_v552_client_idx
  on public.service_commitments(business_id,client_id,period_key);
create index if not exists service_commitments_v552_service_idx
  on public.service_commitments(business_id,service_id,period_key);
create index if not exists team_capacity_profiles_v552_team_day_idx
  on public.team_capacity_profiles(business_id,team_id,weekday);
create index if not exists capacity_exceptions_v552_team_dates_idx
  on public.capacity_exceptions(business_id,team_id,start_date,end_date);
create index if not exists capacity_overrides_v552_period_idx
  on public.capacity_overrides(business_id,period_key,team_id);
create index if not exists visit_photos_v551_visit_idx
  on public.visit_photos(business_id,schedule_job_id,work_record_id,category);
create index if not exists visit_photos_v551_client_idx
  on public.visit_photos(business_id,client_id,captured_at desc);
create index if not exists fulfilment_periods_v552_period_idx
  on public.fulfilment_periods(business_id,period_key,status);

-- Structured photo metadata remains linked to schedule jobs and final Work
-- Records while the actual image files stay in the private field-photos bucket.
create or replace function public.tuinbooks_sync_schedule_photos_v551()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_job_id text;
begin
  if tg_op='DELETE' then
    v_business_id := old.business_id;
    v_job_id := old.id;
  else
    v_business_id := new.business_id;
    v_job_id := new.id;
  end if;

  delete from public.visit_photos
  where business_id=v_business_id and source_kind='schedule' and schedule_job_id=v_job_id;

  if tg_op='DELETE' then return old; end if;

  insert into public.visit_photos(
    business_id,id,source_kind,schedule_job_id,work_record_id,client_id,
    service_site_id,category,storage_path,upload_state,caption,uploaded_by,
    captured_at,payload
  )
  select new.business_id,
    coalesce(nullif(photo.item->>'id',''),'schedule-'||new.id||'-'||photo.ordinality),
    'schedule',new.id,'',new.client_id,
    coalesce(new.payload->>'serviceSiteId',''),
    coalesce(nullif(photo.item->>'category',''),'After'),
    coalesce(photo.item->>'path',''),
    coalesce(nullif(photo.item->>'uploadState',''),case when nullif(photo.item->>'path','') is null then 'pending' else 'saved' end),
    coalesce(photo.item->>'caption',''),
    case when coalesce(photo.item->>'uploadedBy','') ~* '^[0-9a-f-]{36}$'
      then (photo.item->>'uploadedBy')::uuid else new.updated_by end,
    coalesce(nullif(photo.item->>'createdAt','')::timestamptz,new.updated_at),
    photo.item
  from jsonb_array_elements(coalesce(new.payload->'visitPhotoItems','[]'::jsonb))
    with ordinality as photo(item,ordinality)
  where jsonb_typeof(photo.item)='object';

  return new;
end;
$$;

create or replace function public.tuinbooks_sync_work_record_photos_v551()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_record_id text;
begin
  if tg_op='DELETE' then
    v_business_id := old.business_id;
    v_record_id := old.id;
  else
    v_business_id := new.business_id;
    v_record_id := new.id;
  end if;

  delete from public.visit_photos
  where business_id=v_business_id and source_kind='work_record' and work_record_id=v_record_id;

  if tg_op='DELETE' then return old; end if;

  insert into public.visit_photos(
    business_id,id,source_kind,schedule_job_id,work_record_id,client_id,
    service_site_id,category,storage_path,upload_state,caption,uploaded_by,
    captured_at,payload
  )
  select new.business_id,
    'work-'||new.id||'-'||photo.ordinality,
    'work_record',coalesce(new.schedule_job_id,''),new.id,new.client_id,
    coalesce(new.payload->>'serviceSiteId',''),
    coalesce(nullif(new.payload->'photoCategories'->>(photo.ordinality-1),'') ,'After'),
    photo.path,'saved','',new.created_by,new.created_at,
    jsonb_build_object('path',photo.path,'ordinality',photo.ordinality)
  from unnest(coalesce(new.photo_paths,'{}'::text[])) with ordinality as photo(path,ordinality)
  where nullif(photo.path,'') is not null;

  return new;
end;
$$;

revoke all on function public.tuinbooks_sync_schedule_photos_v551() from public,anon,authenticated;
revoke all on function public.tuinbooks_sync_work_record_photos_v551() from public,anon,authenticated;

drop trigger if exists schedule_jobs_sync_photos_v551 on public.schedule_jobs;
create trigger schedule_jobs_sync_photos_v551
after insert or update of payload or delete on public.schedule_jobs
for each row execute function public.tuinbooks_sync_schedule_photos_v551();

drop trigger if exists work_records_sync_photos_v551 on public.work_records;
create trigger work_records_sync_photos_v551
after insert or update of payload,photo_paths or delete on public.work_records
for each row execute function public.tuinbooks_sync_work_record_photos_v551();

-- Backfill photo metadata that already exists.
update public.schedule_jobs set payload=payload
where jsonb_typeof(payload->'visitPhotoItems')='array';
update public.work_records set payload=payload
where cardinality(photo_paths)>0;

-- Keep relational reporting tables synchronized with the authoritative
-- operational_meta payload written by save_operational_snapshot_v53.
create or replace function public.tuinbooks_sync_capacity_v552()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  delete from public.service_commitments where business_id=new.business_id;
  delete from public.service_agreement_lines where business_id=new.business_id;
  delete from public.service_agreements where business_id=new.business_id;
  delete from public.team_capacity_profiles where business_id=new.business_id;
  delete from public.capacity_exceptions where business_id=new.business_id;
  delete from public.capacity_overrides where business_id=new.business_id;
  delete from public.fulfilment_periods where business_id=new.business_id;

  insert into public.service_agreements(
    business_id,id,client_id,service_site_id,name,status,start_date,end_date,
    billing_period,billing_arrangement,monthly_fee,default_team_id,preferred_days,
    cluster_id,catch_up_policy,credit_policy,payload,created_by,created_at,updated_at
  )
  select new.business_id,
    agreement->>'id', agreement->>'clientId', coalesce(agreement->>'serviceSiteId',''),
    coalesce(agreement->>'name',''), coalesce(nullif(agreement->>'status',''),'Draft'),
    nullif(agreement->>'startDate','')::date, nullif(agreement->>'endDate','')::date,
    coalesce(nullif(agreement->>'billingPeriod',''),'Monthly'),
    coalesce(nullif(agreement->>'billingArrangement',''),'Not classified'),
    coalesce(nullif(agreement->>'monthlyFee','')::numeric,0),
    coalesce(agreement->>'defaultTeamId',''),
    case when jsonb_typeof(agreement->'preferredDays')='array'
      then array(select jsonb_array_elements_text(agreement->'preferredDays'))
      else '{}'::text[] end,
    coalesce(agreement->>'clusterId',''),
    coalesce(nullif(agreement->>'catchUpPolicy',''),'review'),
    coalesce(nullif(agreement->>'creditPolicy',''),'review'),
    agreement,new.updated_by,
    coalesce(nullif(agreement->>'createdAt','')::timestamptz,v_now),
    coalesce(nullif(agreement->>'updatedAt','')::timestamptz,v_now)
  from jsonb_array_elements(coalesce(new.payload->'serviceAgreements','[]'::jsonb)) agreement
  where nullif(agreement->>'id','') is not null
    and nullif(agreement->>'clientId','') is not null
    and exists (
      select 1 from public.customers customer
      where customer.business_id=new.business_id and customer.id=agreement->>'clientId'
    );

  insert into public.service_agreement_lines(
    business_id,id,agreement_id,service_id,quantity,frequency,period_type,
    estimated_duration_minutes,minimum_interval_days,maximum_interval_days,
    flexibility_rule,priority,required_capability,required_equipment,
    catch_up_rule,credit_rule,included_in_fee,active,payload,created_at,updated_at
  )
  select new.business_id,
    line->>'id', agreement->>'id', line->>'serviceId',
    coalesce(nullif(line->>'quantity','')::numeric,1),
    coalesce(nullif(line->>'frequency',''),'Monthly'),
    coalesce(nullif(line->>'periodType',''),'Monthly'),
    greatest(1,coalesce(nullif(line->>'estimatedDurationMinutes','')::integer,30)),
    greatest(0,coalesce(nullif(line->>'minimumIntervalDays','')::integer,0)),
    greatest(0,coalesce(nullif(line->>'maximumIntervalDays','')::integer,35)),
    coalesce(nullif(line->>'flexibilityRule',''),'Within month'),
    coalesce(nullif(line->>'priority',''),'Core recurring maintenance'),
    coalesce(nullif(line->>'requiredCapability',''),'general'),
    coalesce(line->>'requiredEquipment',''),
    coalesce(nullif(line->>'catchUpRule',''),'review'),
    coalesce(nullif(line->>'creditRule',''),'review'),
    coalesce((line->>'includedInFee')::boolean,true),
    coalesce((line->>'active')::boolean,true),line,
    coalesce(nullif(line->>'createdAt','')::timestamptz,v_now),
    coalesce(nullif(line->>'updatedAt','')::timestamptz,v_now)
  from jsonb_array_elements(coalesce(new.payload->'serviceAgreements','[]'::jsonb)) agreement
  cross join lateral jsonb_array_elements(coalesce(agreement->'lines','[]'::jsonb)) line
  where nullif(agreement->>'id','') is not null
    and nullif(line->>'id','') is not null
    and nullif(line->>'serviceId','') is not null
    and exists (
      select 1 from public.service_agreements saved
      where saved.business_id=new.business_id and saved.id=agreement->>'id'
    );

  insert into public.service_commitments(
    business_id,id,agreement_id,agreement_line_id,client_id,service_site_id,
    service_id,period_key,earliest_date,preferred_date,latest_date,
    estimated_duration_minutes,priority,required_capability,status,risk_level,
    risk_reasons,schedule_job_id,work_record_id,catch_up_record_id,fulfilled_at,
    resolution_type,resolution_note,payload,created_at,updated_at
  )
  select new.business_id,
    commitment->>'id', commitment->>'agreementId', commitment->>'agreementLineId',
    commitment->>'clientId', coalesce(commitment->>'serviceSiteId',''),
    commitment->>'serviceId', coalesce(commitment->>'periodKey',''),
    nullif(commitment->>'earliestDate','')::date,
    nullif(commitment->>'preferredDate','')::date,
    nullif(commitment->>'latestDate','')::date,
    greatest(1,coalesce(nullif(commitment->>'estimatedDurationMinutes','')::integer,30)),
    coalesce(nullif(commitment->>'priority',''),'Core recurring maintenance'),
    coalesce(nullif(commitment->>'requiredCapability',''),'general'),
    coalesce(nullif(commitment->>'status',''),'Forecast'),
    coalesce(nullif(commitment->>'riskLevel',''),'none'),
    case when jsonb_typeof(commitment->'riskReasons')='array'
      then array(select jsonb_array_elements_text(commitment->'riskReasons'))
      else '{}'::text[] end,
    coalesce(commitment->>'scheduleJobId',''),
    coalesce(commitment->>'workRecordId',''),
    coalesce(commitment->>'catchUpRecordId',''),
    nullif(commitment->>'fulfilledAt','')::timestamptz,
    coalesce(commitment->>'resolutionType',''),
    coalesce(commitment->>'resolutionNote',''),commitment,
    coalesce(nullif(commitment->>'createdAt','')::timestamptz,v_now),
    coalesce(nullif(commitment->>'updatedAt','')::timestamptz,v_now)
  from jsonb_array_elements(coalesce(new.payload->'serviceCommitments','[]'::jsonb)) commitment
  where nullif(commitment->>'id','') is not null
    and nullif(commitment->>'agreementId','') is not null
    and nullif(commitment->>'clientId','') is not null
    and nullif(commitment->>'serviceId','') is not null
    and exists (
      select 1 from public.service_agreements saved
      where saved.business_id=new.business_id and saved.id=commitment->>'agreementId'
    );

  insert into public.team_capacity_profiles(
    business_id,id,team_id,weekday,paid_minutes,break_minutes,
    loading_admin_minutes,default_travel_minutes,recovery_buffer_minutes,
    max_service_minutes,capabilities,equipment_categories,active,payload,
    created_at,updated_at
  )
  select new.business_id,
    profile->>'id', profile->>'teamId',
    least(6,greatest(0,coalesce(nullif(profile->>'weekday','')::smallint,0))),
    greatest(0,coalesce(nullif(profile->>'paidMinutes','')::integer,480)),
    greatest(0,coalesce(nullif(profile->>'breakMinutes','')::integer,30)),
    greatest(0,coalesce(nullif(profile->>'loadingAdminMinutes','')::integer,25)),
    greatest(0,coalesce(nullif(profile->>'defaultTravelMinutes','')::integer,45)),
    greatest(0,coalesce(nullif(profile->>'recoveryBufferMinutes','')::integer,30)),
    greatest(0,coalesce(nullif(profile->>'maxServiceMinutes','')::integer,350)),
    case when jsonb_typeof(profile->'capabilities')='array'
      then array(select jsonb_array_elements_text(profile->'capabilities'))
      else '{}'::text[] end,
    case when jsonb_typeof(profile->'equipmentCategories')='array'
      then array(select jsonb_array_elements_text(profile->'equipmentCategories'))
      else '{}'::text[] end,
    coalesce((profile->>'active')::boolean,true),profile,
    coalesce(nullif(profile->>'createdAt','')::timestamptz,v_now),
    coalesce(nullif(profile->>'updatedAt','')::timestamptz,v_now)
  from jsonb_array_elements(coalesce(new.payload->'teamCapacityProfiles','[]'::jsonb)) profile
  where nullif(profile->>'id','') is not null
    and nullif(profile->>'teamId','') is not null
    and exists (
      select 1 from public.teams team
      where team.business_id=new.business_id and team.id=profile->>'teamId'
    );

  insert into public.capacity_exceptions(
    business_id,id,team_id,start_date,end_date,exception_type,
    capacity_delta_minutes,reason,created_by,payload,created_at
  )
  select new.business_id,exception->>'id',exception->>'teamId',
    nullif(exception->>'startDate','')::date,
    nullif(exception->>'endDate','')::date,
    coalesce(nullif(exception->>'exceptionType',''),'Capacity adjustment'),
    coalesce(nullif(exception->>'capacityDeltaMinutes','')::integer,0),
    coalesce(exception->>'reason',''),
    case when coalesce(exception->>'createdBy','') ~* '^[0-9a-f-]{36}$'
      then (exception->>'createdBy')::uuid else new.updated_by end,
    exception,coalesce(nullif(exception->>'createdAt','')::timestamptz,v_now)
  from jsonb_array_elements(coalesce(new.payload->'capacityExceptions','[]'::jsonb)) exception
  where nullif(exception->>'id','') is not null
    and nullif(exception->>'teamId','') is not null
    and nullif(exception->>'startDate','') is not null
    and nullif(exception->>'endDate','') is not null
    and exists (
      select 1 from public.teams team
      where team.business_id=new.business_id and team.id=exception->>'teamId'
    );

  insert into public.capacity_overrides(
    business_id,id,team_id,schedule_job_id,period_key,override_type,
    reason,approved_by,payload,created_at
  )
  select new.business_id,override_row->>'id',override_row->>'teamId',
    coalesce(override_row->>'scheduleJobId',''),coalesce(override_row->>'periodKey',''),
    coalesce(nullif(override_row->>'overrideType',''),'capacity-override'),
    coalesce(override_row->>'reason',''),
    case when coalesce(override_row->>'approvedBy','') ~* '^[0-9a-f-]{36}$'
      then (override_row->>'approvedBy')::uuid else new.updated_by end,
    override_row,coalesce(nullif(override_row->>'createdAt','')::timestamptz,v_now)
  from jsonb_array_elements(coalesce(new.payload->'capacityOverrides','[]'::jsonb)) override_row
  where nullif(override_row->>'id','') is not null
    and nullif(override_row->>'teamId','') is not null
    and exists (
      select 1 from public.teams team
      where team.business_id=new.business_id and team.id=override_row->>'teamId'
    );

  insert into public.fulfilment_periods(
    business_id,id,period_key,status,reconciled_at,reconciled_by,payload,
    created_at,updated_at
  )
  select new.business_id,period->>'id',period->>'periodKey',
    coalesce(nullif(period->>'status',''),'Open'),
    nullif(period->>'reconciledAt','')::timestamptz,
    case when coalesce(period->>'reconciledBy','') ~* '^[0-9a-f-]{36}$'
      then (period->>'reconciledBy')::uuid else null end,
    period,coalesce(nullif(period->>'createdAt','')::timestamptz,v_now),
    coalesce(nullif(period->>'updatedAt','')::timestamptz,v_now)
  from jsonb_array_elements(coalesce(new.payload->'fulfilmentPeriods','[]'::jsonb)) period
  where nullif(period->>'id','') is not null
    and nullif(period->>'periodKey','') is not null;

  return new;
end;
$$;

revoke all on function public.tuinbooks_sync_capacity_v552() from public,anon,authenticated;

drop trigger if exists operational_meta_sync_capacity_v552 on public.operational_meta;
create trigger operational_meta_sync_capacity_v552
after insert or update of payload on public.operational_meta
for each row execute function public.tuinbooks_sync_capacity_v552();

-- Synchronize any existing v55.2 payload that may already be present.
update public.operational_meta
set payload=payload
where payload ? 'serviceAgreements'
   or payload ? 'teamCapacityProfiles'
   or payload ? 'serviceCommitments';

alter table public.service_agreements enable row level security;
alter table public.service_agreement_lines enable row level security;
alter table public.service_commitments enable row level security;
alter table public.team_capacity_profiles enable row level security;
alter table public.capacity_exceptions enable row level security;
alter table public.capacity_overrides enable row level security;
alter table public.fulfilment_periods enable row level security;
alter table public.visit_photos enable row level security;

revoke all on public.service_agreements from anon,authenticated;
revoke all on public.service_agreement_lines from anon,authenticated;
revoke all on public.service_commitments from anon,authenticated;
revoke all on public.team_capacity_profiles from anon,authenticated;
revoke all on public.capacity_exceptions from anon,authenticated;
revoke all on public.capacity_overrides from anon,authenticated;
revoke all on public.fulfilment_periods from anon,authenticated;
revoke all on public.visit_photos from anon,authenticated;

grant select on public.service_agreements to authenticated;
grant select on public.service_agreement_lines to authenticated;
grant select on public.service_commitments to authenticated;
grant select on public.team_capacity_profiles to authenticated;
grant select on public.capacity_exceptions to authenticated;
grant select on public.capacity_overrides to authenticated;
grant select on public.fulfilment_periods to authenticated;
grant select on public.visit_photos to authenticated;

-- These are read-only relational mirrors for authenticated clients. All writes
-- continue through save_operational_snapshot_v53 and this SECURITY DEFINER
-- synchronization trigger, avoiding a second competing source of truth.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'service_agreements','service_agreement_lines','service_commitments',
    'team_capacity_profiles','capacity_exceptions','capacity_overrides',
    'fulfilment_periods','visit_photos'
  ] loop
    execute format('drop policy if exists %I on public.%I',table_name||'_member_select_v552',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_admin_insert_v552',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_admin_update_v552',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_admin_delete_v552',table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_business_member(business_id))',table_name||'_member_select_v552',table_name);
  end loop;
end $$;

create or replace function public.tuinbooks_capacity_v552_status(p_business_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if p_business_id is not null then
    if not public.is_business_member(p_business_id) then
      raise exception 'Business membership required';
    end if;
    v_business_id := p_business_id;
  else
    select bm.business_id into v_business_id
    from public.business_members bm
    where bm.user_id=auth.uid() and bm.active=true
    order by bm.created_at
    limit 1;
  end if;

  if v_business_id is null then
    raise exception 'No accessible business found';
  end if;

  return jsonb_build_object(
    'business_id',v_business_id,
    'agreements',(select count(*) from public.service_agreements where business_id=v_business_id),
    'active_agreements',(select count(*) from public.service_agreements where business_id=v_business_id and status='Active'),
    'commitments',(select count(*) from public.service_commitments where business_id=v_business_id),
    'at_risk_commitments',(select count(*) from public.service_commitments where business_id=v_business_id and risk_level in ('medium','high','critical')),
    'capacity_profiles',(select count(*) from public.team_capacity_profiles where business_id=v_business_id),
    'capacity_exceptions',(select count(*) from public.capacity_exceptions where business_id=v_business_id),
    'capacity_overrides',(select count(*) from public.capacity_overrides where business_id=v_business_id),
    'visit_photos',(select count(*) from public.visit_photos where business_id=v_business_id),
    'migration','v55.2'
  );
end;
$$;

revoke all on function public.tuinbooks_capacity_v552_status(uuid) from public,anon;
grant execute on function public.tuinbooks_capacity_v552_status(uuid) to authenticated;

commit;
