-- TuinBooks v55.5.0: four-digit, office-managed field-phone pairing
-- Run once in Supabase SQL Editor after the existing v45 mobile-pairing migration.
--
-- The four-digit PIN is used once to pair the browser on the field phone.
-- The resulting field-device session remains active on that browser until the
-- office changes the assigned team or disables the field-device user.

begin;

create extension if not exists pgcrypto;

create table if not exists public.mobile_pairing_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.mobile_pairing_attempts enable row level security;
-- No direct client policy is intentionally created. The security-definer
-- claim function is the only supported access path.

create or replace function public.create_mobile_access_code(
  p_business_id uuid,
  p_team_id text,
  p_device_name text default ''
)
returns table (
  access_code text,
  expires_at timestamptz,
  team_id text,
  team_name text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_code text;
  v_hash text;
  v_expires timestamptz := now() + interval '15 minutes';
  v_team_name text;
  v_attempt integer;
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Owner or admin access is required';
  end if;

  select t.name into v_team_name
  from public.teams t
  where t.business_id=p_business_id and t.id=p_team_id and t.active=true;
  if v_team_name is null then
    raise exception 'Choose an active team';
  end if;

  update public.mobile_access_codes
  set status='expired', updated_at=now()
  where status='active' and expires_at<=now();

  -- A newly generated PIN replaces only the still-unused PIN for this team.
  -- It does not disconnect phones that have already been paired.
  update public.mobile_access_codes
  set status='revoked', updated_at=now()
  where business_id=p_business_id and team_id=p_team_id and status='active';

  for v_attempt in 1..100 loop
    v_code := lpad((floor(random()*10000))::integer::text,4,'0');
    v_hash := encode(digest(v_code,'sha256'),'hex');
    begin
      insert into public.mobile_access_codes(
        business_id,team_id,device_name,code_hash,status,expires_at,created_by
      ) values (
        p_business_id,p_team_id,trim(coalesce(p_device_name,'')),v_hash,'active',v_expires,auth.uid()
      );
      exit;
    exception when unique_violation then
      v_code := null;
    end;
  end loop;

  if v_code is null then
    raise exception 'Could not generate a unique PIN. Try again.';
  end if;

  insert into public.audit_events(
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    p_business_id,auth.uid(),'mobile_access_code',p_team_id,'created',
    jsonb_build_object(
      'team_id',p_team_id,
      'device_name',trim(coalesce(p_device_name,'')),
      'expires_at',v_expires,
      'pin_digits',4,
      'pairing_mode','office_managed_persistent_device'
    )
  );

  return query select v_code,v_expires,p_team_id,v_team_name;
end;
$$;

revoke all on function public.create_mobile_access_code(uuid,text,text) from public;
grant execute on function public.create_mobile_access_code(uuid,text,text) to authenticated;

create or replace function public.claim_mobile_access_code(
  p_code text,
  p_device_name text default ''
)
returns table (
  business_id uuid,
  role text,
  display_name text,
  team_id text,
  team_name text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_code text := regexp_replace(coalesce(p_code,''),'[^0-9]','','g');
  v_hash text;
  v_row public.mobile_access_codes%rowtype;
  v_team_name text;
  v_name text;
  v_existing_business uuid;
  v_locked_until timestamptz;
begin
  if v_user is null then
    raise exception 'A field phone session is required';
  end if;

  insert into public.mobile_pairing_attempts(
    user_id,attempt_count,window_started_at,locked_until,updated_at
  ) values (
    v_user,0,now(),null,now()
  )
  on conflict (user_id) do update set
    attempt_count = case
      when public.mobile_pairing_attempts.window_started_at < now() - interval '10 minutes' then 0
      else public.mobile_pairing_attempts.attempt_count
    end,
    window_started_at = case
      when public.mobile_pairing_attempts.window_started_at < now() - interval '10 minutes' then now()
      else public.mobile_pairing_attempts.window_started_at
    end,
    locked_until = case
      when public.mobile_pairing_attempts.locked_until is not null
       and public.mobile_pairing_attempts.locked_until <= now() then null
      else public.mobile_pairing_attempts.locked_until
    end,
    updated_at=now();

  select a.locked_until into v_locked_until
  from public.mobile_pairing_attempts a
  where a.user_id=v_user
  for update;

  if v_locked_until is not null and v_locked_until > now() then
    return;
  end if;

  if length(v_code)<>4 then
    update public.mobile_pairing_attempts
    set attempt_count=attempt_count+1,
        locked_until=case when attempt_count+1>=5 then now()+interval '10 minutes' else locked_until end,
        updated_at=now()
    where user_id=v_user;
    return;
  end if;

  v_hash := encode(digest(v_code,'sha256'),'hex');

  update public.mobile_access_codes
  set status='expired', updated_at=now()
  where status='active' and expires_at<=now();

  select * into v_row
  from public.mobile_access_codes c
  where c.code_hash=v_hash and c.status='active' and c.expires_at>now()
  for update;

  if not found then
    update public.mobile_pairing_attempts
    set attempt_count=attempt_count+1,
        locked_until=case when attempt_count+1>=5 then now()+interval '10 minutes' else locked_until end,
        updated_at=now()
    where user_id=v_user;
    return;
  end if;

  select bm.business_id into v_existing_business
  from public.business_members bm
  where bm.user_id=v_user and bm.active=true
  limit 1;
  if v_existing_business is not null and v_existing_business<>v_row.business_id then
    return;
  end if;

  select t.name into v_team_name
  from public.teams t
  where t.business_id=v_row.business_id and t.id=v_row.team_id and t.active=true;
  if v_team_name is null then
    return;
  end if;

  v_name := coalesce(
    nullif(trim(p_device_name),''),
    nullif(trim(v_row.device_name),''),
    v_team_name||' phone'
  );

  insert into public.business_members(business_id,user_id,role,display_name,active)
  values(v_row.business_id,v_user,'field',v_name,true)
  on conflict (business_id,user_id) do update set
    role='field',display_name=excluded.display_name,active=true,updated_at=now();

  delete from public.team_assignments
  where business_id=v_row.business_id and user_id=v_user;

  insert into public.team_assignments(business_id,user_id,team_id,is_primary,active)
  values(v_row.business_id,v_user,v_row.team_id,true,true);

  update public.mobile_access_codes
  set status='used',claimed_by=v_user,claimed_at=now(),updated_at=now()
  where id=v_row.id;

  delete from public.mobile_pairing_attempts where user_id=v_user;

  insert into public.audit_events(
    business_id,actor_user_id,entity_type,entity_id,action,details
  ) values (
    v_row.business_id,v_user,'field_device',v_user::text,'paired',
    jsonb_build_object(
      'team_id',v_row.team_id,
      'device_name',v_name,
      'pairing_mode','office_managed_persistent_device'
    )
  );

  return query select v_row.business_id,'field'::text,v_name,v_row.team_id,v_team_name;
end;
$$;

revoke all on function public.claim_mobile_access_code(text,text) from public;
grant execute on function public.claim_mobile_access_code(text,text) to authenticated;

notify pgrst, 'reload schema';
commit;

select
  to_regclass('public.mobile_access_codes') as mobile_access_codes,
  to_regclass('public.mobile_pairing_attempts') as mobile_pairing_attempts,
  to_regprocedure('public.create_mobile_access_code(uuid,text,text)') as create_mobile_access_code,
  to_regprocedure('public.claim_mobile_access_code(text,text)') as claim_mobile_access_code;
