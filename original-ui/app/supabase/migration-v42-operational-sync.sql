-- TuinBooks v42 migration: live schedules, field work records and opportunities
-- Run once after schema.sql and migration-v30-users-teams.sql.
-- Safe to re-run.

begin;

create table if not exists public.schedule_jobs (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  visit_date date not null,
  client_id text not null,
  team_id text not null,
  status text not null default 'scheduled',
  estimated_hours numeric(8,2) not null default 1,
  sort_order integer not null default 99,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, id),
  constraint schedule_jobs_client_fk foreign key (business_id, client_id)
    references public.customers(business_id, id) on delete cascade,
  constraint schedule_jobs_team_fk foreign key (business_id, team_id)
    references public.teams(business_id, id) on delete restrict
);

-- Early pilot databases used work_date and did not store write actors. Keep
-- the old column for compatibility while establishing the v42 shape.
alter table public.schedule_jobs
  add column if not exists visit_date date,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_jobs' and column_name='work_date'
  ) then
    execute 'update public.schedule_jobs set visit_date=coalesce(visit_date,work_date,current_date) where visit_date is null';
  else
    update public.schedule_jobs set visit_date=current_date where visit_date is null;
  end if;
end $$;

alter table public.schedule_jobs
  alter column visit_date set not null;

create unique index if not exists schedule_jobs_business_id_id_v42
  on public.schedule_jobs(business_id,id);

create index if not exists schedule_jobs_business_date_idx
  on public.schedule_jobs(business_id, visit_date, team_id, sort_order);
create index if not exists schedule_jobs_client_date_idx
  on public.schedule_jobs(business_id, client_id, visit_date);

create table if not exists public.work_records (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  schedule_job_id text,
  client_id text not null,
  team_id text not null,
  work_date date not null,
  work_done text[] not null default '{}',
  extra_description text not null default '',
  photo_paths text[] not null default '{}',
  outcome text not null default 'Completed',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, id),
  constraint work_records_client_fk foreign key (business_id, client_id)
    references public.customers(business_id, id) on delete cascade,
  constraint work_records_team_fk foreign key (business_id, team_id)
    references public.teams(business_id, id) on delete restrict,
  constraint work_records_schedule_fk foreign key (business_id, schedule_job_id)
    references public.schedule_jobs(business_id, id) on delete restrict
);

-- Early work records kept these values only inside payload.
alter table public.work_records
  add column if not exists work_done text[] not null default '{}',
  add column if not exists extra_description text not null default '',
  add column if not exists photo_paths text[] not null default '{}';

update public.work_records record
set work_done=array(
  select jsonb_array_elements_text(record.payload->'workDone')
)
where cardinality(record.work_done)=0
  and jsonb_typeof(record.payload->'workDone')='array';

update public.work_records
set extra_description=coalesce(payload->>'extraDescription','')
where extra_description='' and nullif(payload->>'extraDescription','') is not null;

update public.work_records record
set photo_paths=array(
  select jsonb_array_elements_text(record.payload->'photoPaths')
)
where cardinality(record.photo_paths)=0
  and jsonb_typeof(record.payload->'photoPaths')='array';

create unique index if not exists work_records_business_id_id_v42
  on public.work_records(business_id,id);

create unique index if not exists work_records_one_per_schedule_idx
  on public.work_records(business_id, schedule_job_id)
  where schedule_job_id is not null;
create index if not exists work_records_business_date_idx
  on public.work_records(business_id, work_date, team_id);

create table if not exists public.field_opportunities (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  client_id text not null,
  schedule_job_id text,
  work_record_id text,
  team_id text not null,
  category text not null,
  note text not null default '',
  photo_paths text[] not null default '{}',
  status text not null default 'new',
  review_decision text not null default 'new',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, id),
  constraint field_opportunities_client_fk foreign key (business_id, client_id)
    references public.customers(business_id, id) on delete cascade,
  constraint field_opportunities_team_fk foreign key (business_id, team_id)
    references public.teams(business_id, id) on delete restrict,
  constraint field_opportunities_schedule_fk foreign key (business_id, schedule_job_id)
    references public.schedule_jobs(business_id, id) on delete restrict,
  constraint field_opportunities_work_fk foreign key (business_id, work_record_id)
    references public.work_records(business_id, id) on delete restrict
);

create index if not exists field_opportunities_business_status_idx
  on public.field_opportunities(business_id, status, created_at desc);

create table if not exists public.quotes (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  client_id text not null,
  quote_date date,
  status text not null default 'Draft',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint quotes_client_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete restrict
);

-- Early quotes stored their document date only inside payload.
alter table public.quotes
  add column if not exists quote_date date,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.quotes
set quote_date=(payload->>'date')::date
where quote_date is null
  and coalesce(payload->>'date','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

create unique index if not exists quotes_business_id_id_v42
  on public.quotes(business_id,id);

create index if not exists quotes_business_status_idx
  on public.quotes(business_id,status,quote_date desc);

create table if not exists public.invoices (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  client_id text not null,
  invoice_month text not null default '',
  invoice_number text not null default 'Draft',
  status text not null default 'Draft',
  total numeric(12,2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint invoices_client_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete restrict
);

-- Some pre-v42 pilot databases already contained a slimmer invoices table.
-- CREATE TABLE IF NOT EXISTS leaves that older shape untouched, so repair the
-- additive billing columns before v53/v54 build indexes and functions on them.
-- Existing invoice values remain in payload and are used to backfill the new
-- first-class columns where possible.
alter table public.invoices
  add column if not exists invoice_month text not null default '',
  add column if not exists invoice_number text,
  add column if not exists status text not null default 'Draft',
  add column if not exists total numeric(12,2) not null default 0,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.invoices
set invoice_number=coalesce(
  nullif(invoice_number,''),
  nullif(payload->>'invoice_number',''),
  nullif(payload->>'number',''),
  'Draft'
)
where invoice_number is null or invoice_number='';

update public.invoices
set total=(payload->>'total')::numeric
where total=0
  and coalesce(payload->>'total','') ~ '^-?[0-9]+([.][0-9]+)?$';

alter table public.invoices
  alter column invoice_number set default 'Draft',
  alter column invoice_number set not null;

create unique index if not exists invoices_business_id_id_v42
  on public.invoices(business_id,id);

create index if not exists invoices_business_month_idx
  on public.invoices(business_id,invoice_month,status);

create table if not exists public.client_reports (
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  client_id text not null,
  report_type text not null,
  status text not null default 'Ready to review',
  period_start date,
  period_end date,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,id),
  constraint client_reports_client_fk foreign key (business_id,client_id)
    references public.customers(business_id,id) on delete restrict
);

create index if not exists client_reports_business_status_idx
  on public.client_reports(business_id,status,created_at desc);

create table if not exists public.operational_meta (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Updated timestamps.
drop trigger if exists schedule_jobs_set_updated_at on public.schedule_jobs;
create trigger schedule_jobs_set_updated_at before update on public.schedule_jobs
for each row execute function public.set_updated_at();

drop trigger if exists work_records_set_updated_at on public.work_records;
create trigger work_records_set_updated_at before update on public.work_records
for each row execute function public.set_updated_at();

drop trigger if exists field_opportunities_set_updated_at on public.field_opportunities;
create trigger field_opportunities_set_updated_at before update on public.field_opportunities
for each row execute function public.set_updated_at();

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at before update on public.quotes
for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists client_reports_set_updated_at on public.client_reports;
create trigger client_reports_set_updated_at before update on public.client_reports
for each row execute function public.set_updated_at();

drop trigger if exists operational_meta_set_updated_at on public.operational_meta;
create trigger operational_meta_set_updated_at before update on public.operational_meta
for each row execute function public.set_updated_at();

create or replace function public.is_assigned_to_business_team(target_business_id uuid, target_team_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_business_admin(target_business_id)
    or exists (
      select 1
      from public.team_assignments ta
      join public.business_members bm
        on bm.business_id = ta.business_id and bm.user_id = ta.user_id
      where ta.business_id = target_business_id
        and ta.team_id = target_team_id
        and ta.user_id = auth.uid()
        and ta.active = true
        and bm.active = true
    );
$$;

revoke all on function public.is_assigned_to_business_team(uuid,text) from public;
grant execute on function public.is_assigned_to_business_team(uuid,text) to authenticated;

-- Admin snapshot save. Work records and opportunities are only upserted, never
-- bulk-deleted, so a stale office browser cannot erase a field submission.
create or replace function public.save_operational_snapshot(
  p_business_id uuid,
  p_schedules jsonb,
  p_work_records jsonb,
  p_opportunities jsonb,
  p_quotes jsonb,
  p_invoices jsonb,
  p_client_reports jsonb,
  p_meta jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved_at timestamptz := now();
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  insert into public.schedule_jobs (
    business_id,id,visit_date,client_id,team_id,status,estimated_hours,sort_order,
    payload,created_by,updated_by,updated_at
  )
  select
    p_business_id,
    x->>'id',
    (x->>'visit_date')::date,
    x->>'client_id',
    x->>'team_id',
    coalesce(nullif(x->>'status',''),'scheduled'),
    coalesce((x->>'estimated_hours')::numeric,1),
    coalesce((x->>'sort_order')::integer,99),
    coalesce(x->'payload','{}'::jsonb),
    auth.uid(),auth.uid(),v_saved_at
  from jsonb_array_elements(coalesce(p_schedules,'[]'::jsonb)) x
  where nullif(x->>'id','') is not null
    and nullif(x->>'visit_date','') is not null
    and nullif(x->>'client_id','') is not null
    and nullif(x->>'team_id','') is not null
  on conflict (business_id,id) do update set
    visit_date=case when schedule_jobs.status='completed' then schedule_jobs.visit_date else excluded.visit_date end,
    client_id=case when schedule_jobs.status='completed' then schedule_jobs.client_id else excluded.client_id end,
    team_id=case when schedule_jobs.status='completed' then schedule_jobs.team_id else excluded.team_id end,
    status=case when schedule_jobs.status='completed' then 'completed' else excluded.status end,
    estimated_hours=case when schedule_jobs.status='completed' then schedule_jobs.estimated_hours else excluded.estimated_hours end,
    sort_order=case when schedule_jobs.status='completed' then schedule_jobs.sort_order else excluded.sort_order end,
    payload=case when schedule_jobs.status='completed' then schedule_jobs.payload else excluded.payload end,
    updated_by=auth.uid(),
    updated_at=v_saved_at;

  delete from public.schedule_jobs s
  where s.business_id=p_business_id
    and s.status <> 'completed'
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_schedules,'[]'::jsonb)) x
      where x->>'id'=s.id
    )
    and not exists (
      select 1 from public.work_records wr
      where wr.business_id=s.business_id and wr.schedule_job_id=s.id
    );

  insert into public.work_records (
    business_id,id,schedule_job_id,client_id,team_id,work_date,work_done,
    extra_description,photo_paths,outcome,payload,created_by,updated_at
  )
  select
    p_business_id,
    x->>'id',
    nullif(x->>'schedule_job_id',''),
    x->>'client_id',
    x->>'team_id',
    (x->>'work_date')::date,
    coalesce(array(select jsonb_array_elements_text(coalesce(x->'work_done','[]'::jsonb))), '{}'),
    coalesce(x->>'extra_description',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(x->'photo_paths','[]'::jsonb))), '{}'),
    coalesce(nullif(x->>'outcome',''),'Completed'),
    coalesce(x->'payload','{}'::jsonb),
    auth.uid(),v_saved_at
  from jsonb_array_elements(coalesce(p_work_records,'[]'::jsonb)) x
  where nullif(x->>'id','') is not null
    and nullif(x->>'client_id','') is not null
    and nullif(x->>'team_id','') is not null
    and nullif(x->>'work_date','') is not null
    and (nullif(x->>'schedule_job_id','') is null or not exists (
      select 1 from public.work_records existing
      where existing.business_id=p_business_id
        and existing.schedule_job_id=x->>'schedule_job_id'
        and existing.id<>x->>'id'
    ))
  on conflict (business_id,id) do update set
    schedule_job_id=excluded.schedule_job_id,
    client_id=excluded.client_id,
    team_id=excluded.team_id,
    work_date=excluded.work_date,
    work_done=excluded.work_done,
    extra_description=excluded.extra_description,
    photo_paths=case when cardinality(excluded.photo_paths)>0 then excluded.photo_paths else work_records.photo_paths end,
    outcome=excluded.outcome,
    payload=excluded.payload,
    updated_at=v_saved_at;

  insert into public.field_opportunities (
    business_id,id,client_id,schedule_job_id,work_record_id,team_id,category,note,
    photo_paths,status,review_decision,payload,created_by,updated_at
  )
  select
    p_business_id,
    x->>'id',
    x->>'client_id',
    nullif(x->>'schedule_job_id',''),
    nullif(x->>'work_record_id',''),
    x->>'team_id',
    coalesce(nullif(x->>'category',''),'Other'),
    coalesce(x->>'note',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(x->'photo_paths','[]'::jsonb))), '{}'),
    coalesce(nullif(x->>'status',''),'new'),
    coalesce(nullif(x->>'review_decision',''),'new'),
    coalesce(x->'payload','{}'::jsonb),
    auth.uid(),v_saved_at
  from jsonb_array_elements(coalesce(p_opportunities,'[]'::jsonb)) x
  where nullif(x->>'id','') is not null
    and nullif(x->>'client_id','') is not null
    and nullif(x->>'team_id','') is not null
  on conflict (business_id,id) do update set
    client_id=excluded.client_id,
    schedule_job_id=excluded.schedule_job_id,
    work_record_id=excluded.work_record_id,
    team_id=excluded.team_id,
    category=excluded.category,
    note=excluded.note,
    photo_paths=case when cardinality(excluded.photo_paths)>0 then excluded.photo_paths else field_opportunities.photo_paths end,
    status=excluded.status,
    review_decision=excluded.review_decision,
    payload=excluded.payload,
    updated_at=v_saved_at;

  insert into public.quotes (
    business_id,id,client_id,quote_date,status,payload,created_by,updated_at
  )
  select p_business_id,x->>'id',x->>'client_id',nullif(x->>'quote_date','')::date,
    coalesce(nullif(x->>'status',''),'Draft'),coalesce(x->'payload','{}'::jsonb),auth.uid(),v_saved_at
  from jsonb_array_elements(coalesce(p_quotes,'[]'::jsonb)) x
  where nullif(x->>'id','') is not null and nullif(x->>'client_id','') is not null
  on conflict (business_id,id) do update set
    client_id=excluded.client_id,quote_date=excluded.quote_date,status=excluded.status,
    payload=excluded.payload,updated_at=v_saved_at;

  insert into public.invoices (
    business_id,id,client_id,invoice_month,invoice_number,status,total,payload,created_by,updated_at
  )
  select p_business_id,x->>'id',x->>'client_id',coalesce(x->>'invoice_month',''),
    coalesce(nullif(x->>'invoice_number',''),'Draft'),coalesce(nullif(x->>'status',''),'Draft'),
    coalesce((x->>'total')::numeric,0),coalesce(x->'payload','{}'::jsonb),auth.uid(),v_saved_at
  from jsonb_array_elements(coalesce(p_invoices,'[]'::jsonb)) x
  where nullif(x->>'id','') is not null and nullif(x->>'client_id','') is not null
  on conflict (business_id,id) do update set
    client_id=excluded.client_id,invoice_month=excluded.invoice_month,
    invoice_number=excluded.invoice_number,status=excluded.status,total=excluded.total,
    payload=excluded.payload,updated_at=v_saved_at;

  insert into public.client_reports (
    business_id,id,client_id,report_type,status,period_start,period_end,payload,created_by,updated_at
  )
  select p_business_id,x->>'id',x->>'client_id',coalesce(nullif(x->>'report_type',''),'daily'),
    coalesce(nullif(x->>'status',''),'Ready to review'),nullif(x->>'period_start','')::date,
    nullif(x->>'period_end','')::date,coalesce(x->'payload','{}'::jsonb),auth.uid(),v_saved_at
  from jsonb_array_elements(coalesce(p_client_reports,'[]'::jsonb)) x
  where nullif(x->>'id','') is not null and nullif(x->>'client_id','') is not null
  on conflict (business_id,id) do update set
    client_id=excluded.client_id,report_type=excluded.report_type,status=excluded.status,
    period_start=excluded.period_start,period_end=excluded.period_end,payload=excluded.payload,
    updated_at=v_saved_at;

  insert into public.operational_meta (business_id,payload,updated_by,updated_at)
  values (p_business_id,coalesce(p_meta,'{}'::jsonb),auth.uid(),v_saved_at)
  on conflict (business_id) do update set
    payload=excluded.payload,updated_by=auth.uid(),updated_at=v_saved_at;

  insert into public.audit_events (
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    p_business_id,auth.uid(),'workspace',p_business_id::text,'operational_snapshot_saved',
    jsonb_build_object(
      'schedules',jsonb_array_length(coalesce(p_schedules,'[]'::jsonb)),
      'work_records',jsonb_array_length(coalesce(p_work_records,'[]'::jsonb)),
      'opportunities',jsonb_array_length(coalesce(p_opportunities,'[]'::jsonb)),
      'quotes',jsonb_array_length(coalesce(p_quotes,'[]'::jsonb)),
      'invoices',jsonb_array_length(coalesce(p_invoices,'[]'::jsonb)),
      'client_reports',jsonb_array_length(coalesce(p_client_reports,'[]'::jsonb))
    )
  );

  return v_saved_at;
end;
$$;

revoke all on function public.save_operational_snapshot(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_operational_snapshot(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.complete_schedule_job(
  p_business_id uuid,
  p_schedule_id text,
  p_work_record jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.schedule_jobs%rowtype;
  v_existing text;
  v_record_id text := p_work_record->>'id';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_job
  from public.schedule_jobs
  where business_id=p_business_id and id=p_schedule_id
  for update;

  if not found then raise exception 'Scheduled job not found'; end if;
  if not public.is_assigned_to_business_team(p_business_id,v_job.team_id) then
    raise exception 'This job is not assigned to your team';
  end if;

  select id into v_existing
  from public.work_records
  where business_id=p_business_id and schedule_job_id=p_schedule_id
  limit 1;
  if v_existing is not null then return v_existing; end if;

  if nullif(v_record_id,'') is null then raise exception 'Work record id is required'; end if;

  insert into public.work_records (
    business_id,id,schedule_job_id,client_id,team_id,work_date,work_done,
    extra_description,photo_paths,outcome,payload,created_by
  ) values (
    p_business_id,v_record_id,p_schedule_id,v_job.client_id,v_job.team_id,
    coalesce(nullif(p_work_record->>'work_date','')::date,v_job.visit_date),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_work_record->'work_done','[]'::jsonb))), '{}'),
    coalesce(p_work_record->>'extra_description',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_work_record->'photo_paths','[]'::jsonb))), '{}'),
    coalesce(nullif(p_work_record->>'outcome',''),'Completed'),
    coalesce(p_work_record->'payload','{}'::jsonb),auth.uid()
  );

  update public.schedule_jobs
  set status='completed',updated_by=auth.uid(),updated_at=now(),
      payload=payload || jsonb_build_object('completedAt',now(),'completedBy',auth.uid())
  where business_id=p_business_id and id=p_schedule_id;

  insert into public.audit_events (
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    p_business_id,auth.uid(),'schedule_job',p_schedule_id,'visit_completed',
    jsonb_build_object('work_record_id',v_record_id,'team_id',v_job.team_id)
  );

  return v_record_id;
end;
$$;

revoke all on function public.complete_schedule_job(uuid,text,jsonb) from public;
grant execute on function public.complete_schedule_job(uuid,text,jsonb) to authenticated;

create or replace function public.create_unscheduled_work_record(
  p_business_id uuid,
  p_work_record jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text := p_work_record->>'id';
  v_team_id text := p_work_record->>'team_id';
  v_client_id text := p_work_record->>'client_id';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_assigned_to_business_team(p_business_id,v_team_id) then
    raise exception 'This work record is not assigned to your team';
  end if;
  if nullif(v_record_id,'') is null or nullif(v_client_id,'') is null then
    raise exception 'Work record id and client are required';
  end if;

  insert into public.work_records (
    business_id,id,schedule_job_id,client_id,team_id,work_date,work_done,
    extra_description,photo_paths,outcome,payload,created_by
  ) values (
    p_business_id,v_record_id,null,v_client_id,v_team_id,
    coalesce(nullif(p_work_record->>'work_date','')::date,current_date),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_work_record->'work_done','[]'::jsonb))), '{}'),
    coalesce(p_work_record->>'extra_description',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_work_record->'photo_paths','[]'::jsonb))), '{}'),
    coalesce(nullif(p_work_record->>'outcome',''),'Completed'),
    coalesce(p_work_record->'payload','{}'::jsonb),auth.uid()
  )
  on conflict (business_id,id) do nothing;

  insert into public.audit_events (
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    p_business_id,auth.uid(),'work_record',v_record_id,'unscheduled_work_recorded',
    jsonb_build_object('team_id',v_team_id,'client_id',v_client_id)
  );

  return v_record_id;
end;
$$;

revoke all on function public.create_unscheduled_work_record(uuid,jsonb) from public;
grant execute on function public.create_unscheduled_work_record(uuid,jsonb) to authenticated;

create or replace function public.create_field_opportunity(
  p_business_id uuid,
  p_opportunity jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := p_opportunity->>'id';
  v_team_id text := p_opportunity->>'team_id';
  v_client_id text := p_opportunity->>'client_id';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_assigned_to_business_team(p_business_id,v_team_id) then
    raise exception 'This opportunity is not assigned to your team';
  end if;
  if nullif(v_id,'') is null or nullif(v_client_id,'') is null then
    raise exception 'Opportunity id and client are required';
  end if;
  if nullif(p_opportunity->>'schedule_job_id','') is not null and not exists (
    select 1 from public.schedule_jobs job
    where job.business_id=p_business_id
      and job.id=p_opportunity->>'schedule_job_id'
      and job.team_id=v_team_id
  ) then
    raise exception 'The linked scheduled job is not assigned to this team';
  end if;
  if nullif(p_opportunity->>'work_record_id','') is not null and not exists (
    select 1 from public.work_records record
    where record.business_id=p_business_id
      and record.id=p_opportunity->>'work_record_id'
      and record.team_id=v_team_id
  ) then
    raise exception 'The linked work record is not assigned to this team';
  end if;

  insert into public.field_opportunities (
    business_id,id,client_id,schedule_job_id,work_record_id,team_id,category,note,
    photo_paths,status,review_decision,payload,created_by
  ) values (
    p_business_id,v_id,v_client_id,nullif(p_opportunity->>'schedule_job_id',''),
    nullif(p_opportunity->>'work_record_id',''),v_team_id,
    coalesce(nullif(p_opportunity->>'category',''),'Other'),coalesce(p_opportunity->>'note',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_opportunity->'photo_paths','[]'::jsonb))), '{}'),
    'new','new',coalesce(p_opportunity->'payload','{}'::jsonb),auth.uid()
  )
  on conflict (business_id,id) do nothing;

  insert into public.audit_events (
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    p_business_id,auth.uid(),'opportunity',v_id,'opportunity_created',
    jsonb_build_object('team_id',v_team_id,'client_id',v_client_id,'category',p_opportunity->>'category')
  );

  return v_id;
end;
$$;

revoke all on function public.create_field_opportunity(uuid,jsonb) from public;
grant execute on function public.create_field_opportunity(uuid,jsonb) to authenticated;

create or replace function public.create_field_client(
  p_business_id uuid,
  p_customer jsonb,
  p_site jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id text := p_customer->>'id';
  v_site_id text := p_site->>'id';
begin
  if auth.uid() is null or not public.is_business_member(p_business_id) then
    raise exception 'Business access required';
  end if;
  if nullif(v_customer_id,'') is null or nullif(v_site_id,'') is null then
    raise exception 'Client and site ids are required';
  end if;

  insert into public.customers (
    business_id,id,name,customer_type,contact_name,email,phone,billing_address,status,payload
  ) values (
    p_business_id,v_customer_id,coalesce(nullif(p_customer->>'name',''),'New client'),
    coalesce(nullif(p_customer->>'customer_type',''),'Private homeowner'),
    coalesce(p_customer->>'contact_name',''),coalesce(p_customer->>'email',''),
    coalesce(p_customer->>'phone',''),coalesce(p_customer->>'billing_address',''),
    'active',coalesce(p_customer->'payload','{}'::jsonb)
  ) on conflict (business_id,id) do nothing;

  insert into public.service_sites (
    business_id,id,customer_id,site_name,address,suburb,cluster_id,
    access_notes,pet_notes,instructions,active,payload
  ) values (
    p_business_id,v_site_id,v_customer_id,coalesce(p_site->>'site_name',''),
    coalesce(p_site->>'address',''),coalesce(p_site->>'suburb',''),nullif(p_site->>'cluster_id',''),
    coalesce(p_site->>'access_notes',''),coalesce(p_site->>'pet_notes',''),
    coalesce(p_site->>'instructions',''),true,coalesce(p_site->'payload','{}'::jsonb)
  ) on conflict (business_id,id) do nothing;

  insert into public.audit_events (
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    p_business_id,auth.uid(),'customer',v_customer_id,'field_client_created',
    jsonb_build_object('site_id',v_site_id)
  );

  return v_customer_id;
end;
$$;

revoke all on function public.create_field_client(uuid,jsonb,jsonb) from public;
grant execute on function public.create_field_client(uuid,jsonb,jsonb) to authenticated;


-- Extend workspace reset so test/pilot resets clear operational rows first.
create or replace function public.reset_business_workspace(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  delete from public.client_reports where business_id=p_business_id;
  delete from public.invoices where business_id=p_business_id;
  delete from public.quotes where business_id=p_business_id;
  delete from public.field_opportunities where business_id=p_business_id;
  delete from public.work_records where business_id=p_business_id;
  delete from public.schedule_jobs where business_id=p_business_id;
  delete from public.operational_meta where business_id=p_business_id;
  delete from public.service_sites where business_id=p_business_id;
  delete from public.customers where business_id=p_business_id;
  delete from public.teams where business_id=p_business_id;
  delete from public.clusters where business_id=p_business_id;

  update public.businesses
  set onboarding_complete=false,name='TuinBooks business',phone='',email='',address='',settings='{}'::jsonb
  where id=p_business_id;

  insert into public.audit_events (
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    p_business_id,auth.uid(),'workspace',p_business_id::text,'workspace_reset','{}'::jsonb
  );
end;
$$;

revoke all on function public.reset_business_workspace(uuid) from public;
grant execute on function public.reset_business_workspace(uuid) to authenticated;

-- RLS. Direct writes are blocked; writes go through the checked RPCs above.
alter table public.schedule_jobs enable row level security;
alter table public.work_records enable row level security;
alter table public.field_opportunities enable row level security;
alter table public.quotes enable row level security;
alter table public.invoices enable row level security;
alter table public.client_reports enable row level security;
alter table public.operational_meta enable row level security;

drop policy if exists schedule_jobs_select_team on public.schedule_jobs;
create policy schedule_jobs_select_team on public.schedule_jobs
for select to authenticated
using (public.is_assigned_to_business_team(business_id,team_id));

drop policy if exists work_records_select_team on public.work_records;
create policy work_records_select_team on public.work_records
for select to authenticated
using (public.is_assigned_to_business_team(business_id,team_id));

drop policy if exists field_opportunities_select_team on public.field_opportunities;
create policy field_opportunities_select_team on public.field_opportunities
for select to authenticated
using (public.is_assigned_to_business_team(business_id,team_id));

drop policy if exists quotes_select_admin on public.quotes;
create policy quotes_select_admin on public.quotes
for select to authenticated using (public.is_business_admin(business_id));

drop policy if exists invoices_select_admin on public.invoices;
create policy invoices_select_admin on public.invoices
for select to authenticated using (public.is_business_admin(business_id));

drop policy if exists client_reports_select_admin on public.client_reports;
create policy client_reports_select_admin on public.client_reports
for select to authenticated using (public.is_business_admin(business_id));

drop policy if exists operational_meta_select_admin on public.operational_meta;
create policy operational_meta_select_admin on public.operational_meta
for select to authenticated using (public.is_business_admin(business_id));

grant select on public.schedule_jobs to authenticated;
grant select on public.work_records to authenticated;
grant select on public.field_opportunities to authenticated;
grant select on public.quotes to authenticated;
grant select on public.invoices to authenticated;
grant select on public.client_reports to authenticated;
grant select on public.operational_meta to authenticated;
revoke insert,update,delete on public.schedule_jobs from authenticated;
revoke insert,update,delete on public.work_records from authenticated;
revoke insert,update,delete on public.field_opportunities from authenticated;
revoke insert,update,delete on public.quotes from authenticated;
revoke insert,update,delete on public.invoices from authenticated;
revoke insert,update,delete on public.client_reports from authenticated;
revoke insert,update,delete on public.operational_meta from authenticated;

-- Private media bucket. Paths always begin with the business UUID.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('tuinbooks-media','tuinbooks-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists tuinbooks_media_select on storage.objects;
create policy tuinbooks_media_select on storage.objects
for select to authenticated
using (
  bucket_id='tuinbooks-media'
  and public.is_business_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists tuinbooks_media_insert on storage.objects;
create policy tuinbooks_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='tuinbooks-media'
  and public.is_business_member(((storage.foldername(name))[1])::uuid)
);

-- Add tables to Realtime publication when available.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.schedule_jobs';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.work_records';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.field_opportunities';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.quotes';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.invoices';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.client_reports';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.operational_meta';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.customers';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.service_sites';
  exception when duplicate_object then null; end;
end $$;

notify pgrst, 'reload schema';
commit;
