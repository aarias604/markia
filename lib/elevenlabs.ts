// ElevenLabs: voz de los videos con los tiempos de cada letra (para cortar escenas y subtítulos). Solo servidor.
import type { Alignment } from "@/lib/video-timing";

// Limpia espacios y comillas que a veces se cuelan al pegar en Vercel.
const clean = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

const VOICES = {
  female: clean(process.env.ELEVENLABS_VOICE_FEMALE) || "EXAVITQu4vr4xnSDxMaL",
  male: clean(process.env.ELEVENLABS_VOICE_MALE) || "JBFqnCBsd6RMkjVDRZzb",
};

export const elevenConfigured = () => !!process.env.ELEVENLABS_API_KEY;


export async function textToSpeech(text: string, voice: "female" | "male") {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICES[voice]}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": clean(process.env.ELEVENLABS_API_KEY), "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs HTTP ${res.status} (voz ${voice === "male" ? "hombre" : "mujer"}: ${VOICES[voice]}): ${detail.slice(0, 160)}`);
  }
  const json = (await res.json()) as { audio_base64: string; alignment?: Alignment; normalized_alignment?: Alignment };
  const alignment = json.alignment ?? json.normalized_alignment;
  if (!json.audio_base64 || !alignment?.characters?.length) throw new Error("ElevenLabs no devolvió el audio completo.");
  return { audio: Buffer.from(json.audio_base64, "base64"), alignment };
}
