-- TuinBooks v2 Milestone 7: Quotes + Billing authority.
-- Canonical source. Re-runnable against an existing v2 database.
-- Quote, invoice, payment and visit-billing rules live here.
begin;

create table if not exists public.quote_lines_v2(
 business_id uuid not null references public.businesses(id) on delete cascade,
 quote_id text not null,
 id text not null,
 position integer not null default 0,
 description text not null,
 quantity numeric(12,3) not null default 1,
 unit_price numeric(12,2) not null default 0,
 vat_rate numeric(6,3) not null default 0,
 source_visit_id text,
 source_quote_id text,
 category text not null default 'manual',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(business_id,quote_id,id),
 foreign key(business_id,quote_id) references public.quotes(business_id,id) on delete cascade
);

create table if not exists public.invoice_lines_v2(
 business_id uuid not null references public.businesses(id) on delete cascade,
 invoice_id text not null,
 id text not null,
 position integer not null default 0,
 description text not null,
 quantity numeric(12,3) not null default 1,
 unit_price numeric(12,2) not null default 0,
 vat_rate numeric(6,3) not null default 0,
 source_visit_id text,
 source_quote_id text,
 category text not null default 'manual',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(business_id,invoice_id,id),
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete cascade
);
-- A quoted visit can legitimately create several invoice lines. Duplicate
-- prevention is therefore visit-to-invoice authority, not a unique line index.
drop index if exists public.invoice_lines_v2_visit_unique;
create index if not exists invoice_lines_v2_visit_idx on public.invoice_lines_v2(business_id,source_visit_id) where source_visit_id is not null;

create table if not exists public.invoice_visit_links_v2(
 business_id uuid not null references public.businesses(id) on delete cascade,
 source_visit_id text not null,
 invoice_id text not null,
 category text not null default 'work',
 created_at timestamptz not null default now(),
 primary key(business_id,source_visit_id),
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete cascade
);
create index if not exists invoice_visit_links_v2_invoice_idx on public.invoice_visit_links_v2(business_id,invoice_id);

create table if not exists public.payments_v2(
 business_id uuid not null references public.businesses(id) on delete cascade,
 id text not null,
 client_id text not null,
 invoice_id text not null,
 payment_date date not null,
 amount numeric(12,2) not null check(amount>0),
 method text not null default 'EFT',
 reference text not null default '',
 note text not null default '',
 reversed_at timestamptz,
 reversal_reason text not null default '',
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(business_id,id),
 foreign key(business_id,client_id) references public.customers(business_id,id) on delete restrict,
 foreign key(business_id,invoice_id) references public.invoices(business_id,id) on delete restrict
);
create index if not exists payments_v2_invoice_idx on public.payments_v2(business_id,invoice_id,payment_date);

alter table public.quote_lines_v2 enable row level security;
alter table public.invoice_lines_v2 enable row level security;
alter table public.invoice_visit_links_v2 enable row level security;
alter table public.payments_v2 enable row level security;
drop policy if exists quote_lines_v2_select on public.quote_lines_v2;
create policy quote_lines_v2_select on public.quote_lines_v2 for select to authenticated using(public.is_business_admin(business_id));
drop policy if exists invoice_lines_v2_select on public.invoice_lines_v2;
create policy invoice_lines_v2_select on public.invoice_lines_v2 for select to authenticated using(public.is_business_admin(business_id));
drop policy if exists invoice_visit_links_v2_select on public.invoice_visit_links_v2;
create policy invoice_visit_links_v2_select on public.invoice_visit_links_v2 for select to authenticated using(public.is_business_admin(business_id));
drop policy if exists payments_v2_select on public.payments_v2;
create policy payments_v2_select on public.payments_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.quote_lines_v2,public.invoice_lines_v2,public.invoice_visit_links_v2,public.payments_v2 to authenticated;
revoke insert,update,delete on public.quote_lines_v2,public.invoice_lines_v2,public.invoice_visit_links_v2,public.payments_v2 from authenticated;

create or replace function public.tuinbooks_v2_money_lines_json(p_business_id uuid,p_kind text,p_document_id text,p_fallback jsonb)
returns jsonb language plpgsql stable set search_path=public as $$
declare v jsonb;
begin
 if p_kind='quote' then
   select jsonb_agg(jsonb_build_object('id',id,'description',description,'quantity',quantity,'unitPrice',unit_price,'vatRate',vat_rate,'sourceVisitId',source_visit_id,'sourceQuoteId',source_quote_id,'category',category) order by position,id)
   into v from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_document_id;
 else
   select jsonb_agg(jsonb_build_object('id',id,'description',description,'quantity',quantity,'unitPrice',unit_price,'vatRate',vat_rate,'sourceVisitId',source_visit_id,'sourceQuoteId',source_quote_id,'category',category) order by position,id)
   into v from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_document_id;
 end if;
 return coalesce(v,case when jsonb_typeof(p_fallback->'lines')='array' then p_fallback->'lines' when jsonb_typeof(p_fallback->'lineItems')='array' then p_fallback->'lineItems' else '[]'::jsonb end);
end$$;

create or replace function public.tuinbooks_v2_client_monthly_billing(p_business_id uuid,p_client_id text)
returns boolean language plpgsql stable set search_path=public as $$
declare v_basis text;v_amount text;
begin
 select lower(coalesce(c.payload#>>'{v2Billing,billingBasis}','')),coalesce(c.payload#>>'{v2Billing,billingAmount}','')
 into v_basis,v_amount from public.customers c where c.business_id=p_business_id and c.id=p_client_id;
 if v_basis like '%month%' then return true;end if;
 if exists(select 1 from public.client_service_agreements_v2 a where a.business_id=p_business_id and a.client_id=p_client_id and a.status='active' and a.monthly_fee is not null) then return true;end if;
 return false;
end$$;

-- Resolve the amount a routine occurrence would normally carry. Chargeable
-- routine cancellations may use it. Additional visits never inherit it.
create or replace function public.tuinbooks_v2_visit_default_amount(p_business_id uuid,p_client_id text,p_payload jsonb)
returns numeric language plpgsql stable set search_path=public as $$
declare v text;v_site text;v_amount numeric;
begin
 v:=coalesce(p_payload->>'billingAmountV2','');
 if v~'^-?[0-9]+([.][0-9]+)?$' then return v::numeric;end if;
 v_site:=coalesce(nullif(p_payload->>'serviceLocationId',''),nullif(p_payload->>'serviceSiteId',''),nullif(p_payload->>'siteId',''));
 if v_site is not null then
   select case when coalesce(s.payload#>>'{v2Import,locationBillingAmount}','')~'^-?[0-9]+([.][0-9]+)?$' then (s.payload#>>'{v2Import,locationBillingAmount}')::numeric else null end
   into v_amount from public.service_sites s where s.business_id=p_business_id and s.id=v_site and s.customer_id=p_client_id limit 1;
   if v_amount is not null then return v_amount;end if;
 end if;
 select case when coalesce(c.payload#>>'{v2Billing,billingAmount}','')~'^-?[0-9]+([.][0-9]+)?$' then (c.payload#>>'{v2Billing,billingAmount}')::numeric else null end
 into v_amount from public.customers c where c.business_id=p_business_id and c.id=p_client_id;
 if v_amount is not null then return v_amount;end if;
 select sum(a.monthly_fee) into v_amount from public.client_service_agreements_v2 a where a.business_id=p_business_id and a.client_id=p_client_id and a.status='active' and a.monthly_fee is not null;
 return v_amount;
end$$;

create or replace function public.tuinbooks_v2_visit_already_invoiced(p_business_id uuid,p_visit_id text,p_client_id text,p_visit_date date,p_visit_type text)
returns boolean language plpgsql stable set search_path=public as $$
begin
 if exists(select 1 from public.invoice_visit_links_v2 l where l.business_id=p_business_id and l.source_visit_id=p_visit_id) then return true;end if;
 -- Legacy invoices created before visit links were introduced remain authoritative.
 if exists(select 1 from public.invoice_lines_v2 l where l.business_id=p_business_id and l.source_visit_id=p_visit_id) then return true;end if;
 -- A monthly routine fee covers the month, not only whichever visit happened to
 -- be used as the source line when the invoice was created.
 if p_visit_type='routine' and public.tuinbooks_v2_client_monthly_billing(p_business_id,p_client_id) and exists(
   select 1 from public.invoices i join public.invoice_lines_v2 l on l.business_id=i.business_id and l.invoice_id=i.id
   where i.business_id=p_business_id and i.client_id=p_client_id and i.invoice_month=to_char(p_visit_date,'YYYY-MM') and i.status not in('Void','Credited') and l.category='routine'
 ) then return true;end if;
 return false;
end$$;

create or replace function public.tuinbooks_v2_load_money_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_accounts jsonb;v_quotes jsonb;v_invoices jsonb;v_payments jsonb;v_facts jsonb;v_settings jsonb;
begin
 if not public.tuinbooks_v2_can_financial_read(p_business_id) then raise exception 'Financial read access required';end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]') into v_accounts from public.customers c where c.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('payload',coalesce(q.payload,'{}')||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'quote',q.id,q.payload))) order by q.updated_at desc),'[]') into v_quotes from public.quotes q where q.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('payload',coalesce(i.payload,'{}')||jsonb_build_object('lines',public.tuinbooks_v2_money_lines_json(p_business_id,'invoice',i.id,i.payload))) order by i.updated_at desc),'[]') into v_invoices from public.invoices i where i.business_id=p_business_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.payment_date desc,p.created_at desc),'[]') into v_payments from public.payments_v2 p where p.business_id=p_business_id;
 select coalesce(jsonb_agg(x order by x->>'visit_date'),'[]') into v_facts from(
   select jsonb_build_object(
    'visit_id',j.id,'client_id',j.client_id,'visit_date',j.visit_date,
    'visit_type',case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end,
    'status',lower(j.status),
    'billing_disposition',coalesce(j.payload->>'billingDisposition',case when lower(j.status)='cancelled' and coalesce((j.payload->>'cancellationCharge')::boolean,false) then 'charge' when lower(j.status)='cancelled' then 'no-charge' else case when lower(coalesce(j.payload->>'visitType','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end end),
    'description',coalesce(nullif(j.payload->>'task',''),nullif(j.payload->>'serviceDescription',''),'Garden service'),
    'amount',case
      when coalesce(j.payload->>'billingAmountV2','')~'^-?[0-9]+([.][0-9]+)?$' then (j.payload->>'billingAmountV2')::numeric
      when lower(j.status)='cancelled' and coalesce(j.payload->>'billingDisposition','')='charge' then public.tuinbooks_v2_visit_default_amount(j.business_id,j.client_id,j.payload)
      else null
    end,
    'already_invoiced',public.tuinbooks_v2_visit_already_invoiced(j.business_id,j.id,j.client_id,j.visit_date,case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end)
   ) x
   from public.schedule_jobs j where j.business_id=p_business_id and lower(j.status) in('completed','cancelled','suspended','rescheduled')
 ) s;
 select coalesce(settings->'v2',settings,'{}'::jsonb) into v_settings from public.businesses where id=p_business_id;
 return jsonb_build_object(
   'accounts',v_accounts,'quotes',v_quotes,'invoices',v_invoices,'payments',v_payments,'billing_facts',v_facts,
   'vat_registered',lower(coalesce(v_settings->>'vatRegistered',v_settings->>'vat_registered','no')) in('yes','true','1'),
   'vat_rate',coalesce(nullif(v_settings->>'vatRate','')::numeric,nullif(v_settings->>'vat_rate','')::numeric,15),
   'payment_terms_days',coalesce(nullif(v_settings->>'paymentTermsDays','')::integer,7),
   'invoice_prefix',coalesce(nullif(v_settings->>'invoicePrefix',''),'INV-')
 );
end$$;

create or replace function public.tuinbooks_v2_replace_quote_lines(p_business_id uuid,p_quote_id text,p_lines jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare r jsonb;n integer:=0;
begin
 delete from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_quote_id;
 for r in select * from jsonb_array_elements(coalesce(p_lines,'[]')) loop
   n:=n+1;
   insert into public.quote_lines_v2 values(p_business_id,p_quote_id,coalesce(nullif(r->>'id',''),'line-'||n),n,coalesce(r->>'description',''),coalesce((r->>'quantity')::numeric,1),coalesce((r->>'unitPrice')::numeric,0),coalesce((r->>'vatRate')::numeric,0),nullif(r->>'sourceVisitId',''),nullif(r->>'sourceQuoteId',''),coalesce(nullif(r->>'category',''),'manual'),now(),now());
 end loop;
end$$;

create or replace function public.tuinbooks_v2_replace_invoice_lines(p_business_id uuid,p_invoice_id text,p_lines jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare r jsonb;n integer:=0;
begin
 delete from public.invoice_visit_links_v2 where business_id=p_business_id and invoice_id=p_invoice_id;
 delete from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_invoice_id;
 for r in select * from jsonb_array_elements(coalesce(p_lines,'[]')) loop
   n:=n+1;
   insert into public.invoice_lines_v2 values(p_business_id,p_invoice_id,coalesce(nullif(r->>'id',''),'line-'||n),n,coalesce(r->>'description',''),coalesce((r->>'quantity')::numeric,1),coalesce((r->>'unitPrice')::numeric,0),coalesce((r->>'vatRate')::numeric,0),nullif(r->>'sourceVisitId',''),nullif(r->>'sourceQuoteId',''),coalesce(nullif(r->>'category',''),'manual'),now(),now());
 end loop;
 insert into public.invoice_visit_links_v2(business_id,source_visit_id,invoice_id,category)
 select p_business_id,source_visit_id,p_invoice_id,min(category)
 from public.invoice_lines_v2 where business_id=p_business_id and invoice_id=p_invoice_id and source_visit_id is not null
 group by source_visit_id;
end$$;

create or replace function public.tuinbooks_v2_save_quote(p_business_id uuid,p_quote_id text,p_client_id text,p_quote_date date,p_valid_until date,p_status text,p_number text,p_lines jsonb,p_notes text)
returns text language plpgsql security definer set search_path=public,auth as $$
declare old_status text;payload jsonb;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not exists(select 1 from public.customers where business_id=p_business_id and id=p_client_id) then raise exception 'Client not found';end if;
 if p_status not in('Draft','Sent','Accepted','Declined','Expired','Cancelled') then raise exception 'Invalid quote status';end if;
 select status into old_status from public.quotes where business_id=p_business_id and id=p_quote_id for update;
 if old_status='Accepted' then raise exception 'Accepted quotes are historical documents and cannot be edited';end if;
 if nullif(trim(p_number),'') is not null and exists(select 1 from public.quotes where business_id=p_business_id and id<>p_quote_id and payload->>'number'=trim(p_number)) then raise exception 'Quote number already exists';end if;
 payload=jsonb_build_object('number',coalesce(nullif(trim(p_number),''),p_quote_id),'validUntil',p_valid_until,'notes',coalesce(p_notes,''),'lines',coalesce(p_lines,'[]'::jsonb),'v2Document',true);
 insert into public.quotes(business_id,id,client_id,quote_date,status,payload,created_by)
 values(p_business_id,p_quote_id,p_client_id,p_quote_date,p_status,payload,auth.uid())
 on conflict(business_id,id) do update set client_id=excluded.client_id,quote_date=excluded.quote_date,status=excluded.status,payload=excluded.payload,updated_at=now();
 perform public.tuinbooks_v2_replace_quote_lines(p_business_id,p_quote_id,p_lines);
 return p_quote_id;
end$$;

create or replace function public.tuinbooks_v2_set_quote_status(p_business_id uuid,p_quote_id text,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if p_status not in('Draft','Sent','Accepted','Declined','Expired','Cancelled') then raise exception 'Invalid quote status';end if;
 update public.quotes set status=p_status,payload=payload||case when p_status='Accepted' then jsonb_build_object('acceptedAt',now()) else '{}'::jsonb end,updated_at=now() where business_id=p_business_id and id=p_quote_id;
 if not found then raise exception 'Quote not found';end if;
end$$;

create or replace function public.tuinbooks_v2_queue_accepted_quote(p_business_id uuid,p_quote_id text)
returns text language plpgsql security definer set search_path=public,auth as $$
declare q public.quotes%rowtype;qid text:='queue-quote-'||p_quote_id;desc_text text;subtotal numeric;vat_amount numeric;total numeric;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 select * into q from public.quotes where business_id=p_business_id and id=p_quote_id and status='Accepted';
 if not found then raise exception 'Only accepted quotes can be sent to Basket';end if;
 select string_agg(description,', '),coalesce(sum(quantity*unit_price),0),coalesce(sum(quantity*unit_price*vat_rate/100),0) into desc_text,subtotal,vat_amount from public.quote_lines_v2 where business_id=p_business_id and quote_id=p_quote_id;
 total:=subtotal+vat_amount;
 insert into public.schedule_queue_items_v2(business_id,id,client_id,estimated_minutes,item_type,billing_disposition,reason,status,payload,created_by,updated_by)
 values(p_business_id,qid,q.client_id,0,'quoted','quoted','Accepted quote','open',jsonb_build_object('sourceQuoteId',p_quote_id,'task',coalesce(desc_text,'Quoted work'),'quotedSubtotal',round(subtotal,2),'quotedVat',round(vat_amount,2),'quotedTotal',round(total,2),'visitType','quoted','billingDisposition','quoted'),auth.uid(),auth.uid())
 on conflict(business_id,id) do update set status='open',payload=excluded.payload,updated_by=auth.uid(),updated_at=now();
 return qid;
end$$;

create or replace function public.tuinbooks_v2_save_invoice(p_business_id uuid,p_invoice_id text,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_status text,p_number text,p_lines jsonb,p_notes text)
returns text language plpgsql security definer set search_path=public,auth as $$
declare old_status text;total numeric;payload jsonb;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;
 if p_status not in('Draft','Ready','Sent','Paid','Partially paid','Overdue','Credited','Void') then raise exception 'Invalid invoice status';end if;
 select status into old_status from public.invoices where business_id=p_business_id and id=p_invoice_id for update;
 if old_status is not null and old_status not in('Draft','Ready') then raise exception 'Issued invoices are immutable; use payment/credit flows instead';end if;
 if trim(coalesce(p_number,''))<>'Draft' and exists(select 1 from public.invoices where business_id=p_business_id and id<>p_invoice_id and invoice_number=trim(p_number)) then raise exception 'Invoice number already exists';end if;
 select coalesce(sum(coalesce((r->>'quantity')::numeric,1)*coalesce((r->>'unitPrice')::numeric,0)*(1+coalesce((r->>'vatRate')::numeric,0)/100)),0) into total from jsonb_array_elements(coalesce(p_lines,'[]')) r;
 payload=jsonb_build_object('issueDate',p_issue_date,'dueDate',p_due_date,'notes',coalesce(p_notes,''),'lines',coalesce(p_lines,'[]'::jsonb),'v2Document',true);
 insert into public.invoices(business_id,id,client_id,invoice_month,invoice_number,status,total,payload,created_by)
 values(p_business_id,p_invoice_id,p_client_id,p_invoice_month,coalesce(nullif(trim(p_number),''),'Draft'),p_status,round(total,2),payload,auth.uid())
 on conflict(business_id,id) do update set client_id=excluded.client_id,invoice_month=excluded.invoice_month,status=excluded.status,total=excluded.total,payload=excluded.payload,updated_at=now();
 perform public.tuinbooks_v2_replace_invoice_lines(p_business_id,p_invoice_id,p_lines);
 return p_invoice_id;
end$$;

create or replace function public.tuinbooks_v2_set_visit_billing_amount(p_business_id uuid,p_visit_id text,p_amount numeric)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;
 if p_amount<0 then raise exception 'Amount cannot be negative';end if;
 update public.schedule_jobs set payload=payload||jsonb_build_object('billingAmountV2',round(p_amount,2),'billingAmountSetAtV2',now()),updated_at=now(),updated_by=auth.uid() where business_id=p_business_id and id=p_visit_id;
 if not found then raise exception 'Visit not found';end if;
end$$;

create or replace function public.tuinbooks_v2_create_invoice_from_facts(p_business_id uuid,p_client_id text,p_invoice_month text,p_issue_date date,p_due_date date,p_visit_ids text[])
returns text language plpgsql security definer set search_path=public,auth as $$
declare
 inv_id text:='inv-v2-'||replace(gen_random_uuid()::text,'-','');
 lines jsonb:='[]';
 v record;fee numeric;vat numeric:=0;routine_added boolean:=false;monthly_mode boolean:=false;
 source_quote text;quote_rows jsonb;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;
 if coalesce(array_length(p_visit_ids,1),0)=0 then raise exception 'Choose billable visits';end if;
 select case when lower(coalesce(settings->'v2'->>'vatRegistered',settings->>'vatRegistered','no')) in('yes','true','1') then coalesce(nullif(settings->'v2'->>'vatRate','')::numeric,nullif(settings->>'vatRate','')::numeric,15) else 0 end into vat from public.businesses where id=p_business_id;
 monthly_mode:=public.tuinbooks_v2_client_monthly_billing(p_business_id,p_client_id);

 for v in
   select j.*,
    case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end vt,
    coalesce(j.payload->>'billingDisposition','routine') bd
   from public.schedule_jobs j where j.business_id=p_business_id and j.client_id=p_client_id and j.id=any(p_visit_ids)
 loop
   if lower(v.status)='cancelled' and v.bd='no-charge' then continue;end if;
   if public.tuinbooks_v2_visit_already_invoiced(p_business_id,v.id,p_client_id,v.visit_date,v.vt) then raise exception 'Visit % is already invoiced',v.id;end if;

   if v.vt='routine' and (lower(v.status)='completed' or (lower(v.status)='cancelled' and v.bd='charge' and monthly_mode)) then
     if not routine_added then
       fee:=public.tuinbooks_v2_visit_default_amount(p_business_id,p_client_id,v.payload);
       if fee is null then raise exception 'Routine billing amount is not configured for this client';end if;
       lines=lines||jsonb_build_array(jsonb_build_object('id','line-routine-'||p_invoice_month,'description','Routine garden service - '||p_invoice_month,'quantity',1,'unitPrice',fee,'vatRate',vat,'sourceVisitId',v.id,'sourceQuoteId',null,'category','routine'));
       routine_added:=true;
     end if;
   elsif v.vt='quoted' then
     source_quote:=nullif(v.payload->>'sourceQuoteId','');quote_rows:=null;
     if source_quote is not null then
       select jsonb_agg(jsonb_build_object('id','line-'||v.id||'-'||ql.id,'description',ql.description,'quantity',ql.quantity,'unitPrice',ql.unit_price,'vatRate',ql.vat_rate,'sourceVisitId',v.id,'sourceQuoteId',source_quote,'category','quoted') order by ql.position,ql.id)
       into quote_rows from public.quote_lines_v2 ql where ql.business_id=p_business_id and ql.quote_id=source_quote;
     end if;
     if jsonb_typeof(quote_rows)='array' and jsonb_array_length(quote_rows)>0 then
       lines=lines||quote_rows;
     else
       if coalesce(v.payload->>'quotedSubtotal','')~'^[0-9]+([.][0-9]+)?$' then fee=(v.payload->>'quotedSubtotal')::numeric;
       elsif coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$' then fee=(v.payload->>'billingAmountV2')::numeric;
       elsif coalesce(v.payload->>'quotedTotal','')~'^[0-9]+([.][0-9]+)?$' then fee=round((v.payload->>'quotedTotal')::numeric/(1+vat/100),2);
       else raise exception 'Quoted visit % has no billing amount',v.id;end if;
       lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description',coalesce(nullif(v.payload->>'task',''),'Quoted work'),'quantity',1,'unitPrice',fee,'vatRate',vat,'sourceVisitId',v.id,'sourceQuoteId',source_quote,'category','quoted'));
     end if;
   elsif lower(v.status)='cancelled' and v.bd='charge' and v.vt='routine' then
     fee:=public.tuinbooks_v2_visit_default_amount(p_business_id,p_client_id,v.payload);
     if fee is null then raise exception 'Routine billing amount is not configured for chargeable cancellation %',v.id;end if;
     lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description','Chargeable cancellation','quantity',1,'unitPrice',fee,'vatRate',vat,'sourceVisitId',v.id,'sourceQuoteId',null,'category','cancellation'));
   else
     -- Additional visits are intentionally priced in Billing after the work is known.
     if not(coalesce(v.payload->>'billingAmountV2','')~'^[0-9]+([.][0-9]+)?$') then raise exception 'Set the Billing amount for visit % before invoicing',v.id;end if;
     fee=(v.payload->>'billingAmountV2')::numeric;
     lines=lines||jsonb_build_array(jsonb_build_object('id','line-'||v.id,'description',coalesce(nullif(v.payload->>'task',''),'Additional visit'),'quantity',1,'unitPrice',fee,'vatRate',vat,'sourceVisitId',v.id,'sourceQuoteId',null,'category','additional'));
   end if;
 end loop;

 if jsonb_array_length(lines)=0 then raise exception 'No billable lines were produced from the selected visits';end if;
 perform public.tuinbooks_v2_save_invoice(p_business_id,inv_id,p_client_id,p_invoice_month,p_issue_date,p_due_date,'Draft','Draft',lines,'Created from Billing review');
 -- One monthly fee covers all selected routine occurrences, even though only one
 -- visible invoice line carries the fee.
 if monthly_mode and routine_added then
   insert into public.invoice_visit_links_v2(business_id,source_visit_id,invoice_id,category)
   select p_business_id,j.id,inv_id,'routine' from public.schedule_jobs j
   where j.business_id=p_business_id and j.client_id=p_client_id and j.id=any(p_visit_ids)
     and not(lower(j.status)='cancelled' and coalesce(j.payload->>'billingDisposition','routine')='no-charge')
     and case when lower(coalesce(j.payload->>'visitType',j.payload->>'workKind','')) like '%additional%' then 'additional' when lower(coalesce(j.payload->>'visitType',j.payload->>'revenueType','')) like '%quote%' then 'quoted' else 'routine' end='routine'
   on conflict(business_id,source_visit_id) do nothing;
 end if;
 return inv_id;
end$$;

create or replace function public.tuinbooks_v2_record_payment(p_business_id uuid,p_payment_id text,p_invoice_id text,p_date date,p_amount numeric,p_method text,p_reference text,p_note text)
returns text language plpgsql security definer set search_path=public,auth as $$
declare inv public.invoices%rowtype;paid numeric;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;
 select * into inv from public.invoices where business_id=p_business_id and id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found';end if;
 if p_amount<=0 then raise exception 'Payment must be positive';end if;
 select coalesce(sum(amount),0) into paid from public.payments_v2 where business_id=p_business_id and invoice_id=p_invoice_id and reversed_at is null;
 if p_amount>inv.total-paid+.01 then raise exception 'Payment exceeds outstanding balance';end if;
 insert into public.payments_v2(business_id,id,client_id,invoice_id,payment_date,amount,method,reference,note,created_by)
 values(p_business_id,p_payment_id,inv.client_id,p_invoice_id,p_date,round(p_amount,2),coalesce(nullif(trim(p_method),''),'Other'),coalesce(trim(p_reference),''),coalesce(trim(p_note),''),auth.uid());
 paid=paid+p_amount;
 update public.invoices set status=case when paid>=total-.01 then 'Paid' else 'Partially paid' end,updated_at=now() where business_id=p_business_id and id=p_invoice_id;
 return p_payment_id;
end$$;

create or replace function public.tuinbooks_v2_reverse_payment(p_business_id uuid,p_payment_id text,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare iid text;paid numeric;tot numeric;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;
 update public.payments_v2 set reversed_at=now(),reversal_reason=coalesce(nullif(trim(p_reason),''),'Reversed'),updated_at=now() where business_id=p_business_id and id=p_payment_id and reversed_at is null returning invoice_id into iid;
 if iid is null then raise exception 'Active payment not found';end if;
 select total into tot from public.invoices where business_id=p_business_id and id=iid;
 select coalesce(sum(amount),0) into paid from public.payments_v2 where business_id=p_business_id and invoice_id=iid and reversed_at is null;
 update public.invoices set status=case when paid>=tot-.01 then 'Paid' when paid>0 then 'Partially paid' else 'Sent' end,updated_at=now() where business_id=p_business_id and id=iid;
end$$;

create or replace function public.tuinbooks_v2_set_invoice_status(p_business_id uuid,p_invoice_id text,p_status text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare inv public.invoices%rowtype;
begin
 if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
 if not public.tuinbooks_v2_financials_enabled(p_business_id) then raise exception 'Billing is disabled in Planning-only mode';end if;
 if p_status not in('Ready','Sent','Void') then raise exception 'Invalid invoice transition';end if;
 select * into inv from public.invoices where business_id=p_business_id and id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found';end if;
 if inv.status not in('Draft','Ready') then raise exception 'Issued invoices are immutable';end if;
 if p_status='Sent' and coalesce(inv.invoice_number,'Draft')='Draft' then raise exception 'Set an invoice number before sending';end if;
 update public.invoices set status=p_status,updated_at=now(),payload=payload||case when p_status='Sent' then jsonb_build_object('sentAt',now(),'deliveryStatus','Sent') else '{}'::jsonb end where business_id=p_business_id and id=p_invoice_id;
end$$;

-- Helpers are internal implementation details. Only the public money RPCs below
-- are callable by authenticated clients.
revoke all on function public.tuinbooks_v2_money_lines_json(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.tuinbooks_v2_client_monthly_billing(uuid,text) from public,anon,authenticated;
revoke all on function public.tuinbooks_v2_visit_default_amount(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.tuinbooks_v2_visit_already_invoiced(uuid,text,text,date,text) from public,anon,authenticated;
revoke all on function public.tuinbooks_v2_replace_quote_lines(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.tuinbooks_v2_replace_invoice_lines(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.tuinbooks_v2_load_money_workspace(uuid) from public,anon;
revoke all on function public.tuinbooks_v2_save_quote(uuid,text,text,date,date,text,text,jsonb,text) from public,anon;
revoke all on function public.tuinbooks_v2_set_quote_status(uuid,text,text) from public,anon;
revoke all on function public.tuinbooks_v2_queue_accepted_quote(uuid,text) from public,anon;
revoke all on function public.tuinbooks_v2_save_invoice(uuid,text,text,text,date,date,text,text,jsonb,text) from public,anon;
revoke all on function public.tuinbooks_v2_set_invoice_status(uuid,text,text) from public,anon;
revoke all on function public.tuinbooks_v2_set_visit_billing_amount(uuid,text,numeric) from public,anon;
revoke all on function public.tuinbooks_v2_create_invoice_from_facts(uuid,text,text,date,date,text[]) from public,anon;
revoke all on function public.tuinbooks_v2_record_payment(uuid,text,text,date,numeric,text,text,text) from public,anon;
revoke all on function public.tuinbooks_v2_reverse_payment(uuid,text,text) from public,anon;

grant execute on function public.tuinbooks_v2_load_money_workspace(uuid) to authenticated;
grant execute on function public.tuinbooks_v2_save_quote(uuid,text,text,date,date,text,text,jsonb,text) to authenticated;
grant execute on function public.tuinbooks_v2_set_quote_status(uuid,text,text) to authenticated;
grant execute on function public.tuinbooks_v2_queue_accepted_quote(uuid,text) to authenticated;
grant execute on function public.tuinbooks_v2_save_invoice(uuid,text,text,text,date,date,text,text,jsonb,text) to authenticated;
grant execute on function public.tuinbooks_v2_set_invoice_status(uuid,text,text) to authenticated;
grant execute on function public.tuinbooks_v2_set_visit_billing_amount(uuid,text,numeric) to authenticated;
grant execute on function public.tuinbooks_v2_create_invoice_from_facts(uuid,text,text,date,date,text[]) to authenticated;
grant execute on function public.tuinbooks_v2_record_payment(uuid,text,text,date,numeric,text,text,text) to authenticated;
grant execute on function public.tuinbooks_v2_reverse_payment(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
