// POST /api/video/render · Descuenta el cupo, crea la voz con ElevenLabs y manda a renderizar con Remotion (GitHub Actions).
import { NextResponse } from "next/server";
import { elevenConfigured, textToSpeech } from "@/lib/elevenlabs";
import { ICON_NAMES } from "@/lib/icons";
import { siteUrl } from "@/lib/notifications";
import { remotionConfigured, startRender } from "@/lib/remotion-render";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanScenes } from "@/lib/video";
import { alignTimings, narrationParts } from "@/lib/video-timing";
import { VIDEO_BUCKET } from "@/lib/video-server";
import type { Colors, VideoProps } from "@/remotion/types";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

function validColors(p: unknown): Colors | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const keys = ["color_primary", "color_secondary", "color_accent", "color_cream"] as const;
  return keys.every((k) => typeof o[k] === "string" && HEX.test(o[k] as string))
    ? { color_primary: o.color_primary as string, color_secondary: o.color_secondary as string, color_accent: o.color_accent as string, color_cream: o.color_cream as string }
    : null;
}

export async function POST(request: Request) {
  if (!elevenConfigured() || !remotionConfigured()) return fail("La creación de videos aún no está disponible.", 503);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Vuelve a iniciar sesión.", 401);

  const body = (await request.json().catch(() => null)) as {
    videoId?: string; scenes?: unknown; palette?: unknown; voice?: string; subtitles?: boolean; handle?: string;
  } | null;
  if (!body?.videoId) return fail("Solicitud inválida.");

  const admin = createAdminClient();
  const { data: video } = await admin.from("videos").select("*").eq("id", body.videoId).eq("user_id", user.id).maybeSingle();
  if (!video) return fail("Video no encontrado.", 404);
  if (!["draft", "failed"].includes(video.status)) return fail("Este video ya se está creando o está listo.");

  const scenes = cleanScenes(body.scenes, ICON_NAMES);
  if (scenes.length < 2) return fail("El video necesita al menos 2 escenas.");
  const { text } = narrationParts(scenes);
  if (text.length > 4500) return fail("La narración es muy larga: el máximo es de unos 2 minutos.");
  const voice = body.voice === "male" ? "male" : "female";
  const palette = validColors(body.palette);

  const [{ data: kit }, { data: profile }] = await Promise.all([
    admin.from("brand_kits").select("color_primary, color_secondary, color_accent, color_cream, logo_path").eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("business_name").eq("id", user.id).maybeSingle(),
  ]);
  const colors = palette ?? validColors(kit) ?? { color_primary: "#4A154B", color_secondary: "#8C338A", color_accent: "#D9B382", color_cream: "#FAF5EF" };
  const brandName = profile?.business_name || "Mi marca";
  const handle = (body.handle ?? "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30) || brandName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30) || "mimarca";

  await admin.from("videos").update({ scenes, palette, voice, updated_at: new Date().toISOString() }).eq("id", video.id);

  // 1. Cupo
  const { data: q, error: qErr } = await admin.rpc("consume_video_quota", { p_video_id: video.id }).single();
  const quota = q as { ok: boolean; message: string } | null;
  if (qErr || !quota?.ok) return fail(quota?.message ?? qErr?.message ?? "No tienes videos disponibles.", 402);

  try {
    // 2. Voz con los tiempos de cada letra
    const { audio, alignment } = await textToSpeech(text, voice);
    const folder = `${user.id}/${video.id}`;
    const { error: upErr } = await admin.storage.from(VIDEO_BUCKET).upload(`${folder}/voz.mp3`, audio, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw new Error(`No se pudo guardar la voz: ${upErr.message}`);
    const { data: voiceSigned } = await admin.storage.from(VIDEO_BUCKET).createSignedUrl(`${folder}/voz.mp3`, 86400);
    if (!voiceSigned?.signedUrl) throw new Error("No se pudo preparar la voz.");

    let logoUrl: string | null = null;
    if (kit?.logo_path) {
      const { data } = await admin.storage.from("brand-assets").createSignedUrl(kit.logo_path, 86400);
      logoUrl = data?.signedUrl ?? null;
    }

    // 3. Música opcional: /public/video/musica-1.mp3, -2, -3
    const site = siteUrl();
    let musicUrl: string | null = null;
    for (const n of [1, 2, 3].sort(() => Math.random() - 0.5)) {
      const h = await fetch(`${site}/video/musica-${n}.mp3`, { method: "HEAD" }).catch(() => null);
      if (h?.ok) {
        musicUrl = `${site}/video/musica-${n}.mp3`;
        break;
      }
    }

    const t = alignTimings(scenes, alignment);
    const props: VideoProps = {
      scenes,
      colors,
      brandName,
      handle,
      logoUrl,
      voiceUrl: voiceSigned.signedUrl,
      words: t.words,
      timings: t.timings,
      total: t.total,
      musicUrl,
      sfx: { whoosh: `${site}/video/sfx-whoosh.mp3`, pop: `${site}/video/sfx-pop.mp3`, ding: `${site}/video/sfx-ding.mp3` },
      subtitles: body.subtitles !== false,
    };

    // 4. Render en GitHub Actions
    const renderId = await startRender(admin, props, video);
    await admin
      .from("videos")
      .update({ status: "rendering", render_id: renderId, duration_s: Number(t.total.toFixed(2)), error: null, updated_at: new Date().toISOString() })
      .eq("id", video.id);
    return NextResponse.json({ ok: true, status: "rendering" });
  } catch (e) {
    console.error("[video/render]", e);
    await admin.rpc("refund_video_quota", { p_video_id: video.id });
    await admin.from("videos").update({ status: "failed", error: String(e).slice(0, 300), updated_at: new Date().toISOString() }).eq("id", video.id);
    return fail("No se pudo crear el video. No se descontó tu cupo. Inténtalo de nuevo.", 502);
  }
}
