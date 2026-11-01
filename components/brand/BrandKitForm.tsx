"use client";

// Formulario del Kit de Marca. variant="wizard" (paso a paso, onboarding) o "full" (todo en una página).
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ImageUp, Loader2, Trash2 } from "lucide-react";
import { PostImage } from "@/components/posts/PostImage";
import { COLOR_FIELDS, DEFAULT_KIT, NICHOS, TONOS, isHex } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import type { BrandKit } from "@/lib/types";
import { btnPrimary, btnSecondary, cardCls, errorCls, inputCls, labelCls, successCls } from "@/lib/ui";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/svg+xml"];

interface Props {
  userId: string;
  initialKit: BrandKit | null;
  initialBusinessName: string;
  initialLogoUrl: string | null;
  variant: "wizard" | "full";
  onSaved: () => void | Promise<void>;
}

export function BrandKitForm({ userId, initialKit, initialBusinessName, initialLogoUrl, variant, onSaved }: Props) {
  const start = initialKit ?? DEFAULT_KIT;
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [colors, setColors] = useState({
    color_primary: start.color_primary,
    color_secondary: start.color_secondary,
    color_accent: start.color_accent,
    color_cream: start.color_cream,
  });
  const nicheIsCustom = !!start.niche && !NICHOS.includes(start.niche);
  const [niche, setNiche] = useState(nicheIsCustom ? "Otro" : start.niche ?? "");
  const [customNiche, setCustomNiche] = useState(nicheIsCustom ? start.niche ?? "" : "");
  const [tone, setTone] = useState(start.voice_tone ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function pickLogo(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) return setError("El logo debe ser un archivo PNG o SVG.");
    if (file.size > MAX_LOGO_BYTES) return setError("El logo pesa más de 2 MB. Usa una versión más liviana.");
    setRemoveLogo(false);
    setLogoFile(file);
  }

  const finalNiche = niche === "Otro" ? customNiche.trim() : niche;

  function validate(forStep?: number): string | null {
    const check = (s: number) => {
      if (s === 0 && !businessName.trim()) return "Escribe el nombre de tu negocio.";
      if (s === 2 && !Object.values(colors).every(isHex)) return "Revisa los colores: deben tener formato #RRGGBB.";
      if (s === 3 && !finalNiche) return "Elige el nicho de tu negocio.";
      if (s === 3 && !tone) return "Elige un tono de voz.";
      return null;
    };
    if (forStep !== undefined) return check(forStep);
    for (const s of [0, 2, 3]) {
      const e = check(s);
      if (e) return e;
    }
    return null;
  }

  async function save() {
    const v = validate();
    if (v) return setError(v);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      let logo_path = removeLogo ? null : initialKit?.logo_path ?? null;

      if (logoFile) {
        const ext = logoFile.type === "image/svg+xml" ? "svg" : "png";
        const path = `${userId}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("brand-assets")
          .upload(path, logoFile, { contentType: logoFile.type, upsert: false });
        if (upErr) throw new Error(`No se pudo subir el logo: ${upErr.message}`);
        logo_path = path;
      }

      const { error: kitErr } = await supabase.from("brand_kits").upsert(
        { user_id: userId, logo_path, ...colors, niche: finalNiche, voice_tone: tone },
        { onConflict: "user_id" }
      );
      if (kitErr) throw new Error(kitErr.message);

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ business_name: businessName.trim(), onboarding_completed: true })
        .eq("id", userId);
      if (profErr) throw new Error(profErr.message);

      setSaved(true);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  const sections: { title: string; help: string; content: ReactNode }[] = [
    {
      title: "Tu negocio",
      help: "Así aparecerá tu marca cuando no haya logo.",
      content: (
        <div>
          <label htmlFor="biz" className={labelCls}>Nombre del negocio o marca</label>
          <input id="biz" className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Ej. Dinamita Burger" maxLength={60} />
        </div>
      ),
    },
    {
      title: "Logo",
      help: "PNG con fondo transparente o SVG, máximo 2 MB. Puedes saltarte este paso.",
      content: (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-2xl border-2 border-dashed border-[#4A154B]/25 bg-white p-2">
            {logoPreview && !removeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <ImageUp className="h-8 w-8 text-[#4A154B]/40" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={`${btnSecondary} cursor-pointer`}>
              <ImageUp className="h-4 w-4" /> {logoPreview && !removeLogo ? "Cambiar logo" : "Subir logo"}
              <input type="file" accept=".png,.svg,image/png,image/svg+xml" className="hidden"
                onChange={(e) => pickLogo(e.target.files?.[0])} />
            </label>
            {logoPreview && !removeLogo && (
              <button type="button" className={btnSecondary} onClick={() => { setLogoFile(null); setRemoveLogo(true); }}>
                <Trash2 className="h-4 w-4" /> Quitar
              </button>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Colores",
      help: "Toca cada círculo para elegir el color, o escribe el código si ya lo conoces.",
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          {COLOR_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3 rounded-xl bg-white p-3">
              <input type="color" aria-label={f.label} value={isHex(colors[f.key]) ? colors[f.key] : "#000000"}
                onChange={(e) => setColors((c) => ({ ...c, [f.key]: e.target.value.toUpperCase() }))}
                className="h-12 w-12 shrink-0 cursor-pointer rounded-full border-0 bg-transparent" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-xs text-[#4A154B]/60">{f.help}</p>
                <input className={`${inputCls} mt-1 py-1.5 font-mono uppercase`} value={colors[f.key]} maxLength={7}
                  onChange={(e) => setColors((c) => ({ ...c, [f.key]: e.target.value.trim() }))} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Nicho y tono de voz",
      help: "La IA usará esto para escribir como tu marca.",
      content: (
        <div className="space-y-5">
          <div>
            <label htmlFor="niche" className={labelCls}>¿A qué se dedica tu negocio?</label>
            <select id="niche" className={inputCls} value={niche} onChange={(e) => setNiche(e.target.value)}>
              <option value="">Elige una opción…</option>
              {NICHOS.map((n) => <option key={n} value={n}>{n}</option>)}
              <option value="Otro">Otro</option>
            </select>
            {niche === "Otro" && (
              <input className={`${inputCls} mt-2`} placeholder="Describe tu nicho en pocas palabras"
                value={customNiche} onChange={(e) => setCustomNiche(e.target.value)} maxLength={80} />
            )}
          </div>
          <div>
            <p className={labelCls}>¿Cómo habla tu marca?</p>
            <div className="flex flex-wrap gap-2">
              {TONOS.map((t) => (
                <button key={t} type="button" onClick={() => setTone(t)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    tone === t ? "border-[#4A154B] bg-[#4A154B] text-[#FAF5EF]" : "border-[#4A154B]/20 bg-white hover:border-[#4A154B]/50"
                  }`}>
                  {tone === t && <Check className="mr-1 inline h-3.5 w-3.5" />}
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  const preview = (
    <div className={cardCls}>
      <p className="mb-3 text-sm font-semibold">Vista previa</p>
      <div className="overflow-hidden rounded-xl shadow">
        <PostImage
          definition={{ layout: "centrado", fondo: "primary", texto: "cream", detalle: "accent" }}
          colors={colors}
          logoUrl={removeLogo ? null : logoPreview}
          brandName={businessName || "Tu marca"}
          headline="Así se verán tus publicaciones"
          subtext="Con tus colores, tu logo y tu estilo"
        />
      </div>
    </div>
  );

  const feedback = (
    <>
      {error && <p className={errorCls}>{error}</p>}
      {saved && variant === "full" && <p className={successCls}>¡Kit de marca guardado!</p>}
    </>
  );

  if (variant === "full") {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.title} className={cardCls}>
              <h2 className="font-bold">{s.title}</h2>
              <p className="mb-4 text-sm text-[#4A154B]/60">{s.help}</p>
              {s.content}
            </section>
          ))}
          {feedback}
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
          </button>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">{preview}</div>
      </div>
    );
  }

  const current = sections[step];
  const last = step === sections.length - 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className={cardCls}>
        <div className="mb-6 flex gap-2">
          {sections.map((s, i) => (
            <span key={s.title} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#8C338A]" : "bg-[#4A154B]/10"}`} />
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C338A]">Paso {step + 1} de {sections.length}</p>
        <h2 className="mt-1 text-xl font-bold">{current.title}</h2>
        <p className="mb-6 text-sm text-[#4A154B]/60">{current.help}</p>
        {current.content}
        <div className="mt-6 space-y-3">{feedback}</div>
        <div className="mt-6 flex justify-between gap-3">
          <button className={btnSecondary} onClick={() => { setError(null); setStep((s) => s - 1); }} disabled={step === 0 || saving}>
            <ArrowLeft className="h-4 w-4" /> Atrás
          </button>
          {last ? (
            <button className={btnPrimary} onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Terminar
            </button>
          ) : (
            <button className={btnPrimary} onClick={() => {
              const v = validate(step);
              if (v) return setError(v);
              setError(null);
              setStep((s) => s + 1);
            }}>
              Siguiente <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="lg:sticky lg:top-8 lg:self-start">{preview}</div>
    </div>
  );
}
