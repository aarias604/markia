-- =====================================================================
-- Markia · Migración Fase 7 (pagos con Yappy)
-- - Cobro de add-ons (create_addon_payment)
-- - Pack de Plantillas: +5 espacios de plantillas propias
-- - apply_payment actualizado para entregar los add-ons
-- Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.subscriptions
  add column if not exists extra_template_slots integer not null default 0 check (extra_template_slots >= 0);

-- Crea el cobro pendiente de un add-on con el precio de la tabla addons.
create or replace function public.create_addon_payment(p_user_id uuid, p_addon_id text)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  a public.addons%rowtype;
  v public.payments%rowtype;
  v_sub uuid;
begin
  select * into a from public.addons where id = p_addon_id and is_active;
  if not found then
    raise exception 'Este producto no está disponible.';
  end if;

  select id into v_sub from public.subscriptions where user_id = p_user_id;
  if a.id in ('posts_boost_5', 'template_pack') and v_sub is null then
    raise exception 'Necesitas un plan activo para comprar este producto.';
  end if;

  update public.payments set status = 'expired'
  where user_id = p_user_id and status = 'pending' and kind = 'addon';

  insert into public.payments (user_id, subscription_id, kind, addon_id, months_covered,
                               base_amount_cents, discount_pct, amount_cents)
  values (p_user_id, v_sub, 'addon', a.id, 0, a.price_cents, 0, a.price_cents)
  returning * into v;
  return v;
end $$;

revoke execute on function public.create_addon_payment(uuid, text) from public, anon, authenticated;
grant  execute on function public.create_addon_payment(uuid, text) to service_role;

-- Límite de plantillas propias = las del plan + las compradas en la Tienda.
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

  select coalesce(p.custom_templates, 0) + coalesce(s.extra_template_slots, 0) into v_limit
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

-- apply_payment: igual que en la migración inicial, más la entrega del Pack de Plantillas.
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
  p   public.plans%rowtype;
  c   record;
  t   date := public.panama_today();
  v_expected public.payment_kind;
  v_new_due  date;
  v_restart  boolean;
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
    -- logo_service es un servicio manual: el pago queda en 'paid' y lo atiendes por correo.
    update public.payments set applied_at = now() where id = pay.id returning * into pay;
    return pay;
  end if;

  select * into s from public.subscriptions where user_id = pay.user_id for update;

  if not found then
    insert into public.subscriptions (user_id, plan_id, subscription_status, current_period_start,
                                      next_due_date, grace_period_until, cycle_resets_on, last_payment_at)
    values (pay.user_id, pay.plan_id, 'active', t, t + 30, t + 60, t + 30, now())
    returning * into s;
  else
    select * into p from public.plans where id = s.plan_id;
    select * into c from public.compute_subscription_state(
      s.next_due_date, p.price_cents, t, s.subscription_status);

    v_expected := case
      when c.status in ('pending', 'canceled') then 'first_payment'::public.payment_kind
      when c.status = 'grace_period'           then 'grace_catchup'::public.payment_kind
      when c.status = 'suspended'              then 'reactivation'::public.payment_kind
      else 'renewal'::public.payment_kind
    end;

    -- El estado cambió entre crear la orden y pagarla (p. ej. cruzó la medianoche).
    -- El dinero ya entró: se marca para revisión manual en vez de perderlo.
    if pay.kind <> v_expected
       or (pay.kind <> 'first_payment' and pay.amount_cents < c.amount_due_cents) then
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
      last_payment_at       = now()
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
