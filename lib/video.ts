// Videos explicativos: tipos y reglas compartidas (cliente y servidor).

export const VIDEO_W = 1080;
export const VIDEO_H = 1920;

export type SceneLayout = "portada" | "ilustracion" | "lista" | "dato" | "icono" | "comparacion" | "cierre";
export type VideoStyle = "pop" | "pizarra" | "neon" | "minimal" | "cuaderno" | "retro";

export const STYLES: { id: VideoStyle; label: string; hint: string }[] = [
  { id: "pop", label: "Pop", hint: "Titulares grandes, tarjetas con sombra y mascota" },
  { id: "pizarra", label: "Pizarra", hint: "Como dibujado a mano con marcador" },
  { id: "neon", label: "Neón", hint: "Fondo oscuro con brillos y cuadrícula" },
  { id: "minimal", label: "Minimal", hint: "Elegante, limpio y con tipografía serif" },
  { id: "cuaderno", label: "Cuaderno", hint: "Hoja rayada, notas adhesivas y letra a mano" },
  { id: "retro", label: "Retro 90s", hint: "Colores fuertes, estrellas y bordes gruesos" },
];
export type Sfx = "whoosh" | "pop" | "ding" | "none";

export interface Scene {
  layout: SceneLayout;
  /** Lo que dice la voz en esta escena. */
  narracion: string;
  titulo: string;
  texto?: string;
  puntos?: string[];
  dato?: string;
  izquierda?: { titulo: string; texto: string };
  derecha?: { titulo: string; texto: string };
  icono: string;
  /** 1 a 4 íconos que ilustran lo que dice la voz (el primero es el principal). */
  ilustracion?: string[];
  /** Descripción en inglés para generar la imagen con IA (opcional). */
  imagen?: string;
  /** Imagen generada con IA (la agrega el servidor al crear el video). */
  imageUrl?: string;
  sfx?: Sfx;
}

export const LAYOUTS: { id: SceneLayout; label: string }[] = [
  { id: "portada", label: "Portada" },
  { id: "ilustracion", label: "Ilustración grande" },
  { id: "icono", label: "Ícono + texto" },
  { id: "lista", label: "Lista de puntos" },
  { id: "dato", label: "Dato destacado" },
  { id: "comparacion", label: "Comparación" },
  { id: "cierre", label: "Cierre" },
];

export const DURATIONS = [
  { seconds: 60, label: "1 minuto", words: 150 },
  { seconds: 90, label: "1 min 30 s", words: 220 },
  { seconds: 120, label: "2 minutos", words: 290 },
];

/** Normaliza y recorta lo que llega del cliente o de la IA. */
export function cleanScenes(raw: unknown, iconNames: string[]): Scene[] {
  if (!Array.isArray(raw)) return [];
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const layouts = new Set(["portada", "ilustracion", "lista", "dato", "icono", "comparacion", "cierre"]);
  const sfx = new Set(["whoosh", "pop", "ding", "none"]);
  return raw.slice(0, 16).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const layout = (layouts.has(o.layout as string) ? o.layout : "icono") as SceneLayout;
    const side = (v: unknown) => {
      const x = (v ?? {}) as Record<string, unknown>;
      return { titulo: s(x.titulo, 30), texto: s(x.texto, 90) };
    };
    return {
      layout,
      narracion: s(o.narracion, 700),
      titulo: s(o.titulo, 70),
      texto: s(o.texto, 160) || undefined,
      puntos: Array.isArray(o.puntos) ? o.puntos.map((p) => s(p, 60)).filter(Boolean).slice(0, 3) : undefined,
      dato: s(o.dato, 10) || undefined,
      izquierda: layout === "comparacion" ? side(o.izquierda) : undefined,
      derecha: layout === "comparacion" ? side(o.derecha) : undefined,
      icono: iconNames.includes(o.icono as string) ? (o.icono as string) : "idea",
      ilustracion: Array.isArray(o.ilustracion)
        ? o.ilustracion.filter((n): n is string => typeof n === "string" && iconNames.includes(n)).slice(0, 4)
        : undefined,
      imagen: s(o.imagen, 300) || undefined,
      sfx: (sfx.has(o.sfx as string) ? o.sfx : "whoosh") as Sfx,
    };
  }).filter((x) => x.narracion);
}

/** Capas que se animan por separado: la base y cada punto de una lista. */
export const isStyle = (v: unknown): v is VideoStyle => STYLES.some((x) => x.id === v);

export function sceneLayers(scene: Scene): ("base" | number)[] {
  return scene.layout === "lista" ? ["base", ...(scene.puntos ?? []).map((_, i) => i)] : ["base"];
}
