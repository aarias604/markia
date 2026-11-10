-- =====================================================================
-- Markia · Migración Fase 19 · Pago con tarjeta con Tilopay (reemplaza Pagadito)
-- Flujo:
--   1. El cliente paga hoy en la pantalla segura de Tilopay. Si activa la
--      renovación automática, Tilopay guarda su tarjeta y nos devuelve un
--      token (nunca vemos el número de la tarjeta).
--   2. En cada fecha de pago, Markia cobra la mensualidad a ese token.
-- Reutiliza las tablas card_mandates y card_charges de la fase 15.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Columnas nuevas
alter table public.card_mandates add column if not exists provider text not null default 'pagadito';
alter table public.card_mandates drop constraint if exists card_mandates_provider_ck;
alter table public.card_mandates add constraint card_mandates_provider_ck check (provider in ('pagadito', 'tilopay'));
alter table public.card_mandates add column if not exists card_token  text;  -- token de Tilopay (solo servidor)
alter table public.card_mandates add column if not exists card_email  text;  -- correo asociado al token
alter table public.card_mandates add column if not exists card_brand  text;
alter table public.card_mandates add column if not exists card_last4  text;
alter table public.card_mandates add column if not exists failed_attempts integer not null default 0;

alter table public.card_charges add column if not exists attempt_error text;
create index if not exists card_charges_open_idx on public.card_charges (status) where processed_at is null;

-- 2. Crear el mandato de Tilopay a partir de un cobro pendiente de Markia.
--    El número de orden (ern) es alfanumérico, como lo pide Tilopay.
create or replace function public.create_tilopay_mandate(p_payment_id uuid, p_autopay boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  m   public.card_mandates%rowtype;
  v_ern text;
begin
  select * into pay from public.payments where id = p_payment_id and status = 'pending';
  if not found then raise exception 'Cobro no encontrado'; end if;

  update public.payments set method = 'card' where id = pay.id;

  insert into public.card_mandates (user_id, purpose, plan_id, monthly_price_cents, initial_payment_id, autopay, provider)
  values (pay.user_id,
          case when pay.kind = 'addon' then 'addon' else 'subscription' end,
          case when pay.kind = 'addon' then null else pay.plan_id end,
          case when pay.kind = 'addon' then null
               else coalesce(pay.monthly_price_cents, pay.base_amount_cents / greatest(pay.months_covered, 1)) end,
          pay.id,
          pay.kind <> 'addon' and coalesce(p_autopay, false),
          'tilopay')
  returning * into m;

  v_ern := 'MK' || upper(substr(replace(m.id::text, '-', ''), 1, 16)) || 'C0';
  insert into public.card_charges (mandate_id, user_id, seq, ern, due_date, amount_cents, status)
  values (m.id, pay.user_id, 0, v_ern, public.panama_today(), pay.amount_cents, 'PENDING');

  return jsonb_build_object('mandate_id', m.id, 'ern', v_ern, 'amount_cents', pay.amount_cents, 'autopay', m.autopay);
end $$;
revoke execute on function public.create_tilopay_mandate(uuid, boolean) from public, anon, authenticated;
grant  execute on function public.create_tilopay_mandate(uuid, boolean) to service_role;

-- 3. Aplicar un cobro de tarjeta confirmado (igual que la fase 15, ajustado para Tilopay)
create or replace function public.apply_card_charge(p_charge_id uuid, p_reference text default null)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  ch  public.card_charges%rowtype;
  m   public.card_mandates%rowtype;
  s   public.subscriptions%rowtype;
  c   record;
  pay public.payments%rowtype;
  v_due date;
begin
  select * into ch from public.card_charges where id = p_charge_id for update;
  if not found then raise exception 'Cobro de tarjeta no encontrado'; end if;
  select * into m from public.card_mandates where id = ch.mandate_id for update;

  if ch.processed_at is not null then
    select * into pay from public.payments where id = ch.payment_id;
    return pay;
  end if;

  if ch.seq = 0 then
    -- Pago inicial: es el cobro de Markia creado al iniciar el pago.
    select * into pay from public.apply_payment(m.initial_payment_id, p_reference, null);
    update public.card_mandates set
      status = case when status = 'canceled' then 'canceled'
                    when autopay and not pay.needs_review
                         and (provider <> 'tilopay' or card_token is not null) then 'active'
                    else 'finished' end,
      activated_at = now()
    where id = m.id;
    -- Solo un cobro automático a la vez: se cancelan los anteriores.
    if m.purpose = 'subscription' and exists (select 1 from public.card_mandates where id = m.id and status = 'active') then
      update public.card_mandates set cancel_requested = true
      where user_id = m.user_id and id <> m.id and status in ('active', 'pending') and purpose = 'subscription';
    end if;
  else
    -- Cobro mensual automático
    select * into s from public.subscriptions where user_id = m.user_id for update;
    insert into public.payments (user_id, subscription_id, kind, plan_id, months_covered, base_amount_cents,
                                 discount_pct, amount_cents, monthly_price_cents, method, status, paid_at,
                                 yappy_transaction_id)
    values (m.user_id, s.id, 'renewal', m.plan_id, 1, ch.amount_cents, 0, ch.amount_cents, ch.amount_cents,
            'card', 'paid', now(), case when m.provider = 'tilopay' then 'TLP-' else 'PGD-' end || ch.ern)
    returning * into pay;

    select * into c from public.compute_subscription_state(
      s.next_due_date, 1, public.panama_today(), s.subscription_status);

    if s.id is null or m.status <> 'active' or s.plan_id <> m.plan_id
       or c.status not in ('active', 'expiring_soon', 'grace_period') then
      -- Algo cambió (plan, suspensión o cancelación): revisión manual.
      update public.payments set needs_review = true where id = pay.id returning * into pay;
    else
      v_due := s.next_due_date + 30;
      update public.subscriptions set
        subscription_status = 'active',
        next_due_date       = v_due,
        grace_period_until  = v_due + 30,
        unpaid_months       = 0,
        suspended_at        = null,
        last_payment_at     = now(),
        locked_price_cents  = coalesce(locked_price_cents, ch.amount_cents)
      where id = s.id;
      update public.payments set applied_at = now() where id = pay.id returning * into pay;
    end if;

    if m.provider = 'tilopay' then
      update public.card_mandates set failed_attempts = 0, last_error = null where id = m.id;
    elsif not exists (select 1 from public.card_charges where mandate_id = m.id and seq > ch.seq) then
      update public.card_mandates set status = 'finished' where id = m.id and status = 'active';
    end if;
  end if;

  update public.card_charges set
    status = 'COMPLETED', reference = coalesce(p_reference, reference),
    payment_id = pay.id, processed_at = now()
  where id = ch.id;
  return pay;
end $$;
revoke execute on function public.apply_card_charge(uuid, text) from public, anon, authenticated;
grant  execute on function public.apply_card_charge(uuid, text) to service_role;

-- 4. Mensualidades que toca cobrar hoy con Tilopay.
--    Una vez al día por cliente y como máximo 3 intentos por mensualidad.
create or replace function public.tilopay_due_charges(p_limit integer default 100)
returns table (mandate_id uuid, user_id uuid, plan_id text, due_date date, amount_cents integer,
               card_token text, card_email text, attempts integer)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, m.plan_id, s.next_due_date,
         least(coalesce(m.monthly_price_cents, p.price_cents), coalesce(s.locked_price_cents, p.price_cents), p.price_cents),
         m.card_token, m.card_email,
         (select count(*)::integer from public.card_charges c
           where c.mandate_id = m.id and c.seq > 0 and c.due_date = s.next_due_date)
  from public.card_mandates m
  join public.subscriptions s on s.user_id = m.user_id
  join public.plans p on p.id = m.plan_id
  where m.provider = 'tilopay' and m.status = 'active' and not m.cancel_requested
    and m.card_token is not null
    and s.plan_id = m.plan_id
    and s.next_due_date is not null
    and s.next_due_date <= public.panama_today()
    and s.subscription_status in ('active', 'expiring_soon', 'grace_period')
    -- nada en curso ni intentos de hoy
    and not exists (select 1 from public.card_charges c
                     where c.mandate_id = m.id and c.seq > 0
                       and (c.processed_at is null
                            or (c.created_at at time zone 'America/Panama')::date = public.panama_today()))
  order by s.next_due_date
  limit p_limit
$$;
revoke execute on function public.tilopay_due_charges(integer) from public, anon, authenticated;
grant  execute on function public.tilopay_due_charges(integer) to service_role;

-- Reserva el siguiente número de cobro (evita cobrar dos veces lo mismo).
create or replace function public.reserve_tilopay_charge(p_mandate_id uuid, p_due date, p_amount integer)
returns public.card_charges
language plpgsql security definer set search_path = public as $$
declare
  m  public.card_mandates%rowtype;
  ch public.card_charges%rowtype;
  v_seq integer;
begin
  select * into m from public.card_mandates where id = p_mandate_id and status = 'active' for update;
  if not found then return null; end if;
  if exists (select 1 from public.card_charges where mandate_id = m.id and seq > 0 and processed_at is null) then
    return null;  -- ya hay un cobro en curso
  end if;
  select coalesce(max(seq), 0) + 1 into v_seq from public.card_charges where mandate_id = m.id;
  insert into public.card_charges (mandate_id, user_id, seq, ern, due_date, amount_cents, status)
  values (m.id, m.user_id, v_seq,
          'MK' || upper(substr(replace(m.id::text, '-', ''), 1, 16)) || 'C' || v_seq,
          p_due, p_amount, 'PROCESSING')
  returning * into ch;
  return ch;
end $$;
revoke execute on function public.reserve_tilopay_charge(uuid, date, integer) from public, anon, authenticated;
grant  execute on function public.reserve_tilopay_charge(uuid, date, integer) to service_role;

-- 5. Estado del cobro automático para el panel del cliente
drop function if exists public.get_my_autopay();
create function public.get_my_autopay()
returns table (mandate_id uuid, plan_id text, monthly_price_cents integer, next_charge_date date,
               remaining integer, last_charge_date date, provider text, card_brand text, card_last4 text)
language sql stable security definer set search_path = public as $$
  select m.id, m.plan_id,
         case when m.provider = 'tilopay'
              then least(coalesce(m.monthly_price_cents, p.price_cents), coalesce(s.locked_price_cents, p.price_cents), p.price_cents)
              else m.monthly_price_cents end,
         case when m.provider = 'tilopay' then s.next_due_date
              else (select min(c.due_date) from public.card_charges c where c.mandate_id = m.id and c.processed_at is null) end,
         case when m.provider = 'tilopay' then null
              else (select count(*)::integer from public.card_charges c where c.mandate_id = m.id and c.processed_at is null) end,
         case when m.provider = 'tilopay' then null
              else (select max(c.due_date) from public.card_charges c where c.mandate_id = m.id) end,
         m.provider, m.card_brand, m.card_last4
  from public.card_mandates m
  left join public.subscriptions s on s.user_id = m.user_id
  left join public.plans p on p.id = m.plan_id
  where m.user_id = auth.uid() and m.status = 'active' and not m.cancel_requested
  order by m.created_at desc
  limit 1
$$;
grant execute on function public.get_my_autopay() to authenticated;
