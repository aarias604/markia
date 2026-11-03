import type { BrandKit, ColorRole, LayoutId, TemplateDefinition } from "@/lib/types";

export const LAYOUTS: { id: LayoutId; label: string }[] = [
  { id: "centrado", label: "Centrado con círculos" },
  { id: "banda", label: "Banda inferior" },
  { id: "esquina", label: "Esquina curva" },
  { id: "dividido", label: "Dividido en dos" },
  { id: "marco", label: "Marco elegante" },
  { id: "diagonal", label: "Diagonal" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "cita", label: "Cita o frase" },
  { id: "titular", label: "Titular con barra" },
  { id: "minimal", label: "Minimalista" },
  { id: "burbuja", label: "Burbujas" },
  { id: "oferta", label: "Oferta con sello" },
];

export const COLOR_ROLES: { id: ColorRole; label: string }[] = [
  { id: "primary", label: "Primario" },
  { id: "secondary", label: "Secundario" },
  { id: "accent", label: "Acento" },
  { id: "cream", label: "Fondo claro" },
];

export type BrandColors = Pick<BrandKit, "color_primary" | "color_secondary" | "color_accent" | "color_cream">;

export function resolveColor(role: ColorRole, c: BrandColors): string {
  switch (role) {
    case "primary":
      return c.color_primary;
    case "secondary":
      return c.color_secondary;
    case "accent":
      return c.color_accent;
    default:
      return c.color_cream;
  }
}

export function normalizeDefinition(raw: unknown): TemplateDefinition {
  const d = (raw ?? {}) as Partial<TemplateDefinition>;
  const layouts = LAYOUTS.map((l) => l.id);
  const roles: ColorRole[] = ["primary", "secondary", "accent", "cream"];
  return {
    layout: d.layout && layouts.includes(d.layout) ? d.layout : "centrado",
    fondo: d.fondo && roles.includes(d.fondo) ? d.fondo : "primary",
    texto: d.texto && roles.includes(d.texto) ? d.texto : "cream",
    detalle: d.detalle && roles.includes(d.detalle) ? d.detalle : "accent",
  };
}

/** Parte un texto en líneas de como máximo `maxChars` caracteres. */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const raw of words) {
    let word = raw;
    while (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return cut;
  }
  return lines;
}

/** Elige el tamaño de letra más grande que quepa en 4 líneas. */
export function fitHeadline(text: string, width: number) {
  const sizes = [92, 80, 68, 58, 50];
  for (const size of sizes) {
    const maxChars = Math.max(6, Math.floor(width / (size * 0.56)));
    const lines = wrapText(text, maxChars, 99);
    if (lines.length <= 4) return { size, lines };
  }
  const size = 50;
  return { size, lines: wrapText(text, Math.floor(width / (size * 0.56)), 4) };
}
