// Imágenes con IA para las escenas de video (OpenAI). Solo servidor.
// Variables: OPENAI_API_KEY (obligatoria) y OPENAI_IMAGE_MODEL (opcional, por defecto gpt-image-1-mini).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scene } from "@/lib/video";

export const aiImagesConfigured = () => !!process.env.OPENAI_API_KEY;

const MAX_IMAGES = 8;
const STYLE_HINT: Record<string, string> = {
  pop: "bold flat vector illustration, thick outlines, playful",
  pizarra: "hand-drawn marker doodle on a whiteboard, sketchy lines",
  neon: "glowing neon line-art illustration on a very dark background",
  minimal: "minimalist elegant flat illustration, soft shapes, lots of negative space",
  cuaderno: "cute hand-drawn notebook doodle, colored pencil texture",
  retro: "90s retro pop-art illustration, halftone dots, bold shapes",
};

async function generate(prompt: string) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini",
      prompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; error?: { message?: string } };
  const b64 = json.data?.[0]?.b64_json;
  if (!res.ok || !b64) throw new Error(`OpenAI: ${json.error?.message ?? `HTTP ${res.status}`}`);
  return Buffer.from(b64, "base64");
}

/**
 * Crea una imagen para las escenas que la necesitan (máx. 8) y devuelve las escenas con imageUrl.
 * Si alguna falla, esa escena se queda con su ilustración de íconos.
 */
export async function addAiImages(
  admin: SupabaseClient,
  folder: string,
  scenes: Scene[],
  style: string,
  colors: { color_primary: string; color_secondary: string; color_accent: string; color_cream: string }
): Promise<{ scenes: Scene[]; made: number }> {
  const wanted = scenes
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => ["portada", "ilustracion", "icono", "cierre"].includes(s.layout))
    .slice(0, MAX_IMAGES);
  const palette = `${colors.color_primary}, ${colors.color_secondary}, ${colors.color_accent} and ${colors.color_cream}`;
  const out = [...scenes];
  let made = 0;

  await Promise.all(
    wanted.map(async ({ s, i }) => {
      const subject = s.imagen || `an illustration about: ${s.narracion.slice(0, 200)}`;
      const prompt = `${STYLE_HINT[style] ?? STYLE_HINT.pop}. Subject: ${subject}. Use only this color palette: ${palette}. Square composition, centered subject, simple background, absolutely no text, no letters, no logos, no watermarks.`;
      try {
        const png = await generate(prompt);
        const path = `${folder}/img-${i}.png`;
        const { error } = await admin.storage.from("videos").upload(path, png, { contentType: "image/png", upsert: true });
        if (error) throw new Error(error.message);
        const { data } = await admin.storage.from("videos").createSignedUrl(path, 86400);
        if (data?.signedUrl) {
          out[i] = { ...out[i], imageUrl: data.signedUrl };
          made++;
        }
      } catch (e) {
        console.error("[ai-images] escena", i, e);
      }
    })
  );
  return { scenes: out, made };
}
