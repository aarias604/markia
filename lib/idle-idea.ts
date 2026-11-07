// Sugerencia corta de publicación según el negocio y sus publicaciones anteriores. Solo servidor.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-5-5";

export interface IdeaInput {
  businessName: string;
  niche: string | null;
  voiceTone: string | null;
  recent: { title: string | null; caption: string | null }[];
}

const FALLBACK = (b: string) =>
  `Comparte una foto de tu producto o servicio más pedido en ${b} y cuenta por qué tus clientes lo prefieren. Cierra invitando a escribirte por mensaje.`;

export async function idleIdea(input: IdeaInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return FALLBACK(input.businessName);
  const history = input.recent
    .map((p, i) => `${i + 1}. ${(p.title ?? "").slice(0, 80)} — ${(p.caption ?? "").replace(/\s+/g, " ").slice(0, 160)}`)
    .join("\n");
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "Eres estratega de redes sociales para pequeños negocios en Panamá. Respondes en español neutro, cercano y concreto. " +
        "Devuelves SOLO la idea, en un único párrafo de máximo 280 caracteres, sin saltos de línea, sin hashtags, sin comillas y sin emojis al inicio.",
      messages: [
        {
          role: "user",
          content:
            `Negocio: ${input.businessName}\nRubro: ${input.niche ?? "no indicado"}\nTono: ${input.voiceTone ?? "cercano"}\n` +
            `Publicaciones anteriores:\n${history || "(todavía no ha publicado)"}\n\n` +
            "Sugiere UNA idea de publicación para hoy en Instagram: qué mostrar y qué decir. Que sea distinta a las anteriores pero coherente con el negocio.",
        },
      ],
    });
    const text = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return text || FALLBACK(input.businessName);
  } catch (e) {
    console.error("[idle-idea]", e);
    return FALLBACK(input.businessName);
  }
}
