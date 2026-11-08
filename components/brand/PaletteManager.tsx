"use client";

// Kit de marca → «Mis paletas»: crear, editar, borrar y usar como principal.
import { useState, type FormEvent } from "react";
import { Check, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Swatches } from "@/components/brand/PaletteSelect";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { COLOR_FIELDS, DEFAULT_KIT, isHex } from "@/lib/brand";
import { pickColors, usePalettes, type Palette } from "@/lib/palettes";
import { createClient } from "@/lib/supabase/client";
import type { BrandColors } from "@/lib/templates";
import { btnGold, btnSecondary, cardCls, errorCls, inputCls, labelCls, successCls } from "@/lib/ui";

type Form = BrandColors & { id: string; name: string };

export function PaletteManager() {
  const { userId, kit, refresh } = useDashboard();
  const { palettes, reload } = usePalettes();
  const empty = (): Form => ({ id: "", name: "", ...pickColors(kit ?? DEFAULT_KIT) });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMsg(null);
    if (!form.name.trim()) return setMsg({ ok: false, text: "Ponle un nombre a la paleta." });
    if (![form.color_primary, form.color_secondary, form.color_accent, form.color_cream].every(isHex)) {
      return setMsg({ ok: false, text: "Revisa los colores: deben tener el formato #RRGGBB." });
    }
    setBusy("save");
    const row = { name: form.name.trim().slice(0, 40), ...pickColors(form) };
    const sb = createClient();
    const { error } = form.id
      ? await sb.from("brand_palettes").update(row).eq("id", form.id)
      : await sb.from("brand_palettes").insert({ ...row, user_id: userId });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setForm(null);
    setMsg({ ok: true, text: "Paleta guardada." });
    await reload();
  }

  async function remove(p: Palette) {
    setBusy(p.id);
    const { error } = await createClient().from("brand_palettes").delete().eq("id", p.id);
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    await reload();
  }

  async function makeMain(p: Palette) {
    setBusy(p.id);
    const { error } = await createClient().from("brand_kits").update(pickColors(p)).eq("user_id", userId);
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `«${p.name}» ahora es la paleta de tu kit de marca.` });
    await refresh();
  }

  return (
    <section id="paletas" className={`${cardCls} mt-8 space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Mis paletas</h2>
          <p className="text-sm text-[#4A154B]/70">Guarda varias combinaciones (temporadas, promociones, líneas de producto) y elígelas antes de generar.</p>
        </div>
        {!form && (
          <button className={btnSecondary} onClick={() => setForm(empty())} disabled={(palettes?.length ?? 0) >= 10}>
            <Plus className="h-4 w-4" /> Nueva paleta
          </button>
        )}
      </div>
      {msg && <p className={msg.ok ? successCls : errorCls}>{msg.text}</p>}

      {palettes && palettes.length === 0 && !form && (
        <p className="text-sm text-[#4A154B]/60">Aún no tienes paletas guardadas. La paleta de tu kit siempre está disponible.</p>
      )}

      <ul className="space-y-2">
        {(palettes ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
            <Swatches c={p} size="h-7 w-7" />
            <span className="flex-1 font-medium">{p.name}</span>
            <button className={btnSecondary} onClick={() => makeMain(p)} disabled={busy === p.id} title="Usar como paleta del kit">
              <Star className="h-4 w-4" /> Usar como principal
            </button>
            <button className={btnSecondary} onClick={() => setForm({ ...p })}><Pencil className="h-4 w-4" /></button>
            <button className={`${btnSecondary} text-red-700`} onClick={() => remove(p)} disabled={busy === p.id}>
              {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </li>
        ))}
      </ul>

      {form && (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#D9B382]/50 p-4">
          <div className="max-w-xs">
            <label className={labelCls}>Nombre</label>
            <input className={inputCls} value={form.name} maxLength={40} placeholder="Ej. Navidad"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {COLOR_FIELDS.map((f) => (
              <div key={f.key}>
                <label className={labelCls}>{f.label}</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-10 w-12 cursor-pointer rounded-lg border border-[#4A154B]/15 bg-white p-1"
                    value={isHex(form[f.key]) ? form[f.key] : "#000000"} onChange={(e) => setForm({ ...form, [f.key]: e.target.value.toUpperCase() })} />
                  <input className={`${inputCls} font-mono uppercase`} value={form[f.key]} maxLength={7}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className={btnGold} disabled={busy === "save"}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar paleta
            </button>
            <button type="button" className={btnSecondary} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  );
}
