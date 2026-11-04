"use client";

// Subir publicaciones propias: imágenes del usuario + descripción + destino + fecha.
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, Send, Trash2, Upload } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { PostCard } from "@/components/posts/PostCard";
import { fileToJpeg, uploadPostMedia, type Placement } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";
import { btnGold, btnSecondary, cardCls, errorCls, inputCls, labelCls } from "@/lib/ui";

const MAX_FILES = 10;
const MAX_MB = 15;

export default function SubirPage() {
  const { userId, canGenerate, planHasAutopost, canAutopost, instagram } = useDashboard();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [placement, setPlacement] = useState<Placement>("feed");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [when, setWhen] = useState("");
  const [auto, setAuto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Post[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function addFiles(list: FileList | null) {
    setError(null);
    if (!list) return;
    const incoming = Array.from(list).filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (incoming.length < list.length) setError("Solo se aceptan imágenes JPG, PNG o WEBP.");
    const tooBig = incoming.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) return setError(`«${tooBig.name}» pesa más de ${MAX_MB} MB.`);
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) return setError("Agrega al menos una imagen.");
    if (auto && !when) return setError("Elige la fecha y hora para publicar automáticamente.");
    if (auto && new Date(when).getTime() < Date.now() - 60000) return setError("Elige una fecha y hora futuras.");
    setLoading(true);
    try {
      const supabase = createClient();
      const tags = hashtags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
        .slice(0, 30);

      // 1. Crear la publicación
      const { data: post, error: insErr } = await supabase
        .from("posts")
        .insert({
          user_id: userId,
          source: "upload",
          title: title.trim() || null,
          caption: caption.trim(),
          hashtags: tags,
          placement,
          format: files.length > 1 && placement === "feed" ? "carousel" : "single",
          scheduled_at: when ? new Date(when).toISOString() : null,
          status: when ? "scheduled" : "draft",
          auto_publish: false, // se activa después de subir las imágenes
        })
        .select("*")
        .single();
      if (insErr || !post) throw new Error(insErr?.message ?? "No se pudo crear la publicación.");

      // 2. Convertir a JPEG y subir las imágenes
      const blobs = [];
      for (const f of files) blobs.push(await fileToJpeg(f, placement));
      const media_paths = await uploadPostMedia(blobs, userId, post.id);
      const { data: updated, error: upErr } = await supabase.from("posts").update({ media_paths, auto_publish: auto && !!when }).eq("id", post.id).select("*").single();
      if (upErr) throw new Error(upErr.message);

      setCreated((c) => [updated as Post, ...c]);
      setFiles([]);
      setTitle("");
      setCaption("");
      setHashtags("");
      setWhen("");
      setAuto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir.");
    } finally {
      setLoading(false);
    }
  }

  if (!canGenerate) {
    return <p className={errorCls}>Tu cuenta no está activa. Revisa tu plan para programar publicaciones.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Upload className="h-6 w-6 text-[#8C338A]" /> Subir publicación</h1>
        <p className="mt-1 text-[#4A154B]/70">Sube tus propias fotos o diseños, escribe la descripción y programa el día de publicación.</p>
      </div>

      <form onSubmit={submit} className={`${cardCls} space-y-5`}>
        <div className="grid max-w-sm grid-cols-2 gap-1 rounded-full bg-[#4A154B]/5 p-1 text-sm font-semibold">
          {(["feed", "story"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPlacement(p)}
              className={`rounded-full py-2 ${placement === p ? "bg-[#4A154B] text-[#FAF5EF]" : "text-[#4A154B]/60"}`}>
              {p === "feed" ? "Publicación nueva" : "Historia"}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#4A154B]/60">
          {placement === "feed"
            ? "1 imagen = publicación; 2 a 10 imágenes = carrusel. Las fotos muy altas o muy anchas se recortan al centro (Instagram acepta de 4:5 a 1.91:1)."
            : "Cada imagen será una historia. Lo ideal es vertical (9:16). Las historias no muestran descripción ni hashtags."}
        </p>

        <div>
          <label className={labelCls}>Imágenes ({files.length}/{MAX_FILES})</label>
          <div className="flex flex-wrap gap-3">
            {previews.map((u, i) => (
              <div key={u} className="relative h-28 w-28 overflow-hidden rounded-xl bg-white shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                <button type="button" aria-label="Quitar" onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-700">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#4A154B]/25 bg-white text-xs text-[#4A154B]/60 hover:border-[#4A154B]/50">
                <ImagePlus className="h-6 w-6" /> Agregar
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>Título interno (opcional)</label><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ej. Promo del viernes" /></div>
          <div>
            <label className={labelCls}>Fecha y hora de publicación</label>
            <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
        </div>

        {placement === "feed" && (
          <>
            <div>
              <label className={labelCls}>Descripción</label>
              <textarea className={`${inputCls} min-h-28`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2000} />
            </div>
            <div>
              <label className={labelCls}>Hashtags (separados por espacio)</label>
              <input className={inputCls} value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#panama #emprendedores" />
            </div>
          </>
        )}

        {planHasAutopost ? (
          canAutopost ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#4A154B]" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              <Send className="h-4 w-4" /> Publicar automáticamente en <strong>@{instagram?.username}</strong>
            </label>
          ) : (
            <p className="text-sm"><Link href="/dashboard/instagram" className="font-semibold text-[#6B21A8] underline">Conecta tu Instagram</Link> para publicar automáticamente.</p>
          )
        ) : (
          <p className="text-xs text-[#4A154B]/60">📧 Si eliges fecha y hora, te enviaremos un correo de recordatorio en ese momento para que la publiques en Instagram.</p>
        )}

        {error && <p className={errorCls}>{error}</p>}
        <div className="flex gap-2">
          <button className={btnGold} disabled={loading || files.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "Subiendo…" : when ? "Subir y programar" : "Guardar como borrador"}
          </button>
          <Link href="/dashboard/calendario" className={btnSecondary}>Ver calendario</Link>
        </div>
      </form>

      {created.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Recién subidas</h2>
          {created.map((p) => (
            <PostCard key={p.id} post={p}
              onUpdated={(u) => setCreated((c) => c.map((x) => (x.id === u.id ? u : x)))}
              onDeleted={(id) => setCreated((c) => c.filter((x) => x.id !== id))} />
          ))}
        </section>
      )}
    </div>
  );
}
