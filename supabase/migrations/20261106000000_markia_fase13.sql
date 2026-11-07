-- =====================================================================
-- Markia · Migración Fase 13 · Precios congelados y promociones
-- 1. plans.price_cents pasa a ser el PRECIO REGULAR (normal): Básico $15.99, PRO $22.99.
-- 2. Tabla promotions: descuentos por porcentaje o precio fijo, por plan
--    o para todos, con fechas. Solo aplican a suscripciones nuevas.
-- 3. Cada suscripción guarda su precio congelado (locked_price_cents).
--    Mientras la cuenta esté al día o en período de gracia paga ese
--    precio (o el regular, si algún día bajas el regular por debajo). Si se suspende o se
--    cancela, al volver paga el precio vigente y se congela el nuevo.
-- 4. Lanzamiento: Básico $9.99 y PRO $16.99 hasta el 31/12/2026.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas y tabla de promociones
-- ---------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists locked_price_cents integer check (locked_price_cents > 0);

create table if not exists public.promotions (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  label              text not null default 'Promoción',
  plan_id            text references public.plans(id) on delete cascade,  -- null = todos los planes
  discount_pct       numeric(5,2) check (discount_pct > 0 and discount_pct < 100),
  promo_price_cents  integer check (promo_price_cents > 0),
  starts_on          date not null default public.panama_today(),
  ends_on            date,                                                -- inclusive; null = sin fecha de fin
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  constraint promotions_value_ck check ((discount_pct is null) <> (promo_price_cents is null)),
  constraint promotions_fixed_plan_ck check (promo_price_cents is null or plan_id is not null),
  constraint promotions_dates_ck check (ends_on is null or ends_on >= starts_on)
);
alter table public.promotions enable row level security;  -- sin políticas: se lee por funciones

alter table public.payments
  add column if not exists monthly_price_cents integer,
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. Precios de lanzamiento
-- ---------------------------------------------------------------------
-- Precio regular: Básico $15.99 y PRO $22.99 (reemplaza $19 / $39 o los $14.99 / $29.99 de prueba).
-- Si después lo cambias desde el panel, volver a ejecutar este archivo no lo toca.
update public.plans set price_cents = 1599 where id = 'basic' and price_cents in (1900, 1499);
update public.plans set price_cents = 2299 where id = 'pro'   and price_cents in (3900, 2999);

insert into public.promotions (name, label, plan_id, promo_price_cents, starts_on, ends_on)
select 'Lanzamiento Básico', 'Precio de lanzamiento', 'basic', 999, date '2026-11-01', date '2026-12-31'
where not exists (select 1 from public.promotions where name = 'Lanzamiento Básico');

insert into public.promotions (name, label, plan_id, promo_price_cents, starts_on, ends_on)
select 'Lanzamiento PRO', 'Precio de lanzamiento', 'pro', 1699, date '2026-11-01', date '2026-12-31'
where not exists (select 1 from public.promotions where name = 'Lanzamiento PRO');

-- Si ya habías ejecutado esta migración con $14.99 / $29.99, se ajustan a $9.99 / $16.99.
update public.promotions set promo_price_cents = 999  where name = 'Lanzamiento Básico' and promo_price_cents = 1499;
update public.promotions set promo_price_cents = 1699 where name = 'Lanzamiento PRO'    and promo_price_cents = 2999;

-- ---------------------------------------------------------------------
-- 3. Precio vigente para nuevas suscripciones (regular o con promoción)
-- ---------------------------------------------------------------------
create or replace function public.plan_offer(p_plan_id text)
returns table (regular_cents integer, price_cents integer, promotion_id uuid, label text, ends_on date)
language sql stable security definer set search_path = public as $$
  select p.price_cents, coalesce(o.price, p.price_cents), o.id, o.label, o.ends_on
  from public.plans p
  left join lateral (
    select pr.id, pr.label, pr.ends_on,
           coalesce(pr.promo_price_cents,
                    round(p.price_cents * (100 - pr.discount_pct) / 100.0)::integer) as price
    from public.promotions pr
    where pr.is_active
      and (pr.plan_id is null or pr.plan_id = p.id)
      and pr.starts_on <= public.panama_today()
      and (pr.ends_on is null or pr.ends_on >= public.panama_today())
    order by 4 asc, pr.created_at desc
    limit 1
  ) o on o.price < p.price_cents
  where p.id = p_plan_id
$$;

-- Precio mensual que paga una suscripción concreta.
create or replace function public.subscription_monthly_price(s public.subscriptions)
returns integer
language sql stable security definer set search_path = public as $$
  select case
    when s.locked_price_cents is not null
         and c.status in ('active', 'expiring_soon', 'grace_period')
      then least(s.locked_price_cents, o.regular_cents)
    else o.price_cents
  end
  from public.plan_offer(s.plan_id) o
  cross join lateral public.compute_subscription_state(
    s.next_due_date, 1, public.panama_today(), s.subscription_status) c
$$;

-- Planes con su precio regular y el precio de hoy (para la web y el panel).
create or replace function public.get_public_pricing()
returns table (
  plan_id text, name text, regular_cents integer, price_cents integer, label text, ends_on date,
  monthly_posts integer, monthly_carousels integer, generic_templates integer,
  custom_templates integer, instagram_autopost boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, o.regular_cents, o.price_cents, o.label, o.ends_on,
         p.monthly_posts, p.monthly_carousels, p.generic_templates,
         p.custom_templates, p.instagram_autopost
  from public.plans p
  cross join lateral public.plan_offer(p.id) o
  where p.is_active
  order by p.price_cents
$$;
grant execute on function public.get_public_pricing() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Facturación usando el precio de cada suscripción
-- ---------------------------------------------------------------------
drop function if exists public.get_my_billing();
create function public.get_my_billing()
returns table (
  subscription_id     uuid,
  plan_id             text,
  plan_name           text,
  plan_price_cents    integer,
  next_due_date       date,
  status              public.subscription_status,
  days_until_due      integer,
  grace_period_until  date,
  days_left_in_grace  integer,
  unpaid_months       integer,
  months_to_pay       integer,
  discount_pct        numeric,
  amount_due_cents    integer,
  show_banner         boolean,
  can_generate        boolean,
  regular_price_cents integer,
  price_locked        boolean
)
language sql stable security invoker set search_path = public as $$
  select s.id, s.plan_id, p.name, m.price, s.next_due_date,
         c.status, c.days_until_due, c.grace_period_until, c.days_left_in_grace,
         c.unpaid_months, c.months_to_pay, c.discount_pct, c.amount_due_cents,
         c.status in ('expiring_soon', 'grace_period', 'suspended'),
         c.status in ('active', 'expiring_soon', 'grace_period'),
         p.price_cents,
         s.locked_price_cents is not null and c.status in ('active', 'expiring_soon', 'grace_period')
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  cross join lateral (select public.subscription_monthly_price(s) as price) m
  cross join lateral public.compute_subscription_state(
    s.next_due_date, m.price, public.panama_today(), s.subscription_status) c
  where s.user_id = auth.uid()
$$;
grant execute on function public.get_my_billing() to authenticated;

-- Para los correos automáticos del cron diario.
create or replace function public.get_billing_snapshot()
returns table (user_id uuid, next_due_date date, subscription_status public.subscription_status,
               plan_name text, monthly_price_cents integer)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.next_due_date, s.subscription_status, p.name, public.subscription_monthly_price(s)
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.next_due_date is not null
    and s.subscription_status not in ('pending', 'canceled')
$$;
revoke execute on function public.get_billing_snapshot() from public, anon, authenticated;
grant  execute on function public.get_billing_snapshot() to service_role;

create or replace function public.create_subscription_payment(
  p_user_id uuid,
  p_plan_id text default null      -- solo para el primer pago
)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions%rowtype;
  p public.plans%rowtype;
  o record;
  c record;
  v_price integer;
  v_promo uuid;
  v_kind public.payment_kind;
  v public.payments%rowtype;
begin
  update public.payments set status = 'expired'
  where user_id = p_user_id and status = 'pending' and kind <> 'addon';

  select * into s from public.subscriptions where user_id = p_user_id;

  -- Primer pago: precio vigente (con promoción si hay una activa).
  if not found or s.next_due_date is null or s.subscription_status in ('pending', 'canceled') then
    select * into p from public.plans where id = coalesce(p_plan_id, s.plan_id) and is_active;
    if not found then
      raise exception 'Plan inválido';
    end if;
    select * into o from public.plan_offer(p.id);
    insert into public.payments (user_id, subscription_id, kind, plan_id, months_covered,
                                 base_amount_cents, discount_pct, amount_cents,
                                 monthly_price_cents, promotion_id)
    values (p_user_id, s.id, 'first_payment', p.id, 1,
            o.regular_cents, round((1 - o.price_cents::numeric / o.regular_cents) * 100, 2), o.price_cents,
            o.price_cents, o.promotion_id)
    returning * into v;
    return v;
  end if;

  select * into p from public.plans where id = s.plan_id;
  v_price := public.subscription_monthly_price(s);
  select * into c from public.compute_subscription_state(
    s.next_due_date, v_price, public.panama_today(), s.subscription_status);

  v_kind := case c.status
    when 'grace_period' then 'grace_catchup'::public.payment_kind
    when 'suspended'    then 'reactivation'::public.payment_kind
    else 'renewal'::public.payment_kind
  end;

  if v_kind = 'reactivation' then
    select o2.promotion_id into v_promo from public.plan_offer(p.id) o2;
  end if;

  insert into public.payments (user_id, subscription_id, kind, plan_id, months_covered,
                               base_amount_cents, discount_pct, amount_cents,
                               monthly_price_cents, promotion_id)
  values (p_user_id, s.id, v_kind, p.id, c.months_to_pay,
          v_price * c.months_to_pay, c.discount_pct, c.amount_due_cents,
          v_price, v_promo)
  returning * into v;
  return v;
end $$;
revoke execute on function public.create_subscription_payment(uuid, text) from public, anon, authenticated;
grant  execute on function public.create_subscription_payment(uuid, text) to service_role;

create or replace function public.create_upgrade_payment(p_user_id uuid)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  s   public.subscriptions%rowtype;
  o   record;
  c   record;
  v   public.payments%rowtype;
begin
  select * into s from public.subscriptions where user_id = p_user_id for update;
  if not found then raise exception 'Necesitas un plan activo para cambiarte a PRO.'; end if;
  if s.plan_id = 'pro' then raise exception 'Ya tienes el Plan PRO.'; end if;
  if not exists (select 1 from public.plans where id = 'pro' and is_active) then
    raise exception 'El Plan PRO no está disponible.';
  end if;

  select * into c from public.compute_subscription_state(
    s.next_due_date, 1, public.panama_today(), s.subscription_status);
  if c.status not in ('active', 'expiring_soon') then
    raise exception 'Primero ponte al día con tu pago pendiente y luego podrás cambiarte a PRO.';
  end if;

  select * into o from public.plan_offer('pro');

  update public.payments set status = 'expired'
  where user_id = p_user_id and status = 'pending' and kind <> 'addon';

  insert into public.payments (user_id, subscription_id, kind, plan_id, months_covered,
                               base_amount_cents, discount_pct, amount_cents, is_upgrade,
                               monthly_price_cents, promotion_id)
  values (p_user_id, s.id, 'renewal', 'pro', 1,
          o.price_cents, 35, round(o.price_cents * 0.65)::integer, true,
          o.price_cents, o.promotion_id)
  returning * into v;
  return v;
end $$;
revoke execute on function public.create_upgrade_payment(uuid) from public, anon, authenticated;
grant  execute on function public.create_upgrade_payment(uuid) to service_role;

-- apply_payment: igual que en la Fase 7, más el precio congelado.
create or replace function public.apply_payment(
  p_payment_id            uuid,
  p_yappy_transaction_id  text,
  p_raw                   jsonb default null
)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  s   public.subscriptions%rowtype;
  c   record;
  t   date := public.panama_today();
  v_expected public.payment_kind;
  v_new_due  date;
  v_restart  boolean;
  v_monthly  integer;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Pago % no existe', p_payment_id;
  end if;
  if pay.applied_at is not null then
    return pay;
  end if;

  update public.payments set
    status               = 'paid',
    paid_at              = coalesce(paid_at, now()),
    yappy_transaction_id = coalesce(p_yappy_transaction_id, yappy_transaction_id),
    raw_webhook          = coalesce(p_raw, raw_webhook)
  where id = pay.id
  returning * into pay;

  -- Add-ons
  if pay.kind = 'addon' then
    if pay.addon_id = 'posts_boost_5' then
      update public.subscriptions set extra_posts_balance = extra_posts_balance + 5
      where user_id = pay.user_id;
    elsif pay.addon_id = 'template_pack' then
      update public.subscriptions set extra_template_slots = extra_template_slots + 5
      where user_id = pay.user_id;
    end if;
    update public.payments set applied_at = now() where id = pay.id returning * into pay;
    return pay;
  end if;

  -- Precio mensual que queda congelado con este pago.
  v_monthly := coalesce(pay.monthly_price_cents, pay.base_amount_cents / greatest(pay.months_covered, 1));

  select * into s from public.subscriptions where user_id = pay.user_id for update;

  if not found then
    insert into public.subscriptions (user_id, plan_id, subscription_status, current_period_start,
                                      next_due_date, grace_period_until, cycle_resets_on, last_payment_at,
                                      locked_price_cents)
    values (pay.user_id, pay.plan_id, 'active', t, t + 30, t + 60, t + 30, now(), v_monthly)
    returning * into s;
  else
    select * into c from public.compute_subscription_state(
      s.next_due_date, public.subscription_monthly_price(s), t, s.subscription_status);

    v_expected := case
      when c.status in ('pending', 'canceled') then 'first_payment'::public.payment_kind
      when c.status = 'grace_period'           then 'grace_catchup'::public.payment_kind
      when c.status = 'suspended'              then 'reactivation'::public.payment_kind
      else 'renewal'::public.payment_kind
    end;

    -- El estado cambió entre crear la orden y pagarla: revisión manual.
    if pay.kind <> v_expected
       or (pay.kind <> 'first_payment' and not pay.is_upgrade and pay.amount_cents < c.amount_due_cents) then
      update public.payments set needs_review = true where id = pay.id returning * into pay;
      return pay;
    end if;

    v_new_due := case pay.kind
      when 'first_payment' then t + 30
      when 'renewal'       then s.next_due_date + 30
      when 'grace_catchup' then s.next_due_date + 60
      when 'reactivation'  then greatest(s.next_due_date + 60, t + 30)
    end;
    v_restart := pay.kind in ('first_payment', 'reactivation');

    update public.subscriptions set
      plan_id               = coalesce(pay.plan_id, plan_id),
      subscription_status   = 'active',
      current_period_start  = case when v_restart then t else current_period_start end,
      next_due_date         = v_new_due,
      grace_period_until    = v_new_due + 30,
      unpaid_months         = 0,
      suspended_at          = null,
      posts_used_this_cycle = case when v_restart then 0 else posts_used_this_cycle end,
      cycle_resets_on       = case when v_restart then t + 30 else cycle_resets_on end,
      last_payment_at       = now(),
      locked_price_cents    = case
                                when v_restart or pay.is_upgrade then v_monthly
                                else coalesce(locked_price_cents, v_monthly)
                              end
    where id = s.id
    returning * into s;
  end if;

  update public.payments set applied_at = now(), subscription_id = s.id
  where id = pay.id
  returning * into pay;
  return pay;
end $$;
revoke execute on function public.apply_payment(uuid, text, jsonb) from public, anon, authenticated;
grant  execute on function public.apply_payment(uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 5. Clientes que ya pagaron: congelan el precio de lanzamiento
-- ---------------------------------------------------------------------
update public.subscriptions s
set locked_price_cents = (select o.price_cents from public.plan_offer(s.plan_id) o)
where s.locked_price_cents is null
  and s.next_due_date is not null
  and s.subscription_status not in ('pending', 'canceled', 'suspended');
