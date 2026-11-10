-- =====================================================================
-- Markia · Migración Fase 22 · Panel de clientes para el administrador
-- Una fila por cliente: plan, uso, compras en la Tienda, ingresos y
-- datos para estimar costos. Solo la usa el servidor (service_role).
-- Se puede ejecutar más de una vez.
-- =====================================================================

drop function if exists public.admin_clients();
create function public.admin_clients()
returns table (
  user_id              uuid,
  email                text,
  full_name            text,
  business_name        text,
  joined_at            timestamptz,
  is_admin             boolean,
  plan_id              text,
  plan_name            text,
  status               text,
  next_due_date        date,
  monthly_price_cents  integer,
  price_locked         boolean,
  autopay              boolean,
  -- Ciclo actual
  posts_used           integer,
  posts_limit          integer,
  extra_posts          integer,
  carousels_used       integer,
  carousels_limit      integer,
  videos_used          integer,
  videos_limit         integer,
  extra_videos         integer,
  -- Totales históricos
  posts_total          integer,
  uploads_total        integer,
  carousels_total      integer,
  videos_total         integer,
  videos_ai_images     integer,
  wa_utility           integer,
  wa_marketing         integer,
  -- Dinero (centavos)
  plan_revenue_cents   integer,
  store_revenue_cents  integer,
  store_items          jsonb,
  card_revenue_cents   integer,
  card_payments        integer,
  yappy_revenue_cents  integer,
  referral_cents       integer,
  last_payment_at      timestamptz
)
language sql stable security definer set search_path = public as $$
  with paid as (
    select p.user_id, p.kind, p.addon_id, p.method, p.amount_cents, p.paid_at
    from public.payments p
    where p.status = 'paid' and p.applied_at is not null
  ),
  money as (
    select user_id,
      sum(amount_cents) filter (where kind::text <> 'addon')::integer                        as plan_cents,
      sum(amount_cents) filter (where kind::text = 'addon')::integer                         as store_cents,
      sum(amount_cents) filter (where method::text = 'card')::integer                        as card_cents,
      count(*)          filter (where method::text = 'card')::integer                        as card_n,
      sum(amount_cents) filter (where coalesce(method::text, 'yappy') = 'yappy')::integer    as yappy_cents,
      max(paid_at) as last_paid
    from paid group by user_id
  ),
  store as (
    select user_id, jsonb_agg(jsonb_build_object('addon_id', addon_id, 'name', name, 'count', n, 'cents', cents) order by cents desc) as items
    from (
      select pd.user_id, pd.addon_id, coalesce(a.name, pd.addon_id) as name, count(*)::integer as n, sum(pd.amount_cents)::integer as cents
      from paid pd left join public.addons a on a.id = pd.addon_id
      where pd.kind::text = 'addon'
      group by pd.user_id, pd.addon_id, a.name
    ) x group by user_id
  )
  select
    u.id,
    u.email::text,
    pr.full_name,
    pr.business_name,
    u.created_at,
    coalesce(pr.is_admin, false),
    s.plan_id,
    pl.name,
    s.subscription_status::text,
    s.next_due_date,
    case when s.id is null then null
         else least(coalesce(s.locked_price_cents, pl.price_cents), pl.price_cents) end,
    s.locked_price_cents is not null,
    exists (select 1 from public.card_mandates m where m.user_id = u.id and m.status = 'active' and not m.cancel_requested),
    coalesce(s.posts_used_this_cycle, 0),
    coalesce(pl.monthly_posts, 0),
    coalesce(s.extra_posts_balance, 0),
    coalesce((select cq.used_count from public.carousel_quota(u.id) cq), 0),
    coalesce(pl.monthly_carousels, 0),
    coalesce((select vq.used_count from public.video_quota(u.id) vq), 0),
    coalesce(pl.monthly_videos, 0),
    coalesce(s.extra_videos_balance, 0),
    (select count(*)::integer from public.posts po where po.user_id = u.id and po.source = 'ai' and po.format = 'single'),
    (select count(*)::integer from public.posts po where po.user_id = u.id and po.source = 'upload'),
    (select count(*)::integer from public.carousel_generations g where g.user_id = u.id),
    (select count(*)::integer from public.videos v where v.user_id = u.id and v.counted),
    (select count(*)::integer from public.videos v where v.user_id = u.id and v.counted and v.ai_images),
    (select count(*)::integer from public.whatsapp_log w where w.user_id = u.id and w.error is null and w.kind = 'post_reminder'),
    (select count(*)::integer from public.whatsapp_log w where w.user_id = u.id and w.error is null and w.kind = 'idle'),
    coalesce(mo.plan_cents, 0),
    coalesce(mo.store_cents, 0),
    coalesce(st.items, '[]'::jsonb),
    coalesce(mo.card_cents, 0),
    coalesce(mo.card_n, 0),
    coalesce(mo.yappy_cents, 0),
    coalesce((select sum(rc.amount_cents)::integer from public.referral_commissions rc
              where rc.referred_id = u.id and rc.status <> 'reversed'), 0),
    mo.last_paid
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  left join public.subscriptions s on s.user_id = u.id
  left join public.plans pl on pl.id = s.plan_id
  left join money mo on mo.user_id = u.id
  left join store st on st.user_id = u.id
  order by coalesce(mo.plan_cents, 0) + coalesce(mo.store_cents, 0) desc, u.created_at desc
$$;
revoke execute on function public.admin_clients() from public, anon, authenticated;
grant  execute on function public.admin_clients() to service_role;
