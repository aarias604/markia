-- =====================================================================
-- Markia · Migración Fase 21 · Más publicaciones en los planes
--   · Plan Básico: 15 publicaciones al mes (antes 10)
--   · Plan PRO:    35 publicaciones al mes (antes 26)
-- Los carruseles y videos se cuentan aparte (no cambian).
-- Aplica de inmediato a todos los clientes, también a los ya suscritos.
-- =====================================================================
update public.plans set monthly_posts = 15 where id = 'basic';
update public.plans set monthly_posts = 35 where id = 'pro';
