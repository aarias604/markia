"use client";

// Paletas de colores guardadas por el cliente (además de la del kit de marca).
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BrandColors } from "@/lib/templates";

export interface Palette extends BrandColors {
  id: string;
  name: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const pickColors = (c: BrandColors): BrandColors => ({
  color_primary: c.color_primary,
  color_secondary: c.color_secondary,
  color_accent: c.color_accent,
  color_cream: c.color_cream,
});

/** Valida colores que vienen de la base de datos (posts.palette, videos.palette). */
export function asColors(v: unknown): BrandColors | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const keys = ["color_primary", "color_secondary", "color_accent", "color_cream"] as const;
  return keys.every((k) => typeof o[k] === "string" && HEX.test(o[k] as string)) ? (pickColors(o as unknown as BrandColors)) : null;
}

export function usePalettes() {
  const [palettes, setPalettes] = useState<Palette[] | null>(null);
  const reload = useCallback(async () => {
    const { data } = await createClient()
      .from("brand_palettes")
      .select("id, name, color_primary, color_secondary, color_accent, color_cream")
      .order("created_at");
    setPalettes((data ?? []) as Palette[]);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { palettes, reload };
}
