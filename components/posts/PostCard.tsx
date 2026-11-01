"use client";

// Tarjeta de una publicación: imagen, textos editables, programación, descarga y borrado.
import { useRef, useState } from "react";
import { CalendarClock, Check, Copy, Download, Loader2, Trash2 } from "lucide-react";
import { PostImage } from "@/components/posts/PostImage";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { downloadSvgAsPng, slugify } from "@/lib/download";
import { STATUS_INFO, toLocalInputValue } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import type { Post, PostStatus } from "@/lib/types";
import { btnPrimary, btnSecondary, errorCls, inputCls, labelCls } from "@/lib/ui";

interface Props {
  post: Post;
  onUpdated?: (post: Post) => void;
  onDeleted?: (id: string) => void;
}

export function PostCard({ post, onUpdated, onDeleted }: Props) {
  const { kit, logoDataUrl, templates, businessName } = useDashboard();
  const svgRef = useRef<SVGSVGElement>(null);
  const [caption, setCaption] = useState(post.caption ?? "");
  const [headline, setHeadline] = useState(post.image_headline ?? "");
  const [subtext, setSubtext] = useState(post.image_subtext ?? "");
  const [when, setWhen] = useState(post.scheduled_at ? toLocalInputValue(post.scheduled_at) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const template = templates.find((t) => t.id === post.template_id) ?? templates[0];

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

  async function schedule() {
    if (!when) return setError("Elige la fecha y la hora.");
    const status: PostStatus = post.status === "published" ? "published" : "scheduled";
    await save({ scheduled_at: new Date(when).toISOString(), status });
  }

  async function copy() {
    await navigator.clipboard.writeText(`${caption}\n\n${post.hashtags.join(" ")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function download() {
    if (!svgRef.current) return;
    try {
      await downloadSvgAsPng(svgRef.current, slugify(post.title || headline));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar.");
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

  return (
    <article className="grid gap-5 rounded-2xl border border-[#D9B382]/40 bg-[#FDFBF7] p-4 shadow-sm md:grid-cols-[280px_1fr]">
      <div>
        <div className="overflow-hidden rounded-xl shadow">
          {kit && template ? (
            <PostImage
              ref={svgRef}
              definition={template.definition}
              colors={kit}
              logoUrl={logoDataUrl}
              brandName={businessName}
              headline={headline}
              subtext={subtext}
            />
          ) : (
            <div className="flex aspect-square items-center justify-center bg-white p-4 text-center text-xs text-[#4A154B]/60">
              Corre la migración de la Fase 6 para tener plantillas.
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${btnSecondary} px-3 py-2`} onClick={download}>
            <Download className="h-4 w-4" /> PNG
          </button>
          <button className={`${btnSecondary} px-3 py-2`} onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copiado" : "Copiar texto"}
          </button>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold">{post.title || "Publicación"}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
        </div>

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
          <label className={labelCls}>Texto de la publicación</label>
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
