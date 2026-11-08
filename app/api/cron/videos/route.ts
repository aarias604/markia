// GET /api/cron/videos · Vercel Cron cada 10 minutos: termina los videos que siguen "creándose"
// (por si el cliente cerró la página mientras se renderizaba).
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeVideo } from "@/lib/video-server";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("videos")
    .select("*")
    .eq("status", "rendering")
    .lt("updated_at", new Date(Date.now() - 2 * 60000).toISOString())
    .limit(20);
  const out: Record<string, string> = {};
  for (const v of data ?? []) {
    try {
      out[v.id] = (await finalizeVideo(admin, v)).status;
    } catch (e) {
      out[v.id] = `error: ${e instanceof Error ? e.message : e}`;
    }
  }
  return NextResponse.json({ ok: true, out });
}
