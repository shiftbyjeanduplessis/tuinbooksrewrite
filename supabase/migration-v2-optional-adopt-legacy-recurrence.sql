-- TuinBooks v2 optional legacy recurrence adoption bridge.
-- RUN ONLY AFTER both v2 Schedule migrations and only in QA first.
-- This file intentionally depends on legacy service_agreements/service_agreement_lines.
-- It is separate so the v2 recurrence core has no dependency on those legacy mirror tables.

begin;

-- Conservative one-time bridge: adopt only simple ACTIVE legacy service agreements with unambiguous frequency/days/team.
-- It is NEVER called automatically. Run only in QA after reviewing the returned counts.
create or replace function public.tuinbooks_v2_adopt_simple_legacy_series(p_business_id uuid,p_from date default current_date,p_through date default current_date+56)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_agreement public.service_agreements%rowtype;v_frequency text;v_frequency_count integer;v_days text[];v_day text;v_weekday integer;v_series_id text;v_slot_id text;v_slot_count integer;v_created integer:=0;v_skipped integer:=0;v_minutes integer;v_services text[];v_team text;v_site text;v_anchor date;v_job public.schedule_jobs%rowtype;v_due date;v_occ_id text;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  for v_agreement in select * from public.service_agreements where business_id=p_business_id and lower(status)='active' order by id loop
    select lower(coalesce(min(nullif(frequency,'')),'weekly')),count(distinct lower(nullif(frequency,''))),coalesce(sum(estimated_duration_minutes),60),coalesce(array_agg(distinct service_id) filter(where nullif(service_id,'') is not null),'{}'::text[]) into v_frequency,v_frequency_count,v_minutes,v_services from public.service_agreement_lines where business_id=p_business_id and agreement_id=v_agreement.id and active=true;
    v_frequency:=case when v_frequency like '%fortnight%' then 'fortnightly' when v_frequency like '%4%week%' or v_frequency like '%four%week%' then 'four-weekly' when v_frequency like '%month%' then 'monthly' when v_frequency like '%week%' then 'weekly' else '' end;
    v_days:=coalesce(v_agreement.preferred_days,'{}'::text[]);v_slot_count:=cardinality(v_days);v_team:=nullif(v_agreement.default_team_id,'');v_site:=nullif(v_agreement.service_site_id,'');v_anchor:=coalesce(v_agreement.start_date,p_from);
    if v_frequency_count<>1 or v_frequency='' or v_slot_count<1 or v_slot_count>3 or (v_frequency<>'weekly' and v_slot_count<>1) or v_team is null or not exists(select 1 from public.teams where business_id=p_business_id and id=v_team and active=true) then v_skipped:=v_skipped+1;continue;end if;
    if exists(select 1 from public.schedule_series_v2 where business_id=p_business_id and payload->>'legacyAgreementId'=v_agreement.id) then continue;end if;
    v_series_id:='series-agreement-'||v_agreement.id;
    insert into public.schedule_series_v2(business_id,id,client_id,service_site_id,status,frequency,anchor_date,payload,created_by,updated_by) values(p_business_id,v_series_id,v_agreement.client_id,coalesce(v_site,''),'active',v_frequency,v_anchor,jsonb_build_object('legacyAgreementId',v_agreement.id,'adoptedAt',now()),auth.uid(),auth.uid());
    foreach v_day in array v_days loop
      v_weekday:=case lower(trim(v_day)) when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3 when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6 when 'sunday' then 7 else 0 end;
      if v_weekday=0 then raise exception 'Unsupported preferred day % on agreement %',v_day,v_agreement.id;end if;
      v_slot_id:=v_series_id||'-d'||v_weekday;
      insert into public.schedule_series_slots_v2(business_id,id,series_id,weekday,monthly_ordinal,default_team_id,estimated_minutes,service_ids,payload) values(p_business_id,v_slot_id,v_series_id,v_weekday,case when v_frequency='monthly' then least(5,ceil(extract(day from v_anchor)/7.0)::integer) else null end,v_team,least(480,greatest(15,coalesce(v_minutes,60))),v_services,'{}'::jsonb);
      for v_due in select * from public.tuinbooks_v2_series_slot_dates(p_business_id,v_series_id,v_slot_id,p_from,p_through) loop
        select * into v_job from public.schedule_jobs where business_id=p_business_id and client_id=v_agreement.client_id and visit_date=v_due and lower(status) not in ('cancelled','canceled') and lower(coalesce(payload->>'visitType',payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(payload->>'revenueType','')) not like '%quote%' order by sort_order limit 1;
        if found and not exists(select 1 from public.schedule_occurrences_v2 where business_id=p_business_id and schedule_job_id=v_job.id) then
          v_occ_id:='occ-v2-'||replace(gen_random_uuid()::text,'-','');insert into public.schedule_occurrences_v2(business_id,id,series_id,slot_id,occurrence_date,planned_date,schedule_job_id,status,manual_override,payload) values(p_business_id,v_occ_id,v_series_id,v_slot_id,v_due,v_job.visit_date,v_job.id,'scheduled',(lower(coalesce(v_job.payload->>'manualOverride','false')) in ('true','1','yes')),jsonb_build_object('adoptedExistingJob',true));
          update public.schedule_jobs set payload=payload||jsonb_build_object('scheduleSeriesId',v_series_id,'scheduleSeriesSlotId',v_slot_id,'occurrenceDate',v_due,'v2Recurrence',true),updated_by=auth.uid(),updated_at=now() where business_id=p_business_id and id=v_job.id;
        end if;
      end loop;
    end loop;
    v_created:=v_created+1;
  end loop;
  perform public.tuinbooks_v2_ensure_series_horizon(p_business_id,p_from,p_through);
  return jsonb_build_object('created_series',v_created,'skipped_agreements',v_skipped,'from',p_from,'through',p_through);
end;$$;


revoke all on function public.tuinbooks_v2_adopt_simple_legacy_series(uuid,date,date) from public;
grant execute on function public.tuinbooks_v2_adopt_simple_legacy_series(uuid,date,date) to authenticated;

commit;
