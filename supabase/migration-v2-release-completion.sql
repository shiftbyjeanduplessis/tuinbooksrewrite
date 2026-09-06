-- TuinBooks v2 Release Candidate completion migration.
-- ADDITIVE. Applied after M8 migrations.
-- Adds: fast auth/schedule RPCs, permanent admin-visible field PINs,
-- opportunity review workflow, and secure public document/quote-response links.

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- FAST AUTH CONTEXT: one backend round trip after Supabase session restore.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_auth_context()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_user uuid:=auth.uid(); v_member public.business_members%rowtype; v_business public.businesses%rowtype;
begin
  if v_user is null then return null; end if;
  select * into v_member from public.business_members
    where user_id=v_user and active=true
    order by case lower(role) when 'owner' then 0 when 'admin' then 1 else 2 end, updated_at desc
    limit 1;
  if not found then return null; end if;
  select * into v_business from public.businesses where id=v_member.business_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'user_id',v_user,
    'email',coalesce((select email from auth.users where id=v_user),''),
    'business_id',v_member.business_id,
    'business_name',v_business.name,
    'role',v_member.role,
    'display_name',coalesce(v_member.display_name,'')
  );
end;$$;
revoke all on function public.tuinbooks_v2_auth_context() from public,anon;
grant execute on function public.tuinbooks_v2_auth_context() to authenticated;

-- ---------------------------------------------------------------------------
-- FAST SCHEDULE LOAD: one RPC returns the complete week workspace.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_load_schedule_week(p_business_id uuid,p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_end date:=p_week_start+6; v_result jsonb;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  perform public.tuinbooks_v2_ensure_series_horizon(p_business_id,p_week_start,p_week_start+55);
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
revoke all on function public.tuinbooks_v2_load_schedule_week(uuid,date) from public,anon;
grant execute on function public.tuinbooks_v2_load_schedule_week(uuid,date) to authenticated;

-- ---------------------------------------------------------------------------
-- FAST CLIENT WORKSPACE: one backend round trip for accounts, locations,
-- agreements and teams.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_load_client_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 return jsonb_build_object(
  'accounts',coalesce((select jsonb_agg(to_jsonb(c) order by c.name,c.id) from public.customers c where c.business_id=p_business_id and lower(coalesce(c.status,'active'))<>'archived'),'[]'::jsonb),
  'locations',coalesce((select jsonb_agg(to_jsonb(s) order by s.customer_id,s.site_name,s.id) from public.service_sites s where s.business_id=p_business_id),'[]'::jsonb),
  'agreements',coalesce((select jsonb_agg(to_jsonb(a) order by a.client_id,a.start_date,a.id) from public.client_service_agreements_v2 a where a.business_id=p_business_id),'[]'::jsonb),
  'teams',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.teams t where t.business_id=p_business_id and t.active=true),'[]'::jsonb)
 );
end;$$;
revoke all on function public.tuinbooks_v2_load_client_workspace(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_load_client_workspace(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PERMANENT FIELD PINS: one active globally unique 4-digit PIN per team.
-- Plain PIN is intentionally visible only through admin RLS/RPC because the
-- product requires the office to be able to view every active team PIN.
-- ---------------------------------------------------------------------------
create table if not exists public.mobile_team_pins_v2(
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_id text not null,
  pin text not null check(pin ~ '^[0-9]{4}$'),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(business_id,team_id),
  foreign key(business_id,team_id) references public.teams(business_id,id) on delete cascade
);
create unique index if not exists mobile_team_pins_v2_active_pin_unique on public.mobile_team_pins_v2(pin) where active=true;
alter table public.mobile_team_pins_v2 enable row level security;
drop policy if exists mobile_team_pins_v2_admin_select on public.mobile_team_pins_v2;
create policy mobile_team_pins_v2_admin_select on public.mobile_team_pins_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.mobile_team_pins_v2 to authenticated;
revoke insert,update,delete on public.mobile_team_pins_v2 from authenticated;

create table if not exists public.mobile_pin_attempts_v2(
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mobile_pin_attempts_v2 enable row level security;
revoke all on public.mobile_pin_attempts_v2 from anon,authenticated;

create or replace function public.tuinbooks_v2_list_field_pins(p_business_id uuid)
returns table(team_id text,team_name text,pin text,active boolean,updated_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 return query select t.id,t.name,p.pin,coalesce(p.active,false),p.updated_at
 from public.teams t left join public.mobile_team_pins_v2 p on p.business_id=t.business_id and p.team_id=t.id
 where t.business_id=p_business_id and t.active=true order by t.created_at,t.id;
end;$$;

create or replace function public.tuinbooks_v2_generate_field_pin(p_business_id uuid,p_team_id text)
returns table(team_id text,team_name text,pin text)
language plpgsql security definer set search_path=public,auth as $$
declare v_pin text; v_name text; n integer;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 select name into v_name from public.teams where business_id=p_business_id and id=p_team_id and active=true;
 if v_name is null then raise exception 'Active team not found';end if;
 for n in 1..100 loop
   v_pin:=lpad((floor(random()*10000))::integer::text,4,'0');
   begin
     insert into public.mobile_team_pins_v2(business_id,team_id,pin,active,created_by)
       values(p_business_id,p_team_id,v_pin,true,auth.uid())
       on conflict(business_id,team_id) do update set pin=excluded.pin,active=true,created_by=auth.uid(),updated_at=now();
     exit;
   exception when unique_violation then v_pin:=null;
   end;
 end loop;
 if v_pin is null then raise exception 'Could not generate a unique field PIN';end if;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(p_business_id,auth.uid(),'field_pin',p_team_id,'v2_field_pin_generated',jsonb_build_object('team_id',p_team_id));
 return query select p_team_id,v_name,v_pin;
end;$$;

create or replace function public.tuinbooks_v2_revoke_field_pin(p_business_id uuid,p_team_id text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 update public.mobile_team_pins_v2 set active=false,updated_at=now() where business_id=p_business_id and team_id=p_team_id;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(p_business_id,auth.uid(),'field_pin',p_team_id,'v2_field_pin_revoked',jsonb_build_object('team_id',p_team_id));
end;$$;

create or replace function public.tuinbooks_v2_claim_field_pin(p_pin text,p_device_name text default '')
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_pin text:=regexp_replace(coalesce(p_pin,''),'[^0-9]','','g'); v_row public.mobile_team_pins_v2%rowtype; v_team text; v_name text; v_lock timestamptz;
begin
 if v_user is null then raise exception 'A mobile browser session is required';end if;
 insert into public.mobile_pin_attempts_v2(user_id) values(v_user) on conflict(user_id) do update set
  attempt_count=case when mobile_pin_attempts_v2.window_started_at<now()-interval '10 minutes' then 0 else mobile_pin_attempts_v2.attempt_count end,
  window_started_at=case when mobile_pin_attempts_v2.window_started_at<now()-interval '10 minutes' then now() else mobile_pin_attempts_v2.window_started_at end,
  locked_until=case when mobile_pin_attempts_v2.locked_until<=now() then null else mobile_pin_attempts_v2.locked_until end,updated_at=now();
 select locked_until into v_lock from public.mobile_pin_attempts_v2 where user_id=v_user for update;
 if v_lock is not null and v_lock>now() then raise exception 'Too many incorrect PIN attempts. Try again later.';end if;
 if length(v_pin)<>4 then
  update public.mobile_pin_attempts_v2 set attempt_count=attempt_count+1,locked_until=case when attempt_count+1>=5 then now()+interval '10 minutes' else locked_until end,updated_at=now() where user_id=v_user;
  raise exception 'Enter the four-digit PIN';
 end if;
 select * into v_row from public.mobile_team_pins_v2 where pin=v_pin and active=true for update;
 if not found then
  update public.mobile_pin_attempts_v2 set attempt_count=attempt_count+1,locked_until=case when attempt_count+1>=5 then now()+interval '10 minutes' else locked_until end,updated_at=now() where user_id=v_user;
  raise exception 'PIN not recognised';
 end if;
 select name into v_team from public.teams where business_id=v_row.business_id and id=v_row.team_id and active=true;
 if v_team is null then raise exception 'The team assigned to this PIN is inactive';end if;
 v_name:=coalesce(nullif(trim(p_device_name),''),v_team||' phone');
 insert into public.business_members(business_id,user_id,role,display_name,active)
 values(v_row.business_id,v_user,'field',v_name,true)
 on conflict(business_id,user_id) do update set role='field',display_name=excluded.display_name,active=true,updated_at=now();
 delete from public.team_assignments where business_id=v_row.business_id and user_id=v_user;
 insert into public.team_assignments(business_id,user_id,team_id,is_primary,active) values(v_row.business_id,v_user,v_row.team_id,true,true);
 delete from public.mobile_pin_attempts_v2 where user_id=v_user;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(v_row.business_id,v_user,'field_device',v_user::text,'v2_field_phone_paired',jsonb_build_object('team_id',v_row.team_id,'device_name',v_name));
 return jsonb_build_object('business_id',v_row.business_id,'team_id',v_row.team_id,'team_name',v_team,'display_name',v_name);
end;$$;

revoke all on function public.tuinbooks_v2_list_field_pins(uuid) from public,anon;
revoke all on function public.tuinbooks_v2_generate_field_pin(uuid,text) from public,anon;
revoke all on function public.tuinbooks_v2_revoke_field_pin(uuid,text) from public,anon;
revoke all on function public.tuinbooks_v2_claim_field_pin(text,text) from public;
grant execute on function public.tuinbooks_v2_list_field_pins(uuid) to authenticated;
grant execute on function public.tuinbooks_v2_generate_field_pin(uuid,text) to authenticated;
grant execute on function public.tuinbooks_v2_revoke_field_pin(uuid,text) to authenticated;
grant execute on function public.tuinbooks_v2_claim_field_pin(text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- FIELD OPPORTUNITY OFFICE TRIAGE.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_review_opportunity(
 p_business_id uuid,p_opportunity_id text,p_decision text,p_linked_quote_id text default null,p_note text default ''
) returns void language plpgsql security definer set search_path=public,auth as $$
declare v_status text;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 if p_decision not in('quote-created','site-visit','design-consult','defer','closed') then raise exception 'Invalid opportunity decision';end if;
 v_status:=case when p_decision='defer' then 'deferred' when p_decision='closed' then 'closed' else 'reviewed' end;
 update public.field_opportunities set status=v_status,review_decision=p_decision,
  payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('linkedQuoteId',nullif(p_linked_quote_id,''),'reviewNote',coalesce(p_note,''),'reviewedAt',now(),'reviewedBy',auth.uid()),updated_at=now()
 where business_id=p_business_id and id=p_opportunity_id;
 if not found then raise exception 'Opportunity not found';end if;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
 values(p_business_id,auth.uid(),'opportunity',p_opportunity_id,'v2_opportunity_reviewed',jsonb_build_object('decision',p_decision,'linked_quote_id',p_linked_quote_id));
end;$$;
revoke all on function public.tuinbooks_v2_review_opportunity(uuid,text,text,text,text) from public,anon;
grant execute on function public.tuinbooks_v2_review_opportunity(uuid,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- SECURE PUBLIC DOCUMENT LINKS + QUOTE RESPONSE.
-- Snapshot is immutable at link creation so a customer responds to exactly the
-- document version they were sent.
-- ---------------------------------------------------------------------------
create table if not exists public.public_documents_v2(
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_type text not null check(document_type in('quote','invoice','statement')),
  document_id text not null,
  client_id text not null,
  snapshot jsonb not null,
  status text not null default 'active' check(status in('active','responded','revoked','expired')),
  response text,
  responded_by_name text,
  response_note text,
  responded_at timestamptz,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists public_documents_v2_business_idx on public.public_documents_v2(business_id,document_type,document_id,created_at desc);
alter table public.public_documents_v2 enable row level security;
drop policy if exists public_documents_v2_admin_select on public.public_documents_v2;
create policy public_documents_v2_admin_select on public.public_documents_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.public_documents_v2 to authenticated;
revoke insert,update,delete on public.public_documents_v2 from authenticated,anon;

create or replace function public.tuinbooks_v2_create_public_document(
 p_business_id uuid,p_document_type text,p_document_id text,p_client_id text,p_snapshot jsonb,p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_token text:=encode(gen_random_bytes(24),'hex'); v_id uuid;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 if p_document_type not in('quote','invoice','statement') then raise exception 'Invalid document type';end if;
 if p_expires_at<=now() then raise exception 'Expiry must be in the future';end if;
 if jsonb_typeof(p_snapshot)<>'object' then raise exception 'Document snapshot is required';end if;
 insert into public.public_documents_v2(token_hash,business_id,document_type,document_id,client_id,snapshot,expires_at,created_by)
 values(encode(digest(v_token,'sha256'),'hex'),p_business_id,p_document_type,p_document_id,p_client_id,p_snapshot,p_expires_at,auth.uid()) returning id into v_id;
 return jsonb_build_object('id',v_id,'token',v_token,'expires_at',p_expires_at);
end;$$;

create or replace function public.tuinbooks_v2_get_public_document(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.public_documents_v2%rowtype;
begin
 select * into r from public.public_documents_v2 where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex');
 if not found then return jsonb_build_object('ok',false,'error','invalid');end if;
 if r.status='revoked' then return jsonb_build_object('ok',false,'error','revoked');end if;
 if r.expires_at<=now() then update public.public_documents_v2 set status='expired' where id=r.id and status='active';return jsonb_build_object('ok',false,'error','expired');end if;
 return jsonb_build_object('ok',true,'document_type',r.document_type,'document_id',r.document_id,'snapshot',r.snapshot,'status',r.status,'response',r.response,'responded_by_name',r.responded_by_name,'response_note',r.response_note,'responded_at',r.responded_at,'expires_at',r.expires_at);
end;$$;

create or replace function public.tuinbooks_v2_respond_public_quote(p_token text,p_decision text,p_customer_name text,p_note text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.public_documents_v2%rowtype; v_quote_status text;
begin
 if p_decision not in('accepted','changes_requested','declined') then raise exception 'Invalid response';end if;
 if nullif(trim(p_customer_name),'') is null then raise exception 'Your name is required';end if;
 select * into r from public.public_documents_v2 where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') for update;
 if not found or r.document_type<>'quote' then return jsonb_build_object('ok',false,'error','invalid');end if;
 if r.expires_at<=now() then update public.public_documents_v2 set status='expired' where id=r.id;return jsonb_build_object('ok',false,'error','expired');end if;
 if r.status='responded' then return jsonb_build_object('ok',true,'status',r.response,'already_recorded',true);end if;
 v_quote_status:=case when p_decision='accepted' then 'Accepted' when p_decision='declined' then 'Declined' else 'Sent' end;
 update public.public_documents_v2 set status='responded',response=p_decision,responded_by_name=trim(p_customer_name),response_note=coalesce(p_note,''),responded_at=now() where id=r.id;
 update public.quotes set status=v_quote_status,updated_at=now(),payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('customerResponse',p_decision,'acceptedAt',case when p_decision='accepted' then now() else null end,'acceptedBy',trim(p_customer_name),'customerResponseNote',coalesce(p_note,'')) where business_id=r.business_id and id=r.document_id;
 insert into public.audit_events(business_id,entity_type,entity_id,action,details)
 values(r.business_id,'quote',r.document_id,'v2_public_quote_response',jsonb_build_object('decision',p_decision,'customer_name',trim(p_customer_name),'public_document_id',r.id));
 return jsonb_build_object('ok',true,'status',p_decision);
end;$$;

revoke all on function public.tuinbooks_v2_create_public_document(uuid,text,text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.tuinbooks_v2_create_public_document(uuid,text,text,text,jsonb,timestamptz) to authenticated;
revoke all on function public.tuinbooks_v2_get_public_document(text) from public;
grant execute on function public.tuinbooks_v2_get_public_document(text) to anon,authenticated;
revoke all on function public.tuinbooks_v2_respond_public_quote(text,text,text,text) from public;
grant execute on function public.tuinbooks_v2_respond_public_quote(text,text,text,text) to anon,authenticated;


-- ---------------------------------------------------------------------------
-- FULL SUPPORT WORKSPACE: explicit full-scope grants may use v2 admin RPCs.
-- Customer owner/admin membership remains unchanged; support access expires and
-- never creates a business membership.
-- ---------------------------------------------------------------------------
create or replace function public.is_business_admin(target_business_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.business_members bm where bm.business_id=target_business_id and bm.user_id=auth.uid() and bm.active=true and lower(bm.role) in('owner','admin'))
 or exists(select 1 from public.tuinbooks_platform_staff ps join public.tuinbooks_support_grants g on g.support_user_id=ps.user_id and g.business_id=target_business_id where ps.user_id=auth.uid() and ps.active=true and lower(g.status)='active' and coalesce(g.starts_at,now())<=now() and (g.expires_at is null or g.expires_at>now()) and g.operational_read=true and g.operational_edit=true and g.financial_read=true and g.financial_edit=true);
$$;
revoke all on function public.is_business_admin(uuid) from public;
grant execute on function public.is_business_admin(uuid) to authenticated;

create or replace function public.tuinbooks_v2_support_context(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare b public.businesses%rowtype;ps record;
begin
 select staff_role into ps from public.tuinbooks_platform_staff where user_id=auth.uid() and active=true;if not found then raise exception 'Platform staff access required';end if;
 if not public.is_business_admin(p_business_id) then raise exception 'An active full-support grant is required';end if;
 select * into b from public.businesses where id=p_business_id;if not found then raise exception 'Business not found';end if;
 return jsonb_build_object('user_id',auth.uid(),'email',coalesce((select email from auth.users where id=auth.uid()),''),'business_id',b.id,'business_name',b.name,'role','support','display_name',coalesce(ps.staff_role,'Platform support'));
end;$$;
revoke all on function public.tuinbooks_v2_support_context(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_support_context(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- FINAL BILLING CORRECTNESS: discounts, visit links, automatic numbering,
-- payment terms in the Money workspace, and fixed-month duplicate prevention.
-- ---------------------------------------------------------------------------
alter table public.quote_lines_v2 add column if not exists discount_percent numeric(6,3) not null default 0 check(discount_percent between 0 and 100);
alter table public.invoice_lines_v2 add column if not exists discount_percent numeric(6,3) not null default 0 check(discount_percent between 0 and 100);
drop index if exists public.invoice_lines_v2_visit_unique;

create table if not exists public.invoice_visit_links_v2(
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id text not null,
  visit_id text not null,
  created_at timestamptz not null default now(),
  primary key(business_id,invoice_id,visit_id),
  unique(business_id,visit_id),
  foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete cascade
);
alter table public.invoice_visit_links_v2 enable row level security;
drop policy if exists invoice_visit_links_v2_select on public.invoice_visit_links_v2;
create policy invoice_visit_links_v2_select on public.invoice_visit_links_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.invoice_visit_links_v2 to authenticated;
revoke insert,update,delete on public.invoice_visit_links_v2 from authenticated,anon;

create table if not exists public.invoice_sequences_v2(
 business_id uuid primary key references public.businesses(id) on delete cascade,
 next_number bigint not null default 1 check(next_number>0),updated_at timestamptz not null default now()
);
alter table public.invoice_sequences_v2 enable row level security;
revoke all on public.invoice_sequences_v2 from anon,authenticated;

create or replace function public.tuinbooks_v2_next_invoice_number(p_business_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_prefix text;v_next bigint;v_seed bigint;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 select coalesce(nullif(settings->'v2'->>'invoicePrefix',''),nullif(settings->>'invoicePrefix',''),'INV-') into v_prefix from public.businesses where id=p_business_id;
 select coalesce(max((regexp_match(invoice_number,'([0-9]+)$'))[1]::bigint),0)+1 into v_seed from public.invoices where business_id=p_business_id and invoice_number like v_prefix||'%';
 insert into public.invoice_sequences_v2(business_id,next_number) values(p_business_id,greatest(1,v_seed)) on conflict(business_id) do nothing;
 select next_number into v_next from public.invoice_sequences_v2 where business_id=p_business_id for update;
 update public.invoice_sequences_v2 set next_number=v_next+1,updated_at=now() where business_id=p_business_id;
 return v_prefix||lpad(v_next::text,4,'0');
end;$$;

create or replace function public.tuinbooks_v2_money_lines_json(p_business_id uuid,p_kind text,p_document_id text,p_fallback jsonb)
returns jsonb language plpgsql stable set search_path=public as $$declare v jsonb;begin
 if p_kind='quote' then select jsonb_agg(jsonb_build_object('id',id,'description',description,'quantity',quantity,'unitPrice',unit_price,'vatRate',vat_rate,'discountPercent',discount_percent,'sourceVisitId',source_visit_id,'sourceQuoteId',source_quote_id,'category',category) order by position,id) into v from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_document_id;
 else select jsonb_agg(jsonb_build_object('id',id,'description',description,'quantity',quantity,'unitPrice',unit_price,'vatRate',vat_rate,'discountPercent',discount_percent,'sourceVisitId',source_visit_id,'sourceQuoteId',source_quote_id,'category',category) order by position,id) into v from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_document_id;end if;
 return coalesce(v,case when jsonb_typeof(p_fallback->'lines')='array' then p_fallback->'lines' when jsonb_typeof(p_fallback->'lineItems')='array' then p_fallback->'lineItems' else '[]'::jsonb end);end$$;

create or replace function public.tuinbooks_v2_replace_quote_lines(p_business_id uuid,p_quote_id text,p_lines jsonb) returns void language plpgsql security definer set search_path=public as $$declare r jsonb;n integer:=0;begin
 delete from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_quote_id;
 for r in select * from jsonb_array_elements(coalesce(p_lines,'[]')) loop n:=n+1;
  insert into public.quote_lines_v2(business_id,quote_id,id,position,description,quantity,unit_price,vat_rate,source_visit_id,source_quote_id,category,created_at,updated_at,discount_percent)
  values(p_business_id,p_quote_id,coalesce(nullif(r->>'id',''),'line-'||n),n,coalesce(r->>'description',''),coalesce((r->>'quantity')::numeric,1),coalesce((r->>'unitPrice')::numeric,0),coalesce((r->>'vatRate')::numeric,0),nullif(r->>'sourceVisitId',''),nullif(r->>'sourceQuoteId',''),coalesce(nullif(r->>'category',''),'manual'),now(),now(),greatest(0,least(100,coalesce((r->>'discountPercent')::numeric,0))));
 end loop;end$$;

create or replace function public.tuinbooks_v2_replace_invoice_lines(p_business_id uuid,p_invoice_id text,p_lines jsonb) returns void language plpgsql security definer set search_path=public as $$declare r jsonb;n integer:=0;begin
 delete from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_invoice_id;
 for r in select * from jsonb_array_elements(coalesce(p_lines,'[]')) loop n:=n+1;
  insert into public.invoice_lines_v2(business_id,invoice_id,id,position,description,quantity,unit_price,vat_rate,source_visit_id,source_quote_id,category,created_at,updated_at,discount_percent)
  values(p_business_id,p_invoice_id,coalesce(nullif(r->>'id',''),'line-'||n),n,coalesce(r->>'description',''),coalesce((r->>'quantity')::numeric,1),coalesce((r->>'unitPrice')::numeric,0),coalesce((r->>'vatRate')::numeric,0),nullif(r->>'sourceVisitId',''),nullif(r->>'sourceQuoteId',''),coalesce(nullif(r->>'category',''),'manual'),now(),now(),greatest(0,least(100,coalesce((r->>'discountPercent')::numeric,0))));
  if nullif(r->>'sourceVisitId','') is not null then insert into public.invoice_visit_links_v2(business_id,invoice_id,visit_id) values(p_business_id,p_invoice_id,r->>'sourceVisitId') on conflict do nothing;end if;
 end loop;end$$;

create or replace function public.tuinbooks_v2_save_invoice(p_business_id uuid,p_invoice_id text,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_status text,p_number text,p_lines jsonb,p_notes text) returns text language plpgsql security definer set search_path=public as $$
declare old_status text;total numeric;payload jsonb;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 if p_status not in('Draft','Ready','Sent','Paid','Partially paid','Overdue','Credited','Void') then raise exception 'Invalid invoice status';end if;
 if p_due_date<p_issue_date then raise exception 'Due date cannot be before invoice date';end if;
 select status into old_status from public.invoices where business_id=p_business_id and id=p_invoice_id for update;
 if old_status is not null and old_status not in('Draft','Ready') then raise exception 'Issued invoices are immutable; use payment/credit flows instead';end if;
 if trim(coalesce(p_number,''))<>'Draft' and exists(select 1 from public.invoices where business_id=p_business_id and id<>p_invoice_id and invoice_number=trim(p_number)) then raise exception 'Invoice number already exists';end if;
 select coalesce(sum(coalesce((r->>'quantity')::numeric,1)*coalesce((r->>'unitPrice')::numeric,0)*(1-greatest(0,least(100,coalesce((r->>'discountPercent')::numeric,0)))/100)*(1+coalesce((r->>'vatRate')::numeric,0)/100)),0) into total from jsonb_array_elements(coalesce(p_lines,'[]')) r;
 payload=jsonb_build_object('issueDate',p_issue_date,'dueDate',p_due_date,'notes',coalesce(p_notes,''),'lines',coalesce(p_lines,'[]'::jsonb),'v2Document',true);
 insert into public.invoices(business_id,id,client_id,invoice_month,invoice_number,status,total,payload,created_by) values(p_business_id,p_invoice_id,p_client_id,p_invoice_month,coalesce(nullif(trim(p_number),''),'Draft'),p_status,round(total,2),payload,auth.uid()) on conflict(business_id,id) do update set client_id=excluded.client_id,invoice_month=excluded.invoice_month,invoice_number=excluded.invoice_number,status=excluded.status,total=excluded.total,payload=excluded.payload,updated_at=now();
 perform public.tuinbooks_v2_replace_invoice_lines(p_business_id,p_invoice_id,p_lines);
 delete from public.invoice_visit_links_v2 l using public.schedule_jobs j where l.business_id=p_business_id and l.invoice_id=p_invoice_id and j.business_id=l.business_id and j.id=l.visit_id
  and not exists(select 1 from jsonb_array_elements(coalesce(p_lines,'[]')) r where nullif(r->>'sourceVisitId','')=l.visit_id)
  and not (exists(select 1 from jsonb_array_elements(coalesce(p_lines,'[]')) r where coalesce(r->>'category','')='routine') and lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','routine')) not like '%quote%');
 return p_invoice_id;end$$;

create or replace function public.tuinbooks_v2_queue_accepted_quote(p_business_id uuid,p_quote_id text) returns text language plpgsql security definer set search_path=public as $$declare q public.quotes%rowtype;qid text:='queue-quote-'||p_quote_id;desc_text text;total numeric;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;select * into q from public.quotes where business_id=p_business_id and id=p_quote_id and status='Accepted';if not found then raise exception 'Only accepted quotes can be sent to Basket';end if;
 select string_agg(description,', '),sum(quantity*unit_price*(1-discount_percent/100)*(1+vat_rate/100)) into desc_text,total from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_quote_id;
 insert into public.schedule_queue_items_v2(business_id,id,client_id,estimated_minutes,item_type,billing_disposition,reason,status,payload,created_by,updated_by) values(p_business_id,qid,q.client_id,0,'quoted','quoted','Accepted quote','open',jsonb_build_object('sourceQuoteId',p_quote_id,'task',coalesce(desc_text,'Quoted work'),'quotedTotal',coalesce(total,0),'visitType','quoted','billingDisposition','quoted'),auth.uid(),auth.uid()) on conflict(business_id,id) do update set status='open',payload=excluded.payload,updated_by=auth.uid(),updated_at=now();return qid;end$$;

create or replace function public.tuinbooks_v2_load_money_workspace(p_business_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_accounts jsonb;v_quotes jsonb;v_invoices jsonb;v_payments jsonb;v_facts jsonb;v_settings jsonb;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]') into v_accounts from public.customers c where c.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('payload',coalesce(q.payload,'{}')||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'quote',q.id,q.payload))) order by q.updated_at desc),'[]') into v_quotes from public.quotes q where q.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('payload',coalesce(i.payload,'{}')||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'invoice',i.id,i.payload))) order by i.updated_at desc),'[]') into v_invoices from public.invoices i where i.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.payment_date desc,p.created_at desc),'[]') into v_payments from public.payments_v2 p where p.business_id=p_business_id;
 select coalesce(jsonb_agg(x order by x->>'visit_date'),'[]') into v_facts from(
  select jsonb_build_object('visit_id',j.id,'client_id',j.client_id,'visit_date',j.visit_date,'visit_type',case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end,
   'status',lower(j.status),'billing_disposition',coalesce(j.payload->>'billingDisposition',case when lower(j.status)='cancelled' and coalesce((j.payload->>'cancellationCharge')::boolean,false) then 'charge' when lower(j.status)='cancelled' then 'no-charge' else case when lower(coalesce(j.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end end),
   'description',coalesce(nullif(j.payload->>'task',''),nullif(j.payload->>'serviceDescription',''),'Garden service'),'amount',case when coalesce(j.payload->>'billingAmountV2','')~'^-?[0-9]+([.][0-9]+)?$' then (j.payload->>'billingAmountV2')::numeric else null end,
   'already_invoiced',exists(select 1 from public.invoice_visit_links_v2 l join public.invoices li on li.business_id=l.business_id and li.id=l.invoice_id where l.business_id=j.business_id and l.visit_id=j.id and lower(li.status) not in('void','credited'))
     or (lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','routine')) not like '%quote%' and exists(select 1 from public.invoices i join public.invoice_lines_v2 il on il.business_id=i.business_id and il.invoice_id=i.id and il.category='routine' where i.business_id=j.business_id and i.client_id=j.client_id and i.invoice_month=to_char(j.visit_date,'YYYY-MM') and lower(i.status) not in('void','credited')))) x
  from public.schedule_jobs j where j.business_id=p_business_id and lower(j.status) in('completed','cancelled','suspended','rescheduled')
 ) s;
 select coalesce(settings->'v2',settings,'{}'::jsonb) into v_settings from public.businesses where id=p_business_id;
 return jsonb_build_object('accounts',v_accounts,'quotes',v_quotes,'invoices',v_invoices,'payments',v_payments,'billing_facts',v_facts,'vat_registered',lower(coalesce(v_settings->>'vatRegistered',v_settings->>'vat_registered','no')) in('yes','true','1'),'vat_rate',coalesce(nullif(v_settings->>'vatRate','')::numeric,nullif(v_settings->>'vat_rate','')::numeric,15),'payment_terms_days',coalesce(nullif(v_settings->>'paymentTermsDays','')::integer,7),'invoice_prefix',coalesce(nullif(v_settings->>'invoicePrefix',''),'INV-'));end$$;

create or replace function public.tuinbooks_v2_create_invoice_from_facts(p_business_id uuid,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_visit_ids text[]) returns text language plpgsql security definer set search_path=public as $$
declare inv_id text:='inv-v2-'||replace(gen_random_uuid()::text,'-','');lines jsonb:='[]';v record;fee numeric;vat numeric:=0;routine_added boolean:=false;eligible_ids text[]:='{}';begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if coalesce(array_length(p_visit_ids,1),0)=0 then raise exception 'Choose billable visits';end if;
 select case when lower(coalesce(settings->'v2'->>'vatRegistered',settings->>'vatRegistered','no')) in('yes','true','1') then coalesce(nullif(settings->'v2'->>'vatRate','')::numeric,nullif(settings->>'vatRate','')::numeric,15) else 0 end into vat from public.businesses where id=p_business_id;
 for v in select j.*,case when lower(coalesce(j.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end vt,coalesce(j.payload->>'billingDisposition','routine') bd from public.schedule_jobs j where j.business_id=p_business_id and j.client_id=p_client_id and j.id=any(p_visit_ids) order by j.visit_date,j.id loop
  if exists(select 1 from public.invoice_visit_links_v2 l join public.invoices li on li.business_id=l.business_id and li.id=l.invoice_id where l.business_id=p_business_id and l.visit_id=v.id and lower(li.status) not in('void','credited')) then raise exception 'Visit % is already invoiced',v.id;end if;
  if lower(v.status)='cancelled' and v.bd='no-charge' then continue;end if;
  if v.vt='routine' and lower(v.status)='completed' then
    if exists(select 1 from public.invoices i join public.invoice_lines_v2 il on il.business_id=i.business_id and il.invoice_id=i.id and il.category='routine' where i.business_id=p_business_id and i.client_id=p_client_id and i.invoice_month=p_invoice_month and lower(i.status) not in('void','credited')) then raise exception 'Routine service for % is already invoiced for %',p_client_id,p_invoice_month;end if;
    if not routine_added then select nullif(c.payload#>>'{v2Billing,billingAmount}','')::numeric into fee from public.customers c where c.business_id=p_business_id and c.id=p_client_id;if fee is null then select sum(a.monthly_fee) into fee from public.client_service_agreements_v2 a where a.business_id=p_business_id and a.client_id=p_client_id and a.status='active' and a.monthly_fee is not null;end if;if fee is null then raise exception 'Routine monthly fee is not configured for this client';end if;lines=lines||jsonb_build_array(jsonb_build_object('id','line-routine-'||p_invoice_month,'description','Routine garden service - '||p_invoice_month,'quantity',1,'unitPrice',fee,'vatRate',vat,'discountPercent',0,'sourceVisitId',v.id,'sourceQuoteId',null,'category','routine'));routine_added:=true;end if;
  elsif v.vt='quoted' then
    if coalesce(v.payload->>'quotedTotal','')~'^[0-9]+([.][0-9]+)?$' then fee=(v.payload->>'quotedTotal')::numeric;elsif coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$' then fee=(v.payload->>'billingAmountV2')::numeric;else raise exception 'Quoted visit % has no billing amount',v.id;end if;lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description',coalesce(nullif(v.payload->>'task',''),'Quoted work'),'quantity',1,'unitPrice',fee,'vatRate',vat,'discountPercent',0,'sourceVisitId',v.id,'sourceQuoteId',nullif(v.payload->>'sourceQuoteId',''),'category','quoted'));
  else
    if not(coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$') then raise exception 'Set the Billing amount for visit % before invoicing',v.id;end if;fee=(v.payload->>'billingAmountV2')::numeric;lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description',case when lower(v.status)='cancelled' then 'Chargeable cancellation' else coalesce(nullif(v.payload->>'task',''),'Additional visit') end,'quantity',1,'unitPrice',fee,'vatRate',vat,'discountPercent',0,'sourceVisitId',v.id,'sourceQuoteId',null,'category',case when lower(v.status)='cancelled' then 'cancellation' else 'additional' end));
  end if;
  eligible_ids:=array_append(eligible_ids,v.id);
 end loop;
 if jsonb_array_length(lines)=0 then raise exception 'No billable work selected';end if;
 perform public.tuinbooks_v2_save_invoice(p_business_id,inv_id,p_client_id,p_invoice_month,p_issue_date,p_due_date,'Draft','Draft',lines,'Created from Billing review');
 insert into public.invoice_visit_links_v2(business_id,invoice_id,visit_id) select p_business_id,inv_id,x from unnest(eligible_ids) x on conflict do nothing;
 return inv_id;end$$;

create or replace function public.tuinbooks_v2_set_invoice_status(p_business_id uuid,p_invoice_id text,p_status text) returns void language plpgsql security definer set search_path=public as $$declare inv public.invoices%rowtype;v_number text;begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;if p_status not in('Ready','Sent','Void') then raise exception 'Invalid invoice transition';end if;
 select * into inv from public.invoices where business_id=p_business_id and id=p_invoice_id for update;if not found then raise exception 'Invoice not found';end if;
 if p_status='Ready' then
  if inv.status not in('Draft','Ready') then raise exception 'Only draft invoices can be marked ready';end if;
  v_number:=inv.invoice_number;if coalesce(v_number,'Draft')='Draft' then v_number:=public.tuinbooks_v2_next_invoice_number(p_business_id);end if;
  update public.invoices set status='Ready',invoice_number=v_number,updated_at=now() where business_id=p_business_id and id=p_invoice_id;
 elsif p_status='Sent' then
  if inv.status<>'Ready' then raise exception 'Only ready invoices can be sent';end if;if coalesce(inv.invoice_number,'Draft')='Draft' then raise exception 'Invoice number was not assigned';end if;
  update public.invoices set status='Sent',updated_at=now(),payload=payload||jsonb_build_object('sentAt',now(),'deliveryStatus','Sent') where business_id=p_business_id and id=p_invoice_id;
 else
  if inv.status not in('Draft','Ready') then raise exception 'Only unissued invoices can be voided here';end if;update public.invoices set status='Void',updated_at=now() where business_id=p_business_id and id=p_invoice_id;delete from public.invoice_visit_links_v2 where business_id=p_business_id and invoice_id=p_invoice_id;
 end if;
end$$;

notify pgrst,'reload schema';
commit;
