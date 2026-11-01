"use client";

// Pago manual con cripto (USDT) hacia la cuenta de Lulubit del negocio.
import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2 } from "lucide-react";
import type { CheckoutRequest } from "@/components/billing/YappyCheckout";
import { formatUSD } from "@/lib/billing/subscription-state";
import { btnPrimary, errorCls, inputCls, labelCls } from "@/lib/ui";

interface Wallet {
  network: string;
  address: string;
}

export function CryptoPay({ request }: { request: CheckoutRequest }) {
  const [order, setOrder] = useState<{ paymentId: string; amountCents: number; wallets: Wallet[] } | null>(null);
  const [wallet, setWallet] = useState(0);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crypto/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear la orden.");
      setOrder(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la orden.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!order) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/crypto/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: order.paymentId, network: order.wallets[wallet].network, txHash }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(json.error ?? "No se pudo registrar el comprobante.");
    setSent(true);
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (sent) {
    return (
      <div className="mt-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-2 font-semibold">¡Comprobante recibido!</p>
        <p className="mt-1 text-sm text-[#4A154B]/70">
          Verificaremos tu pago en un máximo de 24 horas. Tu plan o compra se activará automáticamente.
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mt-5 space-y-3">
        <p className="text-sm text-[#4A154B]/75">
          Pagas en <strong>USDT</strong> desde tu billetera o exchange. La confirmación es manual y puede tardar hasta 24 horas.
        </p>
        {error && <p className={errorCls}>{error}</p>}
        <button className={`${btnPrimary} w-full`} onClick={start} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Ver datos para pagar
        </button>
      </div>
    );
  }

  const w = order.wallets[wallet];
  const amount = (order.amountCents / 100).toFixed(2);

  return (
    <div className="mt-5 space-y-4 text-sm">
      {order.wallets.length > 1 && (
        <div>
          <label className={labelCls}>Red</label>
          <select className={inputCls} value={wallet} onChange={(e) => setWallet(Number(e.target.value))}>
            {order.wallets.map((x, i) => <option key={x.network} value={i}>{x.network}</option>)}
          </select>
        </div>
      )}

      <div className="rounded-2xl bg-[#FAF5EF] p-4">
        <p className="text-xs text-[#4A154B]/60">Envía exactamente</p>
        <button className="flex w-full items-center justify-between font-mono text-lg font-bold" onClick={() => copy(amount, "amt")}>
          {amount} USDT {copied === "amt" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        <p className="mt-3 text-xs text-[#4A154B]/60">Red: <strong>{w.network}</strong></p>
        <p className="mt-1 text-xs text-[#4A154B]/60">A esta dirección</p>
        <button className="flex w-full items-start justify-between gap-2 break-all text-left font-mono text-xs" onClick={() => copy(w.address, "addr")}>
          {w.address} {copied === "addr" ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
        </button>
      </div>

      <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Usa solo la red indicada. Si envías por otra red, los fondos se pueden perder. La comisión de red la pagas tú. Total
        en dólares: {formatUSD(order.amountCents)}.
      </p>

      <div>
        <label className={labelCls}>Pega el comprobante (hash o ID de la transacción)</label>
        <input className={`${inputCls} font-mono text-xs`} value={txHash} onChange={(e) => setTxHash(e.target.value)}
          placeholder="Ej. 9f3c…a1b2" />
      </div>
      {error && <p className={errorCls}>{error}</p>}
      <button className={`${btnPrimary} w-full`} onClick={submit} disabled={loading || txHash.trim().length < 10}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Ya envié el pago
      </button>
    </div>
  );
}
