// WhatsApp Cloud API (Meta). Solo servidor.
// Envía mensajes con plantillas aprobadas en WhatsApp Manager.
import type { SupabaseClient } from "@supabase/supabase-js";

const GRAPH = "https://graph.facebook.com/v25.0";

export const WA_TEMPLATES = {
  reminder: process.env.WHATSAPP_TEMPLATE_RECORDATORIO || "markia_recordatorio",
  idle: process.env.WHATSAPP_TEMPLATE_INACTIVIDAD || "markia_inactividad",
};
const LANG = process.env.WHATSAPP_TEMPLATE_LANG || "es";

export const whatsappConfigured = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** "6600-1122" → "50766001122". Números de 8 dígitos se toman como de Panamá. */
export function waPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digits.length === 8) return `507${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

/** WhatsApp no acepta saltos de línea, tabulaciones ni 4+ espacios seguidos en las variables. */
export function waParam(text: string | null | undefined, max: number) {
  const clean = (text ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!clean) return "—";
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export async function sendWhatsAppTemplate(opts: {
  to: string;
  template: string;
  bodyParams: string[];
  headerImageUrl?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!whatsappConfigured()) return { ok: false, error: "WhatsApp no está configurado" };

  const components: unknown[] = [];
  if (opts.headerImageUrl) {
    components.push({ type: "header", parameters: [{ type: "image", image: { link: opts.headerImageUrl } }] });
  }
  components.push({ type: "body", parameters: opts.bodyParams.map((text) => ({ type: "text", text })) });

  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: opts.to,
        type: "template",
        template: { name: opts.template, language: { code: LANG }, components },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number; error_data?: { details?: string } };
    };
    if (!res.ok || !json.messages?.[0]?.id) {
      const e = json.error;
      return { ok: false, error: `${e?.code ?? res.status}: ${e?.error_data?.details ?? e?.message ?? "error desconocido"}`.slice(0, 400) };
    }
    return { ok: true, id: json.messages[0].id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error de red" };
  }
}

/** Envía una sola vez por (usuario, tipo, referencia). Guarda el error si falla. */
export async function sendWhatsAppOnce(
  admin: SupabaseClient,
  opts: { userId: string; kind: string; ref: string; to: string; template: string; bodyParams: string[]; headerImageUrl?: string }
) {
  const { data: row, error } = await admin
    .from("whatsapp_log")
    .insert({ user_id: opts.userId, kind: opts.kind, ref: opts.ref })
    .select("id")
    .single();
  if (error) {
    if (error.code !== "23505") console.error("[whatsapp] log", error);
    return { ok: false as const, error: error.code === "23505" ? "ya enviado" : error.message };
  }
  const sent = await sendWhatsAppTemplate(opts);
  await admin
    .from("whatsapp_log")
    .update(sent.ok ? { wa_message_id: sent.id } : { error: sent.error })
    .eq("id", row.id);
  if (!sent.ok) console.error("[whatsapp]", opts.kind, opts.ref, sent.error);
  return sent;
}

// Motivos para mantenerse activo (rotan en cada aviso).
const MOTIVOS = [
  "Instagram muestra más las cuentas que publican con constancia; si dejas de publicar, menos personas ven tu negocio.",
  "Tus clientes te buscan en redes antes de comprar: una cuenta activa transmite confianza y que tu negocio está abierto.",
  "Cada publicación es una oportunidad gratis de recordarle a tus clientes que existes y de atraer nuevos.",
  "Las marcas que publican de 3 a 4 veces por semana crecen más rápido que las que publican de vez en cuando.",
  "Mientras no publicas, tu competencia sí lo hace y ocupa el lugar de tu negocio en la mente de tus clientes.",
  "Publicar seguido te ayuda a descubrir qué contenido le gusta a tu público y qué te trae más ventas.",
  "Una cuenta activa recibe más mensajes, comentarios y recomendaciones: eso se convierte en clientes.",
];
export const motivoDelDia = (n: number) => MOTIVOS[Math.abs(n) % MOTIVOS.length];
