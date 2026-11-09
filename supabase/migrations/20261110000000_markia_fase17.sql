-- =====================================================================
-- Markia · Migración Fase 17 · Publicar también en la Página de Facebook
--   + estilo e imágenes con IA en los videos.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Página de Facebook vinculada a la conexión de Instagram
alter table public.instagram_accounts
  add column if not exists fb_page_id    text,
  add column if not exists fb_page_name  text,
  add column if not exists fb_page_token text;   -- solo lo lee el servidor

-- 2. Publicaciones: también en Facebook
alter table public.posts
  add column if not exists also_facebook boolean not null default false,
  add column if not exists fb_post_id    text,
  add column if not exists fb_permalink  text,
  add column if not exists fb_error      text;

-- 3. Lo que el usuario ve de su conexión (sin tokens), ahora con la Página
drop function if exists public.get_my_instagram();
create function public.get_my_instagram()
returns table (username text, ig_user_id text, connected_at timestamptz, token_expires_at timestamptz,
               last_error text, fb_page_name text)
language sql stable security definer set search_path = public as $$
  select username, ig_user_id, connected_at, token_expires_at, last_error,
         case when fb_page_token is not null then fb_page_name end
  from public.instagram_accounts where user_id = auth.uid()
$$;
revoke execute on function public.get_my_instagram() from public, anon;
grant  execute on function public.get_my_instagram() to authenticated;

-- 4. Videos: estilo de animación e imágenes con IA
alter table public.videos
  add column if not exists style      text not null default 'pop'
    check (style in ('pop', 'pizarra', 'neon', 'minimal', 'cuaderno', 'retro')),
  add column if not exists ai_images  boolean not null default false;
