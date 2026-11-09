-- =====================================================================
-- Markia · Migración Fase 18 · Programar y publicar videos (Reels)
-- Una publicación puede ser un video de Markia: se publica como Reel en
-- Instagram y como video en la Página de Facebook.
-- Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.posts drop constraint if exists posts_source_ck;
alter table public.posts add constraint posts_source_ck check (source in ('ai', 'upload', 'video'));

alter table public.posts
  add column if not exists video_id   uuid references public.videos(id) on delete set null,
  add column if not exists video_path text;   -- ruta del MP4 en el bucket "videos"
