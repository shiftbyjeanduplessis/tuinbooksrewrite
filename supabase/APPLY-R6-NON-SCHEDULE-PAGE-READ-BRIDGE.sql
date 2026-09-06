-- TUINBOOKS UI-RESTORED RELEASE R6
-- Non-Schedule page read bridge for audited Management sessions.
-- Authorization only: no customer/business data is modified by this script.

begin;

create or replace function public.tuinbooks_v2_can_operational_read(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
 select public.is_business_admin(target_business_id)
 or exists(
   select 1
   from public.tuinbooks_platform_staff ps
   join public.tuinbooks_support_sessions s
     on s.support_user_id=ps.user_id
    and s.business_id=target_business_id
   where ps.user_id=auth.uid()
     and ps.active=true
     and lower(s.status)='active'
     and s.expires_at>now()
     and (coalesce(s.allow_operational_read,false)=true or coalesce(s.allow_operational_edit,false)=true)
 );
$$;

create or replace function public.tuinbooks_v2_can_financial_read(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
 select public.is_business_admin(target_business_id)
 or exists(
   select 1
   from public.tuinbooks_platform_staff ps
   join public.tuinbooks_support_sessions s
     on s.support_user_id=ps.user_id
    and s.business_id=target_business_id
   where ps.user_id=auth.uid()
     and ps.active=true
     and lower(s.status)='active'
     and s.expires_at>now()
     and (coalesce(s.allow_financial_read,false)=true or coalesce(s.allow_financial_edit,false)=true)
 );
$$;

revoke all on function public.tuinbooks_v2_can_operational_read(uuid) from public;
revoke all on function public.tuinbooks_v2_can_financial_read(uuid) from public;
grant execute on function public.tuinbooks_v2_can_operational_read(uuid) to authenticated;
grant execute on function public.tuinbooks_v2_can_financial_read(uuid) to authenticated;

create or replace function public.tuinbooks_v2_load_schedule_week(p_business_id uuid,p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_end date:=p_week_start+6; v_result jsonb;
begin
  if not public.tuinbooks_v2_can_operational_read(p_business_id) then raise exception 'Operational read access required'; end if;
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

create or replace function public.tuinbooks_v2_load_money_workspace(p_business_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_accounts jsonb;v_quotes jsonb;v_invoices jsonb;v_payments jsonb;v_facts jsonb;v_settings jsonb;begin
 if not public.tuinbooks_v2_can_financial_read(p_business_id) then raise exception 'Financial read access required';end if;
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

create or replace function public.tuinbooks_v2_load_business_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype;
begin
 if not (public.tuinbooks_v2_can_operational_read(p_business_id) or public.tuinbooks_v2_can_financial_read(p_business_id)) then raise exception 'Business read access required'; end if;
 select * into b from public.businesses where id=p_business_id;if not found then raise exception 'Business not found';end if;
 return jsonb_build_object(
  'business',jsonb_build_object('id',b.id,'name',b.name,'phone',b.phone,'email',b.email,'address',b.address),
  'settings',coalesce(b.settings->'v2','{}'::jsonb),
  'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'notes',s.notes,'active',s.active) order by s.name) from public.business_services_v2 s where s.business_id=p_business_id),'[]'::jsonb),
  'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'capacity_hours',t.capacity_hours,'buffer_hours',t.buffer_hours,'active',t.active) order by t.name) from public.teams t where t.business_id=p_business_id),'[]'::jsonb)
 );
end;$$;

revoke all on function public.tuinbooks_v2_load_schedule_week(uuid,date) from public,anon;
grant execute on function public.tuinbooks_v2_load_schedule_week(uuid,date) to authenticated;
revoke all on function public.tuinbooks_v2_load_client_workspace(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_load_client_workspace(uuid) to authenticated;
revoke all on function public.tuinbooks_v2_load_work_day(uuid,date) from public;
grant execute on function public.tuinbooks_v2_load_work_day(uuid,date) to authenticated;
revoke all on function public.tuinbooks_v2_load_money_workspace(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_load_money_workspace(uuid) to authenticated;
revoke all on function public.tuinbooks_v2_load_business_workspace(uuid) from public,anon;
grant execute on function public.tuinbooks_v2_load_business_workspace(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
