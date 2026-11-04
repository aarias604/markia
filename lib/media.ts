"use client";

// Preparación de imágenes para Instagram en el navegador:
// - Instagram solo acepta JPEG.
// - Publicación (feed): proporción entre 4:5 y 1.91:1 → recortamos al centro si hace falta.
// - Historia: 1080x1920 (9:16).
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Placement = "feed" | "story";

const BUCKET = "post-media";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen."));
    img.src = src;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear el JPEG."))), "image/jpeg", quality)
  );
}

/** Imagen de una publicación generada (SVG) → JPEG. En historia se centra sobre un fondo 9:16. */
export async function svgToJpeg(svg: SVGSVGElement, placement: Placement, background: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", "1080");
  clone.setAttribute("height", "1080");
  const xml = new XMLSerializer().serializeToString(clone);
  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml));

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = placement === "story" ? 1920 : 1080;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, placement === "story" ? 420 : 0, 1080, 1080);
  return canvasToJpeg(canvas);
}

/** Foto subida por el usuario → JPEG listo para Instagram (máx. 1440 px de ancho). */
export async function fileToJpeg(file: File, placement: Placement) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;

    if (placement === "feed") {
      const ratio = sw / sh;
      if (ratio < 0.8) {
        // más alta que 4:5 → recortar arriba y abajo
        const nh = sw / 0.8;
        sy = (sh - nh) / 2;
        sh = nh;
      } else if (ratio > 1.91) {
        // más ancha que 1.91:1 → recortar a los lados
        const nw = sh * 1.91;
        sx = (sw - nw) / 2;
        sw = nw;
      }
    }

    const width = Math.min(placement === "story" ? 1080 : 1440, Math.round(sw));
    const height = Math.round((sh / sw) * width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    return canvasToJpeg(canvas, 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Sube los JPEG a Supabase Storage y devuelve sus rutas. */
export async function uploadPostMedia(blobs: Blob[], userId: string, postId: string) {
  const supabase = createClient();
  const stamp = Date.now();
  const paths: string[] = [];
  for (let i = 0; i < blobs.length; i++) {
    const path = `${userId}/${postId}/${stamp}-${i + 1}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blobs[i], { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`No se pudo subir la imagen ${i + 1}: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

/** Direcciones temporales (1 hora) para mostrar imágenes guardadas. */
export function useSignedUrls(paths: string[] | null | undefined) {
  const [urls, setUrls] = useState<string[]>([]);
  const key = (paths ?? []).join("|");
  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (list.length === 0) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    createClient()
      .storage.from(BUCKET)
      .createSignedUrls(list, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrls((data ?? []).map((d) => d.signedUrl ?? ""));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return urls;
}

/** Descarga un archivo desde una URL (para las imágenes subidas). */
export async function downloadUrl(url: string, filename: string) {
  const blob = await (await fetch(url)).blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
