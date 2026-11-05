"use client";

// Administración → Precios y promociones.
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Loader2, Lock, Pause, Pencil, Play, ShieldAlert, Tag, Trash2 } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { InlineLoader } from "@/components/ui/Loader";
import { formatUSD } from "@/lib/billing/subscription-state";
import { formatDateEs, type PublicPlan } from "@/lib/pricing";
import { btnGold, btnPrimary, btnSecondary, cardCls, errorCls, inputCls, labelCls, successCls } from "@/lib/ui";

interface Item { id: string; name: string; price_cents: number; is_active: boolean }
interface Promo {
  id: string;
  name: string;
  label: string;
  plan_id: string | null;
  discount_pct: number | null;
  promo_price_cents: number | null;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
}
interface Data {
  plans: Item[];
  addons: Item[];
  promotions: Promo[];
  pricing: PublicPlan[];
  locked: { plan_id: string; price_cents: number; count: number }[];
}

const panamaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
const money = (cents: number) => (cents / 100).toFixed(2);

const EMPTY_FORM = { id: "", name: "", label: "Promoción", plan_id: "", mode: "pct" as "pct" | "price", value: "", starts_on: "", ends_on: "" };

function promoState(p: Promo) {
  const today = panamaToday();
  if (!p.is_active) return { text: "Pausada", cls: "bg-gray-200 text-gray-700" };
  if (p.ends_on && p.ends_on < today) return { text: "Vencida", cls: "bg-gray-200 text-gray-700" };
  if (p.starts_on > today) return { text: "Programada", cls: "bg-blue-100 text-blue-800" };
  return { text: "Activa", cls: "bg-emerald-100 text-emerald-800" };
}

export default function PreciosAdminPage() {
  const { profile } = useDashboard();
  const [data, setData] = useState<Data | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/precios");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "No se pudo cargar." });
    const d = json as Data;
    setData(d);
    const p: Record<string, string> = {};
    for (const it of [...d.plans, ...d.addons]) p[it.id] = money(it.price_cents);
    setPrices(p);
  }, []);

  useEffect(() => {
    if (profile?.is_admin) void load();
  }, [profile?.is_admin, load]);

  if (!profile?.is_admin) {
    return (
      <div className={`${cardCls} mx-auto max-w-md text-center`}>
        <ShieldAlert className="mx-auto h-8 w-8 text-red-600" />
        <p className="mt-2 font-semibold">Solo para administradores</p>
      </div>
    );
  }
  if (!data) return msg ? <p className={errorCls}>{msg.text}</p> : <InlineLoader />;

  async function send(key: string, payload: Record<string, unknown>, okText: string) {
    setBusy(key);
    setMsg(null);
    const res = await fetch("/api/admin/precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMsg({ ok: false, text: json.error ?? "Error" });
      return false;
    }
    setMsg({ ok: true, text: okText });
    await load();
    return true;
  }

  async function savePromo(e: FormEvent) {
    e.preventDefault();
    const ok = await send(
      "promo",
      {
        action: "save_promo",
        id: form.id || undefined,
        promo: { ...form, plan_id: form.plan_id || null, ends_on: form.ends_on || null },
      },
      form.id ? "Promoción actualizada." : "Promoción creada."
    );
    if (ok) setForm(EMPTY_FORM);
  }

  function edit(p: Promo) {
    setForm({
      id: p.id,
      name: p.name,
      label: p.label,
      plan_id: p.plan_id ?? "",
      mode: p.promo_price_cents ? "price" : "pct",
      value: p.promo_price_cents ? money(p.promo_price_cents) : String(p.discount_pct ?? ""),
      starts_on: p.starts_on,
      ends_on: p.ends_on ?? "",
    });
    window.scrollTo({ top: document.getElementById("promo-form")?.offsetTop ?? 0, behavior: "smooth" });
  }

  const planName = (id: string | null) => (id ? data.plans.find((p) => p.id === id)?.name ?? id : "Todos los planes");

  const priceRow = (it: Item, action: "plan_price" | "addon_price") => (
    <li key={it.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
      <span className="min-w-40 flex-1 font-medium">{it.name}</span>
      <span className="flex items-center gap-1">
        $
        <input className={`${inputCls} w-28`} inputMode="decimal" value={prices[it.id] ?? ""}
          onChange={(e) => setPrices((p) => ({ ...p, [it.id]: e.target.value }))} />
      </span>
      <button className={btnSecondary} disabled={busy === it.id || prices[it.id] === money(it.price_cents)}
        onClick={() => send(it.id, { action, id: it.id, price: prices[it.id] }, `Precio de ${it.name} actualizado.`)}>
        {busy === it.id && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
      </button>
    </li>
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-sm text-[#6B21A8] underline">
          <ArrowLeft className="h-4 w-4" /> Administración
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold"><Tag className="h-6 w-6 text-[#8C338A]" /> Precios y promociones</h1>
        <p className="mt-1 text-[#4A154B]/70">
          Los cambios solo afectan a clientes nuevos. Quien ya está suscrito conserva el precio con el que entró mientras su
          suscripción siga activa.
        </p>
      </div>
      {msg && <p className={msg.ok ? successCls : errorCls}>{msg.text}</p>}

      {/* Lo que ve hoy un cliente nuevo */}
      <section className={cardCls}>
        <h2 className="font-bold">Así se ve hoy para un cliente nuevo</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.pricing.map((p) => (
            <div key={p.plan_id} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="font-semibold">{p.name}</p>
              {p.price_cents < p.regular_cents ? (
                <p className="mt-1">
                  <span className="mr-2 text-[#4A154B]/50 line-through">{formatUSD(p.regular_cents)}</span>
                  <strong className="text-2xl">{formatUSD(p.price_cents)}</strong>
                  <span className="ml-2 rounded-full bg-[#D9B382] px-2 py-0.5 text-xs font-bold">{p.label}</span>
                  {p.ends_on && <span className="mt-1 block text-xs text-[#4A154B]/60">Hasta el {formatDateEs(p.ends_on)}</span>}
                </p>
              ) : (
                <p className="mt-1"><strong className="text-2xl">{formatUSD(p.price_cents)}</strong> <span className="text-xs text-[#4A154B]/60">precio regular</span></p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Precios regulares */}
      <section className={cardCls}>
        <h2 className="font-bold">Precio regular de los planes (mensual)</h2>
        <p className="mt-1 text-xs text-[#4A154B]/60">Es el precio normal, el que aparece tachado durante una promoción.</p>
        <ul className="mt-4 space-y-2">{data.plans.map((p) => priceRow(p, "plan_price"))}</ul>
      </section>

      <section className={cardCls}>
        <h2 className="font-bold">Precios de la tienda</h2>
        <p className="mt-1 text-xs text-[#4A154B]/60">Compras de una sola vez: el nuevo precio aplica desde la siguiente compra.</p>
        <ul className="mt-4 space-y-2">{data.addons.map((a) => priceRow(a, "addon_price"))}</ul>
      </section>

      {/* Promociones */}
      <section className={cardCls}>
        <h2 className="font-bold">Promociones</h2>
        <p className="mt-1 text-xs text-[#4A154B]/60">
          Si hay varias activas a la vez, se aplica la que deja el precio más bajo. Quien se suscribe durante una promoción
          conserva ese precio mientras siga suscrito, aunque la promoción termine.
        </p>
        {data.promotions.length === 0 ? (
          <p className="mt-3 text-sm text-[#4A154B]/60">No hay promociones.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.promotions.map((p) => {
              const st = promoState(p);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-sm shadow-sm">
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold">{p.name} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.text}</span></p>
                    <p className="text-[#4A154B]/70">
                      {planName(p.plan_id)} · {p.promo_price_cents ? `${formatUSD(p.promo_price_cents)} al mes` : `${p.discount_pct}% de descuento`} ·
                      etiqueta «{p.label}»
                    </p>
                    <p className="text-xs text-[#4A154B]/60">
                      Del {formatDateEs(p.starts_on)} {p.ends_on ? `al ${formatDateEs(p.ends_on)}` : "sin fecha de fin"}
                    </p>
                  </div>
                  <button className={btnSecondary} onClick={() => edit(p)}><Pencil className="h-4 w-4" /> Editar</button>
                  <button className={btnSecondary} disabled={busy === p.id}
                    onClick={() => send(p.id, { action: "toggle_promo", id: p.id, is_active: !p.is_active }, p.is_active ? "Promoción pausada." : "Promoción activada.")}>
                    {p.is_active ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Activar</>}
                  </button>
                  {confirmDelete === p.id ? (
                    <button className={`${btnSecondary} text-red-700`} disabled={busy === p.id}
                      onClick={() => { setConfirmDelete(null); void send(p.id, { action: "delete_promo", id: p.id }, "Promoción eliminada."); }}>
                      <Trash2 className="h-4 w-4" /> ¿Seguro? Eliminar
                    </button>
                  ) : (
                    <button className={`${btnSecondary} text-red-700`} onClick={() => setConfirmDelete(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form id="promo-form" onSubmit={savePromo} className="mt-6 space-y-4 rounded-2xl border border-[#D9B382]/50 p-4">
          <h3 className="font-semibold">{form.id ? "Editar promoción" : "Nueva promoción"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Nombre interno</label>
              <input className={inputCls} value={form.name} maxLength={80} placeholder="Ej. Black Friday 2026"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Etiqueta que ven los clientes</label>
              <input className={inputCls} value={form.label} maxLength={40} placeholder="Ej. Precio de lanzamiento"
                onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Plan</label>
              <select className={inputCls} value={form.plan_id}
                onChange={(e) => setForm({ ...form, plan_id: e.target.value, mode: e.target.value ? form.mode : "pct" })}>
                <option value="">Todos los planes</option>
                {data.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tipo de descuento</label>
              <select className={inputCls} value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as "pct" | "price" })}>
                <option value="pct">Porcentaje (%)</option>
                <option value="price" disabled={!form.plan_id}>Precio fijo ($) — elige un plan</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{form.mode === "pct" ? "Descuento (%)" : "Precio promocional mensual ($)"}</label>
              <input className={inputCls} inputMode="decimal" value={form.value} placeholder={form.mode === "pct" ? "20" : "14.99"}
                onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Desde</label>
                <input type="date" className={inputCls} value={form.starts_on}
                  onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Hasta (opcional)</label>
                <input type="date" className={inputCls} value={form.ends_on}
                  onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btnGold} disabled={busy === "promo"}>
              {busy === "promo" && <Loader2 className="h-4 w-4 animate-spin" />} {form.id ? "Guardar cambios" : "Crear promoción"}
            </button>
            {form.id && <button type="button" className={btnSecondary} onClick={() => setForm(EMPTY_FORM)}>Cancelar</button>}
          </div>
        </form>
      </section>

      {/* Precios congelados */}
      <section className={cardCls}>
        <h2 className="flex items-center gap-2 font-bold"><Lock className="h-4 w-4" /> Clientes con precio congelado</h2>
        {data.locked.length === 0 ? (
          <p className="mt-3 text-sm text-[#4A154B]/60">Aún no hay clientes activos.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-[#4A154B]/60"><th className="py-1">Plan</th><th>Precio mensual</th><th>Clientes</th></tr></thead>
            <tbody>
              {data.locked.sort((a, b) => a.plan_id.localeCompare(b.plan_id) || a.price_cents - b.price_cents).map((l) => (
                <tr key={`${l.plan_id}-${l.price_cents}`} className="border-t border-[#4A154B]/10">
                  <td className="py-2">{planName(l.plan_id)}</td><td>{formatUSD(l.price_cents)}</td><td>{l.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-[#4A154B]/60">
          Si un cliente se suspende o cancela, pierde su precio congelado y al volver paga el precio vigente ese día.
        </p>
      </section>

      <p className="text-center text-xs text-[#4A154B]/50">
        <button className={btnPrimary} onClick={() => void load()}>Actualizar</button>
      </p>
    </div>
  );
}
