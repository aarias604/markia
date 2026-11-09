"use client";

// Publicación de un video de Markia: se programa como Reel (Instagram) y video (Página de Facebook).
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Clapperboard, Download, ExternalLink, Loader2, Send, Trash2 } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { downloadUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";
import { btnPrimary, btnSecondary, errorCls, inputCls, labelCls } from "@/lib/ui";

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const STATUS: Record<string, string> = {
  draft: "Borrador", scheduled: "Programado", publishing: "Publicando…", published: "Publicado", failed: "No se publicó",
};

export function VideoPostCard({ post, onUpdated, onDeleted }: { post: Post; onUpdated?: (p: Post) => void; onDeleted?: (id: string) => void }) {
  const { planHasAutopost, canAutopost, instagram } = useDashboard();
  const [url, setUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState(post.caption ?? "");
  const [hashtags, setHashtags] = useState((post.hashtags ?? []).join(" "));
  const [when, setWhen] = useState(toLocalInput(post.scheduled_at));
  const [auto, setAuto] = useState(!!post.auto_publish && canAutopost);
  const fbPage = instagram?.fb_page_name ?? null;
  const [alsoFb, setAlsoFb] = useState(post.also_facebook ?? !!fbPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!post.video_path) return;
    createClient().storage.from("videos").createSignedUrl(post.video_path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [post.video_path]);

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

  async function schedule() {
    if (!when) return setError("Elige la fecha y la hora.");
    const at = new Date(when);
    if (auto && at.getTime() < Date.now() - 60000) return setError("Para publicar automáticamente, elige una fecha y hora futuras.");
    const tags = hashtags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`)).slice(0, 30);
    await save({
      caption: caption.trim(), hashtags: tags, scheduled_at: at.toISOString(), status: "scheduled", placement: "feed",
      auto_publish: auto, also_facebook: auto && alsoFb && !!fbPage, publish_attempts: 0, error_message: null,
    } as Partial<Post>);
  }

  async function remove() {
    setBusy(true);
    const { error } = await createClient().from("posts").delete().eq("id", post.id);
    setBusy(false);
    if (error) return setError(error.message);
    onDeleted?.(post.id);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row">
      <div className="w-full shrink-0 sm:w-48">
        {url ? (
          <video src={url} controls playsInline className="aspect-[9/16] w-full rounded-xl bg-black" />
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl bg-[#4A154B]/5"><Clapperboard className="h-8 w-8 text-[#4A154B]/40" /></div>
        )}
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#4A154B] px-2.5 py-0.5 text-xs font-bold text-[#FAF5EF]">Reel</span>
          <p className="font-semibold">{post.title || "Video"}</p>
          <span className="ml-auto rounded-full bg-[#D9B382]/40 px-2 py-0.5 text-xs font-bold">{STATUS[post.status] ?? post.status}</span>
        </div>
        <div>
          <label className={labelCls}>Descripción</label>
          <textarea className={`${inputCls} min-h-24`} value={caption} maxLength={2000} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Hashtags</label>
          <input className={inputCls} value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelCls}>Fecha y hora</label>
            <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <button className={btnPrimary} onClick={schedule} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Programar
          </button>
          {url && (
            <button className={btnSecondary} onClick={() => void downloadUrl(url, "markia-video.mp4")}><Download className="h-4 w-4" /> Descargar</button>
          )}
        </div>

        {planHasAutopost && canAutopost ? (
          <div className="space-y-1">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4A154B]" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              <span><Send className="mr-1 inline h-3.5 w-3.5" /> Publicar automáticamente como Reel en <strong>@{instagram?.username}</strong></span>
            </label>
            {auto && fbPage && (
              <label className="flex items-start gap-2 pl-6 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4A154B]" checked={alsoFb} onChange={(e) => setAlsoFb(e.target.checked)} />
                <span>También en la Página de Facebook <strong>{fbPage}</strong></span>
              </label>
            )}
          </div>
        ) : planHasAutopost ? (
          <p className="text-xs"><Link href="/dashboard/instagram" className="font-semibold text-[#6B21A8] underline">Conecta tu Instagram</Link> para publicar automáticamente.</p>
        ) : (
          <p className="text-xs text-[#4A154B]/60">📧 A esa hora te enviaremos un recordatorio. Descarga el video y súbelo como Reel en Instagram.</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {post.ig_permalink && <a href={post.ig_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#6B21A8] underline"><ExternalLink className="h-3.5 w-3.5" /> Ver en Instagram</a>}
          {post.fb_permalink && <a href={post.fb_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#1877F2] underline"><ExternalLink className="h-3.5 w-3.5" /> Ver en Facebook</a>}
          {post.status !== "published" ? (
            <button className="font-medium text-emerald-700 hover:underline" disabled={busy} onClick={() => void save({ status: "published" })}>Marcar como publicado</button>
          ) : null}
          <span className="ml-auto" />
          {confirmDelete ? (
            <button className="font-medium text-red-700" onClick={remove} disabled={busy}>¿Quitar del calendario? Sí</button>
          ) : (
            <button className="text-red-700" onClick={() => setConfirmDelete(true)} title="Quitar del calendario (el video no se borra)"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
        {post.status === "failed" && post.error_message && <p className={errorCls}>No se publicó: {post.error_message}</p>}
        {post.fb_error && <p className="text-xs text-amber-800">Facebook: {post.fb_error}</p>}
        {error && <p className={errorCls}>{error}</p>}
      </div>
    </div>
  );
}
