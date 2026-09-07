-- TuinBooks R31 live R29/R30 finance repair
-- The live QA database contains the R29/R30 quote-prepayment layer. This file
-- preserves the two defects repaired during the 7 Sep stress recovery without
-- forcing R29/R30 onto a database that does not have that layer yet.

begin;

do $r31$
begin
  if to_regclass('public.quote_payments_v29') is not null
     and to_regprocedure('public.tuinbooks_v2_quote_total_v29(uuid,text)') is not null then

    execute $sql$
create or replace function public.tuinbooks_v2_reconcile_quote_prepayments_r30(p_business_id uuid,p_invoice_id text)
returns void language plpgsql security definer set search_path=public,auth as $function$
declare
  v_qp record;
  allocation_id text;
  v_total numeric:=0;
  v_alloc numeric:=0;
begin
  select i.total into v_total
  from public.invoices i
  where i.business_id=p_business_id and i.id=p_invoice_id;
  if v_total is null then raise exception 'Invoice not found';end if;

  delete from public.payments_v2 p
  using public.quote_payments_v29 qpay
  where p.business_id=p_business_id
    and p.invoice_id=p_invoice_id
    and p.id='qapply-'||qpay.id
    and qpay.business_id=p.business_id
    and qpay.applied_invoice_id=p_invoice_id;

  update public.quote_payments_v29 qpay
  set applied_invoice_id=null,applied_at=null,updated_at=now()
  where qpay.business_id=p_business_id and qpay.applied_invoice_id=p_invoice_id;

  select coalesce(sum(qpay.amount),0) into v_alloc
  from public.quote_payments_v29 qpay
  where qpay.business_id=p_business_id
    and qpay.reversed_at is null
    and qpay.applied_invoice_id is null
    and exists(
      select 1 from public.invoice_lines_v2 il
      where il.business_id=p_business_id
        and il.invoice_id=p_invoice_id
        and il.source_quote_id=qpay.quote_id
    );

  if v_alloc>v_total+.01 then
    raise exception 'Quote pre-payments exceed this invoice total. Restore the quoted lines or correct the invoice before saving';
  end if;

  for v_qp in
    select q.*
    from public.quote_payments_v29 q
    where q.business_id=p_business_id
      and q.reversed_at is null
      and q.applied_invoice_id is null
      and exists(
        select 1 from public.invoice_lines_v2 il
        where il.business_id=p_business_id
          and il.invoice_id=p_invoice_id
          and il.source_quote_id=q.quote_id
      )
    order by q.payment_date,q.created_at,q.id
  loop
    allocation_id:='qapply-'||v_qp.id;
    insert into public.payments_v2(business_id,id,client_id,invoice_id,payment_date,amount,method,reference,note,created_by)
    values(p_business_id,allocation_id,v_qp.client_id,p_invoice_id,v_qp.payment_date,v_qp.amount,v_qp.method,v_qp.reference,'Quote pre-payment allocated from '||v_qp.quote_id,auth.uid())
    on conflict(business_id,id) do update set
      invoice_id=excluded.invoice_id,
      client_id=excluded.client_id,
      payment_date=excluded.payment_date,
      amount=excluded.amount,
      method=excluded.method,
      reference=excluded.reference,
      note=excluded.note,
      updated_at=now();

    update public.quote_payments_v29 qpay
    set applied_invoice_id=p_invoice_id,applied_at=now(),updated_at=now()
    where qpay.business_id=p_business_id and qpay.id=v_qp.id;
  end loop;
end;
$function$;
$sql$;

    execute $sql$
create or replace function public.tuinbooks_v2_create_invoice_from_facts(
 p_business_id uuid,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_visit_ids text[]
) returns text language plpgsql security definer set search_path=public,auth as $function$
declare
 inv_id text:='inv-v2-'||replace(gen_random_uuid()::text,'-','');
 lines jsonb:='[]'::jsonb;
 v record;
 fee numeric;
 vat numeric:=0;
 routine_added boolean:=false;
 routine_fee numeric;
 expected integer:=0;
 selected_completed integer:=0;
 quote_id text;
 q_lines jsonb:='[]'::jsonb;
 eligible_ids text[]:='{}'::text[];
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;
 if coalesce(array_length(p_visit_ids,1),0)=0 then raise exception 'Choose billable visits';end if;

 select case when lower(coalesce(settings->'v2'->>'vatRegistered',settings->>'vatRegistered','no')) in('yes','true','1')
   then coalesce(nullif(settings->'v2'->>'vatRate','')::numeric,nullif(settings->>'vatRate','')::numeric,15)
   else 0 end
 into vat from public.businesses where id=p_business_id;

 -- Accept the current v2 billing snapshot and imported legacy monthly fields.
 select coalesce(
   case when coalesce(c.payload#>>'{v2Billing,billingAmount}','')~'^-?[0-9]+([.][0-9]+)?$' then (c.payload#>>'{v2Billing,billingAmount}')::numeric end,
   case when coalesce(c.payload->>'monthlyFee','')~'^-?[0-9]+([.][0-9]+)?$' then (c.payload->>'monthlyFee')::numeric end,
   case when lower(coalesce(c.payload->>'priceBasis',c.payload->>'billingArrangement','')) like '%month%'
          and coalesce(c.payload->>'rateAmount','')~'^-?[0-9]+([.][0-9]+)?$' then (c.payload->>'rateAmount')::numeric end
 ) into routine_fee
 from public.customers c
 where c.business_id=p_business_id and c.id=p_client_id;

 if routine_fee is null then
   select sum(a.monthly_fee) into routine_fee
   from public.client_service_agreements_v2 a
   where a.business_id=p_business_id and a.client_id=p_client_id and a.status='active' and a.monthly_fee is not null;
 end if;

 select count(*) into expected
 from public.schedule_jobs j
 where j.business_id=p_business_id and j.client_id=p_client_id and to_char(j.visit_date,'YYYY-MM')=p_invoice_month
   and lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','routine')) not like '%additional%'
   and lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','routine')) not like '%quote%'
   and lower(coalesce(j.status,'')) not in('rescheduled','deferred');

 -- A routine cancel-charge is a billable routine occurrence. It must count in
 -- the monthly proration instead of requiring an unrelated manual extra amount.
 select count(*) into selected_completed
 from public.schedule_jobs j
 where j.business_id=p_business_id and j.client_id=p_client_id and j.id=any(p_visit_ids)
   and (
     lower(j.status)='completed'
     or (lower(j.status)='cancelled' and coalesce(j.payload->>'billingDisposition',case when coalesce((j.payload->>'cancellationCharge')::boolean,false) then 'charge' else 'no-charge' end)='charge')
   )
   and lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','routine')) not like '%additional%'
   and lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','routine')) not like '%quote%';

 for v in
   select j.*,
     case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional'
          when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted'
          else 'routine' end vt,
     coalesce(j.payload->>'billingDisposition','routine') bd
   from public.schedule_jobs j
   where j.business_id=p_business_id and j.client_id=p_client_id and j.id=any(p_visit_ids)
   order by j.visit_date,j.sort_order,j.id
 loop
   if exists(
     select 1 from public.invoice_lines_v2 l
     join public.invoices i on i.business_id=l.business_id and i.id=l.invoice_id
     where l.business_id=p_business_id and l.source_visit_id=v.id and lower(i.status) not in('void','credited')
   ) then raise exception 'Visit % is already invoiced',v.id;end if;

   if lower(v.status)='cancelled' and v.bd='no-charge' then continue;end if;

   if v.vt='routine' and (lower(v.status)='completed' or (lower(v.status)='cancelled' and v.bd='charge')) then
     if not routine_added then
       if routine_fee is null then raise exception 'Routine monthly fee is not configured for this client';end if;
       if expected<=0 then raise exception 'Expected routine visit count is zero for this billing month';end if;
       fee:=round(routine_fee*selected_completed::numeric/expected::numeric,2);
       lines=lines||jsonb_build_array(jsonb_build_object(
         'id','line-routine-'||p_invoice_month,
         'description','Routine garden service - '||p_invoice_month||' ('||selected_completed||' of '||expected||' billable visits)',
         'quantity',1,'unitPrice',fee,'vatRate',vat,'discountPercent',0,
         'sourceVisitId',v.id,'sourceQuoteId',null,'category','routine'));
       routine_added:=true;
     end if;

   elsif v.vt='quoted' and lower(v.status)='completed' then
     quote_id:=nullif(v.payload->>'sourceQuoteId','');
     if quote_id is not null then
       select coalesce(jsonb_agg(jsonb_build_object(
         'id','line-'||v.id||'-'||ql.position,'description',ql.description,'quantity',ql.quantity,
         'unitPrice',ql.unit_price,'vatRate',ql.vat_rate,'discountPercent',ql.discount_percent,
         'sourceVisitId',v.id,'sourceQuoteId',quote_id,'category','quoted') order by ql.position,ql.id),'[]'::jsonb)
       into q_lines
       from public.quote_lines_v2 ql
       where ql.business_id=p_business_id and ql.quote_id=quote_id;

       if jsonb_array_length(q_lines)>0 then
         lines:=lines||q_lines;
       else
         fee:=public.tuinbooks_v2_quote_total_v29(p_business_id,quote_id);
         lines:=lines||jsonb_build_array(jsonb_build_object(
           'id','line-'||v.id,'description',coalesce(nullif(v.payload->>'task',''),'Quoted work'),
           'quantity',1,'unitPrice',fee,'vatRate',0,'discountPercent',0,
           'sourceVisitId',v.id,'sourceQuoteId',quote_id,'category','quoted'));
       end if;
     elsif coalesce(v.payload->>'quotedTotal','')~'^[0-9]+([.][0-9]+)?$' then
       fee:=(v.payload->>'quotedTotal')::numeric;
       lines:=lines||jsonb_build_array(jsonb_build_object(
         'id','line-'||v.id,'description',coalesce(nullif(v.payload->>'task',''),'Quoted work'),
         'quantity',1,'unitPrice',fee,'vatRate',0,'discountPercent',0,
         'sourceVisitId',v.id,'sourceQuoteId',null,'category','quoted'));
     elsif coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$' then
       fee:=(v.payload->>'billingAmountV2')::numeric;
       lines:=lines||jsonb_build_array(jsonb_build_object(
         'id','line-'||v.id,'description',coalesce(nullif(v.payload->>'task',''),'Quoted work'),
         'quantity',1,'unitPrice',fee,'vatRate',0,'discountPercent',0,
         'sourceVisitId',v.id,'sourceQuoteId',null,'category','quoted'));
     else
       raise exception 'Quoted visit % has no billing amount',v.id;
     end if;

   elsif lower(v.status)='completed' or (lower(v.status)='cancelled' and v.bd='charge') then
     if not(coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$') then
       raise exception 'Set the Billing amount for visit % before invoicing',v.id;
     end if;
     fee=(v.payload->>'billingAmountV2')::numeric;
     lines=lines||jsonb_build_array(jsonb_build_object(
       'id','line-'||v.id,
       'description',case when lower(v.status)='cancelled' then 'Chargeable cancellation' else coalesce(nullif(v.payload->>'task',''),'Additional visit') end,
       'quantity',1,'unitPrice',fee,'vatRate',vat,'discountPercent',0,
       'sourceVisitId',v.id,'sourceQuoteId',null,
       'category',case when lower(v.status)='cancelled' then 'cancellation' else 'additional' end));
   end if;

   if (lower(v.status)='completed' and v.vt in('routine','additional','quoted'))
      or (lower(v.status)='cancelled' and v.bd='charge') then
     eligible_ids:=array_append(eligible_ids,v.id);
   end if;
 end loop;

 if jsonb_array_length(lines)=0 then raise exception 'No billable completed work was selected';end if;
 perform public.tuinbooks_v2_save_invoice(p_business_id,inv_id,p_client_id,p_invoice_month,p_issue_date,p_due_date,'Draft','Draft',lines,'Created from Billing review');
 insert into public.invoice_visit_links_v2(business_id,invoice_id,visit_id)
 select p_business_id,inv_id,x from unnest(eligible_ids) x on conflict do nothing;
 update public.invoices
 set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('quotePrepaymentsAllocatedR30',true),updated_at=now()
 where business_id=p_business_id and id=inv_id;
 return inv_id;
end;
$function$;
$sql$;

  end if;
end;
$r31$;

notify pgrst,'reload schema';
commit;
