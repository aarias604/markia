-- =====================================================================
-- Markia · Migración Fase 16 · Paletas, videos explicativos y portadas
-- 1. brand_palettes: varias paletas de colores por negocio.
-- 2. posts.palette: colores con los que se generó cada publicación.
-- 3. Videos: 1 al mes en Básico, 3 en PRO, + paquete de 3 videos ($9.99).
-- 4. Bucket privado "videos" (escenas, voz, subtítulos y MP4).
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Paletas de colores
-- ---------------------------------------------------------------------
create table if not exists public.brand_palettes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  name            text not null check (char_length(name) between 1 and 40),
  color_primary   text not null check (color_primary   ~ '^#[0-9A-Fa-f]{6}$'),
  color_secondary text not null check (color_secondary ~ '^#[0-9A-Fa-f]{6}$'),
  color_accent    text not null check (color_accent    ~ '^#[0-9A-Fa-f]{6}$'),
  color_cream     text not null check (color_cream     ~ '^#[0-9A-Fa-f]{6}$'),
  created_at      timestamptz not null default now()
);
create index if not exists brand_palettes_user_idx on public.brand_palettes (user_id, created_at);
alter table public.brand_palettes enable row level security;

drop policy if exists brand_palettes_own on public.brand_palettes;
create policy brand_palettes_own on public.brand_palettes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Máximo 10 paletas por negocio
create or replace function public.limit_brand_palettes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.brand_palettes where user_id = new.user_id) >= 10 then
    raise exception 'Puedes guardar hasta 10 paletas.';
  end if;
  return new;
end $$;
drop trigger if exists brand_palettes_limit on public.brand_palettes;
create trigger brand_palettes_limit before insert on public.brand_palettes
  for each row execute function public.limit_brand_palettes();

-- ---------------------------------------------------------------------
-- 2. Colores de cada publicación
-- ---------------------------------------------------------------------
alter table public.posts add column if not exists palette jsonb;

-- ---------------------------------------------------------------------
-- 3. Videos
-- ---------------------------------------------------------------------
alter table public.plans add column if not exists monthly_videos integer not null default 0;
update public.plans set monthly_videos = 1 where id = 'basic';
update public.plans set monthly_videos = 3 where id = 'pro';

alter table public.subscriptions add column if not exists extra_videos_balance integer not null default 0;

insert into public.addons (id, name, price_cents, units)
values ('video_pack_3', 'Paquete de 3 videos', 999, 3)
on conflict (id) do nothing;

create table if not exists public.videos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  status       text not null default 'draft'
               check (status in ('draft', 'rendering', 'ready', 'failed')),
  mode         text not null check (mode in ('idea', 'narration')),
  input_text   text not null,
  title        text,
  caption      text,
  hashtags     text[] not null default '{}',
  voice        text not null default 'female' check (voice in ('female', 'male')),
  palette      jsonb,
  scenes       jsonb not null default '[]',
  render_id    text,
  video_path   text,
  duration_s   numeric(6,2),
  used_extra   boolean not null default false,
  counted      boolean not null default false,   -- consumió cupo
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists videos_user_idx on public.videos (user_id, created_at desc);
alter table public.videos enable row level security;

drop policy if exists videos_select_own on public.videos;
create policy videos_select_own on public.videos for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists videos_delete_own on public.videos;
create policy videos_delete_own on public.videos for delete to authenticated
  using (user_id = (select auth.uid()) and status in ('draft', 'ready', 'failed'));

-- Cupo de videos del ciclo actual
create or replace function public.video_quota(p_user_id uuid)
returns table (limit_count integer, used_count integer, extra_balance integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(p.monthly_videos, 0),
    (select count(*)::int from public.videos v
     where v.user_id = s.user_id and v.counted and not v.used_extra
       and v.created_at >= coalesce(s.cycle_resets_on - 30, s.current_period_start, current_date)::timestamptz),
    s.extra_videos_balance
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = p_user_id
$$;

create or replace function public.get_my_video_quota()
returns table (limit_count integer, used_count integer, extra_balance integer)
language sql stable security definer set search_path = public as $$
  select * from public.video_quota(auth.uid())
$$;

-- Usa primero el cupo del mes y luego los videos extra comprados.
create or replace function public.consume_video_quota(p_video_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v public.videos%rowtype;
  q record;
begin
  select * into v from public.videos where id = p_video_id for update;
  if not found then return query select false, 'Video no encontrado.'::text; return; end if;
  if v.counted then return query select true, 'ok'::text; return; end if;

  perform 1 from public.subscriptions where user_id = v.user_id for update;
  if not found then return query select false, 'No tienes una suscripción activa.'::text; return; end if;
  if not public.can_generate_posts(v.user_id) then
    return query select false, 'Tu cuenta está suspendida. Reactívala para crear videos.'::text; return;
  end if;

  select * into q from public.video_quota(v.user_id);
  if q.used_count < q.limit_count then
    update public.videos set counted = true, used_extra = false where id = v.id;
  elsif q.extra_balance > 0 then
    update public.subscriptions set extra_videos_balance = extra_videos_balance - 1 where user_id = v.user_id;
    update public.videos set counted = true, used_extra = true where id = v.id;
  else
    return query select false, format('Ya usaste tus %s video(s) de este ciclo. Compra un paquete en la Tienda para crear más.', q.limit_count);
    return;
  end if;
  return query select true, 'ok'::text;
end $$;

-- Si el render falla, se devuelve el cupo.
create or replace function public.refund_video_quota(p_video_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.videos%rowtype;
begin
  select * into v from public.videos where id = p_video_id for update;
  if not found or not v.counted then return; end if;
  if v.used_extra then
    update public.subscriptions set extra_videos_balance = extra_videos_balance + 1 where user_id = v.user_id;
  end if;
  update public.videos set counted = false, used_extra = false where id = v.id;
end $$;

revoke execute on function public.video_quota(uuid)         from public, anon, authenticated;
revoke execute on function public.consume_video_quota(uuid) from public, anon, authenticated;
revoke execute on function public.refund_video_quota(uuid)  from public, anon, authenticated;
grant  execute on function public.video_quota(uuid)         to service_role;
grant  execute on function public.consume_video_quota(uuid) to service_role;
grant  execute on function public.refund_video_quota(uuid)  to service_role;
revoke execute on function public.get_my_video_quota()      from public, anon;
grant  execute on function public.get_my_video_quota()      to authenticated;

-- Precios públicos: ahora incluyen los videos de cada plan.
drop function if exists public.get_public_pricing();
create function public.get_public_pricing()
returns table (
  plan_id text, name text, regular_cents integer, price_cents integer, label text, ends_on date,
  monthly_posts integer, monthly_carousels integer, generic_templates integer,
  custom_templates integer, instagram_autopost boolean, monthly_videos integer
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, o.regular_cents, o.price_cents, o.label, o.ends_on,
         p.monthly_posts, p.monthly_carousels, p.generic_templates,
         p.custom_templates, p.instagram_autopost, p.monthly_videos
  from public.plans p
  cross join lateral public.plan_offer(p.id) o
  where p.is_active
  order by p.price_cents
$$;
grant execute on function public.get_public_pricing() to anon, authenticated;

-- apply_payment: igual que en la Fase 13, más el paquete de videos.
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
    elsif pay.addon_id = 'video_pack_3' then
      update public.subscriptions set extra_videos_balance = extra_videos_balance + 3
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
-- 4. Almacenamiento de videos (privado, carpeta por usuario)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800,
        array['image/png', 'audio/mpeg', 'video/mp4', 'text/plain', 'application/x-subrip'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists videos_storage_select on storage.objects;
create policy videos_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists videos_storage_insert on storage.objects;
create policy videos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists videos_storage_update on storage.objects;
create policy videos_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists videos_storage_delete on storage.objects;
create policy videos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
