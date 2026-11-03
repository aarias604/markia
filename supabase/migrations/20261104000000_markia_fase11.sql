-- =====================================================================
-- Markia · Migración Fase 11
-- 1. Cambio de Plan Básico a PRO: el primer pago PRO lleva 35% de descuento.
--    El plan cambia a PRO al confirmarse el pago y se suman 30 días a la
--    fecha de vencimiento actual. Las cuotas siguientes son al precio normal.
-- 2. Registro de correos automáticos enviados (para no repetirlos).
-- Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.payments add column if not exists is_upgrade boolean not null default false;

create or replace function public.create_upgrade_payment(p_user_id uuid)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  s   public.subscriptions%rowtype;
  cur public.plans%rowtype;
  pro public.plans%rowtype;
  c   record;
  v   public.payments%rowtype;
begin
  select * into s from public.subscriptions where user_id = p_user_id for update;
  if not found then raise exception 'Necesitas un plan activo para cambiarte a PRO.'; end if;
  if s.plan_id = 'pro' then raise exception 'Ya tienes el Plan PRO.'; end if;

  select * into cur from public.plans where id = s.plan_id;
  select * into pro from public.plans where id = 'pro' and is_active;
  if not found then raise exception 'El Plan PRO no está disponible.'; end if;

  select * into c from public.compute_subscription_state(
    s.next_due_date, cur.price_cents, public.panama_today(), s.subscription_status);
  if c.status not in ('active', 'expiring_soon') then
    raise exception 'Primero ponte al día con tu pago pendiente y luego podrás cambiarte a PRO.';
  end if;

  -- Una sola orden de suscripción viva por usuario.
  update public.payments set status = 'expired'
  where user_id = p_user_id and status = 'pending' and kind <> 'addon';

  insert into public.payments (user_id, subscription_id, kind, plan_id, months_covered,
                               base_amount_cents, discount_pct, amount_cents, is_upgrade)
  values (p_user_id, s.id, 'renewal', 'pro', 1,
          pro.price_cents, 35, round(pro.price_cents * 0.65)::integer, true)
  returning * into v;
  return v;
end $$;

revoke execute on function public.create_upgrade_payment(uuid) from public, anon, authenticated;
grant  execute on function public.create_upgrade_payment(uuid) to service_role;

-- Registro de correos automáticos (evita enviar dos veces el mismo aviso).
create table if not exists public.email_log (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users on delete cascade,
  kind     text not null,
  ref      text not null,
  sent_at  timestamptz not null default now(),
  unique nulls not distinct (user_id, kind, ref)
);
alter table public.email_log enable row level security;  -- sin políticas: solo el servidor la usa
