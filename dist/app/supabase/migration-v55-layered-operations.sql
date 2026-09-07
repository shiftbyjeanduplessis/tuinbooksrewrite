-- TuinBooks v55: structured client/service classification support
-- Run once after migration-v54-blocker-repairs.sql. Safe to re-run.
-- The v55 app continues to store the complete record in each table's JSONB
-- payload, while these columns make the new classifications queryable and
-- reportable without parsing free text.

begin;

alter table public.customers
  add column if not exists client_type text not null default 'Not classified',
  add column if not exists service_frequency text not null default 'Not classified',
  add column if not exists billing_arrangement text not null default 'Not classified',
  add column if not exists custom_tags text[] not null default '{}'::text[],
  add column if not exists service_ids text[] not null default '{}'::text[];

alter table public.schedule_jobs
  add column if not exists service_ids text[] not null default '{}'::text[];

alter table public.work_records
  add column if not exists service_ids text[] not null default '{}'::text[];

create or replace function public.tuinbooks_sync_v55_customer_classification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.client_type := coalesce(
    nullif(new.payload->>'clientTypeId',''),
    nullif(new.payload->>'customerType',''),
    nullif(new.customer_type,''),
    'Not classified'
  );
  new.service_frequency := coalesce(nullif(new.payload->>'frequency',''),'Not classified');
  new.billing_arrangement := coalesce(nullif(new.payload->>'billingArrangement',''),'Not classified');
  new.custom_tags := case
    when jsonb_typeof(new.payload->'customTags')='array'
      then array(select jsonb_array_elements_text(new.payload->'customTags'))
    else '{}'::text[]
  end;
  new.service_ids := case
    when jsonb_typeof(new.payload->'serviceIds')='array'
      then array(select jsonb_array_elements_text(new.payload->'serviceIds'))
    else '{}'::text[]
  end;
  return new;
end;
$$;

create or replace function public.tuinbooks_sync_v55_schedule_services()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.service_ids := case
    when jsonb_typeof(new.payload->'serviceIds')='array'
      then array(select jsonb_array_elements_text(new.payload->'serviceIds'))
    else '{}'::text[]
  end;
  return new;
end;
$$;

create or replace function public.tuinbooks_sync_v55_work_services()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.service_ids := case
    when jsonb_typeof(new.payload->'serviceIds')='array'
      then array(select jsonb_array_elements_text(new.payload->'serviceIds'))
    else '{}'::text[]
  end;
  return new;
end;
$$;

drop trigger if exists customers_sync_v55_classification on public.customers;
create trigger customers_sync_v55_classification
before insert or update of payload,customer_type on public.customers
for each row execute function public.tuinbooks_sync_v55_customer_classification();

drop trigger if exists schedule_jobs_sync_v55_services on public.schedule_jobs;
create trigger schedule_jobs_sync_v55_services
before insert or update of payload on public.schedule_jobs
for each row execute function public.tuinbooks_sync_v55_schedule_services();

drop trigger if exists work_records_sync_v55_services on public.work_records;
create trigger work_records_sync_v55_services
before insert or update of payload on public.work_records
for each row execute function public.tuinbooks_sync_v55_work_services();

-- Backfill existing payloads through the same trigger logic.
update public.customers set payload=payload;
update public.schedule_jobs set payload=payload;
update public.work_records set payload=payload;

create index if not exists customers_v55_client_type_idx
  on public.customers(business_id,client_type);
create index if not exists customers_v55_frequency_idx
  on public.customers(business_id,service_frequency);
create index if not exists customers_v55_service_ids_gin
  on public.customers using gin(service_ids);
create index if not exists customers_v55_custom_tags_gin
  on public.customers using gin(custom_tags);
create index if not exists schedule_jobs_v55_service_ids_gin
  on public.schedule_jobs using gin(service_ids);
create index if not exists work_records_v55_service_ids_gin
  on public.work_records using gin(service_ids);

commit;

