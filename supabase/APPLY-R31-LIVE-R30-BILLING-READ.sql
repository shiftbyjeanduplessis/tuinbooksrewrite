-- TuinBooks R31 live R30 Billing-review read repair.
-- Conditional because the R29/R30 quote-prepayment layer is newer than the
-- R27 base currently present in repository history.

begin;

do $r31$
begin
  if to_regclass('public.quote_payments_v29') is not null
     and to_regprocedure('public.tuinbooks_v2_quote_required_prepayment_r30(uuid,text)') is not null then
    execute $sql$
create or replace function public.tuinbooks_v2_load_money_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare
 v_accounts jsonb;v_locations jsonb;v_quotes jsonb;v_invoices jsonb;v_payments jsonb;v_quote_payments jsonb;v_facts jsonb;v_settings jsonb;
begin
 if not public.tuinbooks_v2_can_financial_read(p_business_id) then raise exception 'Financial read access required';end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]'::jsonb) into v_accounts from public.customers c where c.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.customer_id,s.created_at,s.id),'[]'::jsonb) into v_locations from public.service_sites s where s.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('payload',coalesce(q.payload,'{}'::jsonb)||jsonb_build_object(
   'lines',public.tuinbooks_v2_money_lines_json(p_business_id,'quote',q.id,q.payload),
   'requiredPrepayment',public.tuinbooks_v2_quote_required_prepayment_r30(p_business_id,q.id),
   'paidPrepayment',public.tuinbooks_v2_quote_paid_v29(p_business_id,q.id),
   'workQueued',exists(select 1 from public.schedule_queue_items_v2 sq where sq.business_id=p_business_id and sq.id='queue-quote-'||q.id and sq.status='open')
     or exists(select 1 from public.schedule_jobs sj where sj.business_id=p_business_id and coalesce(sj.payload->>'sourceQuoteId','')=q.id and lower(coalesce(sj.status,''))<>'cancelled')
 )) order by q.updated_at desc),'[]'::jsonb) into v_quotes from public.quotes q where q.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('payload',coalesce(i.payload,'{}'::jsonb)||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'invoice',i.id,i.payload))) order by i.updated_at desc),'[]'::jsonb) into v_invoices from public.invoices i where i.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.payment_date desc,p.created_at desc),'[]'::jsonb) into v_payments from public.payments_v2 p where p.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.payment_date desc,p.created_at desc),'[]'::jsonb) into v_quote_payments from public.quote_payments_v29 p where p.business_id=p_business_id;

 select coalesce(jsonb_agg(x order by x->>'visit_date'),'[]'::jsonb) into v_facts from(
   select jsonb_build_object(
     'visit_id',j.id,'client_id',j.client_id,'visit_date',j.visit_date,
     'visit_type',case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end,
     'status',lower(j.status),
     'billing_disposition',coalesce(j.payload->>'billingDisposition',case when lower(j.status)='cancelled' and coalesce((j.payload->>'cancellationCharge')::boolean,false) then 'charge' when lower(j.status)='cancelled' then 'no-charge' else case when lower(coalesce(j.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end end),
     'description',coalesce(nullif(j.payload->>'task',''),nullif(j.payload->>'serviceDescription',''),'Garden service'),
     'amount',case
       when coalesce(j.payload->>'billingAmountV2','')~'^-?[0-9]+([.][0-9]+)?$' then (j.payload->>'billingAmountV2')::numeric
       when lower(j.status)='cancelled'
        and coalesce(j.payload->>'billingDisposition',case when coalesce((j.payload->>'cancellationCharge')::boolean,false) then 'charge' else 'no-charge' end)='charge'
        and lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','routine')) not like '%additional%'
        and lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','routine')) not like '%quote%'
       then round(
         coalesce(
           case when coalesce((select c.payload#>>'{v2Billing,billingAmount}' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),'')~'^-?[0-9]+([.][0-9]+)?$' then (select (c.payload#>>'{v2Billing,billingAmount}')::numeric from public.customers c where c.business_id=j.business_id and c.id=j.client_id) end,
           case when coalesce((select c.payload->>'monthlyFee' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),'')~'^-?[0-9]+([.][0-9]+)?$' then (select (c.payload->>'monthlyFee')::numeric from public.customers c where c.business_id=j.business_id and c.id=j.client_id) end,
           case when lower(coalesce((select c.payload->>'priceBasis' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),(select c.payload->>'billingArrangement' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),'')) like '%month%'
                  and coalesce((select c.payload->>'rateAmount' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),'')~'^-?[0-9]+([.][0-9]+)?$'
                then (select (c.payload->>'rateAmount')::numeric from public.customers c where c.business_id=j.business_id and c.id=j.client_id) end,
           (select sum(a.monthly_fee) from public.client_service_agreements_v2 a where a.business_id=j.business_id and a.client_id=j.client_id and a.status='active' and a.monthly_fee is not null)
         ) / nullif((select count(*) from public.schedule_jobs e where e.business_id=j.business_id and e.client_id=j.client_id and to_char(e.visit_date,'YYYY-MM')=to_char(j.visit_date,'YYYY-MM') and lower(coalesce(e.payload->>'visitType',e.payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(e.payload->>'visitType',e.payload->>'revenueType','routine')) not like '%quote%' and lower(coalesce(e.status,'')) not in('rescheduled','deferred')),0),2)
       else null end,
     'source_quote_id',nullif(j.payload->>'sourceQuoteId',''),
     'quote_number',coalesce((select q.payload->>'number' from public.quotes q where q.business_id=j.business_id and q.id=nullif(j.payload->>'sourceQuoteId','')),''),
     'quoted_total',case when nullif(j.payload->>'sourceQuoteId','') is not null then public.tuinbooks_v2_quote_total_v29(j.business_id,j.payload->>'sourceQuoteId') when coalesce(j.payload->>'quotedTotal','')~'^[0-9]+([.][0-9]+)?$' then (j.payload->>'quotedTotal')::numeric else null end,
     'quote_prepaid',case when nullif(j.payload->>'sourceQuoteId','') is not null then public.tuinbooks_v2_quote_paid_v29(j.business_id,j.payload->>'sourceQuoteId') else 0 end,
     'routine_monthly_fee',coalesce(
       case when coalesce((select c.payload#>>'{v2Billing,billingAmount}' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),'')~'^-?[0-9]+([.][0-9]+)?$' then (select (c.payload#>>'{v2Billing,billingAmount}')::numeric from public.customers c where c.business_id=j.business_id and c.id=j.client_id) end,
       case when coalesce((select c.payload->>'monthlyFee' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),'')~'^-?[0-9]+([.][0-9]+)?$' then (select (c.payload->>'monthlyFee')::numeric from public.customers c where c.business_id=j.business_id and c.id=j.client_id) end,
       case when lower(coalesce((select c.payload->>'priceBasis' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),(select c.payload->>'billingArrangement' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),'')) like '%month%'
              and coalesce((select c.payload->>'rateAmount' from public.customers c where c.business_id=j.business_id and c.id=j.client_id),'')~'^-?[0-9]+([.][0-9]+)?$'
            then (select (c.payload->>'rateAmount')::numeric from public.customers c where c.business_id=j.business_id and c.id=j.client_id) end,
       (select sum(a.monthly_fee) from public.client_service_agreements_v2 a where a.business_id=j.business_id and a.client_id=j.client_id and a.status='active' and a.monthly_fee is not null)),
     'routine_expected_visits',(select count(*) from public.schedule_jobs e where e.business_id=j.business_id and e.client_id=j.client_id and to_char(e.visit_date,'YYYY-MM')=to_char(j.visit_date,'YYYY-MM') and lower(coalesce(e.payload->>'visitType',e.payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(e.payload->>'visitType',e.payload->>'revenueType','routine')) not like '%quote%' and lower(coalesce(e.status,'')) not in('rescheduled','deferred')),
     'routine_completed_visits',(select count(*) from public.schedule_jobs e where e.business_id=j.business_id and e.client_id=j.client_id and to_char(e.visit_date,'YYYY-MM')=to_char(j.visit_date,'YYYY-MM') and (lower(e.status)='completed' or (lower(e.status)='cancelled' and coalesce(e.payload->>'billingDisposition',case when coalesce((e.payload->>'cancellationCharge')::boolean,false) then 'charge' else 'no-charge' end)='charge')) and lower(coalesce(e.payload->>'visitType',e.payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(e.payload->>'visitType',e.payload->>'revenueType','routine')) not like '%quote%'),
     'additional_visits',(select count(*) from public.schedule_jobs e where e.business_id=j.business_id and e.client_id=j.client_id and to_char(e.visit_date,'YYYY-MM')=to_char(j.visit_date,'YYYY-MM') and lower(e.status)='completed' and lower(coalesce(e.payload->>'visitType',e.payload->>'workKind','')) like '%additional%'),
     'already_invoiced',exists(select 1 from public.invoice_visit_links_v2 l join public.invoices li on li.business_id=l.business_id and li.id=l.invoice_id where l.business_id=j.business_id and l.visit_id=j.id and lower(li.status) not in('void','credited'))
       or exists(select 1 from public.invoice_lines_v2 il join public.invoices ii on ii.business_id=il.business_id and ii.id=il.invoice_id where il.business_id=j.business_id and il.source_visit_id=j.id and lower(ii.status) not in('void','credited'))
       or (lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','routine')) not like '%additional%' and lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','routine')) not like '%quote%' and exists(select 1 from public.invoices i join public.invoice_lines_v2 il on il.business_id=i.business_id and il.invoice_id=i.id and il.category='routine' where i.business_id=j.business_id and i.client_id=j.client_id and i.invoice_month=to_char(j.visit_date,'YYYY-MM') and lower(i.status) not in('void','credited')))
   ) x
   from public.schedule_jobs j
   where j.business_id=p_business_id and lower(j.status) in('completed','cancelled','suspended','rescheduled')
 ) s;

 select coalesce(settings->'v2',settings,'{}'::jsonb) into v_settings from public.businesses where id=p_business_id;
 return jsonb_build_object(
   'accounts',v_accounts,'locations',v_locations,'quotes',v_quotes,'invoices',v_invoices,'payments',v_payments,'quote_payments',v_quote_payments,'billing_facts',v_facts,
   'vat_registered',lower(coalesce(v_settings->>'vatRegistered',v_settings->>'vat_registered','no')) in('yes','true','1'),
   'vat_rate',coalesce(nullif(v_settings->>'vatRate','')::numeric,nullif(v_settings->>'vat_rate','')::numeric,15),
   'payment_terms_days',coalesce(nullif(v_settings->>'paymentTermsDays','')::integer,7),
   'invoice_prefix',coalesce(nullif(v_settings->>'invoicePrefix',''),'INV-'),
   'invoice_day',coalesce(nullif(v_settings->>'invoiceDay','')::integer,28));
end;
$function$;
$sql$;
  end if;
end;
$r31$;

notify pgrst,'reload schema';
commit;
