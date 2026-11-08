// Render de videos con Remotion en GitHub Actions (gratis: 2,000 minutos al mes en repos privados). Solo servidor.
// 1. Guardamos los datos del video (props.json) en Supabase.
// 2. Pedimos a GitHub que ejecute .github/workflows/render-video.yml.
// 3. GitHub crea el MP4, lo sube a Supabase y avisa a /api/video/listo.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VideoProps } from "@/remotion/types";

const repo = process.env.GITHUB_REPO || "aarias604/markia";
const ref = process.env.GITHUB_RENDER_REF || "main";

export const remotionConfigured = () => !!process.env.GITHUB_RENDER_TOKEN;

export async function startRender(admin: SupabaseClient, props: VideoProps, video: { id: string; user_id: string }) {
  const folder = `${video.user_id}/${video.id}`;
  const { error } = await admin.storage
    .from("videos")
    .upload(`${folder}/props.json`, Buffer.from(JSON.stringify(props)), { contentType: "text/plain", upsert: true });
  if (error) throw new Error(`No se pudieron guardar los datos del video: ${error.message}`);

  // Borra un MP4 anterior (reintentos) para no confundirlo con el nuevo.
  await admin.storage.from("videos").remove([`${folder}/video.mp4`]);

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/render-video.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_RENDER_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "markia-render",
    },
    body: JSON.stringify({
      ref,
      inputs: { video_id: video.id, folder },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub no pudo iniciar el render (HTTP ${res.status}): ${detail.slice(0, 200)}`);
  }
  return `gh:${video.id}`;
}
