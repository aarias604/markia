// Guarda la paleta de un kit de Marca con IA en «Mis paletas» (brand_palettes). Solo servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandResult } from "@/lib/brand-ai";

export async function savePackagePalette(
  admin: SupabaseClient,
  userId: string,
  packageId: string,
  brandName: string | undefined,
  result: BrandResult
): Promise<{ ok: boolean; error?: string }> {
  const colors = {
    color_primary: result.kit.color_primary,
    color_secondary: result.kit.color_secondary,
    color_accent: result.kit.color_accent,
    color_cream: result.kit.color_cream,
  };
  const name = (brandName?.trim() || "Marca con IA").slice(0, 40);

  const { data: existing } = await admin.from("brand_palettes").select("id").eq("package_id", packageId).eq("user_id", userId).maybeSingle();
  const { error } = existing
    ? await admin.from("brand_palettes").update({ name, ...colors }).eq("id", existing.id)
    : await admin.from("brand_palettes").insert({ user_id: userId, package_id: packageId, name, ...colors });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("10 paletas")
        ? "Ya tienes 10 paletas guardadas. Borra una en «Kit de marca» para guardar esta."
        : error.message,
    };
  }
  return { ok: true };
}
