-- TuinBooks v30 migration: Users, invitations and team assignments
-- Run this ONCE after the v28 schema that is already installed.
-- Safe to re-run: objects are created/replaced idempotently.

begin;

create table if not exists public.team_assignments (
  business_id uuid not null,
  user_id uuid not null,
  team_id text not null,
  is_primary boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id, team_id),
  constraint team_assignments_member_fk
    foreign key (business_id, user_id)
    references public.business_members(business_id, user_id)
    on delete cascade,
  constraint team_assignments_team_fk
    foreign key (business_id, team_id)
    references public.teams(business_id, id)
    on delete cascade
);

create unique index if not exists team_assignments_one_primary_per_user
  on public.team_assignments(business_id, user_id)
  where is_primary = true and active = true;

create table if not exists public.business_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null check (role in ('admin','field')),
  team_id text,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_invites_team_fk
    foreign key (business_id, team_id)
    references public.teams(business_id, id)
    on delete set null
);

create index if not exists business_invites_business_status_idx
  on public.business_invites(business_id, status, created_at desc);
create index if not exists business_invites_email_idx
  on public.business_invites(lower(email));

-- Keep updated_at current.
drop trigger if exists team_assignments_set_updated_at on public.team_assignments;
create trigger team_assignments_set_updated_at before update on public.team_assignments
for each row execute function public.set_updated_at();

drop trigger if exists business_invites_set_updated_at on public.business_invites;
create trigger business_invites_set_updated_at before update on public.business_invites
for each row execute function public.set_updated_at();

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.active = true
      and bm.role = 'owner'
  );
$$;

revoke all on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_owner(uuid) to authenticated;

-- Creates a secure invitation link. The browser never needs a service-role key.
create or replace function public.create_business_invite(
  p_business_id uuid,
  p_email text,
  p_display_name text,
  p_role text,
  p_team_id text default null
)
returns table (
  invite_id uuid,
  invite_token uuid,
  invite_email text,
  invite_role text,
  invite_team_id text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_role text := lower(trim(coalesce(p_role,'')));
  v_id uuid;
  v_token uuid;
  v_expires timestamptz;
  v_existing_user uuid;
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Enter a valid email address';
  end if;

  if v_role not in ('admin','field') then
    raise exception 'Role must be admin or field';
  end if;

  if v_role = 'field' and nullif(trim(coalesce(p_team_id,'')),'') is null then
    raise exception 'Field users must be assigned to a team';
  end if;

  if p_team_id is not null and not exists (
    select 1 from public.teams t
    where t.business_id = p_business_id and t.id = p_team_id and t.active = true
  ) then
    raise exception 'The selected team does not exist or is inactive';
  end if;

  select u.id into v_existing_user
  from auth.users u
  where lower(coalesce(u.email,'')) = v_email
  limit 1;

  if v_existing_user is not null and exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id and bm.user_id = v_existing_user and bm.active = true
  ) then
    raise exception 'This email already has access to the business';
  end if;

  update public.business_invites
  set status = 'revoked', updated_at = now()
  where business_id = p_business_id
    and lower(email) = v_email
    and status = 'pending';

  insert into public.business_invites (
    business_id, email, display_name, role, team_id, invited_by
  ) values (
    p_business_id,
    v_email,
    trim(coalesce(p_display_name,'')),
    v_role,
    case when v_role = 'field' then p_team_id else null end,
    auth.uid()
  )
  returning id, token, expires_at into v_id, v_token, v_expires;

  insert into public.audit_events (
    business_id, actor_user_id, entity_type, entity_id, action, details
  ) values (
    p_business_id, auth.uid(), 'business_invite', v_id::text,
    'invite_created', jsonb_build_object('email',v_email,'role',v_role,'team_id',p_team_id)
  );

  return query select v_id, v_token, v_email, v_role,
    case when v_role = 'field' then p_team_id else null end,
    v_expires;
end;
$$;

revoke all on function public.create_business_invite(uuid,text,text,text,text) from public;
grant execute on function public.create_business_invite(uuid,text,text,text,text) to authenticated;

-- A signed-in user accepts an invitation only when their Auth email matches it.
create or replace function public.accept_business_invite(p_token uuid)
returns table (
  business_id uuid,
  role text,
  display_name text,
  team_id text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_auth_email text;
  v_invite public.business_invites%rowtype;
  v_existing_business uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select lower(coalesce(u.email,'')) into v_auth_email
  from auth.users u
  where u.id = v_user;

  select * into v_invite
  from public.business_invites i
  where i.token = p_token
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'This invitation is no longer available';
  end if;

  if v_invite.expires_at <= now() then
    update public.business_invites set status='expired', updated_at=now() where id=v_invite.id;
    raise exception 'This invitation has expired';
  end if;

  if v_auth_email = '' or v_auth_email <> lower(v_invite.email) then
    raise exception 'Sign in with the same email address that received the invitation';
  end if;

  select bm.business_id into v_existing_business
  from public.business_members bm
  where bm.user_id = v_user and bm.active = true
  limit 1;

  if v_existing_business is not null and v_existing_business <> v_invite.business_id then
    raise exception 'This account already belongs to another active business';
  end if;

  insert into public.business_members (
    business_id, user_id, role, display_name, active
  ) values (
    v_invite.business_id, v_user, v_invite.role,
    coalesce(nullif(v_invite.display_name,''), split_part(v_invite.email,'@',1)), true
  )
  on conflict (business_id,user_id) do update set
    role=excluded.role,
    display_name=excluded.display_name,
    active=true,
    updated_at=now();

  delete from public.team_assignments
  where business_id=v_invite.business_id and user_id=v_user;

  if v_invite.role='field' and v_invite.team_id is not null then
    insert into public.team_assignments (
      business_id,user_id,team_id,is_primary,active
    ) values (
      v_invite.business_id,v_user,v_invite.team_id,true,true
    );
  end if;

  update public.business_invites
  set status='accepted', accepted_by=v_user, accepted_at=now(), updated_at=now()
  where id=v_invite.id;

  insert into public.audit_events (
    business_id, actor_user_id, entity_type, entity_id, action, details
  ) values (
    v_invite.business_id, v_user, 'business_member', v_user::text,
    'invite_accepted', jsonb_build_object('role',v_invite.role,'team_id',v_invite.team_id)
  );

  return query select v_invite.business_id, v_invite.role,
    coalesce(nullif(v_invite.display_name,''), split_part(v_invite.email,'@',1)),
    v_invite.team_id;
end;
$$;

revoke all on function public.accept_business_invite(uuid) from public;
grant execute on function public.accept_business_invite(uuid) to authenticated;

create or replace function public.list_business_users(p_business_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  active boolean,
  team_id text,
  team_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    bm.user_id,
    coalesce(u.email,''),
    bm.display_name,
    bm.role,
    bm.active,
    ta.team_id,
    t.name,
    bm.created_at,
    u.last_sign_in_at
  from public.business_members bm
  join auth.users u on u.id=bm.user_id
  left join public.team_assignments ta
    on ta.business_id=bm.business_id and ta.user_id=bm.user_id and ta.active=true and ta.is_primary=true
  left join public.teams t
    on t.business_id=ta.business_id and t.id=ta.team_id
  where bm.business_id=p_business_id
    and public.is_business_admin(p_business_id)
  order by case bm.role when 'owner' then 1 when 'admin' then 2 else 3 end,
           lower(coalesce(nullif(bm.display_name,''),u.email,''));
$$;

revoke all on function public.list_business_users(uuid) from public;
grant execute on function public.list_business_users(uuid) to authenticated;

create or replace function public.list_business_invites(p_business_id uuid)
returns table (
  invite_id uuid,
  email text,
  display_name text,
  role text,
  team_id text,
  team_name text,
  token uuid,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id,i.email,i.display_name,i.role,i.team_id,t.name,i.token,i.status,i.expires_at,i.created_at
  from public.business_invites i
  left join public.teams t on t.business_id=i.business_id and t.id=i.team_id
  where i.business_id=p_business_id
    and public.is_business_admin(p_business_id)
  order by i.created_at desc;
$$;

revoke all on function public.list_business_invites(uuid) from public;
grant execute on function public.list_business_invites(uuid) to authenticated;

create or replace function public.update_business_user(
  p_business_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_role text,
  p_team_id text default null,
  p_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_role text;
  v_role text := lower(trim(coalesce(p_role,'')));
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  select role into v_current_role
  from public.business_members
  where business_id=p_business_id and user_id=p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  if v_current_role='owner' then
    if v_role<>'owner' or p_active=false then
      raise exception 'The business owner cannot be disabled or changed from this screen';
    end if;
  elsif v_role not in ('admin','field') then
    raise exception 'Role must be admin or field';
  end if;

  if p_user_id=auth.uid() and p_active=false then
    raise exception 'You cannot disable your own account';
  end if;

  if v_role='field' and nullif(trim(coalesce(p_team_id,'')),'') is null then
    raise exception 'Field users must be assigned to a team';
  end if;

  if p_team_id is not null and not exists (
    select 1 from public.teams t
    where t.business_id=p_business_id and t.id=p_team_id and t.active=true
  ) then
    raise exception 'The selected team does not exist or is inactive';
  end if;

  update public.business_members
  set display_name=trim(coalesce(p_display_name,'')),
      role=case when v_current_role='owner' then 'owner' else v_role end,
      active=p_active,
      updated_at=now()
  where business_id=p_business_id and user_id=p_user_id;

  delete from public.team_assignments
  where business_id=p_business_id and user_id=p_user_id;

  if p_active and v_role='field' then
    insert into public.team_assignments (
      business_id,user_id,team_id,is_primary,active
    ) values (
      p_business_id,p_user_id,p_team_id,true,true
    );
  end if;

  insert into public.audit_events (
    business_id, actor_user_id, entity_type, entity_id, action, details
  ) values (
    p_business_id, auth.uid(), 'business_member', p_user_id::text,
    'access_updated', jsonb_build_object('role',v_role,'team_id',p_team_id,'active',p_active)
  );
end;
$$;

revoke all on function public.update_business_user(uuid,uuid,text,text,text,boolean) from public;
grant execute on function public.update_business_user(uuid,uuid,text,text,text,boolean) to authenticated;

create or replace function public.revoke_business_invite(
  p_business_id uuid,
  p_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Admin access required';
  end if;

  update public.business_invites
  set status='revoked',updated_at=now()
  where id=p_invite_id and business_id=p_business_id and status='pending';

  if not found then
    raise exception 'Pending invitation not found';
  end if;

  insert into public.audit_events (
    business_id, actor_user_id, entity_type, entity_id, action, details
  ) values (
    p_business_id,auth.uid(),'business_invite',p_invite_id::text,'invite_revoked','{}'::jsonb
  );
end;
$$;

revoke all on function public.revoke_business_invite(uuid,uuid) from public;
grant execute on function public.revoke_business_invite(uuid,uuid) to authenticated;

-- RLS and privileges. Membership and invitations are changed through the RPCs above.
alter table public.team_assignments enable row level security;
alter table public.business_invites enable row level security;

drop policy if exists team_assignments_select_access on public.team_assignments;
create policy team_assignments_select_access on public.team_assignments
for select to authenticated
using (user_id=auth.uid() or public.is_business_admin(business_id));

drop policy if exists business_invites_select_admin on public.business_invites;
create policy business_invites_select_admin on public.business_invites
for select to authenticated
using (public.is_business_admin(business_id));

-- Field users only receive their assigned team row. Owners/admins still receive all teams.
drop policy if exists teams_select_member on public.teams;
create policy teams_select_member on public.teams
for select to authenticated
using (
  public.is_business_admin(business_id)
  or exists (
    select 1 from public.team_assignments ta
    where ta.business_id=teams.business_id
      and ta.team_id=teams.id
      and ta.user_id=auth.uid()
      and ta.active=true
  )
);

-- Remove direct membership write access from browser clients. RPCs enforce role rules.
drop policy if exists members_admin_all on public.business_members;
revoke insert, update, delete on public.business_members from authenticated;
grant select on public.business_members to authenticated;

grant select on public.team_assignments to authenticated;
revoke insert, update, delete on public.team_assignments from authenticated;
revoke all on public.business_invites from authenticated;

commit;
