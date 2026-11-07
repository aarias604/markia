-- =====================================================================
-- Markia · Migración Fase 15 · Pago con tarjeta (Pagadito) y cobro automático
-- Pagadito "Pago único con cobro programado": el cliente paga hoy en la
-- pantalla de Pagadito y autoriza cobros mensuales futuros con fecha fija.
--   card_mandates : cada autorización del cliente (un "mandato").
--   card_charges  : cada cobro (el 0 es el de hoy; 1..N los mensuales).
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Método de pago "card"
alter table public.payments drop constraint if exists payments_method_ck;
alter table public.payments add constraint payments_method_ck check (method in ('yappy', 'crypto', 'card'));

-- 2. Tablas
create table if not exists public.card_mandates (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  purpose             text not null check (purpose in ('subscription', 'addon')),
  plan_id             text references public.plans(id),
  monthly_price_cents integer,
  autopay             boolean not null default false,
  initial_payment_id  uuid references public.payments(id) on delete set null,
  auth_token          text unique,          -- token de la transacción en Pagadito
  oauth_token         text,                 -- token de autorización de cobros
  status              text not null default 'pending'
                      check (status in ('pending', 'active', 'finished', 'canceled', 'failed', 'expired')),
  cancel_requested    boolean not null default false,
  last_error          text,
  created_at          timestamptz not null default now(),
  activated_at        timestamptz,
  canceled_at         timestamptz
);
create index if not exists card_mandates_user_idx on public.card_mandates (user_id, created_at desc);

create table if not exists public.card_charges (
  id            uuid primary key default gen_random_uuid(),
  mandate_id    uuid not null references public.card_mandates(id) on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  seq           smallint not null,
  ern           text not null unique,
  due_date      date not null,
  amount_cents  integer not null check (amount_cents >= 100),
  token_pending text,
  status        text not null default 'SCHEDULED',  -- SCHEDULED | PENDING | COMPLETED | VERIFYING | FAILED | REVOKED | UNCOLLECTABLE | CANCELED | EXPIRED
  reference     text,
  payment_id    uuid references public.payments(id) on delete set null,
  processed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (mandate_id, seq)
);
create index if not exists card_charges_due_idx on public.card_charges (due_date) where processed_at is null;

alter table public.card_mandates enable row level security;
alter table public.card_charges  enable row level security;   -- sin políticas: solo el servidor

-- 3. Crear el mandato y sus cobros a partir de un cobro pendiente de Markia
create or replace function public.create_card_mandate(p_payment_id uuid, p_months integer default 12)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  s   public.subscriptions%rowtype;
  m   public.card_mandates%rowtype;
  t   date := public.panama_today();
  v_first_due date;
  v_monthly   integer;
  v_desc      text;
  i integer;
begin
  select * into pay from public.payments where id = p_payment_id and status = 'pending';
  if not found then raise exception 'Cobro no encontrado'; end if;

  update public.payments set method = 'card' where id = pay.id;

  if pay.kind = 'addon' then
    insert into public.card_mandates (user_id, purpose, initial_payment_id, autopay)
    values (pay.user_id, 'addon', pay.id, false)
    returning * into m;
    select name into v_desc from public.addons where id = pay.addon_id;
    insert into public.card_charges (mandate_id, user_id, seq, ern, due_date, amount_cents)
    values (m.id, pay.user_id, 0, 'MK-' || replace(m.id::text, '-', '') || '-0', t, pay.amount_cents);
  else
    v_monthly := coalesce(pay.monthly_price_cents, pay.base_amount_cents / greatest(pay.months_covered, 1));
    insert into public.card_mandates (user_id, purpose, plan_id, monthly_price_cents, initial_payment_id, autopay)
    values (pay.user_id, 'subscription', pay.plan_id, v_monthly, pay.id, coalesce(p_months, 0) > 0)
    returning * into m;

    insert into public.card_charges (mandate_id, user_id, seq, ern, due_date, amount_cents)
    values (m.id, pay.user_id, 0, 'MK-' || replace(m.id::text, '-', '') || '-0', t, pay.amount_cents);

    if coalesce(p_months, 0) > 0 then
      -- La fecha del primer cobro mensual = el vencimiento que quedará después del pago de hoy.
      select * into s from public.subscriptions where user_id = pay.user_id;
      v_first_due := case
        when s.id is null or s.next_due_date is null or pay.kind = 'first_payment' then t + 30
        when pay.kind = 'renewal'       then s.next_due_date + 30
        when pay.kind = 'grace_catchup' then s.next_due_date + 60
        when pay.kind = 'reactivation'  then greatest(s.next_due_date + 60, t + 30)
      end;
      for i in 1 .. least(p_months, 24) loop
        insert into public.card_charges (mandate_id, user_id, seq, ern, due_date, amount_cents)
        values (m.id, pay.user_id, i, 'MK-' || replace(m.id::text, '-', '') || '-' || i,
                v_first_due + 30 * (i - 1), v_monthly);
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'mandate_id', m.id,
    'charges', (select jsonb_agg(jsonb_build_object('seq', c.seq, 'ern', c.ern, 'due_date', c.due_date,
                                                    'amount_cents', c.amount_cents) order by c.seq)
                from public.card_charges c where c.mandate_id = m.id)
  );
end $$;
revoke execute on function public.create_card_mandate(uuid, integer) from public, anon, authenticated;
grant  execute on function public.create_card_mandate(uuid, integer) to service_role;

-- 4. Aplicar un cobro de tarjeta confirmado (COMPLETED) por Pagadito
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
                    when autopay and not pay.needs_review then 'active' else 'finished' end,
      activated_at = now()
    where id = m.id;
    -- Solo un cobro automático a la vez: se cancelan los anteriores.
    if m.purpose = 'subscription' then
      update public.card_mandates set cancel_requested = true
      where user_id = m.user_id and id <> m.id and status in ('active', 'pending') and purpose = 'subscription';
    end if;
  else
    -- Cobro mensual programado
    select * into s from public.subscriptions where user_id = m.user_id for update;
    insert into public.payments (user_id, subscription_id, kind, plan_id, months_covered, base_amount_cents,
                                 discount_pct, amount_cents, monthly_price_cents, method, status, paid_at,
                                 yappy_transaction_id)
    values (m.user_id, s.id, 'renewal', m.plan_id, 1, ch.amount_cents, 0, ch.amount_cents, ch.amount_cents,
            'card', 'paid', now(), 'PGD-' || ch.ern)
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

    if not exists (select 1 from public.card_charges where mandate_id = m.id and seq > ch.seq) then
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

-- 5. Si el cliente se cambia a PRO por otro medio, se cancela su cobro automático anterior
create or replace function public.handle_upgrade_cancels_autopay()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.applied_at is null and new.applied_at is not null and new.is_upgrade and new.method <> 'card' then
    update public.card_mandates set cancel_requested = true
    where user_id = new.user_id and purpose = 'subscription' and status in ('active', 'pending');
  end if;
  return new;
end $$;

drop trigger if exists payments_upgrade_cancels_autopay on public.payments;
create trigger payments_upgrade_cancels_autopay
  after update on public.payments
  for each row execute function public.handle_upgrade_cancels_autopay();

-- 6. Estado del cobro automático para el panel del cliente
create or replace function public.get_my_autopay()
returns table (mandate_id uuid, plan_id text, monthly_price_cents integer, next_charge_date date,
               remaining integer, last_charge_date date)
language sql stable security definer set search_path = public as $$
  select m.id, m.plan_id, m.monthly_price_cents,
         min(c.due_date) filter (where c.processed_at is null),
         count(*) filter (where c.processed_at is null)::integer,
         max(c.due_date)
  from public.card_mandates m
  join public.card_charges c on c.mandate_id = m.id
  where m.user_id = auth.uid() and m.status = 'active' and not m.cancel_requested
  group by m.id
  order by m.created_at desc
  limit 1
$$;
grant execute on function public.get_my_autopay() to authenticated;
