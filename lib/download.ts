// Utilidades del navegador para archivos e imágenes.

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Convierte el SVG de una publicación en PNG de 1080x1080 y lo descarga. */
export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", "1080");
  clone.setAttribute("height", "1080");
  const xml = new XMLSerializer().serializeToString(clone);
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo preparar la imagen."));
    img.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite crear imágenes.");
  ctx.drawImage(img, 0, 0, 1080, 1080);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Convierte un SVG (texto) en PNG con fondo transparente y lo descarga. */
export async function downloadSvgStringAsPng(svg: string, filename: string, width = 1600) {
  const vb = svg.match(/viewBox\s*=\s*['"]\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const ratio = vb ? Number(vb[2]) / Number(vb[1]) : 1;
  const height = Math.round(width * (ratio || 1));
  const sized = svg.replace(/<svg\b/, `<svg width='${width}' height='${height}'`);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo preparar la imagen."));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadSvgString(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Descarga un archivo de texto (la descripción sugerida). */
export function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".txt") ? filename : `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function slugify(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "publicacion"
  );
}
