// POST /api/generar · Genera publicaciones con Claude usando el kit de marca.
// Revisa: sesión, cuenta no suspendida, cupo del plan. Descuenta el cupo solo si la IA respondió bien.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_POST } from "@/lib/posts";

const MODEL = "claude-sonnet-5-5";
const MAX_POR_VEZ = 5;

interface GeneratedPost {
  titulo: string;
  caption: string;
  hashtags: string[];
  texto_imagen: string;
  subtexto_imagen: string;
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parsePosts(text: string): GeneratedPost[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La IA no devolvió un formato válido.");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { posts?: unknown };
  if (!Array.isArray(parsed.posts)) throw new Error("La IA no devolvió publicaciones.");

  return parsed.posts
    .map((raw) => {
      const p = raw as Partial<Record<keyof GeneratedPost, unknown>>;
      const hashtags = Array.isArray(p.hashtags) ? p.hashtags : [];
      return {
        titulo: String(p.titulo ?? "").slice(0, 80),
        caption: String(p.caption ?? "").slice(0, 2200),
        hashtags: hashtags
          .map((h) => String(h).replace(/\s+/g, ""))
          .filter(Boolean)
          .map((h) => (h.startsWith("#") ? h : `#${h}`))
          .slice(0, 12),
        texto_imagen: String(p.texto_imagen ?? "").slice(0, 90),
        subtexto_imagen: String(p.subtexto_imagen ?? "").slice(0, 120),
      };
    })
    .filter((p) => p.caption && p.texto_imagen);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Vuelve a iniciar sesión.", 401);

  const body = (await request.json().catch(() => null)) as {
    idea?: unknown;
    tipo?: unknown;
    cantidad?: unknown;
    templateId?: unknown;
  } | null;
  if (!body) return fail("Solicitud inválida.", 400);

  const idea = typeof body.idea === "string" ? body.idea.trim().slice(0, 600) : "";
  const tipo = TIPOS_POST.find((t) => t.id === body.tipo) ?? TIPOS_POST[0];
  const cantidad = Math.min(Math.max(Math.floor(Number(body.cantidad) || 1), 1), MAX_POR_VEZ);
  const templateId = typeof body.templateId === "string" && body.templateId ? body.templateId : null;

  // 1. Estado de la cuenta y cupo
  const { data: billing } = await supabase.rpc("get_my_billing").maybeSingle();
  const b = billing as { can_generate?: boolean } | null;
  if (!b) return fail("Necesitas un plan activo para generar publicaciones.", 403);
  if (!b.can_generate) return fail("Tu cuenta está suspendida. Reactívala para seguir generando.", 403);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("posts_used_this_cycle, extra_posts_balance, plans(monthly_posts)")
    .eq("user_id", user.id)
    .single();
  const s = sub as { posts_used_this_cycle: number; extra_posts_balance: number; plans: { monthly_posts: number } | null } | null;
  const remaining = s ? Math.max((s.plans?.monthly_posts ?? 0) - s.posts_used_this_cycle, 0) + s.extra_posts_balance : 0;
  if (remaining < cantidad) {
    return fail(
      remaining === 0
        ? "Ya usaste todas las publicaciones de este ciclo."
        : `Solo te quedan ${remaining} publicaciones este ciclo.`,
      402
    );
  }

  // 2. Marca y plantillas
  const [{ data: kit }, { data: profile }, { data: templates }] = await Promise.all([
    supabase.from("brand_kits").select("niche, voice_tone").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("business_name").eq("id", user.id).maybeSingle(),
    supabase.from("templates").select("id, kind").order("kind").order("name"),
  ]);
  if (!kit) return fail("Primero completa tu kit de marca.", 400);

  const tplList = (templates ?? []) as { id: string; kind: string }[];
  if (templateId && !tplList.some((t) => t.id === templateId)) return fail("La plantilla elegida no existe.", 400);
  const generic = tplList.filter((t) => t.kind === "generic");
  const pickTemplate = (i: number) => templateId ?? (generic.length ? generic[i % generic.length].id : null);

  // 3. Claude
  const negocio = profile?.business_name || "la marca";
  const system = [
    `Eres el community manager de "${negocio}", un negocio de ${kit.niche ?? "su sector"} en Panamá.`,
    `Tono de voz de la marca: ${kit.voice_tone ?? "cercano y profesional"}.`,
    "Escribes publicaciones para Instagram en español latinoamericano natural, con frases cortas y emojis con moderación.",
    "Nunca inventes precios, descuentos, direcciones, teléfonos, premios ni datos que el usuario no te dio; si hacen falta, usa marcadores entre corchetes como [precio] o [dirección].",
    "Nunca inventes reseñas ni testimonios atribuidos a personas reales: para reseñas, escribe una plantilla con [Nombre del cliente] y [comentario real].",
    "Responde SOLO con JSON válido, sin texto antes ni después.",
  ].join("\n");

  const prompt = [
    `Crea ${cantidad} publicación(es) distinta(s) entre sí.`,
    `Tipo de contenido: ${tipo.label}.`,
    idea ? `Idea o contexto del usuario: ${idea}` : "No hay idea específica: propone temas útiles y atractivos para este negocio.",
    "",
    "Formato exacto:",
    '{"posts":[{"titulo":"nombre interno de 2 a 6 palabras","caption":"texto del post de 60 a 150 palabras con una llamada a la acción al final","hashtags":["#ejemplo"],"texto_imagen":"frase gancho para la imagen, máximo 7 palabras","subtexto_imagen":"apoyo para la imagen, máximo 12 palabras"}]}',
    "Incluye de 5 a 10 hashtags por publicación, mezclando generales y locales de Panamá cuando tenga sentido.",
  ].join("\n");

  let generated: GeneratedPost[];
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200 * cantidad,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    generated = parsePosts(text).slice(0, cantidad);
    if (generated.length === 0) throw new Error("La IA no devolvió publicaciones.");
  } catch (e) {
    console.error("[generar] Claude:", e);
    return fail("La IA no pudo responder ahora. Inténtalo de nuevo en un momento (no se descontó tu cupo).", 502);
  }

  // 4. Descontar cupo (de forma atómica en la base de datos)
  const admin = createAdminClient();
  const { data: quota, error: quotaErr } = await admin
    .rpc("consume_post_quota", { p_user_id: user.id, p_count: generated.length })
    .single();
  const q = quota as { ok: boolean; message: string } | null;
  if (quotaErr || !q?.ok) {
    if (quotaErr) console.error("[generar] cupo:", quotaErr);
    return fail(q?.message ?? "No se pudo descontar tu cupo. ¿Corriste la migración de la Fase 6?", 402);
  }

  // 5. Guardar como borradores
  const rows = generated.map((p, i) => ({
    user_id: user.id,
    template_id: pickTemplate(i),
    title: p.titulo,
    caption: p.caption,
    hashtags: p.hashtags,
    image_headline: p.texto_imagen,
    image_subtext: p.subtexto_imagen,
    post_type: tipo.id,
    status: "draft",
  }));
  const { data: inserted, error: insErr } = await supabase.from("posts").insert(rows).select("*");
  if (insErr) {
    console.error("[generar] insert:", insErr);
    return fail(`Se generaron, pero no se pudieron guardar: ${insErr.message}`, 500);
  }

  return NextResponse.json({ posts: inserted });
}
