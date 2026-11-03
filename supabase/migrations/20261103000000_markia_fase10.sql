-- =====================================================================
-- Markia · Migración Fase 10
-- 1. Plantillas: 10 en Plan Básico, 20 en Plan PRO
-- 2. Carruseles: 1 al mes en Básico, 3 en PRO
-- 3. Generación de Marca con IA (logo + paleta + tipografías + guía)
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Planes
-- ---------------------------------------------------------------------
alter table public.plans add column if not exists monthly_carousels integer not null default 0;

update public.plans set generic_templates = 10, monthly_carousels = 1 where id = 'basic';
update public.plans set generic_templates = 20, monthly_carousels = 3 where id = 'pro';

-- Precio del servicio de marca con IA (ver análisis de costos)
update public.addons
set name = 'Generación de Marca con IA', price_cents = 2499
where id = 'logo_service';

-- ---------------------------------------------------------------------
-- 2. Plantillas por plan
-- ---------------------------------------------------------------------
alter table public.templates add column if not exists min_plan text not null default 'basic';
do $$ begin
  alter table public.templates add constraint templates_min_plan_ck check (min_plan in ('basic', 'pro'));
exception when duplicate_object then null; end $$;

insert into public.templates (user_id, kind, name, definition, min_plan)
select null, 'generic', v.name, v.definition::jsonb, v.min_plan
from (values
  ('6 · Diagonal',              '{"layout":"diagonal","fondo":"cream","texto":"primary","detalle":"secondary"}', 'basic'),
  ('7 · Tarjeta',               '{"layout":"tarjeta","fondo":"cream","texto":"primary","detalle":"primary"}',    'basic'),
  ('8 · Cita',                  '{"layout":"cita","fondo":"primary","texto":"cream","detalle":"accent"}',        'basic'),
  ('9 · Titular',               '{"layout":"titular","fondo":"cream","texto":"secondary","detalle":"primary"}',  'basic'),
  ('10 · Minimalista',          '{"layout":"minimal","fondo":"cream","texto":"primary","detalle":"accent"}',     'basic'),
  ('11 · Burbujas',             '{"layout":"burbuja","fondo":"primary","texto":"cream","detalle":"accent"}',     'pro'),
  ('12 · Oferta',               '{"layout":"oferta","fondo":"secondary","texto":"cream","detalle":"accent"}',    'pro'),
  ('13 · Diagonal oscuro',      '{"layout":"diagonal","fondo":"primary","texto":"cream","detalle":"accent"}',    'pro'),
  ('14 · Tarjeta dorada',       '{"layout":"tarjeta","fondo":"cream","texto":"primary","detalle":"accent"}',     'pro'),
  ('15 · Cita clara',           '{"layout":"cita","fondo":"cream","texto":"secondary","detalle":"accent"}',      'pro'),
  ('16 · Titular intenso',      '{"layout":"titular","fondo":"secondary","texto":"cream","detalle":"accent"}',   'pro'),
  ('17 · Minimalista oscuro',   '{"layout":"minimal","fondo":"primary","texto":"cream","detalle":"accent"}',     'pro'),
  ('18 · Banda acento',         '{"layout":"banda","fondo":"accent","texto":"primary","detalle":"primary"}',     'pro'),
  ('19 · Esquina clara',        '{"layout":"esquina","fondo":"cream","texto":"primary","detalle":"secondary"}',  'pro'),
  ('20 · Burbujas claras',      '{"layout":"burbuja","fondo":"cream","texto":"primary","detalle":"secondary"}',  'pro')
) as v(name, definition, min_plan)
where not exists (select 1 from public.templates t where t.kind = 'generic' and t.name = v.name);

create or replace function public.user_plan_id(p_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select plan_id from public.subscriptions where user_id = p_user_id
$$;

-- Cada usuario ve las plantillas genéricas de su plan y las propias.
drop policy if exists templates_read on public.templates;
create policy templates_read on public.templates for select to authenticated
  using (
    user_id = (select auth.uid())
    or (user_id is null and (min_plan = 'basic' or public.user_plan_id((select auth.uid())) = 'pro'))
  );

-- ---------------------------------------------------------------------
-- 3. Carruseles
-- ---------------------------------------------------------------------
alter table public.posts
  add column if not exists format text not null default 'single',
  add column if not exists slides jsonb;
do $$ begin
  alter table public.posts add constraint posts_format_ck check (format in ('single', 'carousel'));
exception when duplicate_object then null; end $$;

-- Registro permanente de carruseles generados (borrar el post no devuelve el cupo).
create table if not exists public.carousel_generations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists carousel_generations_user_idx on public.carousel_generations (user_id, created_at);
alter table public.carousel_generations enable row level security;
drop policy if exists carousel_generations_own on public.carousel_generations;
create policy carousel_generations_own on public.carousel_generations for select to authenticated
  using (user_id = (select auth.uid()));

-- Cupo de carruseles del ciclo actual.
create or replace function public.carousel_quota(p_user_id uuid)
returns table (limit_count integer, used_count integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(p.monthly_carousels, 0),
    (select count(*)::int from public.carousel_generations g
     where g.user_id = s.user_id
       and g.created_at >= coalesce(s.cycle_resets_on - 30, s.current_period_start, current_date)::timestamptz)
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = p_user_id
$$;

create or replace function public.get_my_carousel_quota()
returns table (limit_count integer, used_count integer)
language sql stable security definer set search_path = public as $$
  select * from public.carousel_quota(auth.uid())
$$;

create or replace function public.consume_carousel_quota(p_user_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  q record;
begin
  perform 1 from public.subscriptions where user_id = p_user_id for update;
  if not found then
    return query select false, 'No tienes una suscripción activa.'::text;
    return;
  end if;
  if not public.can_generate_posts(p_user_id) then
    return query select false, 'Tu cuenta está suspendida. Reactívala para seguir generando.'::text;
    return;
  end if;
  select * into q from public.carousel_quota(p_user_id);
  if q.used_count >= q.limit_count then
    return query select false, format('Ya usaste tus %s carrusel(es) de este ciclo.', q.limit_count);
    return;
  end if;
  insert into public.carousel_generations (user_id) values (p_user_id);
  return query select true, 'ok'::text;
end $$;

-- ---------------------------------------------------------------------
-- 4. Paquetes de marca con IA
-- ---------------------------------------------------------------------
create table if not exists public.brand_packages (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  payment_id     uuid unique references public.payments on delete set null,
  status         text not null default 'awaiting_brief'
                 check (status in ('awaiting_brief', 'generating', 'ready', 'failed')),
  brief          jsonb,
  result         jsonb,
  revisions_left integer not null default 1,
  emailed_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.brand_packages enable row level security;
drop policy if exists brand_packages_own on public.brand_packages;
create policy brand_packages_own on public.brand_packages for select to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists brand_packages_updated_at on public.brand_packages;
create trigger brand_packages_updated_at before update on public.brand_packages
  for each row execute function public.set_updated_at();

-- Al confirmarse el pago del servicio, se crea el paquete listo para completar el brief.
create or replace function public.handle_brand_package_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.applied_at is null and new.applied_at is not null and new.addon_id = 'logo_service' then
    insert into public.brand_packages (user_id, payment_id) values (new.user_id, new.id)
    on conflict (payment_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists payments_brand_package on public.payments;
create trigger payments_brand_package
  after update on public.payments
  for each row execute function public.handle_brand_package_payment();

-- ---------------------------------------------------------------------
-- 5. Permisos
-- ---------------------------------------------------------------------
revoke execute on function public.carousel_quota(uuid)          from public, anon, authenticated;
revoke execute on function public.consume_carousel_quota(uuid)  from public, anon, authenticated;
grant  execute on function public.carousel_quota(uuid)          to service_role;
grant  execute on function public.consume_carousel_quota(uuid)  to service_role;
revoke execute on function public.get_my_carousel_quota()       from public, anon;
grant  execute on function public.get_my_carousel_quota()       to authenticated;

-- Pagos del servicio de logo hechos antes de esta migración también reciben su paquete.
insert into public.brand_packages (user_id, payment_id)
select p.user_id, p.id from public.payments p
where p.addon_id = 'logo_service' and p.applied_at is not null
on conflict (payment_id) do nothing;
