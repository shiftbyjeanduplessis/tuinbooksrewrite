begin;

create or replace function public.tuinbooks_v2_resolve_missed_visit_r12(
  p_business_id uuid,
  p_visit_id text,
  p_decision text,
  p_work_record_id text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_job public.schedule_jobs%rowtype;
  v_existing public.work_records%rowtype;
  v_work_id text;
  v_note text:=trim(coalesce(p_note,''));
  v_previous_outcome text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
  if p_decision not in ('complete','no-return') then raise exception 'Unknown missed-visit resolution'; end if;

  select * into v_job from public.schedule_jobs where business_id=p_business_id and id=p_visit_id for update;
  if not found then raise exception 'Visit not found'; end if;
  if lower(v_job.status)<>'missed' then raise exception 'Only a missed visit can be resolved here'; end if;

  select * into v_existing from public.work_records where business_id=p_business_id and schedule_job_id=p_visit_id order by created_at desc limit 1;
  v_work_id:=coalesce(nullif(v_existing.id,''),nullif(trim(p_work_record_id),''));
  if v_work_id is null then raise exception 'Work record id is required'; end if;

  if p_decision='complete' then
    if v_existing.id is null then
      insert into public.work_records(
        business_id,id,schedule_job_id,client_id,team_id,work_date,work_done,extra_description,photo_paths,outcome,payload,created_by
      ) values(
        p_business_id,v_work_id,p_visit_id,v_job.client_id,v_job.team_id,v_job.visit_date,'{}'::text[],
        coalesce(nullif(v_note,''),'Visit confirmed completed by office'),'{}'::text[],'Completed',
        jsonb_build_object('officeConfirmedV2',true,'missedResolutionV2','complete','resolutionNoteV2',v_note,'resolvedAtV2',now()),auth.uid()
      );
    else
      v_previous_outcome:=v_existing.outcome;
      update public.work_records set
        outcome='Completed',
        extra_description=case when v_note='' then extra_description else v_note end,
        payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('officeCorrectionV2',true,'previousOutcomeV2',coalesce(v_previous_outcome,''),'missedResolutionV2','complete','resolutionNoteV2',v_note,'resolvedAtV2',now())
      where business_id=p_business_id and id=v_existing.id;
    end if;

    update public.schedule_jobs set
      status='completed',updated_by=auth.uid(),updated_at=now(),
      payload=payload||jsonb_build_object('resolvedMissedV2',true,'missedResolutionV2','complete','missedResolutionNoteV2',v_note,'completedAt',now(),'completedBy',auth.uid())
    where business_id=p_business_id and id=p_visit_id;
    update public.schedule_occurrences_v2 set status='completed',updated_at=now() where business_id=p_business_id and schedule_job_id=p_visit_id;
    insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
    values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_missed_resolved_complete',jsonb_build_object('work_record_id',v_work_id,'note',v_note));
    return jsonb_build_object('id',p_visit_id,'status','completed','work_record_id',v_work_id);
  end if;

  if v_existing.id is null then
    insert into public.work_records(
      business_id,id,schedule_job_id,client_id,team_id,work_date,work_done,extra_description,photo_paths,outcome,payload,created_by
    ) values(
      p_business_id,v_work_id,p_visit_id,v_job.client_id,v_job.team_id,v_job.visit_date,'{}'::text[],
      coalesce(nullif(v_note,''),'Office resolved missed visit with no catch-up / no charge'),'{}'::text[],'Missed / no charge',
      jsonb_build_object('missedResolutionV2','no-return','resolutionDecisionV2','No catch-up / no charge','chargeable',false,'resolutionNoteV2',v_note,'resolvedAtV2',now()),auth.uid()
    );
  else
    v_previous_outcome:=v_existing.outcome;
    update public.work_records set
      outcome='Missed / no charge',
      extra_description=case when v_note='' then extra_description else v_note end,
      payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('officeCorrectionV2',true,'previousOutcomeV2',coalesce(v_previous_outcome,''),'missedResolutionV2','no-return','resolutionDecisionV2','No catch-up / no charge','chargeable',false,'resolutionNoteV2',v_note,'resolvedAtV2',now())
    where business_id=p_business_id and id=v_existing.id;
  end if;

  update public.schedule_jobs set
    status='cancelled',updated_by=auth.uid(),updated_at=now(),
    payload=payload||jsonb_build_object('resolvedMissedV2',true,'missedResolutionV2','no-return','missedResolutionNoteV2',v_note,'billingDisposition','no-charge','cancellationBilling','no-charge','cancelReason','Resolved missed visit: no catch-up / no charge','cancelledV2',true,'cancelledAt',now())
  where business_id=p_business_id and id=p_visit_id;
  update public.schedule_occurrences_v2 set status='cancelled',updated_at=now() where business_id=p_business_id and schedule_job_id=p_visit_id;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'schedule_job',p_visit_id,'v2_missed_resolved_no_return',jsonb_build_object('work_record_id',v_work_id,'billing','no-charge','note',v_note));
  return jsonb_build_object('id',p_visit_id,'status','cancelled','billing','no-charge','work_record_id',v_work_id);
end;
$$;

revoke all on function public.tuinbooks_v2_resolve_missed_visit_r12(uuid,text,text,text,text) from public;
grant execute on function public.tuinbooks_v2_resolve_missed_visit_r12(uuid,text,text,text,text) to authenticated;

commit;
