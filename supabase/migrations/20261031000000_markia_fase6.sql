-- =====================================================================
-- Markia · Migración Fase 6
-- Textos de imagen en posts, 5 plantillas genéricas, cupo de posts
-- atómico y límite de plantillas propias por plan.
-- Se puede ejecutar más de una vez sin duplicar nada.
-- =====================================================================

-- 1. Campos nuevos en publicaciones
alter table public.posts
  add column if not exists title          text,
  add column if not exists image_headline text,
  add column if not exists image_subtext  text,
  add column if not exists post_type      text;

-- 2. Plantillas genéricas (visibles para todos los usuarios)
insert into public.templates (user_id, kind, name, definition)
select null, 'generic', v.name, v.definition::jsonb
from (values
  ('1 · Clásico centrado', '{"layout":"centrado","fondo":"primary","texto":"cream","detalle":"accent"}'),
  ('2 · Banda inferior',   '{"layout":"banda","fondo":"cream","texto":"primary","detalle":"secondary"}'),
  ('3 · Esquina curva',    '{"layout":"esquina","fondo":"secondary","texto":"cream","detalle":"accent"}'),
  ('4 · Dividido',         '{"layout":"dividido","fondo":"cream","texto":"secondary","detalle":"primary"}'),
  ('5 · Marco elegante',   '{"layout":"marco","fondo":"cream","texto":"primary","detalle":"accent"}')
) as v(name, definition)
where not exists (
  select 1 from public.templates t where t.kind = 'generic' and t.name = v.name
);

-- 3. Descontar cupo de publicaciones (primero del mes, luego del Boost)
create or replace function public.consume_post_quota(p_user_id uuid, p_count integer)
returns table (ok boolean, remaining integer, message text)
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions%rowtype;
  p public.plans%rowtype;
  v_free integer;
  v_from_month integer;
begin
  if p_count is null or p_count < 1 then
    return query select false, 0, 'Cantidad inválida.'::text;
    return;
  end if;

  select * into s from public.subscriptions where user_id = p_user_id for update;
  if not found then
    return query select false, 0, 'No tienes una suscripción activa.'::text;
    return;
  end if;

  if not public.can_generate_posts(p_user_id) then
    return query select false, 0, 'Tu cuenta está suspendida. Reactívala para seguir generando.'::text;
    return;
  end if;

  select * into p from public.plans where id = s.plan_id;
  v_free := greatest(p.monthly_posts - s.posts_used_this_cycle, 0);

  if v_free + s.extra_posts_balance < p_count then
    return query select false, v_free + s.extra_posts_balance,
      format('Solo te quedan %s publicaciones este ciclo.', v_free + s.extra_posts_balance);
    return;
  end if;

  v_from_month := least(v_free, p_count);
  update public.subscriptions set
    posts_used_this_cycle = posts_used_this_cycle + v_from_month,
    extra_posts_balance   = extra_posts_balance - (p_count - v_from_month)
  where id = s.id;

  return query select true, v_free + s.extra_posts_balance - p_count, 'ok'::text;
end $$;

revoke execute on function public.consume_post_quota(uuid, integer) from public, anon, authenticated;
grant  execute on function public.consume_post_quota(uuid, integer) to service_role;

-- 4. Límite de plantillas propias según el plan (Básico 0, PRO 5)
create or replace function public.enforce_custom_template_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.kind <> 'custom' then
    return new;
  end if;

  select coalesce(p.custom_templates, 0) into v_limit
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = new.user_id;

  select count(*) into v_count
  from public.templates
  where user_id = new.user_id and kind = 'custom';

  if v_count >= coalesce(v_limit, 0) then
    raise exception 'Tu plan permite % plantillas propias.', coalesce(v_limit, 0);
  end if;
  return new;
end $$;

drop trigger if exists templates_custom_limit on public.templates;
create trigger templates_custom_limit
  before insert on public.templates
  for each row execute function public.enforce_custom_template_limit();
