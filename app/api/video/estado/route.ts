// GET /api/video/estado?id= · Estado del video; si está listo, devuelve un enlace temporal para verlo.
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_BUCKET, finalizeVideo } from "@/lib/video-server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  const admin = createAdminClient();
  const { data: v } = await admin.from("videos").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!v) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

  let status = v.status as string;
  let progress = 0;
  if (status === "rendering") {
    try {
      ({ status, progress } = await finalizeVideo(admin, v));
    } catch (e) {
      console.error("[video/estado]", e);
    }
  }

  let url: string | null = null;
  if (status === "ready") {
    const path = v.video_path ?? `${user.id}/${v.id}/video.mp4`;
    const { data } = await admin.storage.from(VIDEO_BUCKET).createSignedUrl(path, 3600, { download: false });
    url = data?.signedUrl ?? null;
  }
  return NextResponse.json({ status, progress, url, error: status === "failed" ? v.error : null });
}
