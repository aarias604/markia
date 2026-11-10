-- =====================================================================
-- Markia · Migración Fase 20 · Nuevos paquetes de la Tienda
--   · Boost de 10 Posts IA Extra  ($11.99)
--   · Boost de 20 Posts IA Extra  ($19.99)
--   · Paquete de 10 videos        ($24.99)
-- Los precios se pueden cambiar después en «Precios y promos».
-- Se puede ejecutar más de una vez (no cambia precios ya editados).
-- =====================================================================

insert into public.addons (id, name, price_cents, units) values
  ('posts_boost_10', 'Boost de 10 Posts IA Extra', 1199, 10),
  ('posts_boost_20', 'Boost de 20 Posts IA Extra', 1999, 20),
  ('video_pack_10',  'Paquete de 10 videos',       2499, 10)
on conflict (id) do nothing;

-- Asegura las unidades de los paquetes existentes.
update public.addons set units = 5 where id = 'posts_boost_5' and units is distinct from 5;
update public.addons set units = 3 where id = 'video_pack_3'  and units is distinct from 3;

-- apply_payment: igual que en la Fase 16, pero los paquetes suman sus unidades automáticamente.
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
  v_units    integer;
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
    -- Cada paquete suma sus unidades (columna addons.units).
    select coalesce(units, 0) into v_units from public.addons where id = pay.addon_id;
    if pay.addon_id like 'posts_boost_%' then
      update public.subscriptions set extra_posts_balance = extra_posts_balance + coalesce(v_units, 0)
      where user_id = pay.user_id;
    elsif pay.addon_id like 'video_pack_%' then
      update public.subscriptions set extra_videos_balance = extra_videos_balance + coalesce(v_units, 0)
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
