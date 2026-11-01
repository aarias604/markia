import type { PostStatus } from "@/lib/types";

export const TIPOS_POST = [
  { id: "mixto", label: "Mezcla variada" },
  { id: "promocion", label: "Promoción u oferta" },
  { id: "producto", label: "Presentar un producto o servicio" },
  { id: "educativo", label: "Consejo o tip útil" },
  { id: "inspirador", label: "Frase inspiradora" },
  { id: "detras", label: "Detrás de cámaras" },
  { id: "testimonio", label: "Reseña de cliente (plantilla)" },
  { id: "fecha", label: "Fecha especial o temporada" },
] as const;

export type TipoPost = (typeof TIPOS_POST)[number]["id"];

export const STATUS_INFO: Record<PostStatus, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-stone-200 text-stone-700" },
  scheduled: { label: "Programado", cls: "bg-[#6B21A8]/15 text-[#6B21A8]" },
  publishing: { label: "Publicando", cls: "bg-amber-100 text-amber-800" },
  published: { label: "Publicado", cls: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Falló", cls: "bg-red-100 text-red-700" },
};

/** ISO → valor para <input type="datetime-local"> en hora local. */
export function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-PA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Clave YYYY-MM-DD en hora local. */
export function dayKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
