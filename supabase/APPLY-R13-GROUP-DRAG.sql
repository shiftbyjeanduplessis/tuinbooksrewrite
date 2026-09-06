-- TuinBooks R13 — atomic multi-select Schedule rearrangement.
-- Additive only. Group moves apply to the selected occurrences only; they do not rewrite future recurrence.

begin;

create or replace function public.tuinbooks_v2_move_visits_group_r13(
  p_business_id uuid,
  p_moves jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_move jsonb;
  v_id text;
  v_date date;
  v_team text;
  v_sort integer;
  v_count integer:=0;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if p_moves is null or jsonb_typeof(p_moves)<>'array' then raise exception 'Moves must be a JSON array'; end if;
  if jsonb_array_length(p_moves)<1 then raise exception 'No visits selected'; end if;
  if jsonb_array_length(p_moves)>100 then raise exception 'At most 100 visits can be moved together'; end if;

  -- Preflight every row first so a bad selection fails before any update is attempted.
  for v_move in select value from jsonb_array_elements(p_moves) loop
    v_id:=nullif(trim(v_move->>'visit_id'),'');
    v_team:=nullif(trim(v_move->>'team_id'),'');
    if v_id is null or v_team is null or nullif(v_move->>'date','') is null then raise exception 'Each selected visit needs visit_id, date and team_id'; end if;
    begin v_date:=(v_move->>'date')::date; exception when others then raise exception 'Invalid target date for visit %',v_id; end;
    if not exists(select 1 from public.schedule_jobs where business_id=p_business_id and id=v_id and lower(status) not in ('completed','cancelled','canceled','rescheduled','suspended')) then raise exception 'Visit % cannot be moved',v_id; end if;
    if not exists(select 1 from public.teams where business_id=p_business_id and id=v_team and active=true) then raise exception 'Team % not found',v_team; end if;
  end loop;

  for v_move in select value from jsonb_array_elements(p_moves) loop
    v_id:=trim(v_move->>'visit_id');
    v_date:=(v_move->>'date')::date;
    v_team:=trim(v_move->>'team_id');
    v_sort:=coalesce(nullif(v_move->>'sort_order','')::integer,99);
    perform public.tuinbooks_v2_move_visit(p_business_id,v_id,v_date,v_team,v_sort);
    v_count:=v_count+1;
  end loop;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule',p_business_id::text,'v2_group_visit_move_r13',jsonb_build_object('count',v_count,'moves',p_moves));
  return jsonb_build_object('moved',v_count);
end;
$$;

create or replace function public.tuinbooks_v2_move_visits_to_basket_r13(
  p_business_id uuid,
  p_visit_ids text[]
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text;
  v_count integer:=0;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if coalesce(array_length(p_visit_ids,1),0)<1 then raise exception 'No visits selected'; end if;
  if array_length(p_visit_ids,1)>100 then raise exception 'At most 100 visits can be moved together'; end if;

  foreach v_id in array p_visit_ids loop
    if not exists(select 1 from public.schedule_jobs where business_id=p_business_id and id=v_id and lower(status) not in ('completed','cancelled','canceled','rescheduled','suspended')) then raise exception 'Visit % cannot move to Basket',v_id; end if;
    if exists(select 1 from public.work_records where business_id=p_business_id and schedule_job_id=v_id) then raise exception 'Visit % already has field work and cannot move to Basket',v_id; end if;
  end loop;

  foreach v_id in array p_visit_ids loop
    perform public.tuinbooks_v2_move_visit_to_basket(p_business_id,v_id);
    v_count:=v_count+1;
  end loop;

  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule',p_business_id::text,'v2_group_visit_to_basket_r13',jsonb_build_object('count',v_count,'visit_ids',to_jsonb(p_visit_ids)));
  return jsonb_build_object('queued',v_count);
end;
$$;

revoke all on function public.tuinbooks_v2_move_visits_group_r13(uuid,jsonb) from public;
revoke all on function public.tuinbooks_v2_move_visits_to_basket_r13(uuid,text[]) from public;
grant execute on function public.tuinbooks_v2_move_visits_group_r13(uuid,jsonb) to authenticated;
grant execute on function public.tuinbooks_v2_move_visits_to_basket_r13(uuid,text[]) to authenticated;

commit;
