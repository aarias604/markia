// Videos: estado del render (lo hace GitHub Actions y sube el MP4 a Supabase). Solo servidor.
import type { SupabaseClient } from "@supabase/supabase-js";

export const VIDEO_BUCKET = "videos";
const MAX_MINUTES = 40; // si no terminó en este tiempo, se marca como fallido y se devuelve el cupo

interface VideoRow {
  id: string;
  user_id: string;
  status: string;
  render_id: string | null;
  updated_at?: string;
}

/** Marca el video como fallido (solo si seguía creándose) y devuelve el cupo. */
export async function markVideoFailed(admin: SupabaseClient, id: string, error: string) {
  const { data } = await admin
    .from("videos")
    .update({ status: "failed", error: error.slice(0, 300), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "rendering")
    .select("id");
  if (data?.length) await admin.rpc("refund_video_quota", { p_video_id: id });
}

/** Revisa si el MP4 ya está en Supabase. Devuelve el estado y un avance aproximado (0–1). */
export async function finalizeVideo(admin: SupabaseClient, v: VideoRow): Promise<{ status: string; progress: number }> {
  if (v.status !== "rendering") return { status: v.status, progress: v.status === "ready" ? 1 : 0 };

  const folder = `${v.user_id}/${v.id}`;
  const { data: files } = await admin.storage.from(VIDEO_BUCKET).list(folder, { limit: 100 });
  if ((files ?? []).some((f) => f.name === "video.mp4")) {
    await admin
      .from("videos")
      .update({ status: "ready", video_path: `${folder}/video.mp4`, error: null, updated_at: new Date().toISOString() })
      .eq("id", v.id)
      .eq("status", "rendering");
    return { status: "ready", progress: 1 };
  }

  const minutes = v.updated_at ? (Date.now() - new Date(v.updated_at).getTime()) / 60000 : 0;
  if (minutes > MAX_MINUTES) {
    await markVideoFailed(admin, v.id, "El video no terminó a tiempo.");
    return { status: "failed", progress: 0 };
  }
  // Avance estimado: un video suele tardar de 4 a 8 minutos.
  return { status: "rendering", progress: Math.min(minutes / 7, 0.95) };
}
