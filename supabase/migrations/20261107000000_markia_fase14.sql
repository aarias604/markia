-- =====================================================================
-- Markia · Migración Fase 14 · Avisos por WhatsApp + Marca con IA a $19.99
-- 1. Generación de Marca con IA: $19.99.
-- 2. profiles.whatsapp_opt_in: el cliente acepta recibir avisos por WhatsApp.
-- 3. whatsapp_log: evita mensajes duplicados y guarda errores.
-- 4. whatsapp_idle_candidates(): clientes que llevan 2+ días sin publicar
--    y no recibieron aviso de inactividad en los últimos 2 días.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Precio de Marca con IA
update public.addons set price_cents = 1999 where id = 'logo_service' and price_cents = 2499;

-- 2. Permiso del cliente para WhatsApp
alter table public.profiles
  add column if not exists whatsapp_opt_in    boolean not null default false,
  add column if not exists whatsapp_opt_in_at timestamptz;

grant update (full_name, business_name, phone, onboarding_completed, whatsapp_opt_in)
  on public.profiles to authenticated;

create or replace function public.set_whatsapp_opt_in_at()
returns trigger language plpgsql as $$
begin
  if new.whatsapp_opt_in and not coalesce(old.whatsapp_opt_in, false) then
    new.whatsapp_opt_in_at := now();
  end if;
  return new;
end $$;

drop trigger if exists profiles_whatsapp_opt_in on public.profiles;
create trigger profiles_whatsapp_opt_in
  before update of whatsapp_opt_in on public.profiles
  for each row execute function public.set_whatsapp_opt_in_at();

-- 3. Registro de mensajes enviados
create table if not exists public.whatsapp_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade,
  kind          text not null,             -- 'post_reminder' | 'idle' | 'test'
  ref           text not null,             -- id de la publicación o fecha
  sent_at       timestamptz not null default now(),
  wa_message_id text,
  error         text,
  unique nulls not distinct (user_id, kind, ref)
);
alter table public.whatsapp_log enable row level security;  -- sin políticas: solo el servidor la usa

-- 4. Clientes para el aviso de inactividad (cada 2 días sin publicar)
create or replace function public.whatsapp_idle_candidates()
returns table (
  user_id       uuid,
  phone         text,
  full_name     text,
  business_name text,
  days_idle     integer
)
language sql stable security definer set search_path = public as $$
  with base as (
    select pr.id, pr.phone, pr.full_name, pr.business_name, s.current_period_start, s.created_at
    from public.profiles pr
    join public.subscriptions s on s.user_id = pr.id
    cross join lateral public.compute_subscription_state(
      s.next_due_date, 1, public.panama_today(), s.subscription_status) c
    where pr.whatsapp_opt_in
      and coalesce(pr.phone, '') <> ''
      and c.status in ('active', 'expiring_soon', 'grace_period')
  ),
  activity as (
    select b.*,
      greatest(
        (select max((p.scheduled_at at time zone 'America/Panama')::date)
           from public.posts p
          where p.user_id = b.id and p.scheduled_at <= now()
            and p.status in ('scheduled', 'publishing', 'published')),
        (select max((p.published_at at time zone 'America/Panama')::date)
           from public.posts p where p.user_id = b.id),
        coalesce(b.current_period_start, (b.created_at at time zone 'America/Panama')::date)
      ) as last_activity
    from base b
  )
  select a.id, a.phone, a.full_name, a.business_name,
         (public.panama_today() - a.last_activity)::integer
  from activity a
  where public.panama_today() - a.last_activity >= 2
    -- Sin publicaciones programadas para hoy
    and not exists (
      select 1 from public.posts p
      where p.user_id = a.id
        and p.status in ('scheduled', 'publishing', 'published')
        and (p.scheduled_at at time zone 'America/Panama')::date = public.panama_today()
    )
    -- Último aviso de inactividad hace 2 días o más
    and not exists (
      select 1 from public.whatsapp_log w
      where w.user_id = a.id and w.kind = 'idle'
        and w.error is null
        and (w.sent_at at time zone 'America/Panama')::date > public.panama_today() - 2
    )
$$;
revoke execute on function public.whatsapp_idle_candidates() from public, anon, authenticated;
grant  execute on function public.whatsapp_idle_candidates() to service_role;
