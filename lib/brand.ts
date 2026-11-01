import type { BrandKit } from "@/lib/types";

export const DEFAULT_KIT: BrandKit = {
  logo_path: null,
  color_primary: "#4A154B",
  color_secondary: "#6B21A8",
  color_accent: "#D9B382",
  color_cream: "#FAF5EF",
  niche: null,
  voice_tone: null,
};

export const NICHOS = [
  "Restaurante o comida",
  "Moda y accesorios",
  "Belleza y estética",
  "Salud y bienestar",
  "Fitness y deporte",
  "Bienes raíces",
  "Educación y cursos",
  "Tecnología",
  "Servicios profesionales",
  "Turismo y viajes",
  "Mascotas",
  "Creador de contenido",
];

export const TONOS = [
  "Cercano y amigable",
  "Profesional y confiable",
  "Divertido y relajado",
  "Inspirador y motivador",
  "Elegante y exclusivo",
  "Juvenil y directo",
];

export const COLOR_FIELDS: { key: "color_primary" | "color_secondary" | "color_accent" | "color_cream"; label: string; help: string }[] = [
  { key: "color_primary", label: "Primario", help: "El color principal de tu marca" },
  { key: "color_secondary", label: "Secundario", help: "Acompaña al primario" },
  { key: "color_accent", label: "Acento", help: "Para detalles y llamadas de atención" },
  { key: "color_cream", label: "Fondo claro", help: "Crema, blanco o un tono suave" },
];

export function isHex(v: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}
