-- TuinBooks R31 recovery authority
-- Canonical repair for defects proven by the 7 Sep medium stress test.
-- Re-runnable. This is source-of-truth repair, not a runtime overlay.

begin;

-- ---------------------------------------------------------------------------
-- PERMANENT FIELD PIN GENERATION
-- Fix PL/pgSQL ambiguity caused by RETURNS TABLE(team_id ...) colliding with
-- ON CONFLICT(business_id,team_id). Target the named primary-key constraint.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_generate_field_pin(p_business_id uuid,p_team_id text)
returns table(team_id text,team_name text,pin text)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_pin text;
  v_name text;
  n integer;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required';end if;
  select t.name into v_name
  from public.teams t
  where t.business_id=p_business_id and t.id=p_team_id and t.active=true;
  if v_name is null then raise exception 'Active team not found';end if;

  for n in 1..100 loop
    v_pin:=lpad((floor(random()*10000))::integer::text,4,'0');
    begin
      insert into public.mobile_team_pins_v2(business_id,team_id,pin,active,created_by)
      values(p_business_id,p_team_id,v_pin,true,auth.uid())
      on conflict on constraint mobile_team_pins_v2_pkey
      do update set pin=excluded.pin,active=true,created_by=auth.uid(),updated_at=now();
      exit;
    exception when unique_violation then
      v_pin:=null;
    end;
  end loop;

  if v_pin is null then raise exception 'Could not generate a unique field PIN';end if;
  insert into public.audit_events(business_id,actor_user_id,entity_type,entity_id,action,details)
  values(p_business_id,auth.uid(),'field_pin',p_team_id,'v2_field_pin_generated',jsonb_build_object('team_id',p_team_id));
  return query select p_team_id,v_name,v_pin;
end;
$$;

revoke all on function public.tuinbooks_v2_generate_field_pin(uuid,text) from public,anon;
grant execute on function public.tuinbooks_v2_generate_field_pin(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- SECURE PUBLIC DOCUMENTS
-- pgcrypto is installed in the extensions schema in Supabase. Explicitly
-- qualify cryptographic functions so RPC execution does not depend on the
-- session search_path.
-- ---------------------------------------------------------------------------
create or replace function public.tuinbooks_v2_create_public_document(
 p_business_id uuid,p_document_type text,p_document_id text,p_client_id text,p_snapshot jsonb,p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path=public,auth,extensions
as $$
declare
  v_token text:=encode(extensions.gen_random_bytes(24),'hex');
  v_id uuid;
begin
  if not public.tuinbooks_v2_can_financial_edit(p_business_id) then raise exception 'Financial edit access required';end if;
  if p_document_type not in('quote','invoice','statement') then raise exception 'Invalid document type';end if;
  if p_expires_at<=now() then raise exception 'Expiry must be in the future';end if;
  if jsonb_typeof(p_snapshot)<>'object' then raise exception 'Document snapshot is required';end if;
  if not exists(select 1 from public.customers where business_id=p_business_id and id=p_client_id) then raise exception 'Client not found';end if;

  update public.public_documents_v2
  set status='revoked'
  where business_id=p_business_id and document_type=p_document_type and document_id=p_document_id and status='active';

  insert into public.public_documents_v2(token_hash,business_id,document_type,document_id,client_id,snapshot,expires_at,created_by)
  values(encode(extensions.digest(v_token,'sha256'),'hex'),p_business_id,p_document_type,p_document_id,p_client_id,p_snapshot,p_expires_at,auth.uid())
  returning id into v_id;

  return jsonb_build_object('id',v_id,'token',v_token,'expires_at',p_expires_at);
end;
$$;

create or replace function public.tuinbooks_v2_get_public_document(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare r public.public_documents_v2%rowtype;
begin
  select * into r
  from public.public_documents_v2
  where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex');
  if not found then return jsonb_build_object('ok',false,'error','invalid');end if;
  if r.status='revoked' then return jsonb_build_object('ok',false,'error','revoked');end if;
  if r.expires_at<=now() then
    update public.public_documents_v2 set status='expired' where id=r.id and status='active';
    return jsonb_build_object('ok',false,'error','expired');
  end if;
  return jsonb_build_object('ok',true,'document_type',r.document_type,'document_id',r.document_id,'snapshot',r.snapshot,'status',r.status,'response',r.response,'responded_by_name',r.responded_by_name,'response_note',r.response_note,'responded_at',r.responded_at,'expires_at',r.expires_at);
end;
$$;

create or replace function public.tuinbooks_v2_respond_public_quote(p_token text,p_decision text,p_customer_name text,p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path=public,auth,extensions
as $$
declare
  r public.public_documents_v2%rowtype;
  v_quote_status text;
begin
  if p_decision not in('accepted','changes_requested','declined') then raise exception 'Invalid response';end if;
  if nullif(trim(p_customer_name),'') is null then raise exception 'Your name is required';end if;

  select * into r
  from public.public_documents_v2
  where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
  for update;

  if not found or r.document_type<>'quote' then return jsonb_build_object('ok',false,'error','invalid');end if;
  if r.expires_at<=now() then
    update public.public_documents_v2 set status='expired' where id=r.id;
    return jsonb_build_object('ok',false,'error','expired');
  end if;
  if r.status='responded' then return jsonb_build_object('ok',true,'status',r.response,'already_recorded',true);end if;

  v_quote_status:=case when p_decision='accepted' then 'Accepted' when p_decision='declined' then 'Declined' else 'Changes requested' end;
  update public.public_documents_v2
  set status='responded',response=p_decision,responded_by_name=trim(p_customer_name),response_note=coalesce(p_note,''),responded_at=now()
  where id=r.id;

  update public.quotes
  set status=v_quote_status,updated_at=now(),payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
    'customerResponse',p_decision,'respondedAt',now(),'acceptedAt',case when p_decision='accepted' then now() else null end,
    'acceptedBy',trim(p_customer_name),'customerResponseNote',coalesce(p_note,''))
  where business_id=r.business_id and id=r.document_id;
  if not found then return jsonb_build_object('ok',false,'error','quote_not_found');end if;

  -- R29+ automatically queues an accepted quote when its payment condition is met.
  -- Keep the call optional so the canonical base remains installable before R29.
  if p_decision='accepted' and to_regprocedure('public.tuinbooks_v2_queue_quote_if_eligible_v29(uuid,text)') is not null then
    execute 'select public.tuinbooks_v2_queue_quote_if_eligible_v29($1,$2)' using r.business_id,r.document_id;
  end if;

  insert into public.audit_events(business_id,entity_type,entity_id,action,details)
  values(r.business_id,'quote',r.document_id,'v2_public_quote_response',jsonb_build_object('decision',p_decision,'customer_name',trim(p_customer_name),'public_document_id',r.id));
  return jsonb_build_object('ok',true,'status',p_decision);
end;
$$;

revoke all on function public.tuinbooks_v2_create_public_document(uuid,text,text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.tuinbooks_v2_create_public_document(uuid,text,text,text,jsonb,timestamptz) to authenticated;
revoke all on function public.tuinbooks_v2_get_public_document(text) from public;
grant execute on function public.tuinbooks_v2_get_public_document(text) to anon,authenticated;
revoke all on function public.tuinbooks_v2_respond_public_quote(text,text,text,text) from public;
grant execute on function public.tuinbooks_v2_respond_public_quote(text,text,text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
