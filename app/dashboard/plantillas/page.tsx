"use client";

import { useState } from "react";
import { Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { PostImage } from "@/components/posts/PostImage";
import { createClient } from "@/lib/supabase/client";
import { COLOR_ROLES, LAYOUTS } from "@/lib/templates";
import type { ColorRole, LayoutId, Template, TemplateDefinition } from "@/lib/types";
import { btnPrimary, cardCls, errorCls, inputCls, labelCls } from "@/lib/ui";

export default function PlantillasPage() {
  const { kit, logoDataUrl, businessName, templates, subscription, userId, refresh } = useDashboard();
  const generic = templates.filter((t) => t.kind === "generic");
  const own = templates.filter((t) => t.kind !== "generic");
  const limit = (subscription?.plans?.custom_templates ?? 0) + (subscription?.extra_template_slots ?? 0);

  const [name, setName] = useState("");
  const [def, setDef] = useState<TemplateDefinition>({ layout: "centrado", fondo: "cream", texto: "primary", detalle: "secondary" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  if (!kit) return <p>Completa tu kit de marca primero.</p>;
  const brandKit = kit;

  async function create() {
    if (!name.trim()) return setError("Ponle un nombre a tu plantilla.");
    if (def.fondo === def.texto) return setError("El color del texto debe ser distinto al del fondo.");
    setSaving(true);
    setError(null);
    const { error } = await createClient()
      .from("templates")
      .insert({ user_id: userId, kind: "custom", name: name.trim(), definition: def });
    setSaving(false);
    if (error) return setError(error.message);
    setName("");
    await refresh();
  }

  async function remove(t: Template) {
    setDeleting(t.id);
    const { error } = await createClient().from("templates").delete().eq("id", t.id);
    setDeleting(null);
    if (error) return setError(error.message);
    await refresh();
  }

  const preview = (d: TemplateDefinition, headline: string) => (
    <PostImage
      definition={d}
      colors={brandKit}
      logoUrl={logoDataUrl}
      brandName={businessName}
      headline={headline}
      subtext="Así se ve con tu marca"
    />
  );

  const roleSelect = (key: "fondo" | "texto" | "detalle", label: string) => (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={inputCls} value={def[key]} onChange={(e) => setDef((d) => ({ ...d, [key]: e.target.value as ColorRole }))}>
        {COLOR_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Plantillas</h1>
        <p className="mt-1 text-[#4A154B]/70">Los diseños que usa Markia para crear tus imágenes, siempre con tus colores.</p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-bold">Plantillas incluidas ({generic.length})</h2>
        {generic.length === 0 ? (
          <p className={errorCls}>No hay plantillas. Corre el archivo SQL de la Fase 6 en Supabase.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {generic.map((t) => (
              <figure key={t.id}>
                <div className="overflow-hidden rounded-xl shadow">{preview(t.definition, t.name)}</div>
                <figcaption className="mt-2 text-sm font-medium">{t.name}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">Mis plantillas ({own.length} de {limit})</h2>
        {limit === 0 ? (
          <div className={`${cardCls} mt-4 flex items-center gap-3`}>
            <Lock className="h-5 w-5 text-[#8C338A]" />
            <p className="text-sm">
              Crear plantillas propias está disponible en el <strong>Plan PRO</strong> o con el{" "}
              <strong>Pack de Plantillas</strong> de la Tienda.
            </p>
          </div>
        ) : (
          <>
            {own.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {own.map((t) => (
                  <figure key={t.id}>
                    <div className="overflow-hidden rounded-xl shadow">{preview(t.definition, t.name)}</div>
                    <figcaption className="mt-2 flex items-center justify-between gap-2 text-sm font-medium">
                      <span className="truncate">{t.name}</span>
                      <button onClick={() => remove(t)} disabled={deleting === t.id} aria-label="Borrar plantilla"
                        className="text-red-700 hover:text-red-900">
                        {deleting === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {own.length < limit && (
              <div className={`${cardCls} mt-6 grid gap-6 md:grid-cols-[1fr_300px]`}>
                <div className="space-y-4">
                  <h3 className="font-bold">Crear una plantilla</h3>
                  <div>
                    <label className={labelCls}>Nombre</label>
                    <input className={inputCls} value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Promo de fin de semana" />
                  </div>
                  <div>
                    <label className={labelCls}>Diseño</label>
                    <select className={inputCls} value={def.layout}
                      onChange={(e) => setDef((d) => ({ ...d, layout: e.target.value as LayoutId }))}>
                      {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {roleSelect("fondo", "Color de fondo")}
                    {roleSelect("texto", "Color del texto")}
                    {roleSelect("detalle", "Color de detalles")}
                  </div>
                  {error && <p className={errorCls}>{error}</p>}
                  <button className={btnPrimary} onClick={create} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar plantilla
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl shadow">{preview(def, name || "Tu plantilla")}</div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
