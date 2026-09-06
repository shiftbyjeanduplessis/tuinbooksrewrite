-- TUINBOOKS UI-RESTORED RELEASE R4
-- Management support-session bridge for the clean v2 RPC boundary.
-- Safe to run after the already-installed V2 core. This does not alter client data.

create or replace function public.is_business_admin(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
 select exists(
   select 1 from public.business_members bm
   where bm.business_id=target_business_id
     and bm.user_id=auth.uid()
     and bm.active=true
     and lower(bm.role) in('owner','admin')
 )
 or exists(
   select 1
   from public.tuinbooks_platform_staff ps
   join public.tuinbooks_support_grants g
     on g.support_user_id=ps.user_id
    and g.business_id=target_business_id
   where ps.user_id=auth.uid()
     and ps.active=true
     and lower(g.status)='active'
     and coalesce(g.starts_at,now())<=now()
     and (g.expires_at is null or g.expires_at>now())
     and g.allow_operational_read=true
     and g.allow_operational_edit=true
     and g.allow_financial_read=true
     and g.allow_financial_edit=true
 )
 or exists(
   select 1
   from public.tuinbooks_platform_staff ps
   join public.tuinbooks_support_sessions s
     on s.support_user_id=ps.user_id
    and s.business_id=target_business_id
   where ps.user_id=auth.uid()
     and ps.active=true
     and lower(s.status)='active'
     and s.expires_at>now()
     and s.allow_operational_read=true
     and s.allow_operational_edit=true
     and s.allow_financial_read=true
     and s.allow_financial_edit=true
 );
$$;

revoke all on function public.is_business_admin(uuid) from public;
grant execute on function public.is_business_admin(uuid) to authenticated;
