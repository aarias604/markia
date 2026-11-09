"use client";

// Videos explicativos animados (1 a 2 minutos) con voz, efectos y la paleta de la marca.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowDown, ArrowUp, CalendarClock, Clapperboard, Copy, Download, Eye, Loader2, Plus, RefreshCw, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { PaletteSelect } from "@/components/brand/PaletteSelect";
import { VideoPostCard } from "@/components/posts/VideoPostCard";
import type { Post } from "@/lib/types";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { DEFAULT_KIT } from "@/lib/brand";
import { ICON_NAMES } from "@/lib/icons";
import { asColors, pickColors } from "@/lib/palettes";
import { createClient } from "@/lib/supabase/client";
import type { BrandColors } from "@/lib/templates";
import { btnGold, btnSecondary, cardCls, errorCls, inputCls, labelCls, successCls } from "@/lib/ui";
import { DURATIONS, LAYOUTS, STYLES, VIDEO_H, VIDEO_W, type Scene, type SceneLayout, type VideoStyle } from "@/lib/video";
import { FPS, estimateTimings } from "@/lib/video-timing";
import { MarkiaVideo } from "@/remotion/MarkiaVideo";
import type { VideoProps } from "@/remotion/types";

interface Video {
  id: string;
  status: "draft" | "rendering" | "ready" | "failed";
  mode: "idea" | "narration";
  title: string | null;
  caption: string | null;
  hashtags: string[];
  voice: "female" | "male";
  palette: BrandColors | null;
  scenes: Scene[];
  style?: VideoStyle;
  ai_images?: boolean;
  duration_s: number | null;
  error: string | null;
  created_at: string;
}

const STATUS: Record<Video["status"], string> = {
  draft: "Borrador",
  rendering: "Creándose…",
  ready: "Listo",
  failed: "Falló",
};

const secondsFor = (scenes: Scene[]) => Math.round(scenes.reduce((n, s) => n + s.narracion.split(/\s+/).filter(Boolean).length, 0) / 2.5);

export default function VideosPage() {
  const { kit, userId, businessName, logoDataUrl, canGenerate } = useDashboard();
  const [quota, setQuota] = useState<{ limit: number; used: number; extra: number } | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [urls, setUrls] = useState<Record<string, { view: string; download: string }>>({});

  // Formulario
  const [mode, setMode] = useState<"idea" | "narration">("idea");
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(90);
  const [voice, setVoice] = useState<"female" | "male">("female");
  const [paletteId, setPaletteId] = useState("kit");
  const [colors, setColors] = useState<BrandColors>(pickColors(kit ?? DEFAULT_KIT));
  const [subtitles, setSubtitles] = useState(true);
  const [style, setStyle] = useState<VideoStyle>("pop");
  const [aiImages, setAiImages] = useState(false);

  // Editor
  const [editing, setEditing] = useState<Video | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [handle, setHandle] = useState("");
  const [scheduling, setScheduling] = useState<Post | null>(null);
  const playerRef = useRef<PlayerRef>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [{ data: q }, { data: list }] = await Promise.all([
      sb.rpc("get_my_video_quota").maybeSingle(),
      sb.from("videos").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    const qq = q as { limit_count: number; used_count: number; extra_balance: number } | null;
    setQuota(qq ? { limit: qq.limit_count, used: qq.used_count, extra: qq.extra_balance } : { limit: 0, used: 0, extra: 0 });
    setVideos((list ?? []) as Video[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Estado de los videos que se están creando y enlaces de los listos.
  const check = useCallback(async (id: string) => {
    const res = await fetch(`/api/video/estado?id=${id}`);
    const json = (await res.json().catch(() => ({}))) as { status?: Video["status"]; url?: string | null };
    if (json.url) {
      const u = json.url;
      setUrls((m) => ({ ...m, [id]: { view: u, download: `${u}${u.includes("?") ? "&" : "?"}download=markia-video.mp4` } }));
    }
    if (json.status) setVideos((vs) => vs?.map((v) => (v.id === id ? { ...v, status: json.status! } : v)) ?? vs);
    return json.status;
  }, []);

  useEffect(() => {
    if (!videos) return;
    videos.filter((v) => v.status === "ready" && !urls[v.id]).forEach((v) => void check(v.id));
    const rendering = videos.filter((v) => v.status === "rendering");
    if (!rendering.length) return;
    const t = setInterval(() => rendering.forEach((v) => void check(v.id)), 8000);
    return () => clearInterval(t);
  }, [videos, urls, check]);

  const left = quota ? Math.max(quota.limit - quota.used, 0) + quota.extra : 0;

  async function createScript() {
    setBusy("guion");
    setMsg(null);
    try {
      const res = await fetch("/api/video/guion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text, seconds, voice, palette: paletteId === "kit" ? null : colors, style, aiImages }),
      });
      const json = (await res.json().catch(() => ({}))) as { video?: Video; error?: string };
      if (!res.ok || !json.video) throw new Error(json.error ?? "No se pudo crear el guion.");
      setEditing(json.video);
      setText("");
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo crear el guion." });
    } finally {
      setBusy(null);
    }
  }

  function edit(v: Video) {
    setEditing(v);
    setVoice(v.voice);
    setStyle(v.style ?? "pop");
    setAiImages(!!v.ai_images);
    const c = asColors(v.palette);
    if (c) {
      setColors(c);
      setPaletteId("custom");
    } else {
      setColors(pickColors(kit ?? DEFAULT_KIT));
      setPaletteId("kit");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const setScene = (i: number, patch: Partial<Scene>) =>
    setEditing((v) => (v ? { ...v, scenes: v.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : v));
  const moveScene = (i: number, d: -1 | 1) =>
    setEditing((v) => {
      if (!v) return v;
      const s = [...v.scenes];
      const j = i + d;
      if (j < 0 || j >= s.length) return v;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...v, scenes: s };
    });

  async function render() {
    if (!editing) return;
    setBusy("render");
    setMsg(null);
    try {
      const scenes = editing.scenes;
      setProgress("Creando la voz y enviando a producción…");
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: editing.id, scenes, voice, palette: paletteId === "kit" ? null : colors, subtitles, handle, style, aiImages }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear el video.");
      setEditing(null);
      setMsg({ ok: true, text: "¡Listo! Tu video se está creando. Tarda de 4 a 8 minutos; puedes salir de esta página y te avisamos aquí." });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo crear el video." });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  /** Crea la publicación del video para programarla (Reel en Instagram y video en Facebook). */
  async function scheduleVideo(v: Video) {
    setBusy(`s-${v.id}`);
    setMsg(null);
    const sb = createClient();
    const { data: existing } = await sb.from("posts").select("*").eq("video_id", v.id).neq("status", "published").maybeSingle();
    const { data, error } = existing
      ? { data: existing, error: null }
      : await sb
          .from("posts")
          .insert({
            user_id: userId, source: "video", video_id: v.id, video_path: `${userId}/${v.id}/video.mp4`,
            title: v.title, caption: v.caption ?? "", hashtags: v.hashtags ?? [], placement: "feed", format: "single", status: "draft",
          })
          .select("*")
          .single();
    setBusy(null);
    if (error || !data) return setMsg({ ok: false, text: error?.message ?? "No se pudo preparar la publicación." });
    setScheduling(data as Post);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(v: Video) {
    setBusy(v.id);
    const sb = createClient();
    const { data: files } = await sb.storage.from("videos").list(`${userId}/${v.id}`, { limit: 200 });
    if (files?.length) await sb.storage.from("videos").remove(files.map((f) => `${userId}/${v.id}/${f.name}`));
    await sb.from("videos").delete().eq("id", v.id);
    setBusy(null);
    if (editing?.id === v.id) setEditing(null);
    await load();
  }

  const preview = useMemo<VideoProps | null>(() => {
    if (!editing) return null;
    const scenes = editing.scenes.filter((x) => x.narracion.trim());
    if (!scenes.length) return null;
    const t = estimateTimings(scenes);
    return {
      scenes, style, colors, brandName: businessName, handle: handle || defaultHandleFor(businessName), logoUrl: logoDataUrl,
      voiceUrl: null, words: t.words, timings: t.timings, total: t.total, musicUrl: null, sfx: null, subtitles,
    };
  }, [editing, colors, businessName, handle, logoDataUrl, subtitles, style]);

  function seekScene(i: number) {
    if (!preview) return;
    const tm = preview.timings[i];
    if (tm) {
      playerRef.current?.seekTo(Math.round(tm.start * FPS));
      playerRef.current?.play();
    }
  }

  if (!canGenerate) {
    return <p className={errorCls}>Tu cuenta no está activa. Revisa tu plan para crear videos.</p>;
  }

    const defaultHandle = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30) || "mimarca";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Clapperboard className="h-6 w-6 text-[#8C338A]" /> Videos explicativos</h1>
        <p className="mt-1 text-[#4A154B]/70">
          Videos animados de 1 a 2 minutos para Reels, con voz, efectos de sonido, subtítulos y tus colores.{" "}
          {quota && (
            <>Te quedan <strong>{left}</strong> video(s): {Math.max(quota.limit - quota.used, 0)} de tu plan este ciclo{quota.extra ? ` + ${quota.extra} extra` : ""}.</>
          )}
        </p>
      </div>

      {msg && <p className={msg.ok ? successCls : errorCls}>{msg.text}</p>}

      {scheduling && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Programar publicación</h2>
            <span className="flex gap-2">
              <Link href="/dashboard/calendario" className={btnSecondary}>Ver calendario</Link>
              <button className={btnSecondary} onClick={() => setScheduling(null)}>Cerrar</button>
            </span>
          </div>
          <VideoPostCard post={scheduling} onUpdated={(p) => { setScheduling(p); if (p.status === "scheduled") setMsg({ ok: true, text: "Video programado. Lo verás en tu calendario." }); }}
            onDeleted={() => setScheduling(null)} />
        </div>
      )}

      {/* Paso 1: idea o narración */}
      {!editing && (
        <div className={`${cardCls} space-y-5`}>
          <div className="grid max-w-md grid-cols-2 gap-1 rounded-full bg-[#4A154B]/5 p-1 text-sm font-semibold">
            {([["idea", "La IA escribe el guion", Wand2], ["narration", "Tengo mi narración", Sparkles]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setMode(id)}
                className={`inline-flex items-center justify-center gap-2 rounded-full py-2 ${mode === id ? "bg-white shadow" : "text-[#4A154B]/60"}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div>
            <label className={labelCls}>{mode === "idea" ? "Idea base del video" : "Tu narración (la voz dirá exactamente esto)"}</label>
            <textarea className={`${inputCls} ${mode === "idea" ? "min-h-24" : "min-h-56"}`} value={text}
              maxLength={mode === "idea" ? 800 : 3200} onChange={(e) => setText(e.target.value)}
              placeholder={mode === "idea"
                ? "Ej. Explica 3 errores comunes al elegir un seguro de auto y cómo evitarlos."
                : "Pega aquí el texto completo que quieres que diga la voz. Unas 150 palabras ≈ 1 minuto."} />
            {mode === "narration" && (
              <p className="mt-1 text-xs text-[#4A154B]/60">≈ {Math.round(text.split(/\s+/).filter(Boolean).length / 2.5)} segundos. La IA la divide en escenas y diseña lo visual.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-6">
            {mode === "idea" && (
              <div>
                <label className={labelCls}>Duración</label>
                <select className={inputCls} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                  {DURATIONS.map((d) => <option key={d.seconds} value={d.seconds}>{d.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Voz</label>
              <select className={inputCls} value={voice} onChange={(e) => setVoice(e.target.value as "female" | "male")}>
                <option value="female">Mujer</option>
                <option value="male">Hombre</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#4A154B]" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} />
              Subtítulos
            </label>
          </div>
          <PaletteSelect value={paletteId} onChange={(id, c) => { setPaletteId(id); setColors(c); }} />
          <div>
            <label className={labelCls}>Estilo de animación</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STYLES.map((st) => (
                <button key={st.id} type="button" onClick={() => setStyle(st.id)}
                  className={`rounded-xl border p-3 text-left transition ${style === st.id ? "border-[#4A154B] bg-white shadow" : "border-[#4A154B]/15 bg-white/60 hover:border-[#4A154B]/40"}`}>
                  <span className="block text-sm font-bold">{st.label}</span>
                  <span className="block text-xs text-[#4A154B]/60">{st.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4A154B]" checked={aiImages} onChange={(e) => setAiImages(e.target.checked)} />
            <span>
              <strong>Imágenes con IA</strong> según lo que dice la voz, con tus colores.
              <span className="block text-xs text-[#4A154B]/60">Si no lo marcas, cada escena se ilustra con íconos animados. La vista previa siempre muestra los íconos.</span>
            </span>
          </label>
          {left > 0 ? (
            <button className={btnGold} onClick={createScript} disabled={busy === "guion" || text.trim().length < 5}>
              {busy === "guion" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {busy === "guion" ? "Escribiendo el guion… (hasta 1 minuto)" : "Crear guion y escenas"}
            </button>
          ) : (
            <p className="text-sm">
              Usaste tus videos de este ciclo.{" "}
              <Link href="/dashboard/tienda" className="font-semibold text-[#6B21A8] underline">Compra un paquete de 3 videos</Link>.
            </p>
          )}
          <p className="text-xs text-[#4A154B]/60">Crear el guion no descuenta tu cupo: solo se descuenta al generar el video.</p>
        </div>
      )}

      {/* Paso 2: revisar escenas */}
      {editing && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{editing.title ?? "Tu video"}</h2>
              <p className="text-sm text-[#4A154B]/70">{editing.scenes.length} escenas · ≈ {secondsFor(editing.scenes)} segundos. Revisa y ajusta los textos.</p>
            </div>
            <button className={btnSecondary} onClick={() => setEditing(null)}>Cerrar</button>
          </div>
          <div className={`${cardCls} space-y-4`}>
            <PaletteSelect value={paletteId} onChange={(id, c) => { setPaletteId(id); setColors(c); }} />
          <div>
            <label className={labelCls}>Estilo de animación</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STYLES.map((st) => (
                <button key={st.id} type="button" onClick={() => setStyle(st.id)}
                  className={`rounded-xl border p-3 text-left transition ${style === st.id ? "border-[#4A154B] bg-white shadow" : "border-[#4A154B]/15 bg-white/60 hover:border-[#4A154B]/40"}`}>
                  <span className="block text-sm font-bold">{st.label}</span>
                  <span className="block text-xs text-[#4A154B]/60">{st.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4A154B]" checked={aiImages} onChange={(e) => setAiImages(e.target.checked)} />
            <span>
              <strong>Imágenes con IA</strong> según lo que dice la voz, con tus colores.
              <span className="block text-xs text-[#4A154B]/60">Si no lo marcas, cada escena se ilustra con íconos animados. La vista previa siempre muestra los íconos.</span>
            </span>
          </label>
            <div className="flex flex-wrap gap-6">
              <div>
                <label className={labelCls}>Voz</label>
                <select className={inputCls} value={voice} onChange={(e) => setVoice(e.target.value as "female" | "male")}>
                  <option value="female">Mujer</option>
                  <option value="male">Hombre</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Tu usuario de Instagram</label>
                <input className={inputCls} value={handle} placeholder={defaultHandle} maxLength={30}
                  onChange={(e) => setHandle(e.target.value.replace(/[^A-Za-z0-9._]/g, ""))} />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[#4A154B]" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} />
                Subtítulos
              </label>
            </div>
          </div>

          {preview && (
            <div className={`${cardCls} flex flex-col items-center gap-2`}>
              <p className="text-sm font-semibold">Vista previa animada (sin voz; los tiempos son aproximados)</p>
              <div className="w-full max-w-[320px] overflow-hidden rounded-2xl shadow">
                <Player ref={playerRef} component={MarkiaVideo} inputProps={preview}
                  durationInFrames={Math.max(Math.ceil(preview.total * FPS), FPS)} fps={FPS}
                  compositionWidth={VIDEO_W} compositionHeight={VIDEO_H}
                  style={{ width: "100%", aspectRatio: "9 / 16" }} controls loop />
              </div>
            </div>
          )}

          {editing.scenes.map((s, i) => (
            <div key={i} className={`${cardCls} flex flex-col gap-4 sm:flex-row`}>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#4A154B] px-2.5 py-0.5 text-xs font-bold text-[#FAF5EF]">Escena {i + 1}</span>
                  <button className={btnSecondary} onClick={() => seekScene(i)} title="Ver en la vista previa"><Eye className="h-4 w-4" /></button>
                  <select className={`${inputCls} w-auto py-1.5`} value={s.layout} onChange={(e) => setScene(i, { layout: e.target.value as SceneLayout })}>
                    {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                  <select className={`${inputCls} w-auto py-1.5`} value={s.sfx ?? "whoosh"} onChange={(e) => setScene(i, { sfx: e.target.value as Scene["sfx"] })}>
                    <option value="whoosh">Sonido: swoosh</option>
                    <option value="pop">Sonido: pop</option>
                    <option value="ding">Sonido: ding</option>
                    <option value="none">Sin sonido</option>
                  </select>
                  <span className="ml-auto flex gap-1">
                    <button className={btnSecondary} onClick={() => moveScene(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></button>
                    <button className={btnSecondary} onClick={() => moveScene(i, 1)} disabled={i === editing.scenes.length - 1}><ArrowDown className="h-4 w-4" /></button>
                    <button className={`${btnSecondary} text-red-700`} disabled={editing.scenes.length <= 2}
                      onClick={() => setEditing({ ...editing, scenes: editing.scenes.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                  </span>
                </div>
                <div>
                  <label className={labelCls}>Ilustración (íconos según lo que dice la voz)</label>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3].map((k) => {
                      const list = s.ilustracion?.length ? s.ilustracion : [s.icono];
                      return (
                        <select key={k} className={`${inputCls} w-auto py-1.5`} value={list[k] ?? ""}
                          onChange={(e) => {
                            const next = [...list];
                            next[k] = e.target.value;
                            const clean = next.filter(Boolean);
                            setScene(i, { ilustracion: clean, icono: clean[0] ?? s.icono });
                          }}>
                          <option value="">{k === 0 ? "— principal —" : "— ninguno —"}</option>
                          {ICON_NAMES.map((n) => <option key={n} value={n}>{n.replace(/_/g, " ")}</option>)}
                        </select>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Narración (voz)</label>
                  <textarea className={`${inputCls} min-h-20`} value={s.narracion} maxLength={700} onChange={(e) => setScene(i, { narracion: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Título en pantalla</label>
                    <input className={inputCls} value={s.titulo} maxLength={70} onChange={(e) => setScene(i, { titulo: e.target.value })} />
                  </div>
                  {s.layout === "dato" && (
                    <div>
                      <label className={labelCls}>Dato (número corto)</label>
                      <input className={inputCls} value={s.dato ?? ""} maxLength={10} onChange={(e) => setScene(i, { dato: e.target.value })} />
                    </div>
                  )}
                  {["portada", "icono", "dato", "cierre"].includes(s.layout) && (
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Texto de apoyo (opcional)</label>
                      <input className={inputCls} value={s.texto ?? ""} maxLength={160} onChange={(e) => setScene(i, { texto: e.target.value })} />
                    </div>
                  )}
                  {s.layout === "lista" &&
                    [0, 1, 2].map((k) => (
                      <div key={k}>
                        <label className={labelCls}>Punto {k + 1}{k === 2 ? " (opcional)" : ""}</label>
                        <input className={inputCls} value={s.puntos?.[k] ?? ""} maxLength={60}
                          onChange={(e) => {
                            const p = [...(s.puntos ?? ["", "", ""])];
                            p[k] = e.target.value;
                            setScene(i, { puntos: p.slice(0, 3) });
                          }} />
                      </div>
                    ))}
                  {s.layout === "comparacion" &&
                    (["izquierda", "derecha"] as const).map((side) => (
                      <div key={side} className="space-y-2">
                        <label className={labelCls}>{side === "izquierda" ? "Lado ✗ (antes / mito)" : "Lado ✓ (después / realidad)"}</label>
                        <input className={inputCls} placeholder="Título" value={s[side]?.titulo ?? ""} maxLength={30}
                          onChange={(e) => setScene(i, { [side]: { titulo: e.target.value, texto: s[side]?.texto ?? "" } })} />
                        <input className={inputCls} placeholder="Texto" value={s[side]?.texto ?? ""} maxLength={90}
                          onChange={(e) => setScene(i, { [side]: { titulo: s[side]?.titulo ?? "", texto: e.target.value } })} />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            {editing.scenes.length < 16 && (
              <button className={btnSecondary}
                onClick={() => setEditing({ ...editing, scenes: [...editing.scenes.slice(0, -1), { layout: "icono", narracion: "", titulo: "", icono: "idea", sfx: "whoosh" }, ...editing.scenes.slice(-1)] })}>
                <Plus className="h-4 w-4" /> Agregar escena
              </button>
            )}
            <button className={btnGold} onClick={render} disabled={busy === "render" || left <= 0 || editing.scenes.some((s) => !s.narracion.trim())}>
              {busy === "render" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
              {busy === "render" ? progress ?? "Preparando…" : "Generar video (usa 1 de tu cupo)"}
            </button>
            {editing.scenes.some((s) => !s.narracion.trim()) && <span className="text-xs text-red-700">Todas las escenas necesitan narración.</span>}
          </div>

        </div>
      )}

      {/* Mis videos */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Mis videos</h2>
        {videos === null ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : videos.length === 0 ? (
          <p className="text-sm text-[#4A154B]/60">Aún no tienes videos.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <div key={v.id} className={`${cardCls} space-y-3`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{v.title ?? "Video"}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    v.status === "ready" ? "bg-emerald-100 text-emerald-800" : v.status === "failed" ? "bg-red-100 text-red-800" : "bg-[#D9B382]/40"
                  }`}>{STATUS[v.status]}</span>
                </div>
                {v.status === "ready" && urls[v.id] ? (
                  <video src={urls[v.id].view} controls playsInline className="aspect-[9/16] w-full rounded-xl bg-black" />
                ) : v.status === "rendering" ? (
                  <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-xl bg-[#4A154B]/5 text-sm text-[#4A154B]/70">
                    <Loader2 className="h-6 w-6 animate-spin" /> Creando tu video (4 a 8 min)…
                  </div>
                ) : (
                  <p className="text-sm text-[#4A154B]/70">{v.scenes?.length ?? 0} escenas · ≈ {secondsFor(v.scenes ?? [])} segundos</p>
                )}
                {v.status === "failed" && <p className="text-xs text-red-700">No se pudo crear. No se descontó tu cupo.</p>}
                {v.caption && v.status === "ready" && (
                  <button className={`${btnSecondary} w-full`} onClick={() => navigator.clipboard.writeText(`${v.caption}\n\n${v.hashtags.join(" ")}`)}>
                    <Copy className="h-4 w-4" /> Copiar descripción y hashtags
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  {v.status === "ready" && urls[v.id] && (
                    <a href={urls[v.id].download} className={btnGold}><Download className="h-4 w-4" /> Descargar MP4</a>
                  )}
                  {v.status === "ready" && (
                    <button className={btnSecondary} onClick={() => void scheduleVideo(v)} disabled={busy === `s-${v.id}`}>
                      {busy === `s-${v.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Programar
                    </button>
                  )}
                  {(v.status === "draft" || v.status === "failed") && (
                    <button className={btnSecondary} onClick={() => edit(v)}>
                      {v.status === "failed" ? <><RefreshCw className="h-4 w-4" /> Reintentar</> : "Continuar"}
                    </button>
                  )}
                  {v.status !== "rendering" && (
                    <button className={`${btnSecondary} text-red-700`} onClick={() => remove(v)} disabled={busy === v.id}>
                      {busy === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function defaultHandleFor(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30) || "mimarca";
}
