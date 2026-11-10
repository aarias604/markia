"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Image as ImageIcon, Layers, Loader2, Lock, Sparkles } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { PostCard } from "@/components/posts/PostCard";
import { PaletteSelect } from "@/components/brand/PaletteSelect";
import type { BrandColors } from "@/lib/templates";
import { TIPOS_POST } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";
import { btnGold, cardCls, errorCls, inputCls, labelCls } from "@/lib/ui";

type Formato = "single" | "carousel";

export default function GeneradorPage() {
  const { subscription, canGenerate, remainingPosts, monthlyPosts, templates, refresh } = useDashboard();
  const [formato, setFormato] = useState<Formato>("single");
  const [idea, setIdea] = useState("");
  const [tipo, setTipo] = useState<string>(TIPOS_POST[0].id);
  const [cantidad, setCantidad] = useState(1);
  const [laminas, setLaminas] = useState(6);
  const [templateId, setTemplateId] = useState("auto");
  const [paletteId, setPaletteId] = useState("kit");
  const [palette, setPalette] = useState<BrandColors | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Post[]>([]);
  const [carousels, setCarousels] = useState<{ limit: number; used: number } | null>(null);

  const loadCarousels = useCallback(async () => {
    const { data } = await createClient().rpc("get_my_carousel_quota").maybeSingle();
    const q = data as { limit_count: number; used_count: number } | null;
    setCarousels(q ? { limit: q.limit_count, used: q.used_count } : { limit: 0, used: 0 });
  }, []);

  useEffect(() => {
    void loadCarousels();
  }, [loadCarousels]);

  const maxCantidad = Math.max(1, Math.min(5, remainingPosts));
  const carouselsLeft = carousels ? Math.max(carousels.limit - carousels.used, 0) : 0;
  const noQuota = formato === "single" ? remainingPosts === 0 : carouselsLeft === 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formato,
          idea,
          tipo,
          cantidad: Math.min(cantidad, maxCantidad),
          laminas,
          templateId: templateId === "auto" ? null : templateId,
          palette: paletteId === "kit" ? null : palette,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { posts?: Post[]; error?: string };
      if (!res.ok || !json.posts) throw new Error(json.error ?? "No se pudo generar.");
      setResults((prev) => [...(json.posts ?? []), ...prev]);
      setIdea("");
      await Promise.all([refresh(), loadCarousels()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar.");
    } finally {
      setLoading(false);
    }
  }

  if (!subscription) {
    return <Blocked title="Necesitas un plan activo" text="Elige el Plan Básico o PRO para generar publicaciones con IA." />;
  }
  if (!canGenerate) {
    return <Blocked title="Tu cuenta está suspendida" text="Reactiva tu cuenta con el descuento especial para seguir generando." />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Generador con IA</h1>
        <p className="mt-1 text-[#4A154B]/70">
          Este ciclo te quedan <strong>{remainingPosts}</strong> de {monthlyPosts} publicaciones y{" "}
          <strong>{carouselsLeft}</strong> de {carousels?.limit ?? 0} carrusel(es).
        </p>
      </div>

      <form onSubmit={onSubmit} className={`${cardCls} space-y-5`}>
        <div className="grid max-w-md grid-cols-2 gap-1 rounded-full bg-[#4A154B]/5 p-1 text-sm font-semibold">
          {([
            ["single", "Publicación", ImageIcon],
            ["carousel", "Carrusel", Layers],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setFormato(id)}
              className={`inline-flex items-center justify-center gap-2 rounded-full py-2 transition ${formato === id ? "bg-white shadow" : "text-[#4A154B]/60"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="idea" className={labelCls}>
            {formato === "carousel" ? "¿Sobre qué tema es el carrusel? (opcional)" : "¿Sobre qué quieres publicar? (opcional)"}
          </label>
          <textarea id="idea" className={`${inputCls} min-h-24`} value={idea} maxLength={600}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={formato === "carousel"
              ? "Ej. 5 razones para elegir nuestras hamburguesas artesanales."
              : "Ej. Lanzamos una hamburguesa doble con tocino este viernes. O déjalo vacío y la IA te propone temas."} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="tipo" className={labelCls}>Tipo de contenido</label>
            <select id="tipo" className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_POST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          {formato === "single" ? (
            <div>
              <label htmlFor="cant" className={labelCls}>Cantidad</label>
              <select id="cant" className={inputCls} value={Math.min(cantidad, maxCantidad)}
                onChange={(e) => setCantidad(Number(e.target.value))} disabled={remainingPosts === 0}>
                {Array.from({ length: maxCantidad }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? "publicación" : "publicaciones"}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="lam" className={labelCls}>Número de láminas</label>
              <select id="lam" className={inputCls} value={laminas} onChange={(e) => setLaminas(Number(e.target.value))}>
                {[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} láminas</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="tpl" className={labelCls}>Plantilla ({templates.length} disponibles)</label>
            <select id="tpl" className={inputCls} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="auto">Variar automáticamente</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.kind === "custom" ? " (propia)" : ""}</option>
              ))}
            </select>
          </div>
        </div>

        <PaletteSelect value={paletteId} onChange={(id, c) => { setPaletteId(id); setPalette(c); }} />

        {error && <p className={errorCls}>{error}</p>}

        {noQuota ? (
          <p className="text-sm text-[#4A154B]/70">
            {formato === "single"
              ? "Usaste todas tus publicaciones de este ciclo. Puedes comprar un Boost de 5, 10 o 20 en la Tienda."
              : "Usaste tus carruseles de este ciclo. Se renuevan con tu próximo ciclo."}
          </p>
        ) : (
          <button type="submit" className={btnGold} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Creando… (hasta 1 minuto)" : formato === "carousel" ? "Generar carrusel" : "Generar"}
          </button>
        )}
      </form>

      {results.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recién generadas</h2>
            <Link href="/dashboard/calendario" className="text-sm font-semibold text-[#6B21A8] hover:underline">
              Ver en el calendario →
            </Link>
          </div>
          {results.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onUpdated={(u) => setResults((rs) => rs.map((r) => (r.id === u.id ? u : r)))}
              onDeleted={(id) => setResults((rs) => rs.filter((r) => r.id !== id))}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function Blocked({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#D9B382]/50 bg-[#FDFBF7] p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-[#8C338A]" />
      <h1 className="mt-3 text-xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-[#4A154B]/70">{text}</p>
      <Link href="/dashboard/planes" className={`${btnGold} mt-5`}>Ver planes</Link>
    </div>
  );
}
