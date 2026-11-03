// Markia · Generación de Marca con IA (logo SVG + paleta + tipografías + guía). Solo servidor.
import Anthropic from "@anthropic-ai/sdk";
import { escapeHtml } from "@/lib/email";

export const BRAND_MODEL = "claude-opus-5-5";

export interface BrandBrief {
  nombre: string;
  eslogan?: string;
  nicho: string;
  descripcion: string;
  publico?: string;
  estilo: string;
  colores?: string;
  evitar?: string;
  correo: string;
}

export interface BrandLogo {
  id: "principal" | "icono" | "monocromo";
  nombre: string;
  descripcion: string;
  svg: string;
}

export interface BrandResult {
  concepto: string;
  logos: BrandLogo[];
  paleta: { rol: string; nombre: string; hex: string; uso: string }[];
  tipografias: { rol: string; familia: string; url: string; uso: string }[];
  guia: { tono: string; usos_correctos: string[]; usos_incorrectos: string[]; aplicaciones: string[] };
  kit: { color_primary: string; color_secondary: string; color_accent: string; color_cream: string };
  generado: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => str(x, 200)).filter(Boolean).slice(0, max) : []);

/** Deja el SVG seguro: sin scripts, eventos, enlaces externos ni imágenes incrustadas. */
export function sanitizeSvg(raw: string): string | null {
  const start = raw.indexOf("<svg");
  const end = raw.lastIndexOf("</svg>");
  if (start < 0 || end < 0) return null;
  let s = raw.slice(start, end + 6);
  s = s
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!(DOCTYPE|ENTITY)[\s\S]*?>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<(image|use|a|iframe|object|embed)\b[\s\S]*?(\/>|<\/\1>)/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, "none");
  if (!/^<svg[^>]*xmlns=/.test(s)) s = s.replace("<svg", "<svg xmlns='http://www.w3.org/2000/svg'");
  if (s.length > 80000) return null;
  return s;
}

function fontUrl(family: string) {
  return `https://fonts.google.com/specimen/${encodeURIComponent(family).replace(/%20/g, "+")}`;
}

function parseResult(text: string): BrandResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("La IA no devolvió un formato válido.");
  const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;

  const logosRaw = Array.isArray(raw.logos) ? raw.logos : [];
  const ids: BrandLogo["id"][] = ["principal", "icono", "monocromo"];
  const logos: BrandLogo[] = [];
  logosRaw.forEach((l, i) => {
    const o = l as Record<string, unknown>;
    const svg = sanitizeSvg(String(o.svg ?? ""));
    if (!svg) return;
    const id = ids.includes(o.id as BrandLogo["id"]) ? (o.id as BrandLogo["id"]) : ids[i] ?? "principal";
    logos.push({ id, nombre: str(o.nombre, 60), descripcion: str(o.descripcion, 300), svg });
  });
  if (logos.length < 2) throw new Error("La IA no generó logos válidos.");

  const paleta = (Array.isArray(raw.paleta) ? raw.paleta : [])
    .map((p) => {
      const o = p as Record<string, unknown>;
      return { rol: str(o.rol, 40), nombre: str(o.nombre, 40), hex: str(o.hex, 7).toUpperCase(), uso: str(o.uso, 200) };
    })
    .filter((p) => HEX.test(p.hex))
    .slice(0, 6);
  if (paleta.length < 4) throw new Error("La IA no generó una paleta válida.");

  const tipografias = (Array.isArray(raw.tipografias) ? raw.tipografias : [])
    .map((t) => {
      const o = t as Record<string, unknown>;
      const familia = str(o.familia, 50);
      return { rol: str(o.rol, 40), familia, url: fontUrl(familia), uso: str(o.uso, 200) };
    })
    .filter((t) => t.familia)
    .slice(0, 3);

  const g = (raw.guia ?? {}) as Record<string, unknown>;
  const k = (raw.kit ?? {}) as Record<string, unknown>;
  const pick = (v: unknown, fallback: string) => (HEX.test(String(v)) ? String(v).toUpperCase() : fallback);

  return {
    concepto: str(raw.concepto, 600),
    logos,
    paleta,
    tipografias,
    guia: {
      tono: str(g.tono, 400),
      usos_correctos: list(g.usos_correctos, 8),
      usos_incorrectos: list(g.usos_incorrectos, 8),
      aplicaciones: list(g.aplicaciones, 8),
    },
    kit: {
      color_primary: pick(k.color_primary, paleta[0].hex),
      color_secondary: pick(k.color_secondary, paleta[1].hex),
      color_accent: pick(k.color_accent, paleta[2].hex),
      color_cream: pick(k.color_cream, paleta[3].hex),
    },
    generado: new Date().toISOString(),
  };
}

export async function generateBrand(brief: BrandBrief, revision?: { previous: BrandResult; feedback: string }) {
  const system = [
    "Eres un director de arte experto en identidad de marca para pequeños negocios de Latinoamérica.",
    "Diseñas logos simples, memorables y legibles en tamaño pequeño, dibujados como SVG vectorial a mano.",
    "Reglas para cada SVG:",
    "- Usa SOLO comillas simples en los atributos (ej. fill='#123456') para que el JSON sea válido.",
    "- Solo elementos svg, g, path, rect, circle, ellipse, polygon, line, text y tspan. Sin imágenes, scripts, filtros ni enlaces.",
    "- En text usa font-family='Arial, Helvetica, sans-serif' o font-family='Georgia, serif' para que se vea igual en cualquier computadora.",
    "- Fondo transparente (no dibujes un rectángulo de fondo).",
    "- Nada parecido a marcas famosas existentes.",
    "Responde SOLO con JSON válido, en español, sin texto antes ni después.",
  ].join("\n");

  const datos = [
    `Nombre del negocio: ${brief.nombre}`,
    brief.eslogan ? `Eslogan: ${brief.eslogan}` : "",
    `Nicho: ${brief.nicho}`,
    `Descripción: ${brief.descripcion}`,
    brief.publico ? `Público objetivo: ${brief.publico}` : "",
    `Estilo deseado: ${brief.estilo}`,
    brief.colores ? `Colores que le gustan: ${brief.colores}` : "",
    brief.evitar ? `Qué evitar: ${brief.evitar}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const formato = `{
"concepto":"2 a 4 frases explicando la idea visual y por qué encaja con el negocio",
"logos":[
 {"id":"principal","nombre":"Logo principal","descripcion":"cuándo usarlo","svg":"<svg viewBox='0 0 600 240' ...>ícono + nombre en horizontal, a color</svg>"},
 {"id":"icono","nombre":"Ícono","descripcion":"para foto de perfil y favicon","svg":"<svg viewBox='0 0 300 300' ...>solo el símbolo, a color</svg>"},
 {"id":"monocromo","nombre":"Versión monocromática","descripcion":"para sellos, empaques y fondos de color","svg":"<svg viewBox='0 0 600 240' ...>logo principal en un solo color oscuro</svg>"}
],
"paleta":[{"rol":"Primario","nombre":"nombre creativo","hex":"#RRGGBB","uso":"dónde usarlo"}, ... 5 colores: Primario, Secundario, Acento, Fondo claro, Texto oscuro],
"tipografias":[{"rol":"Títulos","familia":"nombre exacto de una fuente de Google Fonts","uso":"..."},{"rol":"Textos","familia":"...","uso":"..."}],
"guia":{"tono":"cómo debe sentirse la marca","usos_correctos":["..."],"usos_incorrectos":["..."],"aplicaciones":["ideas concretas de uso: redes, empaque, local, uniforme..."]},
"kit":{"color_primary":"#RRGGBB","color_secondary":"#RRGGBB","color_accent":"#RRGGBB","color_cream":"#RRGGBB (claro, buen contraste con el primario)"}
}`;

  const prompt = revision
    ? [
        "Datos del negocio:",
        datos,
        "",
        "Esta es la propuesta anterior (resumen):",
        `Concepto: ${revision.previous.concepto}`,
        `Paleta: ${revision.previous.paleta.map((p) => `${p.nombre} ${p.hex}`).join(", ")}`,
        "",
        `El cliente pidió estos ajustes: ${revision.feedback}`,
        "Crea la versión ajustada completa con el mismo formato.",
        formato,
      ].join("\n")
    : ["Crea la identidad de marca completa para este negocio.", datos, "", "Formato exacto:", formato].join("\n");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: BRAND_MODEL,
    max_tokens: 12000,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseResult(text);
}

/** Correo con el paquete de marca: guía en HTML + logos SVG adjuntos. */
export function brandEmail(brief: BrandBrief, r: BrandResult, siteUrl: string) {
  const e = escapeHtml;
  const swatches = r.paleta
    .map(
      (p) => `<tr>
        <td style="width:56px;height:56px;background:${p.hex};border-radius:8px;border:1px solid #e5e0d8"></td>
        <td style="padding:6px 12px"><strong>${e(p.rol)} · ${e(p.nombre)}</strong><br><code>${p.hex}</code><br><span style="color:#6b5a6b">${e(p.uso)}</span></td>
      </tr>`
    )
    .join("");
  const fonts = r.tipografias
    .map((t) => `<li><strong>${e(t.rol)}:</strong> <a href="${t.url}">${e(t.familia)}</a> (gratis en Google Fonts) — ${e(t.uso)}</li>`)
    .join("");
  const ul = (items: string[]) => items.map((i) => `<li>${e(i)}</li>`).join("");
  const logos = r.logos.map((l) => `<li><strong>${e(l.nombre)}</strong> (logo-${l.id}.svg): ${e(l.descripcion)}</li>`).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#FAF5EF;font-family:Arial,Helvetica,sans-serif;color:#4A154B">
  <div style="max-width:620px;margin:0 auto;padding:24px">
    <div style="background:#4A154B;color:#FAF5EF;border-radius:16px;padding:28px">
      <p style="margin:0;color:#D9B382;font-weight:bold;letter-spacing:1px">MARKIA · GENERACIÓN DE MARCA</p>
      <h1 style="margin:8px 0 0;font-size:26px">La marca de ${e(brief.nombre)} está lista</h1>
    </div>
    <div style="background:#FDFBF7;border-radius:16px;padding:24px;margin-top:16px;line-height:1.55">
      <h2 style="font-size:18px">El concepto</h2><p>${e(r.concepto)}</p>
      <h2 style="font-size:18px">Tus logos (adjuntos en SVG)</h2><ul>${logos}</ul>
      <p>El formato SVG se puede ampliar a cualquier tamaño sin perder calidad. Para obtenerlos en PNG, entra a
      <a href="${siteUrl}/dashboard/marca-ia">tu cuenta de Markia → Marca con IA</a> y pulsa «Descargar PNG».</p>
      <h2 style="font-size:18px">Tu paleta de colores</h2><table style="border-collapse:separate;border-spacing:0 8px">${swatches}</table>
      <h2 style="font-size:18px">Tus tipografías</h2><ul>${fonts}</ul>
      <h2 style="font-size:18px">Cómo debe sentirse tu marca</h2><p>${e(r.guia.tono)}</p>
      <h2 style="font-size:18px">Úsalo así ✅</h2><ul>${ul(r.guia.usos_correctos)}</ul>
      <h2 style="font-size:18px">Evita esto ❌</h2><ul>${ul(r.guia.usos_incorrectos)}</ul>
      <h2 style="font-size:18px">Ideas para aplicarla</h2><ul>${ul(r.guia.aplicaciones)}</ul>
      <h2 style="font-size:18px">Instrucciones rápidas</h2>
      <ol>
        <li>Descarga los archivos adjuntos y guárdalos en una carpeta llamada «Marca ${e(brief.nombre)}».</li>
        <li>Usa el <strong>ícono</strong> como foto de perfil en Instagram, Facebook y WhatsApp Business.</li>
        <li>Usa el <strong>logo principal</strong> en tu web, menú, facturas y publicaciones.</li>
        <li>Usa la <strong>versión monocromática</strong> sobre fotos o fondos de color, y para sellos o empaques.</li>
        <li>Instala las tipografías desde Google Fonts (botón «Get font») para usarlas en Canva, Word o tu web.</li>
        <li>En Markia, pulsa «Usar en mi Kit de marca» para que tus publicaciones salgan con esta identidad.</li>
      </ol>
      <p style="font-size:12px;color:#8a7a8a">Antes de registrar tu logo como marca, consulta en la Dirección General del Registro de la Propiedad Industrial (DIGERPI) que no exista una marca igual o parecida.</p>
    </div>
  </div></body></html>`;

  const attachments = r.logos.map((l) => ({
    filename: `logo-${l.id}.svg`,
    content: Buffer.from(l.svg, "utf-8").toString("base64"),
  }));

  return { subject: `Tu nueva marca: ${brief.nombre} 🎨`, html, attachments };
}
