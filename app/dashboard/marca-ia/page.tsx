"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Download, Loader2, Mail, Palette, Plus, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { InlineLoader } from "@/components/ui/Loader";
import type { BrandBrief, BrandResult } from "@/lib/brand-ai";
import { NICHOS } from "@/lib/brand";
import { downloadSvgString, downloadSvgStringAsPng, slugify } from "@/lib/download";
import { createClient } from "@/lib/supabase/client";
import { btnGold, btnPrimary, btnSecondary, cardCls, errorCls, inputCls, labelCls, successCls } from "@/lib/ui";

interface BrandPackage {
  id: string;
  status: "awaiting_brief" | "generating" | "ready" | "failed";
  brief: BrandBrief | null;
  result: BrandResult | null;
  revisions_left: number;
  emailed_at: string | null;
  created_at: string;
}

const ESTILOS = ["Moderno", "Minimalista", "Clásico y elegante", "Divertido y colorido", "Artesanal", "Juvenil y urbano", "Lujoso"];

export default function MarcaIAPage() {
  const [packages, setPackages] = useState<BrandPackage[] | null>(null);
  const [savedPalettes, setSavedPalettes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { data: pals }] = await Promise.all([
      supabase.from("brand_packages").select("*").order("created_at", { ascending: false }),
      supabase.from("brand_palettes").select("package_id").not("package_id", "is", null),
    ]);
    setPackages((data as BrandPackage[]) ?? []);
    setSavedPalettes(new Set(((pals ?? []) as { package_id: string }[]).map((p) => p.package_id)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (packages === null) return <InlineLoader />;

  const pending = packages.filter((p) => p.status === "awaiting_brief" || p.status === "failed");
  const kits = packages.filter((p) => p.status === "ready" || p.status === "generating");
  // Por defecto: el kit por crear (recién comprado) o el más reciente.
  const current = selected ?? (pending[0] ? "nuevo" : kits[0]?.id ?? "nuevo");
  const shown = kits.find((k) => k.id === current);
  const label = (p: BrandPackage) =>
    `${p.brief?.nombre || "Kit"} · ${new Date(p.created_at).toLocaleDateString("es-PA", { day: "numeric", month: "short" })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Wand2 className="h-6 w-6 text-[#8C338A]" /> Marca con IA</h1>
        <p className="mt-1 text-[#4A154B]/70">
          Logo en 3 versiones, paleta de colores, tipografías y guía de uso, creados por IA y enviados a tu correo.
          Cada kit que creas se guarda aquí y su paleta queda disponible al generar imágenes y videos.
        </p>
      </div>

      {(kits.length > 0 || pending.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {kits.map((k) => (
            <button
              key={k.id}
              onClick={() => setSelected(k.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                current === k.id ? "bg-[#4A154B] text-[#FAF5EF]" : "border border-[#4A154B]/20 bg-white text-[#4A154B] hover:border-[#4A154B]/50"
              }`}
            >
              {k.status === "generating" && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
              {label(k)}
            </button>
          ))}
          <button
            onClick={() => setSelected("nuevo")}
            className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              current === "nuevo" ? "bg-[#D9B382] text-[#4A154B]" : "border border-dashed border-[#4A154B]/40 bg-white text-[#4A154B] hover:border-[#4A154B]"
            }`}
          >
            <Plus className="h-4 w-4" /> Nuevo kit{pending.length > 0 && ` (${pending.length} disponible${pending.length > 1 ? "s" : ""})`}
          </button>
        </div>
      )}

      {current === "nuevo" ? (
        pending[0] ? (
          <BriefForm key={pending[0].id} pkg={pending[0]} onDone={async () => { setSelected(pending[0].id); await load(); }} />
        ) : (
          <div className={`${cardCls} text-center`}>
            <p className="font-semibold">{kits.length ? "¿Quieres otra marca o una variante?" : "Aún no tienes un kit de marca."}</p>
            <p className="mt-1 text-sm text-[#4A154B]/70">
              Compra un kit de Marca con IA en la Tienda y vuelve aquí para crearlo.{" "}
              {kits.length > 0 && "Tus kits anteriores se conservan."}
            </p>
            <Link href="/dashboard/tienda" className={`${btnGold} mt-4`}>{kits.length ? "Comprar otro kit" : "Ir a la Tienda"}</Link>
          </div>
        )
      ) : shown?.status === "generating" ? (
        <div className={`${cardCls} flex items-center gap-3`}>
          <Loader2 className="h-5 w-5 animate-spin" /> Tu marca se está generando… recarga la página en un minuto.
        </div>
      ) : shown?.result ? (
        <ResultView key={shown.id} pkg={shown} paletteSaved={savedPalettes.has(shown.id)} onChange={load} />
      ) : null}
    </div>
  );
}

function BriefForm({ pkg, onDone }: { pkg: BrandPackage; onDone: () => Promise<void> }) {
  const { profile, kit, email } = useDashboard();
  const [brief, setBrief] = useState<BrandBrief>({
    nombre: pkg.brief?.nombre ?? profile?.business_name ?? "",
    eslogan: pkg.brief?.eslogan ?? "",
    nicho: pkg.brief?.nicho ?? kit?.niche ?? "",
    descripcion: pkg.brief?.descripcion ?? "",
    publico: pkg.brief?.publico ?? "",
    estilo: pkg.brief?.estilo ?? ESTILOS[0],
    colores: pkg.brief?.colores ?? "",
    evitar: pkg.brief?.evitar ?? "",
    correo: pkg.brief?.correo ?? email,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof BrandBrief) => (e: { target: { value: string } }) => setBrief({ ...brief, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/marca-ia/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: pkg.id, brief }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(json.error ?? "No se pudo generar.");
    await onDone();
  }

  return (
    <form onSubmit={submit} className={`${cardCls} space-y-4`}>
      <h2 className="text-lg font-bold">Cuéntanos sobre tu negocio</h2>
      {pkg.status === "failed" && <p className={errorCls}>El intento anterior falló. Revisa los datos y vuelve a intentarlo.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={labelCls}>Nombre del negocio *</label><input className={inputCls} value={brief.nombre} onChange={set("nombre")} maxLength={60} /></div>
        <div><label className={labelCls}>Eslogan (opcional)</label><input className={inputCls} value={brief.eslogan} onChange={set("eslogan")} maxLength={80} /></div>
        <div>
          <label className={labelCls}>¿A qué se dedica? *</label>
          <input className={inputCls} list="nichos" value={brief.nicho} onChange={set("nicho")} maxLength={80} />
          <datalist id="nichos">{NICHOS.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
        <div>
          <label className={labelCls}>Estilo *</label>
          <select className={inputCls} value={brief.estilo} onChange={set("estilo")}>
            {ESTILOS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Describe tu negocio *</label>
        <textarea className={`${inputCls} min-h-24`} value={brief.descripcion} onChange={set("descripcion")} maxLength={600}
          placeholder="Qué vendes, qué te hace diferente, cómo quieres que te perciban." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={labelCls}>Público objetivo</label><input className={inputCls} value={brief.publico} onChange={set("publico")} placeholder="Ej. jóvenes de 18 a 35 en Ciudad de Panamá" /></div>
        <div><label className={labelCls}>Colores que te gustan</label><input className={inputCls} value={brief.colores} onChange={set("colores")} placeholder="Ej. rojo y negro, tonos tierra" /></div>
        <div><label className={labelCls}>Qué evitar</label><input className={inputCls} value={brief.evitar} onChange={set("evitar")} placeholder="Ej. nada infantil, sin color rosa" /></div>
        <div><label className={labelCls}>Correo para recibir tu marca *</label><input type="email" className={inputCls} value={brief.correo} onChange={set("correo")} /></div>
      </div>
      {error && <p className={errorCls}>{error}</p>}
      <button className={btnGold} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Diseñando tu marca… (1 a 2 minutos, no cierres esta página)" : "Crear mi marca"}
      </button>
    </form>
  );
}

function ResultView({ pkg, paletteSaved, onChange }: { pkg: BrandPackage; paletteSaved: boolean; onChange: () => Promise<void> }) {
  const { userId, refresh } = useDashboard();
  const r = pkg.result!;
  const name = slugify(pkg.brief?.nombre ?? "marca");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function applyToKit() {
    setBusy("apply");
    setMsg(null);
    try {
      const supabase = createClient();
      const logo = r.logos.find((l) => l.id === "principal") ?? r.logos[0];
      const path = `${userId}/logo-ia-${Date.now()}.svg`;
      const { error: upErr } = await supabase.storage
        .from("brand-assets")
        .upload(path, new Blob([logo.svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml" });
      if (upErr) throw new Error(upErr.message);
      const { error } = await supabase.from("brand_kits").upsert({ user_id: userId, logo_path: path, ...r.kit }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      await refresh();
      setMsg({ ok: true, text: "¡Listo! Este logo y estos colores son ahora tu marca principal." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo aplicar." });
    } finally {
      setBusy(null);
    }
  }

  async function post(url: string, body: object, key: string, okText: string) {
    setBusy(key);
    setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Error" });
    setMsg({ ok: true, text: okText });
    await onChange();
  }

  async function copy(hex: string) {
    await navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      <div className={cardCls}>
        <h2 className="text-xl font-bold">{pkg.brief?.nombre}</h2>
        <p className="mt-2 text-sm text-[#4A154B]/80">{r.concepto}</p>
        <p className="mt-3 text-xs text-[#4A154B]/60">
          {pkg.emailed_at ? `Enviado a ${pkg.brief?.correo}.` : "Aún no se pudo enviar por correo."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnGold} onClick={applyToKit} disabled={!!busy}>
            {busy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Usar como marca principal
          </button>
          <button className={btnSecondary} disabled={!!busy || paletteSaved}
            onClick={() => post("/api/marca-ia/paleta", { packageId: pkg.id }, "pal", "Paleta guardada. Elígela en «Paleta de colores» al generar imágenes y videos.")}>
            {busy === "pal" ? <Loader2 className="h-4 w-4 animate-spin" /> : paletteSaved ? <Check className="h-4 w-4" /> : <Palette className="h-4 w-4" />}
            {paletteSaved ? "Paleta guardada en Mis paletas" : "Guardar en Mis paletas"}
          </button>
          <button className={btnSecondary} disabled={!!busy}
            onClick={() => post("/api/marca-ia/reenviar", { packageId: pkg.id }, "mail", "Correo enviado.")}>
            {busy === "mail" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Enviar por correo
          </button>
        </div>
        {msg && <p className={`${msg.ok ? successCls : errorCls} mt-3`}>{msg.text}</p>}
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {r.logos.map((l) => (
          <div key={l.id} className={cardCls}>
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-white p-4 [background-image:linear-gradient(45deg,#f3eee7_25%,transparent_25%,transparent_75%,#f3eee7_75%),linear-gradient(45deg,#f3eee7_25%,transparent_25%,transparent_75%,#f3eee7_75%)] [background-position:0_0,8px_8px] [background-size:16px_16px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(l.svg)} alt={l.nombre} className="max-h-full max-w-full" />
            </div>
            <p className="mt-3 font-semibold">{l.nombre}</p>
            <p className="text-xs text-[#4A154B]/70">{l.descripcion}</p>
            <div className="mt-3 flex gap-2">
              <button className={`${btnSecondary} px-3 py-1.5 text-xs`} onClick={() => downloadSvgStringAsPng(l.svg, `${name}-${l.id}`)}>
                <Download className="h-3.5 w-3.5" /> PNG
              </button>
              <button className={`${btnSecondary} px-3 py-1.5 text-xs`} onClick={() => downloadSvgString(l.svg, `${name}-${l.id}`)}>
                <Download className="h-3.5 w-3.5" /> SVG
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className={cardCls}>
        <h3 className="font-bold">Paleta de colores</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {r.paleta.map((p) => (
            <button key={p.hex + p.rol} onClick={() => copy(p.hex)} className="text-left">
              <span className="block aspect-square rounded-2xl border border-black/10 shadow-sm" style={{ background: p.hex }} />
              <span className="mt-2 block text-sm font-semibold">{p.rol} · {p.nombre}</span>
              <span className="flex items-center gap-1 font-mono text-xs">
                {p.hex} {copied === p.hex ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </span>
              <span className="mt-1 block text-xs text-[#4A154B]/60">{p.uso}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className={cardCls}>
          <h3 className="font-bold">Tipografías (Google Fonts, gratis)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {r.tipografias.map((t) => (
              <li key={t.familia}>
                <strong>{t.rol}:</strong>{" "}
                <a href={t.url} target="_blank" rel="noreferrer" className="text-[#6B21A8] underline">{t.familia}</a>
                <span className="block text-xs text-[#4A154B]/60">{t.uso}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={cardCls}>
          <h3 className="font-bold">Guía de uso</h3>
          <p className="mt-2 text-sm">{r.guia.tono}</p>
          <p className="mt-3 text-sm font-semibold">✅ Úsalo así</p>
          <ul className="ml-5 list-disc text-sm">{r.guia.usos_correctos.map((u) => <li key={u}>{u}</li>)}</ul>
          <p className="mt-3 text-sm font-semibold">❌ Evita</p>
          <ul className="ml-5 list-disc text-sm">{r.guia.usos_incorrectos.map((u) => <li key={u}>{u}</li>)}</ul>
          <p className="mt-3 text-sm font-semibold">💡 Ideas para aplicarla</p>
          <ul className="ml-5 list-disc text-sm">{r.guia.aplicaciones.map((u) => <li key={u}>{u}</li>)}</ul>
        </div>
      </section>

      <section className={cardCls}>
        <h3 className="flex items-center gap-2 font-bold"><RefreshCw className="h-4 w-4" /> Pedir un ajuste ({pkg.revisions_left} disponible)</h3>
        {pkg.revisions_left > 0 ? (
          <div className="mt-3 space-y-3">
            <textarea className={`${inputCls} min-h-20`} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={600}
              placeholder="Ej. Me gusta la paleta, pero quiero un ícono más sencillo y el nombre en letras más gruesas." />
            <button className={btnPrimary} disabled={!!busy || feedback.trim().length < 10}
              onClick={() => post("/api/marca-ia/generar", { packageId: pkg.id, feedback }, "rev", "¡Ajuste listo! También lo enviamos a tu correo.")}>
              {busy === "rev" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {busy === "rev" ? "Ajustando… (1 a 2 minutos)" : "Pedir ajuste"}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#4A154B]/60">Ya usaste el ajuste incluido.</p>
        )}
      </section>
    </div>
  );
}
