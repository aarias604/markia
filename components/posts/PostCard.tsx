"use client";

// Tarjeta de una publicación (generada con IA o subida por el usuario):
// imágenes, descripción sugerida, destino (publicación o historia), programación,
// publicación automática en Instagram (PRO), descarga y borrado.
import Link from "next/link";
import { useRef, useState } from "react";
import { CalendarClock, Check, CircleDashed, Copy, Download, ExternalLink, Layers, Loader2, Send, Trash2, Zap } from "lucide-react";
import { PostImage } from "@/components/posts/PostImage";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { asColors } from "@/lib/palettes";
import { downloadSvgAsPng, downloadText, slugify, wait } from "@/lib/download";
import { downloadUrl, svgToJpeg, uploadPostMedia, useSignedUrls, type Placement } from "@/lib/media";
import { STATUS_INFO, toLocalInputValue } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import { resolveColor } from "@/lib/templates";
import type { Post, PostStatus, Slide } from "@/lib/types";
import { btnGold, btnPrimary, btnSecondary, errorCls, inputCls, labelCls } from "@/lib/ui";

interface Props {
  post: Post;
  onUpdated?: (post: Post) => void;
  onDeleted?: (id: string) => void;
}

export function PostCard({ post, onUpdated, onDeleted }: Props) {
  const { kit: kitColors, logoDataUrl, templates, businessName, userId, planHasAutopost, canAutopost, instagram } = useDashboard();
  // Colores de la publicación: la paleta elegida al generarla o la del kit de marca.
  const kit = asColors(post.palette) ?? kitColors;
  const isUpload = post.source === "upload";
  const isCarousel = !isUpload && post.format === "carousel" && Array.isArray(post.slides) && post.slides.length > 0;
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const uploadedUrls = useSignedUrls(isUpload ? post.media_paths : null);

  const [caption, setCaption] = useState(post.caption ?? "");
  const [headline, setHeadline] = useState(post.image_headline ?? "");
  const [subtext, setSubtext] = useState(post.image_subtext ?? "");
  const [slides, setSlides] = useState<Slide[]>(post.slides ?? []);
  const [when, setWhen] = useState(post.scheduled_at ? toLocalInputValue(post.scheduled_at) : "");
  const [placement, setPlacement] = useState<Placement>(post.placement ?? "feed");
  const [auto, setAuto] = useState<boolean>(!!post.auto_publish && canAutopost);
  const fbPage = instagram?.fb_page_name ?? null;
  const [alsoFb, setAlsoFb] = useState<boolean>(post.also_facebook ?? !!fbPage);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const template = templates.find((t) => t.id === post.template_id) ?? templates[0];
  const fullDescription = `${caption}\n\n${post.hashtags.join(" ")}`.trim();
  const baseName = slugify(post.title || headline || "publicacion");
  const isStory = placement === "story";

  async function save(patch: Partial<Post>) {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().from("posts").update(patch).eq("id", post.id).select("*").single();
    setBusy(false);
    if (error) {
      setError(`No se pudo guardar: ${error.message}`);
      return false;
    }
    onUpdated?.(data as Post);
    return true;
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

  /** Para publicaciones con IA: convierte las imágenes a JPEG y las guarda para Instagram. */
  async function prepareMedia(): Promise<string[] | null> {
    if (isUpload) return post.media_paths ?? null;
    if (!kit || !template) throw new Error("Falta tu kit de marca o la plantilla.");
    const svgs = svgRefs.current.filter((s): s is SVGSVGElement => !!s);
    const bg = resolveColor(template.definition.fondo, kit);
    const blobs = [];
    for (const svg of svgs) blobs.push(await svgToJpeg(svg, placement, bg));
    return uploadPostMedia(blobs, userId, post.id);
  }

  async function schedule() {
    if (!when) return setError("Elige la fecha y la hora.");
    const at = new Date(when);
    if (auto && at.getTime() < Date.now() - 60000) return setError("Para publicar automáticamente, elige una fecha y hora futuras.");
    setBusy(true);
    setError(null);
    try {
      // Siempre preparamos las imágenes: sirven para Instagram automático y para el recordatorio por WhatsApp.
      let media_paths: string[] | null = post.media_paths ?? null;
      try {
        media_paths = await prepareMedia();
      } catch (err) {
        if (auto) throw err; // sin imágenes no se puede publicar solo
      }
      const status: PostStatus = post.status === "published" ? "published" : "scheduled";
      await save({ scheduled_at: at.toISOString(), status, placement, auto_publish: auto, also_facebook: auto && alsoFb && !!fbPage, media_paths, publish_attempts: 0, error_message: null } as Partial<Post>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo programar.");
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(fullDescription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** Descarga las imágenes y la descripción sugerida en .txt. */
  async function downloadAll() {
    setDownloading(true);
    setError(null);
    try {
      if (isUpload) {
        for (let i = 0; i < uploadedUrls.length; i++) {
          await downloadUrl(uploadedUrls[i], `${baseName}-${i + 1}.jpg`);
          await wait(400);
        }
      } else {
        const svgs = svgRefs.current.filter((s): s is SVGSVGElement => !!s);
        for (let i = 0; i < svgs.length; i++) {
          await downloadSvgAsPng(svgs[i], svgs.length > 1 ? `${baseName}-${i + 1}` : baseName);
          await wait(400);
        }
      }
      if (fullDescription) downloadText(fullDescription, `${baseName}-descripcion`);
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
  const imageCount = isUpload ? uploadedUrls.length : isCarousel ? slides.length : 1;

  const images = isUpload ? (
    <div className="flex snap-x gap-3 overflow-x-auto pb-2">
      {(uploadedUrls.length ? uploadedUrls : [""]).map((u, i) => (
        <div key={i} className="w-56 shrink-0 snap-start overflow-hidden rounded-xl bg-white shadow">
          {u ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u} alt="" className="w-full object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          )}
        </div>
      ))}
    </div>
  ) : kit && template ? (
    <div className={isCarousel ? "flex snap-x gap-3 overflow-x-auto pb-2" : ""}>
      {(isCarousel ? slides : [{ titulo: headline, texto: subtext }]).map((s, i) => (
        <div key={i} className={`${isCarousel ? "w-60 shrink-0 snap-start" : ""} overflow-hidden rounded-xl shadow`}>
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
            badge={isCarousel ? `${i + 1}/${slides.length}` : undefined}
          />
        </div>
      ))}
    </div>
  ) : (
    <div className="flex aspect-square items-center justify-center rounded-xl bg-white p-4 text-center text-xs text-[#4A154B]/60">
      Corre las migraciones en Supabase para tener plantillas.
    </div>
  );

  const multi = imageCount > 1;

  return (
    <article className={`grid gap-5 rounded-2xl border border-[#D9B382]/40 bg-[#FDFBF7] p-4 shadow-sm ${multi ? "" : "md:grid-cols-[280px_1fr]"}`}>
      <div className="min-w-0">
        {images}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${btnGold} px-4 py-2`} onClick={downloadAll} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {multi ? `Descargar ${imageCount} imágenes + descripción` : "Descargar imagen + descripción"}
          </button>
          {fullDescription && (
            <button className={`${btnSecondary} px-3 py-2`} onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copiada" : "Copiar descripción"}
            </button>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold">
            {isCarousel && <Layers className="h-4 w-4 text-[#8C338A]" />}
            {isStory && <CircleDashed className="h-4 w-4 text-[#8C338A]" />}
            {post.title || (isUpload ? "Publicación propia" : "Publicación")}
          </h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>
            {post.auto_publish && post.status === "scheduled" && <Zap className="mr-1 inline h-3 w-3" />}
            {status.label}
          </span>
        </div>

        {post.fb_permalink && (
          <a href={post.fb_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#1877F2] underline">
            Ver en Facebook
          </a>
        )}
        {post.fb_error && <p className="text-xs text-amber-800">Facebook: {post.fb_error}</p>}
        {post.ig_permalink && (
          <a href={post.ig_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#6B21A8] underline">
            Ver en Instagram <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {post.status === "failed" && post.error_message && <p className={errorCls}>No se publicó: {post.error_message}</p>}

        {!isUpload && (isCarousel ? (
          <details className="rounded-xl bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold">Editar textos de las láminas</summary>
            <div className="mt-3 space-y-3">
              {slides.map((s, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[40px_1fr_1.5fr] sm:items-center">
                  <span className="text-xs font-bold text-[#8C338A]">{i + 1}</span>
                  <input className={inputCls} value={s.titulo} maxLength={90} onChange={(e) => updateSlide(i, "titulo", e.target.value)} onBlur={saveSlides} />
                  <input className={inputCls} value={s.texto} maxLength={160} onChange={(e) => updateSlide(i, "texto", e.target.value)} onBlur={saveSlides} />
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
        ))}

        {!isUpload && templates.length > 1 && (
          <div>
            <label className={labelCls}>Plantilla</label>
            <select className={inputCls} value={template?.id ?? ""} onChange={(e) => void save({ template_id: e.target.value })}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.kind === "custom" ? " (propia)" : ""}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>Descripción sugerida para Instagram {isStory && <span className="font-normal text-[#4A154B]/50">(las historias no muestran descripción)</span>}</label>
          <textarea className={`${inputCls} min-h-32`} value={caption}
            onChange={(e) => setCaption(e.target.value)} onBlur={() => saveIfChanged("caption", caption)} />
          {post.hashtags.length > 0 && <p className="mt-1 break-words text-xs text-[#6B21A8]">{post.hashtags.join(" ")}</p>}
        </div>

        {/* Destino y programación */}
        <div className="space-y-3 rounded-xl bg-white p-4">
          <div className="grid max-w-sm grid-cols-2 gap-1 rounded-full bg-[#4A154B]/5 p-1 text-sm font-semibold">
            {(["feed", "story"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPlacement(p)}
                className={`rounded-full py-1.5 ${placement === p ? "bg-[#4A154B] text-[#FAF5EF]" : "text-[#4A154B]/60"}`}>
                {p === "feed" ? "Publicación" : "Historia"}
              </button>
            ))}
          </div>
          {isStory && multi && <p className="text-xs text-[#4A154B]/60">Cada imagen se publicará como una historia separada.</p>}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-52 flex-1">
              <label className={labelCls}>Fecha y hora</label>
              <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <button className={btnPrimary} onClick={schedule} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Programar
            </button>
          </div>

          {planHasAutopost ? (
            canAutopost ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4A154B]" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                <span>
                  <Send className="mr-1 inline h-3.5 w-3.5" />
                  Publicar automáticamente en <strong>@{instagram?.username}</strong> a esa hora.
                  {!isUpload && <span className="block text-xs text-[#4A154B]/60">Si cambias el texto de la imagen, vuelve a pulsar «Programar».</span>}
                </span>
              </label>
            ) : null
          ) : null}
          {planHasAutopost && canAutopost && auto && (
            fbPage ? (
              <label className="flex items-start gap-2 pl-6 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4A154B]" checked={alsoFb} onChange={(e) => setAlsoFb(e.target.checked)} />
                <span>También en la Página de Facebook <strong>{fbPage}</strong></span>
              </label>
            ) : (
              <p className="pl-6 text-xs text-[#4A154B]/60">
                Para publicar también en Facebook, <Link href="/dashboard/instagram" className="font-semibold text-[#6B21A8] underline">vuelve a conectar tu cuenta</Link>.
              </p>
            )
          )}
          {planHasAutopost ? (
            canAutopost ? (
              null
            ) : (
              <p className="text-xs text-[#4A154B]/70">
                <Link href="/dashboard/instagram" className="font-semibold text-[#6B21A8] underline">Conecta tu Instagram</Link> para publicar automáticamente.
              </p>
            )
          ) : (
            <p className="text-xs text-[#4A154B]/60">
              📧 A esa hora te enviaremos un correo de recordatorio con la descripción lista para copiar. Descarga la
              imagen, súbela a Instagram y luego pulsa «Marcar como publicado».
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[#D9B382]/30 pt-3 text-sm">
          {post.status !== "published" ? (
            <button className="font-medium text-emerald-700 hover:underline" disabled={busy} onClick={() => void save({ status: "published" })}>
              Marcar como publicado
            </button>
          ) : (
            <button className="font-medium text-[#6B21A8] hover:underline" disabled={busy}
              onClick={() => void save({ status: post.scheduled_at ? "scheduled" : "draft", auto_publish: false } as Partial<Post>)}>
              Desmarcar publicado
            </button>
          )}
          {post.scheduled_at && (
            <button className="font-medium text-[#4A154B]/70 hover:underline" disabled={busy}
              onClick={() => { setWhen(""); void save({ scheduled_at: null, status: "draft", auto_publish: false } as Partial<Post>); }}>
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
