-- TUINBOOKS UI-RESTORED RELEASE R17
-- Admin-visible audit/activity history bridge.
-- ADDITIVE: reads the existing public.audit_events table only.

begin;

create or replace function public.tuinbooks_v2_list_audit_log_r17(
  p_business_id uuid,
  p_limit integer default 80
)
returns table(
  created_at timestamptz,
  actor_user_id uuid,
  actor_label text,
  entity_type text,
  entity_id text,
  action text,
  details jsonb
)
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_business_admin(p_business_id) then raise exception 'Admin access required'; end if;

  return query
  select
    a.created_at,
    a.actor_user_id,
    coalesce(
      nullif(bm.display_name,''),
      nullif(u.email,''),
      case when a.actor_user_id is null then 'System' else 'User' end
    )::text as actor_label,
    a.entity_type,
    a.entity_id,
    a.action,
    coalesce(a.details,'{}'::jsonb)
  from public.audit_events a
  left join public.business_members bm
    on bm.business_id=a.business_id and bm.user_id=a.actor_user_id
  left join auth.users u on u.id=a.actor_user_id
  where a.business_id=p_business_id
  order by a.created_at desc
  limit greatest(1,least(coalesce(p_limit,80),250));
end;
$$;

revoke all on function public.tuinbooks_v2_list_audit_log_r17(uuid,integer) from public,anon;
grant execute on function public.tuinbooks_v2_list_audit_log_r17(uuid,integer) to authenticated;

commit;
