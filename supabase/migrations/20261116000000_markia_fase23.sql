-- =====================================================================
-- Markia · Migración Fase 23 · Varios kits de Marca con IA
-- Cada kit creado guarda su paleta en «Mis paletas» para poder elegirla
-- al generar imágenes, carruseles, videos y portadas destacadas.
-- Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.brand_palettes
  add column if not exists package_id uuid references public.brand_packages on delete set null;
create unique index if not exists brand_palettes_package_uidx on public.brand_palettes (package_id);

-- Los kits que ya estaban listos también guardan su paleta (si hay espacio: máximo 10).
do $$
declare r record;
begin
  for r in
    select bp.id, bp.user_id, left(coalesce(nullif(trim(bp.brief->>'nombre'), ''), 'Marca con IA'), 40) as name, bp.result->'kit' as k
    from public.brand_packages bp
    where bp.status = 'ready' and bp.result ? 'kit'
      and not exists (select 1 from public.brand_palettes p where p.package_id = bp.id)
    order by bp.created_at
  loop
    begin
      insert into public.brand_palettes (user_id, name, color_primary, color_secondary, color_accent, color_cream, package_id)
      values (r.user_id, r.name, r.k->>'color_primary', r.k->>'color_secondary', r.k->>'color_accent', r.k->>'color_cream', r.id);
    exception when others then null; -- sin espacio o colores inválidos: se omite
    end;
  end loop;
end $$;
