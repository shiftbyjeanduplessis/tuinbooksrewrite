-- TuinBooks R14 — restore visit detail/work expectations in Schedule.
-- Adds service catalogue + active service agreements to the existing single
-- Schedule-week read so clicking a card can show the work expected at that site
-- without an extra browser round trip.

begin;

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
    'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id) from public.business_services_v2 s where s.business_id=p_business_id and s.active=true),'[]'::jsonb),
    'agreements',coalesce((select jsonb_agg(to_jsonb(a) order by a.client_id,a.service_site_id,a.version desc,a.id) from public.client_service_agreements_v2 a where a.business_id=p_business_id and lower(coalesce(a.status,'active')) in ('active','paused')),'[]'::jsonb),
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

commit;
