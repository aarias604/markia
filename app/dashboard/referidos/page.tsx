"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Gift, Loader2, Wallet } from "lucide-react";
import { InlineLoader } from "@/components/ui/Loader";
import { formatUSD } from "@/lib/billing/subscription-state";
import { LEGAL, REGLAS } from "@/lib/legal";
import { createClient } from "@/lib/supabase/client";
import { btnGold, btnPrimary, cardCls, errorCls, inputCls, labelCls, successCls } from "@/lib/ui";

interface Summary {
  code: string;
  joined_at: string;
  referrals_count: number;
  pending_cents: number;
  available_cents: number;
  in_payout_cents: number;
  paid_cents: number;
}
interface Commission {
  id: string;
  amount_cents: number;
  base_cents: number;
  status: string;
  available_at: string;
  created_at: string;
}
interface Payout {
  id: string;
  amount_cents: number;
  method: string;
  status: string;
  reference: string | null;
  admin_note: string | null;
  created_at: string;
}

const MIN_CENTS = Math.round(Number(REGLAS.retiroMinimo) * 100);
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" });

const COMMISSION_LABEL: Record<string, string> = {
  earned: "Ganada",
  in_payout: "En retiro",
  paid: "Pagada",
  reversed: "Anulada",
};
const PAYOUT_LABEL: Record<string, string> = { requested: "En proceso", paid: "Pagado", rejected: "Rechazado" };

export default function ReferidosPage() {
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: s, error: e }, { data: c }, { data: p }] = await Promise.all([
      supabase.rpc("get_referral_summary").maybeSingle(),
      supabase.from("referral_commissions").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("payout_requests").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (e) setError(e.message);
    setSummary((s as Summary | null) ?? null);
    setCommissions((c as Commission[]) ?? []);
    setPayouts((p as Payout[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (summary === undefined) return <InlineLoader />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Programa de referidos</h1>
        <p className="mt-1 text-[#4A154B]/70">
          Gana el {REGLAS.referidoPorcentaje}% de cada mensualidad que paguen las personas que se registren con tu enlace.
        </p>
      </div>
      {error && <p className={errorCls}>{error}</p>}
      {summary ? (
        <MemberView summary={summary} commissions={commissions} payouts={payouts} reload={load} />
      ) : (
        <JoinView onJoined={load} />
      )}
    </div>
  );
}

function JoinView({ onJoined }: { onJoined: () => Promise<void> }) {
  const [checks, setChecks] = useState([false, false, false]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = [
    <>He leído y acepto los <Link href="/legal/referidos" target="_blank" className="font-semibold underline">Términos y Acuerdo del Programa de Referidos</Link>.</>,
    <>Soy mayor de 18 años y participo como referente independiente, sin relación laboral con {LEGAL.marca}.</>,
    <>Entiendo que soy responsable de declarar mis comisiones y que no se permite el spam ni las promesas falsas.</>,
  ];

  async function join() {
    setLoading(true);
    setError(null);
    const { error } = await createClient().rpc("join_referral_program", { p_terms_version: LEGAL.version });
    setLoading(false);
    if (error) return setError(error.message);
    await onJoined();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className={cardCls}>
        <Gift className="h-8 w-8 text-[#8C338A]" />
        <h2 className="mt-3 text-xl font-bold">Así funciona</h2>
        <ol className="mt-4 space-y-3 text-sm">
          <li><strong>1.</strong> Te unes y recibes tu enlace personal.</li>
          <li><strong>2.</strong> Lo compartes con negocios y creadores que necesiten contenido.</li>
          <li><strong>3.</strong> Cuando pagan su plan, ganas el {REGLAS.referidoPorcentaje}% de cada mensualidad, mientras sigan pagando.</li>
          <li><strong>4.</strong> Cada comisión se libera a los {REGLAS.referidoEsperaDias} días. Desde US${REGLAS.retiroMinimo} disponibles, pides tu retiro por banco o cripto.</li>
        </ol>
        <p className="mt-4 rounded-xl bg-[#FAF5EF] p-3 text-xs text-[#4A154B]/70">
          Ejemplo: 5 referidos en Plan PRO pagando $22.99 te generan $11.50 al mes.
        </p>
      </div>
      <div className={`${cardCls} space-y-4`}>
        <h2 className="font-bold">Acuerdo de participación</h2>
        {items.map((label, i) => (
          <label key={i} className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#4A154B]" checked={checks[i]}
              onChange={(e) => setChecks((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />
            <span>{label}</span>
          </label>
        ))}
        {error && <p className={errorCls}>{error}</p>}
        <button className={`${btnGold} w-full`} disabled={!checks.every(Boolean) || loading} onClick={join}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Unirme al programa
        </button>
      </div>
    </div>
  );
}

function MemberView({
  summary,
  commissions,
  payouts,
  reload,
}: {
  summary: Summary;
  commissions: Commission[];
  payouts: Payout[];
  reload: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/registro?ref=${summary.code}`;
  const openPayout = payouts.some((p) => p.status === "requested");

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const stats = [
    { label: "Referidos registrados", value: String(summary.referrals_count) },
    { label: `Pendiente (${REGLAS.referidoEsperaDias} días)`, value: formatUSD(summary.pending_cents) },
    { label: "Disponible para retirar", value: formatUSD(summary.available_cents), strong: true },
    { label: "Ya cobrado", value: formatUSD(summary.paid_cents) },
  ];

  return (
    <div className="space-y-8">
      <div className={`${cardCls} space-y-3`}>
        <p className="text-sm font-semibold">Tu enlace para compartir</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly className={`${inputCls} font-mono text-xs`} value={link} />
          <button className={btnPrimary} onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copiado" : "Copiar enlace"}
          </button>
        </div>
        <p className="text-xs text-[#4A154B]/60">También pueden escribir tu código <strong>{summary.code}</strong> al final de la dirección de registro.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${cardCls} ${s.strong ? "ring-2 ring-[#D9B382]" : ""}`}>
            <p className="text-sm text-[#4A154B]/70">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {summary.in_payout_cents > 0 && (
        <p className={successCls}>Tienes {formatUSD(summary.in_payout_cents)} en proceso de pago (máximo {REGLAS.pagoRetiroDiasHabiles} días hábiles).</p>
      )}

      <PayoutForm available={summary.available_cents} blocked={openPayout} onDone={reload} />

      <section className={cardCls}>
        <h2 className="font-bold">Comisiones</h2>
        {commissions.length === 0 ? (
          <p className="mt-3 text-sm text-[#4A154B]/60">Aún no tienes comisiones. ¡Comparte tu enlace!</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[#4A154B]/60"><th className="py-2">Fecha</th><th>Pago del referido</th><th>Comisión</th><th>Estado</th></tr></thead>
              <tbody>
                {commissions.map((c) => {
                  const pending = c.status === "earned" && new Date(c.available_at) > new Date();
                  return (
                    <tr key={c.id} className="border-t border-[#D9B382]/30">
                      <td className="py-2">{fecha(c.created_at)}</td>
                      <td>{formatUSD(c.base_cents)}</td>
                      <td className="font-semibold">{formatUSD(c.amount_cents)}</td>
                      <td>{pending ? `Disponible el ${fecha(c.available_at)}` : COMMISSION_LABEL[c.status] ?? c.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {payouts.length > 0 && (
        <section className={cardCls}>
          <h2 className="font-bold">Mis retiros</h2>
          <ul className="mt-3 divide-y divide-[#D9B382]/30 text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{fecha(p.created_at)} · {p.method === "bank" ? "Banco" : "Cripto"}</span>
                <span className="font-semibold">{formatUSD(p.amount_cents)}</span>
                <span>
                  {PAYOUT_LABEL[p.status] ?? p.status}
                  {p.reference ? ` · Ref. ${p.reference}` : ""}
                  {p.admin_note ? ` · ${p.admin_note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PayoutForm({ available, blocked, onDone }: { available: number; blocked: boolean; onDone: () => Promise<void> }) {
  const [method, setMethod] = useState<"bank" | "crypto">("bank");
  const [bank, setBank] = useState({ banco: "", tipo: "Ahorros", numero: "", titular: "", identificacion: "" });
  const [crypto, setCrypto] = useState({ red: "USDT · Tron (TRC20)", direccion: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const canRequest = available >= MIN_CENTS && !blocked;

  async function request() {
    setLoading(true);
    setError(null);
    const { error } = await createClient().rpc("request_payout", {
      p_method: method,
      p_details: method === "bank" ? bank : crypto,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setOk(true);
    await onDone();
  }

  return (
    <section className={cardCls}>
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-[#8C338A]" />
        <h2 className="font-bold">Solicitar retiro</h2>
      </div>
      {ok && <p className={`${successCls} mt-3`}>Solicitud enviada. Te pagaremos en máximo {REGLAS.pagoRetiroDiasHabiles} días hábiles.</p>}
      {!canRequest ? (
        <p className="mt-3 text-sm text-[#4A154B]/70">
          {blocked
            ? "Ya tienes un retiro en proceso. Podrás pedir otro cuando se complete."
            : `Necesitas al menos US$${REGLAS.retiroMinimo} disponibles. Te faltan ${formatUSD(MIN_CENTS - available)}.`}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm">Retirarás <strong>{formatUSD(available)}</strong> (todo tu saldo disponible).</p>
          <div className="grid max-w-sm grid-cols-2 gap-1 rounded-full bg-[#4A154B]/5 p-1 text-sm font-semibold">
            {(["bank", "crypto"] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`rounded-full py-2 ${method === m ? "bg-white shadow" : "text-[#4A154B]/60"}`}>
                {m === "bank" ? "Cuenta bancaria" : "Cripto (USDT)"}
              </button>
            ))}
          </div>

          {method === "bank" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={labelCls}>Banco</label><input className={inputCls} value={bank.banco} onChange={(e) => setBank({ ...bank, banco: e.target.value })} placeholder="Banco General" /></div>
              <div>
                <label className={labelCls}>Tipo de cuenta</label>
                <select className={inputCls} value={bank.tipo} onChange={(e) => setBank({ ...bank, tipo: e.target.value })}>
                  <option>Ahorros</option><option>Corriente</option>
                </select>
              </div>
              <div><label className={labelCls}>Número de cuenta</label><input className={inputCls} value={bank.numero} onChange={(e) => setBank({ ...bank, numero: e.target.value })} /></div>
              <div><label className={labelCls}>Titular de la cuenta</label><input className={inputCls} value={bank.titular} onChange={(e) => setBank({ ...bank, titular: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Cédula o RUC del titular</label><input className={inputCls} value={bank.identificacion} onChange={(e) => setBank({ ...bank, identificacion: e.target.value })} /></div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div>
                <label className={labelCls}>Red</label>
                <select className={inputCls} value={crypto.red} onChange={(e) => setCrypto({ ...crypto, red: e.target.value })}>
                  <option>USDT · Tron (TRC20)</option><option>USDT · Ethereum (ERC20)</option><option>USDT · BNB Smart Chain (BEP20)</option><option>USDT · Polygon</option>
                </select>
              </div>
              <div><label className={labelCls}>Dirección de tu billetera</label><input className={`${inputCls} font-mono text-xs`} value={crypto.direccion} onChange={(e) => setCrypto({ ...crypto, direccion: e.target.value.trim() })} /></div>
              <p className="text-xs text-amber-800">Revisa que la dirección sea de la misma red. Un envío a una dirección o red equivocada no se puede recuperar.</p>
            </div>
          )}

          {error && <p className={errorCls}>{error}</p>}
          <button className={btnPrimary} onClick={request} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Solicitar retiro de {formatUSD(available)}
          </button>
        </div>
      )}
    </section>
  );
}
