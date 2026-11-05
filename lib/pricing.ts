// Precios públicos de los planes: precio regular + precio de hoy (con promoción si hay).
import { createClient } from "@/lib/supabase/client";

export interface PublicPlan {
  plan_id: string;
  name: string;
  regular_cents: number;
  price_cents: number;
  label: string | null;
  ends_on: string | null;
  monthly_posts: number;
  monthly_carousels: number | null;
  generic_templates: number;
  custom_templates: number;
  instagram_autopost: boolean;
}

export async function fetchPublicPricing(): Promise<PublicPlan[]> {
  const { data, error } = await createClient().rpc("get_public_pricing");
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicPlan[];
}

export const hasPromo = (p: PublicPlan) => p.price_cents < p.regular_cents;

/** "31 de diciembre de 2026" */
export function formatDateEs(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" });
}

export function planFeatures(p: PublicPlan) {
  const carruseles = p.monthly_carousels ?? 0;
  const list = [
    `${p.monthly_posts} publicaciones con IA al mes`,
    `${carruseles} carrusel${carruseles === 1 ? "" : "es"} con IA al mes`,
    `${p.generic_templates} plantillas de diseño`,
    "Descripción sugerida y hashtags en cada publicación",
    "Calendario de contenido y recordatorios por correo",
    "Descarga de imágenes en PNG",
  ];
  if (p.custom_templates > 0) list.push(`${p.custom_templates} plantillas personalizadas propias`);
  if (p.instagram_autopost) list.push("Publicación automática en Instagram (próximamente)");
  return list;
}
