"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { InlineLoader } from "@/components/ui/Loader";
import { formatUSD } from "@/lib/billing/subscription-state";
import { btnPrimary, btnSecondary, cardCls, errorCls, inputCls, successCls } from "@/lib/ui";

interface CryptoRow {
  id: string;
  user_id: string;
  kind: string;
  plan_id: string | null;
  addon_id: string | null;
  amount_cents: number;
  crypto_network: string;
  crypto_tx_hash: string;
  crypto_submitted_at: string;
  status: string;
}
interface PayoutRow {
  id: string;
  user_id: string;
  amount_cents: number;
  method: "bank" | "crypto";
  details: Record<string, string>;
  created_at: string;
}
interface Overview {
  crypto: CryptoRow[];
  payouts: PayoutRow[];
  logos: { id: string; user_id: string; paid_at: string }[];
  emails: Record<string, string>;
}

const KIND: Record<string, string> = {
  first_payment: "Primer pago",
  renewal: "Renovación",
  grace_catchup: "Ponerse al día (2 meses)",
  reactivation: "Reactivación (−35%)",
  addon: "Add-on",
};
const fecha = (iso: string) => new Date(iso).toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" });

export default function AdminPage() {
  const { profile, refresh } = useDashboard();
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/overview");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "No se pudo cargar." });
    setData(json as Overview);
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
  if (!data) return <InlineLoader />;

  async function act(action: string, id: string, needsText = false) {
    const text = texts[id] ?? "";
    if (needsText && !text.trim()) return setMsg({ ok: false, text: "Escribe la referencia o el motivo." });
    setBusy(id + action);
    setMsg(null);
    const res = await fetch("/api/admin/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, text }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Error" });
    setMsg({
      ok: !json.needsReview,
      text: json.needsReview
        ? "El pago quedó marcado para revisión: el estado de la cuenta cambió o el monto no coincide. Revísalo en Supabase."
        : "Listo.",
    });
    await load();
    await refresh();
  }

  const who = (id: string) => data.emails[id] ?? id;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="mt-1 text-[#4A154B]/70">Aprueba pagos con cripto y paga los retiros de referidos.</p>
      </div>
      {msg && <p className={msg.ok ? successCls : errorCls}>{msg.text}</p>}

      <section className={cardCls}>
        <h2 className="font-bold">Pagos con cripto por verificar ({data.crypto.length})</h2>
        <p className="mt-1 text-xs text-[#4A154B]/60">
          Antes de aprobar, confirma en Lulubit (o en el explorador de la red) que llegó el monto exacto con ese comprobante.
        </p>
        {data.crypto.length === 0 ? (
          <p className="mt-3 text-sm text-[#4A154B]/60">No hay pagos pendientes.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.crypto.map((p) => (
              <li key={p.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{who(p.user_id)}</span>
                  <span className="text-lg font-bold">{formatUSD(p.amount_cents)} USDT</span>
                </div>
                <p className="text-[#4A154B]/70">
                  {KIND[p.kind] ?? p.kind} {p.plan_id ? `· ${p.plan_id}` : ""} {p.addon_id ? `· ${p.addon_id}` : ""} · {fecha(p.crypto_submitted_at)}
                </p>
                <p className="mt-1">Red: {p.crypto_network}</p>
                <p className="break-all font-mono text-xs">Hash: {p.crypto_tx_hash}</p>
                <div className="mt-3 flex gap-2">
                  <button className={btnPrimary} disabled={!!busy} onClick={() => act("approve_crypto", p.id)}>
                    {busy === p.id + "approve_crypto" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprobar
                  </button>
                  <button className={btnSecondary} disabled={!!busy} onClick={() => act("reject_crypto", p.id)}>
                    <X className="h-4 w-4" /> Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="font-bold">Retiros de referidos ({data.payouts.length})</h2>
        {data.payouts.length === 0 ? (
          <p className="mt-3 text-sm text-[#4A154B]/60">No hay retiros pendientes.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.payouts.map((p) => (
              <li key={p.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{who(p.user_id)}</span>
                  <span className="text-lg font-bold">{formatUSD(p.amount_cents)}</span>
                </div>
                <p className="text-[#4A154B]/70">{p.method === "bank" ? "Transferencia bancaria" : "Cripto"} · {fecha(p.created_at)}</p>
                <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {Object.entries(p.details).map(([k, v]) => (
                    <div key={k} className="break-all"><dt className="inline font-medium capitalize">{k}: </dt><dd className="inline font-mono text-xs">{v}</dd></div>
                  ))}
                </dl>
                <input className={`${inputCls} mt-3`} placeholder="Referencia del pago o motivo del rechazo"
                  value={texts[p.id] ?? ""} onChange={(e) => setTexts({ ...texts, [p.id]: e.target.value })} />
                <div className="mt-3 flex gap-2">
                  <button className={btnPrimary} disabled={!!busy} onClick={() => act("pay_payout", p.id, true)}>
                    <Check className="h-4 w-4" /> Marcar pagado
                  </button>
                  <button className={btnSecondary} disabled={!!busy} onClick={() => act("reject_payout", p.id, true)}>
                    <X className="h-4 w-4" /> Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="font-bold">Pedidos de Logo y Paleta</h2>
        {data.logos.length === 0 ? (
          <p className="mt-3 text-sm text-[#4A154B]/60">Sin pedidos.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#D9B382]/30 text-sm">
            {data.logos.map((l) => (
              <li key={l.id} className="flex justify-between py-2"><span>{who(l.user_id)}</span><span>{l.paid_at ? fecha(l.paid_at) : ""}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
