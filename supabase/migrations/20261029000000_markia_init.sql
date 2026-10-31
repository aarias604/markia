-- =====================================================================
-- Markia · Migración inicial
-- Supabase (Postgres 15) · Auth + RLS + Storage + lógica de cobro Yappy
-- Zona horaria de negocio: America/Panama (todas las fechas de corte
-- se evalúan en hora de Panamá, no en UTC).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
create type public.subscription_status as enum (
  'pending',        -- registrado, aún no paga el primer mes
  'active',         -- al día, faltan > 5 días
  'expiring_soon',  -- faltan 0–5 días: banner preventivo
  'grace_period',   -- vencido, días 1–30: funcional, debe 2 meses
  'suspended',      -- día 31+: generador bloqueado, oferta 35 %
  'canceled'
);

create type public.payment_kind as enum (
  'first_payment',  -- 1 mes
  'renewal',        -- 1 mes (dentro o antes de los 5 días)
  'grace_catchup',  -- 2 meses (vencido + entrante)
  'reactivation',   -- 2 meses con 35 % de descuento
  'addon'
);

create type public.payment_status as enum ('pending', 'paid', 'failed', 'expired', 'refunded');
create type public.post_status   as enum ('draft', 'scheduled', 'publishing', 'published', 'failed');
create type public.template_kind as enum ('generic', 'custom', 'addon_pack');

-- ---------------------------------------------------------------------
-- 2. Catálogos
-- ---------------------------------------------------------------------
create table public.plans (
  id                  text primary key,               -- 'basic' | 'pro'
  name                text    not null,
  price_cents         integer not null check (price_cents > 0),
  monthly_posts       integer not null,
  generic_templates   integer not null,
  custom_templates    integer not null default 0,
  instagram_autopost  boolean not null default false,
  is_active           boolean not null default true
);

insert into public.plans (id, name, price_cents, monthly_posts, generic_templates, custom_templates, instagram_autopost) values
  ('basic', 'Plan Básico', 1900, 10, 5, 0, false),
  ('pro',   'Plan PRO',    3900, 26, 5, 5, true);

create table public.addons (
  id           text primary key,
  name         text    not null,
  price_cents  integer not null check (price_cents > 0),
  units        integer,                               -- p. ej. 5 posts en el boost
  is_active    boolean not null default true
);

insert into public.addons (id, name, price_cents, units) values
  ('template_pack', 'Pack de Plantillas Extra',                 999,  null),
  ('logo_service',  'Creación de Logo & Paleta de Colores con IA', 1999, null),
  ('posts_boost_5', 'Boost de 5 Posts IA Extra',                699,  5);

-- ---------------------------------------------------------------------
-- 3. Usuarios, marca y suscripción
-- ---------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users on delete cascade,
  full_name             text,
  business_name         text,
  phone                 text,                         -- celular asociado a Yappy
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.brand_kits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users on delete cascade,
  logo_path        text,                              -- ruta en bucket 'brand-assets'
  color_primary    text check (color_primary   ~ '^#[0-9A-Fa-f]{6}$'),
  color_secondary  text check (color_secondary ~ '^#[0-9A-Fa-f]{6}$'),
  color_accent     text check (color_accent    ~ '^#[0-9A-Fa-f]{6}$'),
  color_cream      text check (color_cream     ~ '^#[0-9A-Fa-f]{6}$'),
  niche            text,
  voice_tone       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users on delete cascade,
  plan_id                text not null references public.plans(id),
  subscription_status    public.subscription_status not null default 'pending',
  current_period_start   date,
  next_due_date          date,                        -- último día cubierto por el pago
  grace_period_until     date,                        -- next_due_date + 30
  unpaid_months          smallint not null default 0 check (unpaid_months between 0 and 2),
  suspended_at           timestamptz,
  -- Cupo de posts (ciclo de 30 días, independiente del cobro)
  posts_used_this_cycle  integer not null default 0 check (posts_used_this_cycle >= 0),
  cycle_resets_on        date,
  extra_posts_balance    integer not null default 0 check (extra_posts_balance >= 0),
  last_payment_at        timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index subscriptions_next_due_idx on public.subscriptions (next_due_date);
create index subscriptions_status_idx   on public.subscriptions (subscription_status);

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  subscription_id       uuid references public.subscriptions(id) on delete set null,
  kind                  public.payment_kind not null,
  plan_id               text references public.plans(id),
  addon_id              text references public.addons(id),
  months_covered        smallint not null default 0,
  base_amount_cents     integer  not null check (base_amount_cents >= 0),
  discount_pct          numeric(5,2) not null default 0,
  amount_cents          integer  not null check (amount_cents > 0),
  status                public.payment_status not null default 'pending',
  yappy_order_id        text unique,
  yappy_transaction_id  text unique,
  raw_webhook           jsonb,
  needs_review          boolean not null default false, -- pagado pero el estado cambió
  paid_at               timestamptz,
  applied_at            timestamptz,                    -- idempotencia del webhook
  created_at            timestamptz not null default now(),
  constraint payments_addon_ck check ((kind = 'addon') = (addon_id is not null))
);

create index payments_user_created_idx on public.payments (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. Plantillas y publicaciones
-- ---------------------------------------------------------------------
create table public.templates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users on delete cascade, -- null = genérica
  kind           public.template_kind not null,
  name           text  not null,
  definition     jsonb not null,                       -- layout para el renderer SVG/Canvas
  preview_path   text,
  created_at     timestamptz not null default now(),
  constraint templates_owner_ck check ((kind = 'generic') = (user_id is null))
);

create table public.posts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  template_id         uuid references public.templates(id) on delete set null,
  caption             text,
  hashtags            text[] not null default '{}',
  image_path          text,
  scheduled_at        timestamptz,
  status              public.post_status not null default 'draft',
  instagram_media_id  text,
  error_message       text,
  created_at          timestamptz not null default now()
);

create index posts_user_scheduled_idx on public.posts (user_id, scheduled_at);

-- ---------------------------------------------------------------------
-- 5. Utilidades
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger brand_kits_updated_at    before update on public.brand_kits    for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.panama_today()
returns date language sql stable as $$
  select (now() at time zone 'America/Panama')::date
$$;

-- ---------------------------------------------------------------------
-- 6. Lógica de cobro (fuente de verdad)
--    Mantener en sincronía con lib/billing/subscription-state.ts
--
--    d = next_due_date - hoy
--    d > 5            → active         (paga 1 mes si quiere adelantar)
--    0 ≤ d ≤ 5        → expiring_soon  (banner preventivo, 1 mes)
--    hoy ≤ due + 30   → grace_period   (funcional, debe 2 meses)
--    hoy > due + 30   → suspended      (bloqueado, 2 meses − 35 %)
-- ---------------------------------------------------------------------
create or replace function public.compute_subscription_state(
  p_next_due_date  date,
  p_price_cents    integer,
  p_today          date default public.panama_today(),
  p_stored_status  public.subscription_status default 'active'
)
returns table (
  status              public.subscription_status,
  days_until_due      integer,
  grace_period_until  date,
  days_left_in_grace  integer,
  unpaid_months       integer,
  months_to_pay       integer,
  discount_pct        numeric,
  amount_due_cents    integer
)
language plpgsql stable as $$
declare
  d integer;
  g date;
begin
  if p_next_due_date is null or p_stored_status in ('pending', 'canceled') then
    return query select
      (case when p_stored_status = 'canceled' then 'canceled' else 'pending' end)::public.subscription_status,
      null::integer, null::date, null::integer, 0, 1, 0::numeric, p_price_cents;
    return;
  end if;

  d := p_next_due_date - p_today;
  g := p_next_due_date + 30;

  if d > 5 then
    return query select 'active'::public.subscription_status, d, g, null::integer, 0, 1, 0::numeric, p_price_cents;
  elsif d >= 0 then
    return query select 'expiring_soon'::public.subscription_status, d, g, null::integer, 0, 1, 0::numeric, p_price_cents;
  elsif p_today <= g then
    return query select 'grace_period'::public.subscription_status, d, g, (g - p_today), 1, 2, 0::numeric, p_price_cents * 2;
  else
    return query select 'suspended'::public.subscription_status, d, g, 0, 2, 2, 35::numeric,
      round(p_price_cents * 2 * (100 - 35) / 100.0)::integer;   -- $38.00 → $24.70
  end if;
end $$;

-- Estado de la suscripción del usuario logueado (respeta RLS).
create or replace function public.get_my_billing()
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
  can_generate        boolean
)
language sql stable security invoker set search_path = public as $$
  select s.id, s.plan_id, p.name, p.price_cents, s.next_due_date,
         c.status, c.days_until_due, c.grace_period_until, c.days_left_in_grace,
         c.unpaid_months, c.months_to_pay, c.discount_pct, c.amount_due_cents,
         c.status in ('expiring_soon', 'grace_period', 'suspended'),
         c.status in ('active', 'expiring_soon', 'grace_period')
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  cross join lateral public.compute_subscription_state(
    s.next_due_date, p.price_cents, public.panama_today(), s.subscription_status) c
  where s.user_id = auth.uid()
$$;

-- Usado por RLS de posts: bloquea el generador en estado suspended.
create or replace function public.can_generate_posts(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.status in ('active', 'expiring_soon', 'grace_period')
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    cross join lateral public.compute_subscription_state(
      s.next_due_date, p.price_cents, public.panama_today(), s.subscription_status) c
    where s.user_id = p_user_id
  ), false)
$$;

-- Job diario: persiste el estado calculado y reinicia cupos de posts.
create or replace function public.refresh_subscription_statuses()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with computed as (
    select s.id, c.status, c.grace_period_until, c.unpaid_months
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    cross join lateral public.compute_subscription_state(
      s.next_due_date, p.price_cents, public.panama_today(), s.subscription_status) c
    where s.subscription_status not in ('pending', 'canceled')
  )
  update public.subscriptions s set
    subscription_status = computed.status,
    grace_period_until  = computed.grace_period_until,
    unpaid_months       = computed.unpaid_months,
    suspended_at        = case when computed.status = 'suspended'
                               then coalesce(s.suspended_at, now()) end
  from computed
  where s.id = computed.id
    and (s.subscription_status, s.unpaid_months)
        is distinct from (computed.status, computed.unpaid_months::smallint);
  get diagnostics v_count = row_count;

  update public.subscriptions set
    posts_used_this_cycle = 0,
    cycle_resets_on = cycle_resets_on + 30 * ((public.panama_today() - cycle_resets_on) / 30 + 1)
  where cycle_resets_on is not null
    and cycle_resets_on <= public.panama_today();

  return v_count;
end $$;

-- Crea la orden pendiente con el monto calculado en BD (nunca desde el cliente).
create or replace function public.create_subscription_payment(
  p_user_id uuid,
  p_plan_id text default null      -- solo para el primer pago o cambio de plan
)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions%rowtype;
  p public.plans%rowtype;
  c record;
  v_kind public.payment_kind;
  v public.payments%rowtype;
begin
  -- Una sola orden de suscripción viva por usuario.
  update public.payments set status = 'expired'
  where user_id = p_user_id and status = 'pending' and kind <> 'addon';

  select * into s from public.subscriptions where user_id = p_user_id;

  if not found or s.next_due_date is null or s.subscription_status in ('pending', 'canceled') then
    select * into p from public.plans where id = coalesce(p_plan_id, s.plan_id) and is_active;
    if not found then
      raise exception 'Plan inválido';
    end if;
    insert into public.payments (user_id, subscription_id, kind, plan_id, months_covered,
                                 base_amount_cents, discount_pct, amount_cents)
    values (p_user_id, s.id, 'first_payment', p.id, 1, p.price_cents, 0, p.price_cents)
    returning * into v;
    return v;
  end if;

  select * into p from public.plans where id = s.plan_id;
  select * into c from public.compute_subscription_state(
    s.next_due_date, p.price_cents, public.panama_today(), s.subscription_status);

  v_kind := case c.status
    when 'grace_period' then 'grace_catchup'::public.payment_kind
    when 'suspended'    then 'reactivation'::public.payment_kind
    else 'renewal'::public.payment_kind
  end;

  insert into public.payments (user_id, subscription_id, kind, plan_id, months_covered,
                               base_amount_cents, discount_pct, amount_cents)
  values (p_user_id, s.id, v_kind, p.id, c.months_to_pay,
          p.price_cents * c.months_to_pay, c.discount_pct, c.amount_due_cents)
  returning * into v;
  return v;
end $$;

-- Aplica un pago confirmado por Yappy. Idempotente (webhooks repetidos).
--   renewal        → next_due_date + 30
--   grace_catchup  → next_due_date + 60 (mes vencido + mes entrante)
--   reactivation   → max(next_due_date + 60, hoy + 30)
--   first_payment  → hoy + 30
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
    end if;
    -- template_pack y logo_service los entrega la app al ver el pago en 'paid'.
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

-- Solo el backend (service_role) puede crear/aplicar cobros o correr el job.
revoke execute on function public.create_subscription_payment(uuid, text)  from public, anon, authenticated;
revoke execute on function public.apply_payment(uuid, text, jsonb)         from public, anon, authenticated;
revoke execute on function public.refresh_subscription_statuses()          from public, anon, authenticated;
grant  execute on function public.create_subscription_payment(uuid, text)  to service_role;
grant  execute on function public.apply_payment(uuid, text, jsonb)         to service_role;
grant  execute on function public.refresh_subscription_statuses()          to service_role;

-- Job diario a las 00:05 hora de Panamá (05:05 UTC). Requiere pg_cron:
-- create extension if not exists pg_cron;
-- select cron.schedule('markia-refresh-subscriptions', '5 5 * * *',
--   $$select public.refresh_subscription_statuses()$$);

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
alter table public.plans         enable row level security;
alter table public.addons        enable row level security;
alter table public.profiles      enable row level security;
alter table public.brand_kits    enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;
alter table public.templates     enable row level security;
alter table public.posts         enable row level security;

-- Catálogos públicos (página de precios)
create policy plans_read  on public.plans  for select to anon, authenticated using (is_active);
create policy addons_read on public.addons for select to anon, authenticated using (is_active);

-- Perfil y kit de marca: solo el dueño
create policy profiles_own_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy brand_kits_own_all on public.brand_kits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Suscripción y pagos: solo lectura para el usuario; escritura vía service_role
create policy subscriptions_own_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy payments_own_select on public.payments for select to authenticated
  using (user_id = (select auth.uid()));

-- Plantillas: genéricas visibles para todos los usuarios; propias editables
create policy templates_read on public.templates for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy templates_own_write on public.templates for insert to authenticated
  with check (user_id = (select auth.uid()) and kind <> 'generic');
create policy templates_own_update on public.templates for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy templates_own_delete on public.templates for delete to authenticated
  using (user_id = (select auth.uid()));

-- Posts: crear solo si la cuenta no está suspendida
create policy posts_own_select on public.posts for select to authenticated
  using (user_id = (select auth.uid()));
create policy posts_own_insert on public.posts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_generate_posts((select auth.uid())));
create policy posts_own_update on public.posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy posts_own_delete on public.posts for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 8. Storage: logos y plantillas en carpeta {user_id}/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false)
on conflict (id) do nothing;

create policy brand_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy brand_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy brand_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy brand_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
