"use client";

// Tarjeta de una publicación o carrusel: imágenes, descripción sugerida, programación,
// descarga (imágenes PNG + descripción en .txt) y borrado.
import { useRef, useState } from "react";
import { CalendarClock, Check, Copy, Download, Layers, Loader2, Trash2 } from "lucide-react";
import { PostImage } from "@/components/posts/PostImage";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { downloadSvgAsPng, downloadText, slugify, wait } from "@/lib/download";
import { STATUS_INFO, toLocalInputValue } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import type { Post, PostStatus, Slide } from "@/lib/types";
import { btnGold, btnPrimary, btnSecondary, errorCls, inputCls, labelCls } from "@/lib/ui";

interface Props {
  post: Post;
  onUpdated?: (post: Post) => void;
  onDeleted?: (id: string) => void;
}

export function PostCard({ post, onUpdated, onDeleted }: Props) {
  const { kit, logoDataUrl, templates, businessName } = useDashboard();
  const isCarousel = post.format === "carousel" && Array.isArray(post.slides) && post.slides.length > 0;
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const [caption, setCaption] = useState(post.caption ?? "");
  const [headline, setHeadline] = useState(post.image_headline ?? "");
  const [subtext, setSubtext] = useState(post.image_subtext ?? "");
  const [slides, setSlides] = useState<Slide[]>(post.slides ?? []);
  const [when, setWhen] = useState(post.scheduled_at ? toLocalInputValue(post.scheduled_at) : "");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const template = templates.find((t) => t.id === post.template_id) ?? templates[0];
  const fullDescription = `${caption}\n\n${post.hashtags.join(" ")}`.trim();
  const baseName = slugify(post.title || headline || "publicacion");

  async function save(patch: Partial<Post>) {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().from("posts").update(patch).eq("id", post.id).select("*").single();
    setBusy(false);
    if (error) return setError(`No se pudo guardar: ${error.message}`);
    onUpdated?.(data as Post);
  }

  function saveIfChanged(field: "caption" | "image_headline" | "image_subtext", value: string) {
    if ((post[field] ?? "") !== value) void save({ [field]: value } as Partial<Post>);
  }

  function updateSlide(i: number, key: keyof Slide, value: string) {
    setSlides((s) => s.map((sl, j) => (j === i ? { ...sl, [key]: value } : sl)));
  }

  function saveSlides() {
    if (JSON.stringify(slides) !== JSON.stringify(post.slides ?? [])) void save({ slides });
  }

  async function schedule() {
    if (!when) return setError("Elige la fecha y la hora.");
    const status: PostStatus = post.status === "published" ? "published" : "scheduled";
    await save({ scheduled_at: new Date(when).toISOString(), status });
  }

  async function copy() {
    await navigator.clipboard.writeText(fullDescription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** Descarga las imágenes en PNG y la descripción sugerida en .txt. */
  async function downloadAll() {
    setDownloading(true);
    setError(null);
    try {
      const svgs = svgRefs.current.filter((s): s is SVGSVGElement => !!s);
      for (let i = 0; i < svgs.length; i++) {
        await downloadSvgAsPng(svgs[i], isCarousel ? `${baseName}-${i + 1}` : baseName);
        await wait(400);
      }
      downloadText(fullDescription, `${baseName}-descripcion`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar.");
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    setBusy(true);
    const { error } = await createClient().from("posts").delete().eq("id", post.id);
    setBusy(false);
    if (error) return setError(`No se pudo borrar: ${error.message}`);
    onDeleted?.(post.id);
  }

  const status = STATUS_INFO[post.status];
  const images =
    kit && template ? (
      isCarousel ? (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {slides.map((s, i) => (
            <div key={i} className="w-60 shrink-0 snap-start overflow-hidden rounded-xl shadow">
              <PostImage
                ref={(el) => {
                  svgRefs.current[i] = el;
                }}
                definition={template.definition}
                colors={kit}
                logoUrl={logoDataUrl}
                brandName={businessName}
                headline={s.titulo}
                subtext={s.texto}
                badge={`${i + 1}/${slides.length}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl shadow">
          <PostImage
            ref={(el) => {
              svgRefs.current[0] = el;
            }}
            definition={template.definition}
            colors={kit}
            logoUrl={logoDataUrl}
            brandName={businessName}
            headline={headline}
            subtext={subtext}
          />
        </div>
      )
    ) : (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-white p-4 text-center text-xs text-[#4A154B]/60">
        Corre las migraciones en Supabase para tener plantillas.
      </div>
    );

  return (
    <article className={`grid gap-5 rounded-2xl border border-[#D9B382]/40 bg-[#FDFBF7] p-4 shadow-sm ${isCarousel ? "" : "md:grid-cols-[280px_1fr]"}`}>
      <div className="min-w-0">
        {images}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${btnGold} px-4 py-2`} onClick={downloadAll} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isCarousel ? `Descargar ${slides.length} imágenes + descripción` : "Descargar imagen + descripción"}
          </button>
          <button className={`${btnSecondary} px-3 py-2`} onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copiada" : "Copiar descripción"}
          </button>
        </div>
        {isCarousel && (
          <p className="mt-2 text-xs text-[#4A154B]/60">
            Si tu navegador pregunta, permite descargar varios archivos. En Instagram súbelas en orden (1, 2, 3…).
          </p>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold">
            {isCarousel && <Layers className="h-4 w-4 text-[#8C338A]" />}
            {post.title || "Publicación"}
          </h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
        </div>

        {isCarousel ? (
          <details className="rounded-xl bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold">Editar textos de las láminas</summary>
            <div className="mt-3 space-y-3">
              {slides.map((s, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[40px_1fr_1.5fr] sm:items-center">
                  <span className="text-xs font-bold text-[#8C338A]">{i + 1}</span>
                  <input className={inputCls} value={s.titulo} maxLength={90}
                    onChange={(e) => updateSlide(i, "titulo", e.target.value)} onBlur={saveSlides} />
                  <input className={inputCls} value={s.texto} maxLength={160}
                    onChange={(e) => updateSlide(i, "texto", e.target.value)} onBlur={saveSlides} />
                </div>
              ))}
            </div>
          </details>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Texto de la imagen</label>
              <input className={inputCls} value={headline} maxLength={90}
                onChange={(e) => setHeadline(e.target.value)} onBlur={() => saveIfChanged("image_headline", headline)} />
            </div>
            <div>
              <label className={labelCls}>Subtexto de la imagen</label>
              <input className={inputCls} value={subtext} maxLength={120}
                onChange={(e) => setSubtext(e.target.value)} onBlur={() => saveIfChanged("image_subtext", subtext)} />
            </div>
          </div>
        )}

        {templates.length > 1 && (
          <div>
            <label className={labelCls}>Plantilla</label>
            <select className={inputCls} value={template?.id ?? ""} onChange={(e) => void save({ template_id: e.target.value })}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.kind === "custom" ? " (propia)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>Descripción sugerida para Instagram</label>
          <textarea className={`${inputCls} min-h-36`} value={caption}
            onChange={(e) => setCaption(e.target.value)} onBlur={() => saveIfChanged("caption", caption)} />
          <p className="mt-1 break-words text-xs text-[#6B21A8]">{post.hashtags.join(" ")}</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <label className={labelCls}>Fecha y hora de publicación</label>
            <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <button className={btnPrimary} onClick={schedule} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Programar
          </button>
        </div>
        <p className="text-xs text-[#4A154B]/60">
          Mientras activamos la publicación automática, descarga la imagen y la descripción y súbelas a Instagram en la fecha programada. Luego márcala como publicada.
        </p>

        <div className="flex flex-wrap items-center gap-3 border-t border-[#D9B382]/30 pt-3 text-sm">
          {post.status !== "published" ? (
            <button className="font-medium text-emerald-700 hover:underline" disabled={busy}
              onClick={() => void save({ status: "published" })}>
              Marcar como publicado
            </button>
          ) : (
            <button className="font-medium text-[#6B21A8] hover:underline" disabled={busy}
              onClick={() => void save({ status: post.scheduled_at ? "scheduled" : "draft" })}>
              Desmarcar publicado
            </button>
          )}
          {post.scheduled_at && (
            <button className="font-medium text-[#4A154B]/70 hover:underline" disabled={busy}
              onClick={() => { setWhen(""); void save({ scheduled_at: null, status: "draft" }); }}>
              Quitar fecha
            </button>
          )}
          <span className="ml-auto" />
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              ¿Borrar?
              <button className="font-semibold text-red-700 hover:underline" onClick={remove} disabled={busy}>Sí, borrar</button>
              <button className="hover:underline" onClick={() => setConfirmDelete(false)}>No</button>
            </span>
          ) : (
            <button className="inline-flex items-center gap-1 text-red-700 hover:underline" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Borrar
            </button>
          )}
        </div>

        {error && <p className={errorCls}>{error}</p>}
      </div>
    </article>
  );
}
