// POST /api/video/listo · GitHub Actions avisa que terminó (o falló) un video.
// Protegido con CRON_SECRET (el mismo valor se guarda como secreto en GitHub).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeVideo, markVideoFailed } from "@/lib/video-server";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { videoId?: string; ok?: boolean; error?: string } | null;
  if (!body?.videoId || !/^[0-9a-f-]{36}$/i.test(body.videoId)) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const admin = createAdminClient();
  const { data: v } = await admin.from("videos").select("*").eq("id", body.videoId).maybeSingle();
  if (!v) return NextResponse.json({ ok: true });

  if (body.ok) {
    const r = await finalizeVideo(admin, v);
    return NextResponse.json({ ok: true, status: r.status });
  }
  await markVideoFailed(admin, v.id, body.error || "El render falló en GitHub.");
  return NextResponse.json({ ok: true, status: "failed" });
}
