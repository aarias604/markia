"use client";

// Administración → Clientes: plan, uso, compras en la Tienda, ingresos y costo estimado de cada cliente.
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CreditCard, Search, ShieldAlert } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { InlineLoader } from "@/components/ui/Loader";
import { formatDateEs } from "@/lib/pricing";
import { cardCls, errorCls, inputCls } from "@/lib/ui";

interface Client {
  user_id: string;
  email: string;
  full_name: string | null;
  business_name: string | null;
  joined_at: string;
  is_admin: boolean;
  plan_id: string | null;
  plan_name: string | null;
  status: string | null;
  next_due_date: string | null;
  monthly_price_cents: number | null;
  price_locked: boolean;
  autopay: boolean;
  posts_used: number;
  posts_limit: number;
  extra_posts: number;
  carousels_used: number;
  carousels_limit: number;
  videos_used: number;
  videos_limit: number;
  extra_videos: number;
  posts_total: number;
  uploads_total: number;
  carousels_total: number;
  videos_total: number;
  videos_ai_images: number;
  wa_utility: number;
  wa_marketing: number;
  plan_revenue_cents: number;
  store_revenue_cents: number;
  store_items: { addon_id: string; name: string; count: number; cents: number }[];
  last_payment_at: string | null;
  revenue: number;
  costs: { ai: number; whatsapp: number; fees: number; itbms: number; referral: number; total: number };
  profit: number;
}
interface Data {
  clients: Client[];
  totals: { clients: number; active: number; basic: number; pro: number; mrr: number; planRevenue: number; storeRevenue: number; revenue: number; cost: number; profit: number };
  fixedMonthly: number;
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const cents = (c: number) => usd(c / 100);

const STATUS: Record<string, { text: string; cls: string }> = {
  active: { text: "Activo", cls: "bg-emerald-100 text-emerald-800" },
  expiring_soon: { text: "Por vencer", cls: "bg-amber-100 text-amber-800" },
  grace_period: { text: "En gracia", cls: "bg-orange-100 text-orange-800" },
  suspended: { text: "Suspendido", cls: "bg-red-100 text-red-700" },
  canceled: { text: "Cancelado", cls: "bg-gray-200 text-gray-700" },
  pending: { text: "Sin pagar", cls: "bg-gray-200 text-gray-700" },
};

type Filter = "all" | "active" | "basic" | "pro" | "none" | "store";

export default function ClientesAdminPage() {
  const { profile } = useDashboard();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    fetch("/api/admin/clientes")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "No se pudo cargar.");
        setData(j as Data);
      })
      .catch((e: Error) => setError(e.message));
  }, [profile?.is_admin]);

  const rows = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return data.clients.filter((c) => {
      const isActive = !!c.status && ["active", "expiring_soon", "grace_period"].includes(c.status);
      if (filter === "active" && !isActive) return false;
      if (filter === "basic" && !(isActive && c.plan_id === "basic")) return false;
      if (filter === "pro" && !(isActive && c.plan_id === "pro")) return false;
      if (filter === "none" && isActive) return false;
      if (filter === "store" && c.store_revenue_cents <= 0) return false;
      if (!t) return true;
      return [c.email, c.full_name, c.business_name].some((v) => v?.toLowerCase().includes(t));
    });
  }, [data, q, filter]);

  if (!profile?.is_admin) {
    return (
      <div className={`${cardCls} mx-auto max-w-md text-center`}>
        <ShieldAlert className="mx-auto h-8 w-8 text-red-600" />
        <p className="mt-2 font-semibold">Solo para administradores</p>
      </div>
    );
  }
  if (error) return <p className={errorCls}>{error}</p>;
  if (!data) return <InlineLoader />;

  const t = data.totals;
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: `Todos (${t.clients})` },
    { id: "active", label: `Con plan (${t.active})` },
    { id: "basic", label: `Básico (${t.basic})` },
    { id: "pro", label: `PRO (${t.pro})` },
    { id: "none", label: "Sin plan" },
    { id: "store", label: "Compraron en Tienda" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Clientes</h1>
      <p className="mt-1 text-[#4A154B]/70">Plan, uso, compras y cuánto te ha dejado cada cliente. Los costos son estimados.</p>

      {/* Resumen */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clientes con plan" value={String(t.active)} hint={`${t.basic} Básico · ${t.pro} PRO · ${t.clients} registrados`} />
        <Stat label="Ingreso mensual (planes activos)" value={usd(t.mrr)} hint={`Gastos fijos: ${usd(data.fixedMonthly)} al mes`} />
        <Stat label="Ingresos totales" value={usd(t.revenue)} hint={`Planes ${usd(t.planRevenue)} · Tienda ${usd(t.storeRevenue)}`} />
        <Stat
          label="Te ha quedado"
          value={usd(t.profit)}
          hint={`Costos variables: ${usd(t.cost)} (sin gastos fijos)`}
          strong={t.profit >= 0 ? "text-emerald-700" : "text-red-700"}
        />
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A154B]/40" />
          <input className={`${inputCls} pl-9`} placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.id ? "bg-[#4A154B] text-[#FAF5EF]" : "border border-[#4A154B]/20 bg-white text-[#4A154B]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className={`${cardCls} mt-4 overflow-x-auto p-0`}>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-[#D9B382]/40 text-xs uppercase tracking-wide text-[#4A154B]/60">
            <tr>
              <th className="px-4 py-3" />
              <th className="px-2 py-3">Cliente</th>
              <th className="px-2 py-3">Plan</th>
              <th className="px-2 py-3">Uso del ciclo</th>
              <th className="px-2 py-3 text-right">Tienda</th>
              <th className="px-2 py-3 text-right">Ingresos</th>
              <th className="px-2 py-3 text-right">Costo</th>
              <th className="px-4 py-3 text-right">Te queda</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[#4A154B]/60">No hay clientes con ese filtro.</td>
              </tr>
            )}
            {rows.map((c) => {
              const st = c.status ? STATUS[c.status] : null;
              const isOpen = open === c.user_id;
              return (
                <Fragment key={c.user_id}>
                  <tr className="cursor-pointer border-b border-[#D9B382]/20 hover:bg-white" onClick={() => setOpen(isOpen ? null : c.user_id)}>
                    <td className="px-4 py-3 text-[#4A154B]/50">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="px-2 py-3">
                      <p className="font-semibold">
                        {c.business_name || c.full_name || "Sin nombre"}
                        {c.is_admin && <span className="ml-2 rounded-full bg-[#D9B382]/40 px-2 py-0.5 text-[10px]">ADMIN</span>}
                      </p>
                      <p className="text-xs text-[#4A154B]/60">{c.email}</p>
                    </td>
                    <td className="px-2 py-3">
                      {c.plan_name ? (
                        <>
                          <p className="font-medium">
                            {c.plan_name} {c.monthly_price_cents != null && <span className="text-[#4A154B]/60">· {cents(c.monthly_price_cents)}</span>}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {st && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.text}</span>}
                            {c.autopay && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                                <CreditCard className="h-3 w-3" /> Auto
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[#4A154B]/50">Sin plan</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-xs leading-5">
                      {c.plan_id ? (
                        <>
                          <p>Posts {c.posts_used}/{c.posts_limit}{c.extra_posts > 0 && <span className="text-[#4A154B]/50"> (+{c.extra_posts})</span>}</p>
                          <p>Carruseles {c.carousels_used}/{c.carousels_limit}</p>
                          <p>Videos {c.videos_used}/{c.videos_limit}{c.extra_videos > 0 && <span className="text-[#4A154B]/50"> (+{c.extra_videos})</span>}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">{c.store_revenue_cents > 0 ? cents(c.store_revenue_cents) : "—"}</td>
                    <td className="px-2 py-3 text-right font-medium">{usd(c.revenue)}</td>
                    <td className="px-2 py-3 text-right text-[#4A154B]/70">{usd(c.costs.total)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${c.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{usd(c.profit)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-[#D9B382]/20 bg-white">
                      <td colSpan={8} className="px-6 py-5">
                        <Detail c={c} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[#4A154B]/50">
        Costo = IA + WhatsApp + comisiones de pago (Tilopay 3.75 % + $0.50, Yappy 3 %) + ITBMS 7 % incluido + comisión de referido.
        No incluye los gastos fijos mensuales. Las publicaciones borradas por el cliente no se cuentan en el total histórico.
      </p>
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint: string; strong?: string }) {
  return (
    <div className={cardCls}>
      <p className="text-xs font-medium text-[#4A154B]/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${strong ?? ""}`}>{value}</p>
      <p className="mt-1 text-xs text-[#4A154B]/60">{hint}</p>
    </div>
  );
}

function Detail({ c }: { c: Client }) {
  const line = (label: string, value: string, cls = "") => (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-[#4A154B]/70">{label}</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </div>
  );
  return (
    <div className="grid gap-6 text-sm md:grid-cols-3">
      <div>
        <p className="mb-2 font-bold">Cuenta</p>
        {line("Nombre", c.full_name || "—")}
        {line("Negocio", c.business_name || "—")}
        {line("Registro", formatDateEs(c.joined_at.slice(0, 10)))}
        {c.next_due_date && line("Próximo pago", formatDateEs(c.next_due_date))}
        {line("Precio congelado", c.price_locked ? "Sí" : "No")}
        {line("Cobro automático", c.autopay ? "Activo (tarjeta)" : "No")}
        {c.last_payment_at && line("Último pago", formatDateEs(c.last_payment_at.slice(0, 10)))}
      </div>
      <div>
        <p className="mb-2 font-bold">Uso total (desde que se registró)</p>
        {line("Publicaciones con IA", String(c.posts_total))}
        {line("Carruseles", String(c.carousels_total))}
        {line("Videos", `${c.videos_total}${c.videos_ai_images ? ` (${c.videos_ai_images} con imágenes IA)` : ""}`)}
        {line("Publicaciones subidas", String(c.uploads_total))}
        {line("WhatsApp enviados", `${c.wa_utility + c.wa_marketing} (${c.wa_utility} recordatorios · ${c.wa_marketing} inactividad)`)}
        <p className="mb-2 mt-4 font-bold">Compras en Tienda</p>
        {c.store_items.length === 0 ? (
          <p className="text-[#4A154B]/60">No ha comprado en la Tienda.</p>
        ) : (
          c.store_items.map((i) => line(`${i.name} ×${i.count}`, cents(i.cents)))
        )}
      </div>
      <div>
        <p className="mb-2 font-bold">Dinero</p>
        {line("Ingresos por planes", cents(c.plan_revenue_cents))}
        {line("Ingresos por Tienda", cents(c.store_revenue_cents))}
        {line("Total ingresos", usd(c.revenue), "font-bold")}
        <div className="my-2 border-t border-[#D9B382]/40" />
        {line("IA (posts, carruseles, videos, marca)", `−${usd(c.costs.ai)}`)}
        {line("WhatsApp", `−${usd(c.costs.whatsapp)}`)}
        {line("Comisiones de pago", `−${usd(c.costs.fees)}`)}
        {line("ITBMS (7 %)", `−${usd(c.costs.itbms)}`)}
        {line("Comisión de referido", `−${usd(c.costs.referral)}`)}
        <div className="my-2 border-t border-[#D9B382]/40" />
        {line("Te queda", usd(c.profit), c.profit >= 0 ? "font-bold text-emerald-700" : "font-bold text-red-700")}
      </div>
    </div>
  );
}
