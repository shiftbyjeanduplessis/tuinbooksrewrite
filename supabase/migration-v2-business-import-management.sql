-- TuinBooks v2 Milestone 8: Business settings, v4 workbook import/export and Management support.
-- SQLFIX1: explicit non-keyword aliases in v4 route export query.
-- ADDITIVE. Requires M3-M7 v2 migrations. Does not remove or rewrite legacy tables.
begin;

create table if not exists public.business_services_v2(
  business_id uuid not null references public.businesses(id) on delete cascade,
  id text not null,
  name text not null,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(business_id,id)
);
alter table public.business_services_v2 enable row level security;
drop policy if exists business_services_v2_select on public.business_services_v2;
create policy business_services_v2_select on public.business_services_v2 for select to authenticated using(public.is_business_admin(business_id));
grant select on public.business_services_v2 to authenticated;
revoke insert,update,delete on public.business_services_v2 from authenticated;

create or replace function public.tuinbooks_v2_load_business_workspace(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
 select * into b from public.businesses where id=p_business_id;if not found then raise exception 'Business not found';end if;
 return jsonb_build_object(
  'business',jsonb_build_object('id',b.id,'name',b.name,'phone',b.phone,'email',b.email,'address',b.address),
  'settings',coalesce(b.settings->'v2','{}'::jsonb),
  'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'notes',s.notes,'active',s.active) order by s.name) from public.business_services_v2 s where s.business_id=p_business_id),'[]'::jsonb),
  'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'capacity_hours',t.capacity_hours,'buffer_hours',t.buffer_hours,'active',t.active) order by t.name) from public.teams t where t.business_id=p_business_id),'[]'::jsonb)
 );
end;$$;

create or replace function public.tuinbooks_v2_save_business_settings(p_business_id uuid,p_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare n text:=trim(coalesce(p_settings->>'name',''));
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;if n='' then raise exception 'Business name is required';end if;
 update public.businesses set name=n,phone=trim(coalesce(p_settings->>'phone','')),email=lower(trim(coalesce(p_settings->>'email',''))),address=trim(coalesce(p_settings->>'address','')),settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{v2}',p_settings-'name'-'phone'-'email'-'address',true),updated_at=now() where id=p_business_id;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'business',p_business_id::text,'v2_business_settings_saved',jsonb_build_object('mode',p_settings->>'mode'));
 return jsonb_build_object('ok',true);
end;$$;

create or replace function public.tuinbooks_v2_save_business_service(p_business_id uuid,p_id text,p_name text,p_notes text,p_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;if trim(coalesce(p_id,''))='' or trim(coalesce(p_name,''))='' then raise exception 'Service id and name are required';end if;
 insert into public.business_services_v2(business_id,id,name,notes,active) values(p_business_id,trim(p_id),trim(p_name),coalesce(trim(p_notes),''),coalesce(p_active,true)) on conflict(business_id,id) do update set name=excluded.name,notes=excluded.notes,active=excluded.active,updated_at=now();
 return jsonb_build_object('id',trim(p_id));
end;$$;

create or replace function public.tuinbooks_v2_save_business_team(p_business_id uuid,p_id text,p_name text,p_capacity_hours numeric,p_buffer_hours numeric,p_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;if trim(coalesce(p_id,''))='' or trim(coalesce(p_name,''))='' then raise exception 'Team id and name are required';end if;if coalesce(p_capacity_hours,0)<=0 or coalesce(p_capacity_hours,0)>24 then raise exception 'Capacity must be between 0 and 24 hours';end if;if coalesce(p_buffer_hours,0)<0 or coalesce(p_buffer_hours,0)>8 then raise exception 'Buffer must be between 0 and 8 hours';end if;
 insert into public.teams(business_id,id,name,capacity_hours,buffer_hours,active) values(p_business_id,trim(p_id),trim(p_name),p_capacity_hours,p_buffer_hours,coalesce(p_active,true)) on conflict(business_id,id) do update set name=excluded.name,capacity_hours=excluded.capacity_hours,buffer_hours=excluded.buffer_hours,active=excluded.active,updated_at=now();return jsonb_build_object('id',trim(p_id));
end;$$;

create or replace function public.tuinbooks_v2_import_v4_snapshot(p_business_id uuid,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;v_id text;v_client text;v_site text;v_team text;v_service text;v_weekdays smallint[];v_fee numeric;v_weeka date;v_day integer;v_stop integer;v_label text;v_routes jsonb;v_accounts integer:=0;v_sites integer:=0;v_teams integer:=0;v_services integer:=0;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;
 if jsonb_typeof(p_snapshot)<>'object' then raise exception 'Invalid v4 snapshot';end if;
 if trim(coalesce(p_snapshot#>>'{business,name}',''))='' then raise exception 'Business Name is required';end if;
 v_weeka=nullif(p_snapshot#>>'{business,weekAStartsOn}','')::date;
 perform public.tuinbooks_v2_save_business_settings(p_business_id,coalesce(p_snapshot->'business','{}'::jsonb));
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'services','[]'::jsonb)) loop
   v_id=coalesce(nullif(r->>'id',''),'svc-v2-'||substr(md5(lower(r->>'name')),1,16));perform public.tuinbooks_v2_save_business_service(p_business_id,v_id,r->>'name',r->>'notes',coalesce((r->>'active')::boolean,true));v_services:=v_services+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'teams','[]'::jsonb)) loop
   v_id=coalesce(nullif(r->>'id',''),'team-v2-'||substr(md5(lower(r->>'name')),1,16));perform public.tuinbooks_v2_save_business_team(p_business_id,v_id,r->>'name',coalesce((r->>'capacityHours')::numeric,8),coalesce((r->>'bufferHours')::numeric,1),coalesce((r->>'active')::boolean,true));v_teams:=v_teams+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'accounts','[]'::jsonb)) loop
   select id into v_client from public.customers where business_id=p_business_id and lower(name)=lower(r->>'name') order by updated_at desc limit 1;v_client=coalesce(v_client,'client-v2-'||substr(md5(lower(r->>'name')),1,20));
   perform public.tuinbooks_v2_save_account(p_business_id,v_client,r->>'name','active',r->>'contactName',r->>'phone',r->>'email');
   update public.customers set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('v2Billing',jsonb_build_object('invoiceMethod',r->>'invoiceMethod','billingBasis',r->>'billingBasis','billingAmount',r->'billingAmount','invoiceDay',r->'invoiceDay','billingNotes',r->>'billingNotes')) where business_id=p_business_id and id=v_client;v_accounts:=v_accounts+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'locations','[]'::jsonb)) loop
   select id into v_client from public.customers where business_id=p_business_id and lower(name)=lower(r->>'accountName') limit 1;if v_client is null then raise exception 'Import account not found: %',r->>'accountName';end if;
   select id into v_team from public.teams where business_id=p_business_id and lower(name)=lower(r->>'team') limit 1;if v_team is null then raise exception 'Import team not found: %',r->>'team';end if;
   select id into v_service from public.business_services_v2 where business_id=p_business_id and lower(name)=lower(r->>'service') limit 1;if v_service is null then raise exception 'Import service not found: %',r->>'service';end if;
   select id into v_site from public.service_sites where business_id=p_business_id and customer_id=v_client and (lower(address)=lower(r->>'address') or (lower(site_name)=lower(r->>'locationName') and lower(coalesce(suburb,''))=lower(coalesce(r->>'suburb','')))) order by updated_at desc limit 1;v_site=coalesce(v_site,'site-v2-'||substr(md5(lower(v_client||'|'||coalesce(r->>'locationName','')||'|'||r->>'address')),1,20));
   perform public.tuinbooks_v2_save_service_location(p_business_id,v_site,v_client,r->>'locationName',r->>'address',r->>'suburb',r->>'accessNotes',r->>'routingNotes',true);
   v_routes=(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(p_snapshot->'routes','[]'::jsonb)) x where lower(x->>'accountName')=lower(r->>'accountName') and (lower(x->>'address')=lower(r->>'address') or lower(x->>'locationName')=lower(r->>'locationName')));
   update public.service_sites set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('v2Import',jsonb_build_object('routePreference',r->>'routePreference','locationBillingBasis',r->>'locationBillingBasis','locationBillingAmount',r->'locationBillingAmount','fortnightlyCycle',r->>'fortnightlyCycle','routes',v_routes)) where business_id=p_business_id and id=v_site;
   select array_agg(value::smallint order by ord) into v_weekdays from jsonb_array_elements_text(coalesce(r->'weekdays','[]'::jsonb)) with ordinality q(value,ord);v_fee=nullif(r->>'locationBillingAmount','')::numeric;
   perform public.tuinbooks_v2_save_service_agreement(p_business_id,'agr-v2-'||substr(md5(v_site),1,20),v_client,v_site,'active',(r->>'startDate')::date,null,r->>'frequency',coalesce(v_weekdays,'{}'::smallint[]),nullif(r->>'monthlyOrdinal','')::integer,v_team,60,array[v_service],coalesce(r->>'routingNotes',''),v_fee,current_date);v_sites:=v_sites+1;
 end loop;
 -- Apply approved route order to generated horizon without rewriting historical/completed work.
 for r in select value from jsonb_array_elements(coalesce(p_snapshot->'routes','[]'::jsonb)) loop
   select id into v_client from public.customers where business_id=p_business_id and lower(name)=lower(r->>'accountName') limit 1;select id into v_team from public.teams where business_id=p_business_id and lower(name)=lower(r->>'team') limit 1;select id into v_site from public.service_sites where business_id=p_business_id and customer_id=v_client and (lower(address)=lower(r->>'address') or lower(site_name)=lower(r->>'locationName')) limit 1;v_day=case lower(r->>'day') when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3 when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6 when 'sunday' then 7 else null end;v_stop=coalesce(nullif(r->>'approvedStop','')::integer,99);v_label=coalesce(r->>'week','');
   if v_client is not null and v_team is not null and v_site is not null and v_day is not null then update public.schedule_jobs j set sort_order=v_stop*100,updated_at=now() where j.business_id=p_business_id and j.client_id=v_client and j.team_id=v_team and j.payload->>'serviceLocationId'=v_site and lower(j.status)='scheduled' and j.visit_date>=current_date and extract(isodow from j.visit_date)::integer=v_day and (v_label='' or (lower(v_label)='week a' and v_weeka is not null and mod(((date_trunc('week',j.visit_date)::date-v_weeka)/7),2)=0) or (lower(v_label)='week b' and v_weeka is not null and mod(((date_trunc('week',j.visit_date)::date-v_weeka)/7),2)<>0) or (lower(v_label)~'^week [1-5]$' and ceil(extract(day from j.visit_date)/7.0)::integer=substring(v_label from '[1-5]')::integer));end if;
 end loop;
 insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details) values(p_business_id,auth.uid(),'business',p_business_id::text,'v2_v4_import',jsonb_build_object('accounts',v_accounts,'locations',v_sites,'teams',v_teams,'services',v_services));return jsonb_build_object('accounts',v_accounts,'locations',v_sites,'teams',v_teams,'services',v_services);
end;$$;

create or replace function public.tuinbooks_v2_export_v4_data(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype;v2 jsonb;
begin
 if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;select * into b from public.businesses where id=p_business_id;v2=coalesce(b.settings->'v2','{}'::jsonb);
 return jsonb_build_object(
 'business',jsonb_build_object('name',b.name,'phone',b.phone,'email',b.email,'address',b.address,'suburb',coalesce(v2->>'suburb',''),'province',coalesce(v2->>'province',''),'vatRegistered',coalesce((v2->>'vatRegistered')::boolean,false),'vatNumber',coalesce(v2->>'vatNumber',''),'mode',coalesce(v2->>'mode','financials'),'weekAStartsOn',v2->>'weekAStartsOn','invoiceDay',coalesce((v2->>'invoiceDay')::integer,28),'paymentTermsDays',coalesce((v2->>'paymentTermsDays')::integer,7),'invoicePrefix',coalesce(v2->>'invoicePrefix','INV-'),'statementMessage',coalesce(v2->>'statementMessage',''),'emailFromName',coalesce(v2->>'emailFromName',b.name),'whatsappMessage',coalesce(v2->>'whatsappMessage','')),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'notes',s.notes,'active',s.active) order by s.name) from public.business_services_v2 s where s.business_id=p_business_id),'[]'::jsonb),
 'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'capacityHours',t.capacity_hours,'bufferHours',t.buffer_hours,'active',t.active) order by t.name) from public.teams t where t.business_id=p_business_id),'[]'::jsonb),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'contactName',c.contact_name,'phone',c.phone,'email',c.email,'invoiceMethod',coalesce(c.payload#>>'{v2Billing,invoiceMethod}','By Account'),'billingBasis',coalesce(c.payload#>>'{v2Billing,billingBasis}','Monthly fixed fee'),'billingAmount',c.payload#>'{v2Billing,billingAmount}','invoiceDay',c.payload#>'{v2Billing,invoiceDay}','billingNotes',coalesce(c.payload#>>'{v2Billing,billingNotes}','')) order by c.name) from public.customers c where c.business_id=p_business_id and c.status<>'archived'),'[]'::jsonb),
 'locations',coalesce((select jsonb_agg(jsonb_build_object('accountName',c.name,'locationName',s.site_name,'address',s.address,'suburb',s.suburb,'team',t.name,'service',coalesce(bs.name,a.service_ids[1],'Garden service'),'frequency',a.frequency,'weekdays',a.weekdays,'fortnightlyCycle',s.payload#>>'{v2Import,fortnightlyCycle}','monthlyOrdinal',a.monthly_ordinal,'startDate',a.start_date,'locationBillingBasis',coalesce(s.payload#>>'{v2Import,locationBillingBasis}',''),'locationBillingAmount',s.payload#>'{v2Import,locationBillingAmount}','routePreference',coalesce(s.payload#>>'{v2Import,routePreference}','Normal'),'routingNotes',a.notes,'accessNotes',s.access_notes) order by c.name,s.site_name) from public.service_sites s join public.customers c on c.business_id=s.business_id and c.id=s.customer_id left join public.client_service_agreements_v2 a on a.business_id=s.business_id and a.service_site_id=s.id and a.status='active' left join public.teams t on t.business_id=s.business_id and t.id=a.default_team_id left join public.business_services_v2 bs on bs.business_id=s.business_id and bs.id=a.service_ids[1] where s.business_id=p_business_id and s.active=true),'[]'::jsonb),
 'routes',coalesce((
  select jsonb_agg(q.row_json order by q.team_name,q.day_num,q.week_label,q.stop_order)
  from (
    select distinct on (
      t.name,
      extract(isodow from j.visit_date),
      c.name,
      s.id,
      case
        when a.frequency='monthly' then 'Week '||ceil(extract(day from j.visit_date)/7.0)::integer::text
        else case
          when (v2->>'weekAStartsOn') is not null
           and mod(((date_trunc('week',j.visit_date)::date-(v2->>'weekAStartsOn')::date)/7),2)=0 then 'Week A'
          else 'Week B'
        end
      end
    )
      t.name as team_name,
      extract(isodow from j.visit_date)::integer as day_num,
      case extract(isodow from j.visit_date)::integer
        when 1 then 'Monday' when 2 then 'Tuesday' when 3 then 'Wednesday'
        when 4 then 'Thursday' when 5 then 'Friday' when 6 then 'Saturday'
        else 'Sunday'
      end as day_name,
      case
        when a.frequency='monthly' then 'Week '||ceil(extract(day from j.visit_date)/7.0)::integer::text
        else case
          when (v2->>'weekAStartsOn') is not null
           and mod(((date_trunc('week',j.visit_date)::date-(v2->>'weekAStartsOn')::date)/7),2)=0 then 'Week A'
          else 'Week B'
        end
      end as week_label,
      j.sort_order as stop_order,
      jsonb_build_object(
        'team',t.name,
        'day',case extract(isodow from j.visit_date)::integer
          when 1 then 'Monday' when 2 then 'Tuesday' when 3 then 'Wednesday'
          when 4 then 'Thursday' when 5 then 'Friday' when 6 then 'Saturday'
          else 'Sunday'
        end,
        'week',case
          when a.frequency='monthly' then 'Week '||ceil(extract(day from j.visit_date)/7.0)::integer::text
          else case
            when (v2->>'weekAStartsOn') is not null
             and mod(((date_trunc('week',j.visit_date)::date-(v2->>'weekAStartsOn')::date)/7),2)=0 then 'Week A'
            else 'Week B'
          end
        end,
        'approvedStop',greatest(1,round(j.sort_order/100.0)),
        'accountName',c.name,
        'locationName',s.site_name,
        'suburb',s.suburb,
        'address',s.address
      ) as row_json
    from public.schedule_jobs j
    join public.teams t on t.business_id=j.business_id and t.id=j.team_id
    join public.customers c on c.business_id=j.business_id and c.id=j.client_id
    join public.service_sites s on s.business_id=j.business_id and s.id::text=j.payload->>'serviceLocationId'
    left join public.client_service_agreements_v2 a on a.business_id=s.business_id and a.service_site_id=s.id and a.status='active'
    where j.business_id=p_business_id
      and j.visit_date between current_date and current_date+55
      and lower(j.status)='scheduled'
    order by
      t.name,
      extract(isodow from j.visit_date),
      c.name,
      s.id,
      case
        when a.frequency='monthly' then 'Week '||ceil(extract(day from j.visit_date)/7.0)::integer::text
        else case
          when (v2->>'weekAStartsOn') is not null
           and mod(((date_trunc('week',j.visit_date)::date-(v2->>'weekAStartsOn')::date)/7),2)=0 then 'Week A'
          else 'Week B'
        end
      end,
      j.visit_date
  ) q
),'[]'::jsonb)
 );
end;$$;

-- Management: uses the existing platform-staff/support-grant authority if installed.
create or replace function public.tuinbooks_v2_management_current_staff()
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record;begin if to_regclass('public.tuinbooks_platform_staff') is null then raise exception 'Platform staff authority is not installed';end if;select user_id,staff_role,active into r from public.tuinbooks_platform_staff where user_id=auth.uid() and active=true;if not found then raise exception 'Not authorised as platform staff';end if;return jsonb_build_object('userId',r.user_id,'staffRole',r.staff_role,'displayName',r.staff_role);end;$$;

create or replace function public.tuinbooks_v2_management_list_businesses(p_search text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare ok boolean;begin select exists(select 1 from public.tuinbooks_platform_staff where user_id=auth.uid() and active=true) into ok;if not ok then raise exception 'Not authorised as platform staff';end if;return coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'phone',b.phone,'email',b.email,'onboardingComplete',b.onboarding_complete,'createdAt',b.created_at,'support',case when g.business_id is null then null else jsonb_build_object('status',g.status,'expiresAt',g.expires_at,'operationalRead',g.allow_operational_read,'operationalEdit',g.allow_operational_edit,'financialRead',g.allow_financial_read,'financialEdit',g.allow_financial_edit) end,'health',jsonb_build_object('clients',(select count(*) from public.customers c where c.business_id=b.id and c.status<>'archived'),'locations',(select count(*) from public.service_sites s where s.business_id=b.id and s.active),'teams',(select count(*) from public.teams t where t.business_id=b.id and t.active),'futureVisits',(select count(*) from public.schedule_jobs j where j.business_id=b.id and j.visit_date>=current_date and lower(j.status)='scheduled'),'openInvoices',(select count(*) from public.invoices i where i.business_id=b.id and lower(i.status) not in('paid','void','credited')))) order by b.name) from public.businesses b left join lateral(select * from public.tuinbooks_support_grants x where x.business_id=b.id and x.support_user_id=auth.uid() order by x.expires_at desc nulls first limit 1) g on true where coalesce(p_search,'')='' or b.name ilike '%'||p_search||'%' or b.email ilike '%'||p_search||'%'),'[]'::jsonb);end;$$;

create or replace function public.tuinbooks_v2_management_set_support_grant(p_business_id uuid,p_status text,p_expires_at timestamptz,p_operational_read boolean,p_operational_edit boolean,p_financial_read boolean,p_financial_edit boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare role text;begin select staff_role into role from public.tuinbooks_platform_staff where user_id=auth.uid() and active=true;if role is null then raise exception 'Not authorised as platform staff';end if;if p_status not in('active','revoked') then raise exception 'Invalid support status';end if;update public.tuinbooks_support_grants set status=p_status,starts_at=case when p_status='active' then least(coalesce(starts_at,now()),now()) else starts_at end,expires_at=p_expires_at,allow_operational_read=coalesce(p_operational_read,false) or coalesce(p_operational_edit,false),allow_operational_edit=coalesce(p_operational_edit,false),allow_financial_read=coalesce(p_financial_read,false) or coalesce(p_financial_edit,false),allow_financial_edit=coalesce(p_financial_edit,false) where business_id=p_business_id and support_user_id=auth.uid();if not found then insert into public.tuinbooks_support_grants(business_id,support_user_id,status,reason,starts_at,expires_at,allow_operational_read,allow_operational_edit,allow_financial_read,allow_financial_edit) values(p_business_id,auth.uid(),p_status,'TuinBooks v2 support',now(),p_expires_at,coalesce(p_operational_read,false) or coalesce(p_operational_edit,false),coalesce(p_operational_edit,false),coalesce(p_financial_read,false) or coalesce(p_financial_edit,false),coalesce(p_financial_edit,false));end if;return jsonb_build_object('ok',true);end;$$;

revoke all on function public.tuinbooks_v2_load_business_workspace(uuid) from public,anon;
revoke all on function public.tuinbooks_v2_save_business_settings(uuid,jsonb) from public,anon;
revoke all on function public.tuinbooks_v2_save_business_service(uuid,text,text,text,boolean) from public,anon;
revoke all on function public.tuinbooks_v2_save_business_team(uuid,text,text,numeric,numeric,boolean) from public,anon;
revoke all on function public.tuinbooks_v2_import_v4_snapshot(uuid,jsonb) from public,anon;
revoke all on function public.tuinbooks_v2_export_v4_data(uuid) from public,anon;
revoke all on function public.tuinbooks_v2_management_current_staff() from public,anon;
revoke all on function public.tuinbooks_v2_management_list_businesses(text) from public,anon;
revoke all on function public.tuinbooks_v2_management_set_support_grant(uuid,text,timestamptz,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.tuinbooks_v2_load_business_workspace(uuid),public.tuinbooks_v2_save_business_settings(uuid,jsonb),public.tuinbooks_v2_save_business_service(uuid,text,text,text,boolean),public.tuinbooks_v2_save_business_team(uuid,text,text,numeric,numeric,boolean),public.tuinbooks_v2_import_v4_snapshot(uuid,jsonb),public.tuinbooks_v2_export_v4_data(uuid),public.tuinbooks_v2_management_current_staff(),public.tuinbooks_v2_management_list_businesses(text),public.tuinbooks_v2_management_set_support_grant(uuid,text,timestamptz,boolean,boolean,boolean,boolean) to authenticated;
commit;
