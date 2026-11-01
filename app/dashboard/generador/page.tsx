"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { PostCard } from "@/components/posts/PostCard";
import { TIPOS_POST } from "@/lib/posts";
import type { Post } from "@/lib/types";
import { btnGold, cardCls, errorCls, inputCls, labelCls } from "@/lib/ui";

export default function GeneradorPage() {
  const { subscription, canGenerate, remainingPosts, monthlyPosts, templates, refresh } = useDashboard();
  const [idea, setIdea] = useState("");
  const [tipo, setTipo] = useState<string>(TIPOS_POST[0].id);
  const [cantidad, setCantidad] = useState(1);
  const [templateId, setTemplateId] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Post[]>([]);

  const maxCantidad = Math.max(1, Math.min(5, remainingPosts));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          tipo,
          cantidad: Math.min(cantidad, maxCantidad),
          templateId: templateId === "auto" ? null : templateId,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { posts?: Post[]; error?: string };
      if (!res.ok || !json.posts) throw new Error(json.error ?? "No se pudo generar.");
      setResults((prev) => [...(json.posts ?? []), ...prev]);
      setIdea("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar.");
    } finally {
      setLoading(false);
    }
  }

  if (!subscription) {
    return (
      <Blocked title="Necesitas un plan activo" text="Elige el Plan Básico o PRO para generar publicaciones con IA." />
    );
  }
  if (!canGenerate) {
    return <Blocked title="Tu cuenta está suspendida" text="Reactiva tu cuenta con el descuento especial para seguir generando." />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Generador con IA</h1>
        <p className="mt-1 text-[#4A154B]/70">
          Te quedan <strong>{remainingPosts}</strong> de {monthlyPosts} publicaciones en este ciclo.
        </p>
      </div>

      <form onSubmit={onSubmit} className={`${cardCls} space-y-5`}>
        <div>
          <label htmlFor="idea" className={labelCls}>¿Sobre qué quieres publicar? (opcional)</label>
          <textarea id="idea" className={`${inputCls} min-h-24`} value={idea} maxLength={600}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Ej. Lanzamos una hamburguesa doble con tocino este viernes. O déjalo vacío y la IA te propone temas." />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="tipo" className={labelCls}>Tipo de contenido</label>
            <select id="tipo" className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_POST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cant" className={labelCls}>Cantidad</label>
            <select id="cant" className={inputCls} value={Math.min(cantidad, maxCantidad)}
              onChange={(e) => setCantidad(Number(e.target.value))} disabled={remainingPosts === 0}>
              {Array.from({ length: maxCantidad }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? "publicación" : "publicaciones"}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tpl" className={labelCls}>Plantilla</label>
            <select id="tpl" className={inputCls} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="auto">Variar automáticamente</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.kind === "custom" ? " (propia)" : ""}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className={errorCls}>{error}</p>}

        {remainingPosts === 0 ? (
          <p className="text-sm text-[#4A154B]/70">
            Usaste todas tus publicaciones de este ciclo. Se renuevan con tu próximo ciclo
            {subscription.cycle_resets_on ? ` (${new Date(`${subscription.cycle_resets_on}T12:00:00`).toLocaleDateString("es-PA", { day: "numeric", month: "long" })})` : ""}.
          </p>
        ) : (
          <button type="submit" className={btnGold} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Escribiendo tus publicaciones… (hasta 1 minuto)" : "Generar"}
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
