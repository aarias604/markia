-- =====================================================================
-- Markia · Migración Fase 12
-- 1. Destino de cada publicación: feed (publicación nueva) o historia
-- 2. Publicaciones propias subidas por el usuario (sus imágenes)
-- 3. Conexión con Instagram y publicación automática (Plan PRO)
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 y 2. Publicaciones
-- ---------------------------------------------------------------------
alter table public.posts
  add column if not exists placement        text not null default 'feed',
  add column if not exists source           text not null default 'ai',
  add column if not exists media_paths      text[],
  add column if not exists auto_publish     boolean not null default false,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists published_at     timestamptz,
  add column if not exists ig_permalink     text;

do $$ begin
  alter table public.posts add constraint posts_placement_ck check (placement in ('feed', 'story'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.posts add constraint posts_source_ck check (source in ('ai', 'upload'));
exception when duplicate_object then null; end $$;

create index if not exists posts_autopublish_idx on public.posts (scheduled_at)
  where auto_publish and status = 'scheduled';

-- Las publicaciones propias no deben bloquearse por el cupo de IA, pero sí por suspensión
-- (la política posts_own_insert ya usa can_generate_posts).

-- Almacenamiento de imágenes de publicaciones (JPEG listos para Instagram)
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', false)
on conflict (id) do nothing;

drop policy if exists post_media_select on storage.objects;
drop policy if exists post_media_insert on storage.objects;
drop policy if exists post_media_update on storage.objects;
drop policy if exists post_media_delete on storage.objects;
create policy post_media_select on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy post_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy post_media_update on storage.objects for update to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy post_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 3. Cuentas de Instagram conectadas
-- ---------------------------------------------------------------------
create table if not exists public.instagram_accounts (
  user_id          uuid primary key references auth.users on delete cascade,
  ig_user_id       text not null,
  username         text,
  access_token     text not null,          -- solo lo lee el servidor
  token_expires_at timestamptz not null,
  connected_at     timestamptz not null default now(),
  refreshed_at     timestamptz not null default now(),
  last_error       text
);
alter table public.instagram_accounts enable row level security;  -- sin políticas: el navegador no puede leer el token

-- Lo que el usuario sí puede ver de su conexión (sin el token).
create or replace function public.get_my_instagram()
returns table (username text, ig_user_id text, connected_at timestamptz, token_expires_at timestamptz, last_error text)
language sql stable security definer set search_path = public as $$
  select username, ig_user_id, connected_at, token_expires_at, last_error
  from public.instagram_accounts where user_id = auth.uid()
$$;
revoke execute on function public.get_my_instagram() from public, anon;
grant  execute on function public.get_my_instagram() to authenticated;

-- ¿Este usuario puede publicar automáticamente? (plan con Instagram + cuenta al día)
create or replace function public.can_autopost(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.instagram_autopost and public.can_generate_posts(p_user_id)
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.user_id = p_user_id
  ), false)
$$;
revoke execute on function public.can_autopost(uuid) from public, anon, authenticated;
grant  execute on function public.can_autopost(uuid) to service_role;
