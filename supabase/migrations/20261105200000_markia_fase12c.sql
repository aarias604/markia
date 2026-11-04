-- =====================================================================
-- Markia · Fase 12c
-- La publicación automática en Instagram queda SOLO para administradores
-- (pruebas). Los clientes descargan y publican manualmente y reciben
-- recordatorios por correo.
-- =====================================================================

create or replace function public.can_autopost(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = p_user_id), false)
$$;
revoke execute on function public.can_autopost(uuid) from public, anon, authenticated;
grant  execute on function public.can_autopost(uuid) to service_role;

-- Publicaciones de clientes que estaban marcadas como automáticas pasan a manual.
update public.posts p
set auto_publish = false
where p.auto_publish
  and not exists (select 1 from public.profiles pr where pr.id = p.user_id and pr.is_admin);

-- Conexiones de Instagram de clientes (si hubiera) se eliminan.
delete from public.instagram_accounts a
where not exists (select 1 from public.profiles pr where pr.id = a.user_id and pr.is_admin);
