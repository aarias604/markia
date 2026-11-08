// POST /api/video/guion · Crea el guion y las escenas de un video (no descuenta cupo).
// mode "idea": la IA escribe la narración a partir de una idea.
// mode "narration": el cliente trae su narración; la IA solo la divide en escenas y diseña lo visual.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { ICON_NAMES } from "@/lib/icons";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DURATIONS, cleanScenes, type Scene } from "@/lib/video";

const MODEL = "claude-sonnet-5-5";
const MAX_BORRADORES_POR_DIA = 10;
const HEX = /^#[0-9A-Fa-f]{6}$/;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Respaldo si la IA altera la narración del cliente: una escena por cada 1–2 oraciones. */
function splitNarration(text: string): Scene[] {
  const sentences = text.match(/[^.!?¡¿]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const chunks: string[] = [];
  for (const s of sentences) {
    const last = chunks[chunks.length - 1];
    if (last && last.split(/\s+/).length < 18) chunks[chunks.length - 1] = `${last} ${s}`;
    else chunks.push(s);
  }
  return chunks.slice(0, 16).map((n, i, arr) => ({
    layout: i === 0 ? "portada" : i === arr.length - 1 ? "cierre" : "icono",
    narracion: n,
    titulo: n.split(/\s+/).slice(0, 6).join(" "),
    icono: "idea",
    sfx: "whoosh",
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Vuelve a iniciar sesión.", 401);

  const body = (await request.json().catch(() => null)) as {
    mode?: string; text?: string; seconds?: number; voice?: string; palette?: Record<string, unknown> | null;
  } | null;
  const mode = body?.mode === "narration" ? "narration" : "idea";
  const text = (body?.text ?? "").trim().slice(0, mode === "narration" ? 3200 : 800);
  const dur = DURATIONS.find((d) => d.seconds === Number(body?.seconds)) ?? DURATIONS[1];
  const voice = body?.voice === "male" ? "male" : "female";
  const p = body?.palette;
  const palette =
    p && ["color_primary", "color_secondary", "color_accent", "color_cream"].every((k) => typeof p[k] === "string" && HEX.test(p[k] as string))
      ? { color_primary: p.color_primary, color_secondary: p.color_secondary, color_accent: p.color_accent, color_cream: p.color_cream }
      : null;

  if (mode === "idea" && text.length < 5) return fail("Escribe la idea base del video.");
  if (mode === "narration" && text.split(/\s+/).length < 25) return fail("Tu narración es muy corta: escribe al menos 25 palabras.");

  const admin = createAdminClient();

  // Cupo disponible (se descuenta al generar el video, no aquí)
  const { data: q } = await admin.rpc("video_quota", { p_user_id: user.id }).maybeSingle();
  const quota = q as { limit_count: number; used_count: number; extra_balance: number } | null;
  if (!quota) return fail("Necesitas un plan activo para crear videos.", 402);
  if (quota.used_count >= quota.limit_count && quota.extra_balance <= 0) {
    return fail("Ya usaste tus videos de este ciclo. Compra un paquete de videos en la Tienda.", 402);
  }

  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await admin.from("videos").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= MAX_BORRADORES_POR_DIA) return fail("Llegaste al límite de guiones por hoy. Inténtalo mañana.", 429);

  const [{ data: kit }, { data: profile }] = await Promise.all([
    admin.from("brand_kits").select("niche, voice_tone").eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("business_name").eq("id", user.id).maybeSingle(),
  ]);
  const negocio = profile?.business_name || "la marca";

  const system = [
    `Eres guionista de videos explicativos animados para Instagram (Reels) de "${negocio}", negocio de ${kit?.niche ?? "su sector"} en Panamá.`,
    `Tono de la marca: ${kit?.voice_tone ?? "cercano y profesional"}. Español latinoamericano natural, frases cortas, fácil de escuchar.`,
    "El video es de gráficos y texto animado (sin fotos): cada escena tiene un diseño (layout), un ícono y textos breves en pantalla.",
    "Nunca inventes precios, direcciones, teléfonos, premios, estadísticas exactas ni testimonios. Si das un dato, que sea general y verdadero, o usa marcadores como [precio].",
    "Responde SOLO con JSON válido, sin texto antes ni después.",
  ].join("\n");

  const schema = [
    'Formato exacto: {"titulo":"nombre interno, máx. 6 palabras","caption":"descripción para publicar, 50 a 120 palabras, con llamada a la acción","hashtags":["#ejemplo"],"escenas":[',
    '{"layout":"portada|icono|lista|dato|comparacion|cierre","narracion":"lo que dice la voz","titulo":"texto grande en pantalla, máx. 7 palabras","texto":"apoyo opcional, máx. 18 palabras",',
    '"puntos":["solo en lista: 2 o 3 puntos de máx. 6 palabras"],"dato":"solo en dato: número corto como 3x, 80% o 24/7","izquierda":{"titulo":"solo en comparacion","texto":"máx. 12 palabras"},"derecha":{"titulo":"","texto":""},',
    `"icono":"uno de: ${ICON_NAMES.join(", ")}","sfx":"whoosh|pop|ding|none"}]}`,
    "Reglas: la primera escena es portada (gancho fuerte en los primeros 3 segundos) y la última es cierre (llamada a la acción). Varía los layouts.",
    "Cada escena dura entre 6 y 14 segundos de narración. Incluye de 5 a 10 hashtags.",
  ].join("\n");

  const prompt =
    mode === "idea"
      ? [
          `Escribe un video explicativo de ${dur.label} (unas ${dur.words} palabras de narración en total, entre 7 y 12 escenas).`,
          `Idea base del cliente: ${text}`,
          schema,
        ].join("\n")
      : [
          "El cliente ya tiene su narración. NO la cambies: copia el texto palabra por palabra, en orden, repartido entre las escenas (al unir todas las narraciones debe quedar exactamente el texto original).",
          "Tu trabajo es dividirla en escenas y diseñar lo visual de cada una.",
          `Narración del cliente:\n"""${text}"""`,
          schema,
        ].join("\n");

  let scenes: Scene[];
  let meta: { titulo?: string; caption?: string; hashtags?: string[] } = {};
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Record<string, unknown>;
    scenes = cleanScenes(json.escenas, ICON_NAMES);
    meta = {
      titulo: typeof json.titulo === "string" ? json.titulo.slice(0, 80) : undefined,
      caption: typeof json.caption === "string" ? json.caption.slice(0, 2200) : undefined,
      hashtags: Array.isArray(json.hashtags)
        ? json.hashtags.map((h) => String(h).replace(/\s+/g, "")).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 12)
        : [],
    };
    if (scenes.length < 3) throw new Error("Muy pocas escenas");
    // Si el cliente trajo su narración, verificamos que la IA no la haya cambiado.
    if (mode === "narration" && norm(scenes.map((s) => s.narracion).join(" ")) !== norm(text)) {
      const visuals = scenes;
      scenes = splitNarration(text).map((s, i) => ({ ...s, ...pickVisual(visuals[i]), narracion: s.narracion }));
    }
  } catch (e) {
    console.error("[video/guion]", e);
    if (mode !== "narration") return fail("La IA no pudo crear el guion ahora. Inténtalo de nuevo (no se descontó tu cupo).", 502);
    scenes = splitNarration(text);
  }

  const { data: video, error } = await admin
    .from("videos")
    .insert({
      user_id: user.id,
      mode,
      input_text: text,
      title: meta.titulo ?? text.slice(0, 60),
      caption: meta.caption ?? null,
      hashtags: meta.hashtags ?? [],
      voice,
      palette,
      scenes,
    })
    .select("*")
    .single();
  if (error) return fail(`No se pudo guardar el guion: ${error.message}`, 500);
  return NextResponse.json({ video });
}

function pickVisual(s?: Scene): Partial<Scene> {
  if (!s) return {};
  const { narracion: _n, ...rest } = s;
  void _n;
  return rest;
}
