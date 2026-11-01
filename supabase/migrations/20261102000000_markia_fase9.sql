-- =====================================================================
-- Markia · Migración Fase 9
-- 1. Aceptación de términos y referido en el registro
-- 2. Protección de columnas sensibles de profiles (is_admin, referido)
-- 3. Programa de referidos: 10% de cada mensualidad pagada por el referido,
--    15 días de espera, retiro mínimo $25 (banco o cripto)
-- 4. Pagos con cripto (manual, Lulubit) con aprobación del administrador
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfil: términos, referido, administrador
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists terms_version     text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists referred_by       uuid references auth.users on delete set null,
  add column if not exists is_admin          boolean not null default false;

-- El usuario solo puede editar estos campos de su perfil (no is_admin ni referred_by).
revoke update on public.profiles from authenticated;
grant update (full_name, business_name, phone, onboarding_completed) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2. Programa de referidos
-- ---------------------------------------------------------------------
create table if not exists public.referral_members (
  user_id                uuid primary key references auth.users on delete cascade,
  code                   text not null unique,
  accepted_terms_version text not null,
  accepted_at            timestamptz not null default now(),
  status                 text not null default 'active' check (status in ('active', 'suspended'))
);

create table if not exists public.payout_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  amount_cents integer not null check (amount_cents >= 2500),
  method       text not null check (method in ('bank', 'crypto')),
  details      jsonb not null,
  status       text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  reference    text,
  admin_note   text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.referral_commissions (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references auth.users on delete cascade,
  referred_id  uuid not null references auth.users on delete cascade,
  payment_id   uuid not null unique references public.payments on delete cascade,
  base_cents   integer not null,
  amount_cents integer not null check (amount_cents >= 0),
  status       text not null default 'earned' check (status in ('earned', 'in_payout', 'paid', 'reversed')),
  available_at timestamptz not null,
  payout_id    uuid references public.payout_requests on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists referral_commissions_referrer_idx on public.referral_commissions (referrer_id, created_at desc);

alter table public.referral_members     enable row level security;
alter table public.payout_requests      enable row level security;
alter table public.referral_commissions enable row level security;

drop policy if exists referral_members_own on public.referral_members;
create policy referral_members_own on public.referral_members for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists payout_requests_own on public.payout_requests;
create policy payout_requests_own on public.payout_requests for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists referral_commissions_own on public.referral_commissions;
create policy referral_commissions_own on public.referral_commissions for select to authenticated
  using (referrer_id = (select auth.uid()));

-- Registro: guarda la aceptación de términos y quién lo refirió.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref text := upper(nullif(trim(new.raw_user_meta_data ->> 'ref'), ''));
  v_referrer uuid;
begin
  if v_ref is not null then
    select user_id into v_referrer
    from public.referral_members
    where code = v_ref and status = 'active' and user_id <> new.id;
  end if;

  insert into public.profiles (id, full_name, terms_version, terms_accepted_at, referred_by)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'terms_version',
    case when new.raw_user_meta_data ? 'terms_version' then now() end,
    v_referrer
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Unirse al programa (requiere aceptar los términos del programa).
create or replace function public.join_referral_program(p_terms_version text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'Inicia sesión primero.'; end if;
  if coalesce(trim(p_terms_version), '') = '' then raise exception 'Debes aceptar los términos del programa.'; end if;

  select code into v_code from public.referral_members where user_id = v_uid;
  if found then return v_code; end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.referral_members where code = v_code);
  end loop;

  insert into public.referral_members (user_id, code, accepted_terms_version)
  values (v_uid, v_code, p_terms_version);
  return v_code;
end $$;

-- Resumen de saldos del referente.
create or replace function public.get_referral_summary()
returns table (
  code text,
  joined_at timestamptz,
  referrals_count integer,
  pending_cents integer,
  available_cents integer,
  in_payout_cents integer,
  paid_cents integer
)
language sql stable security definer set search_path = public as $$
  select
    m.code,
    m.accepted_at,
    (select count(*)::int from public.profiles p where p.referred_by = m.user_id),
    coalesce((select sum(amount_cents)::int from public.referral_commissions c
              where c.referrer_id = m.user_id and c.status = 'earned' and c.available_at > now()), 0),
    coalesce((select sum(amount_cents)::int from public.referral_commissions c
              where c.referrer_id = m.user_id and c.status = 'earned' and c.available_at <= now()), 0),
    coalesce((select sum(amount_cents)::int from public.referral_commissions c
              where c.referrer_id = m.user_id and c.status = 'in_payout'), 0),
    coalesce((select sum(amount_cents)::int from public.referral_commissions c
              where c.referrer_id = m.user_id and c.status = 'paid'), 0)
  from public.referral_members m
  where m.user_id = auth.uid()
$$;

-- Solicitar retiro: mínimo $25 disponibles, una solicitud abierta a la vez.
create or replace function public.request_payout(p_method text, p_details jsonb)
returns public.payout_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v public.payout_requests%rowtype;
begin
  if v_uid is null then raise exception 'Inicia sesión primero.'; end if;
  if not exists (select 1 from public.referral_members where user_id = v_uid and status = 'active') then
    raise exception 'No eres parte del programa de referidos o tu cuenta está suspendida.';
  end if;
  if p_method not in ('bank', 'crypto') then raise exception 'Método de retiro inválido.'; end if;
  if p_method = 'bank' and (coalesce(p_details ->> 'banco', '') = '' or coalesce(p_details ->> 'numero', '') = ''
                            or coalesce(p_details ->> 'titular', '') = '') then
    raise exception 'Completa banco, número de cuenta y titular.';
  end if;
  if p_method = 'crypto' and (coalesce(p_details ->> 'red', '') = '' or coalesce(p_details ->> 'direccion', '') = '') then
    raise exception 'Completa la red y la dirección de tu billetera.';
  end if;
  if exists (select 1 from public.payout_requests where user_id = v_uid and status = 'requested') then
    raise exception 'Ya tienes una solicitud de retiro en proceso.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_total
  from public.referral_commissions
  where referrer_id = v_uid and status = 'earned' and available_at <= now();

  if v_total < 2500 then
    raise exception 'Necesitas al menos $25.00 disponibles para retirar (tienes $%).', to_char(v_total / 100.0, 'FM999990.00');
  end if;

  insert into public.payout_requests (user_id, amount_cents, method, details)
  values (v_uid, v_total, p_method, p_details)
  returning * into v;

  update public.referral_commissions
  set status = 'in_payout', payout_id = v.id
  where referrer_id = v_uid and status = 'earned' and available_at <= now();

  return v;
end $$;

-- Admin: marcar retiro pagado o rechazarlo (devuelve las comisiones al saldo).
create or replace function public.complete_payout(p_payout_id uuid, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.payout_requests set status = 'paid', reference = p_reference, processed_at = now()
  where id = p_payout_id and status = 'requested';
  if not found then raise exception 'La solicitud no existe o ya fue procesada.'; end if;
  update public.referral_commissions set status = 'paid' where payout_id = p_payout_id;
end $$;

create or replace function public.reject_payout(p_payout_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.payout_requests set status = 'rejected', admin_note = p_note, processed_at = now()
  where id = p_payout_id and status = 'requested';
  if not found then raise exception 'La solicitud no existe o ya fue procesada.'; end if;
  update public.referral_commissions set status = 'earned', payout_id = null where payout_id = p_payout_id;
end $$;

-- Comisión automática: 10% de cada mensualidad aplicada (no add-ons), mientras el referido pague.
-- Se libera a los 15 días. Si el pago se reembolsa, la comisión se revierte.
create or replace function public.handle_payment_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_referrer uuid;
begin
  if tg_op = 'UPDATE' and old.applied_at is null and new.applied_at is not null and new.kind <> 'addon' then
    select p.referred_by into v_referrer
    from public.profiles p
    join public.referral_members m on m.user_id = p.referred_by and m.status = 'active'
    where p.id = new.user_id;

    if v_referrer is not null and v_referrer <> new.user_id then
      insert into public.referral_commissions (referrer_id, referred_id, payment_id, base_cents, amount_cents, available_at)
      values (v_referrer, new.user_id, new.id, new.amount_cents, round(new.amount_cents * 0.10), now() + interval '15 days')
      on conflict (payment_id) do nothing;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status = 'refunded' and old.status <> 'refunded' then
    update public.referral_commissions set status = 'reversed'
    where payment_id = new.id and status = 'earned';
  end if;
  return new;
end $$;

drop trigger if exists payments_referral_commission on public.payments;
create trigger payments_referral_commission
  after update on public.payments
  for each row execute function public.handle_payment_commission();

-- ---------------------------------------------------------------------
-- 3. Pagos con cripto (manual)
-- ---------------------------------------------------------------------
alter table public.payments
  add column if not exists method              text not null default 'yappy',
  add column if not exists crypto_network      text,
  add column if not exists crypto_tx_hash      text,
  add column if not exists crypto_submitted_at timestamptz;

do $$ begin
  alter table public.payments add constraint payments_method_ck check (method in ('yappy', 'crypto'));
exception when duplicate_object then null; end $$;

create unique index if not exists payments_crypto_tx_hash_key on public.payments (crypto_tx_hash) where crypto_tx_hash is not null;

-- El cliente registra el comprobante (hash) de su envío.
create or replace function public.submit_crypto_payment(p_payment_id uuid, p_network text, p_tx_hash text)
returns void language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
begin
  select * into pay from public.payments where id = p_payment_id and user_id = auth.uid() for update;
  if not found then raise exception 'Orden no encontrada.'; end if;
  if pay.method <> 'crypto' then raise exception 'Esta orden no es de pago con cripto.'; end if;
  if pay.applied_at is not null then raise exception 'Esta orden ya fue pagada.'; end if;
  if length(coalesce(trim(p_tx_hash), '')) < 10 then raise exception 'El comprobante (hash) no parece válido.'; end if;
  if exists (select 1 from public.payments where crypto_tx_hash = trim(p_tx_hash) and id <> p_payment_id) then
    raise exception 'Ese comprobante ya fue usado en otra orden.';
  end if;

  update public.payments set
    crypto_network = p_network,
    crypto_tx_hash = trim(p_tx_hash),
    crypto_submitted_at = now()
  where id = p_payment_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Permisos
-- ---------------------------------------------------------------------
revoke execute on function public.join_referral_program(text)            from public, anon;
revoke execute on function public.get_referral_summary()                 from public, anon;
revoke execute on function public.request_payout(text, jsonb)            from public, anon;
revoke execute on function public.submit_crypto_payment(uuid, text, text) from public, anon;
grant  execute on function public.join_referral_program(text)            to authenticated;
grant  execute on function public.get_referral_summary()                 to authenticated;
grant  execute on function public.request_payout(text, jsonb)            to authenticated;
grant  execute on function public.submit_crypto_payment(uuid, text, text) to authenticated;

revoke execute on function public.complete_payout(uuid, text) from public, anon, authenticated;
revoke execute on function public.reject_payout(uuid, text)   from public, anon, authenticated;
grant  execute on function public.complete_payout(uuid, text) to service_role;
grant  execute on function public.reject_payout(uuid, text)   to service_role;
