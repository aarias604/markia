"use client";

// Pago con tarjeta de crédito o débito (Pagadito). Lleva al cliente a la pantalla segura de Pagadito.
import { useState } from "react";
import { CreditCard, Loader2, Lock, RefreshCw } from "lucide-react";
import type { CheckoutRequest } from "@/components/billing/YappyCheckout";
import { errorCls } from "@/lib/ui";

export function CardPay({ request }: { request: CheckoutRequest }) {
  const recurring = request.kind !== "addon";
  const [autopay, setAutopay] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pagadito/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, autopay: recurring && autopay }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "No se pudo iniciar el pago.");
      window.location.assign(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      {recurring && (
        <label className="flex items-start gap-2 rounded-2xl bg-[#FAF5EF] p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4A154B]" checked={autopay} onChange={(e) => setAutopay(e.target.checked)} />
          <span>
            <strong className="flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Renovar automáticamente cada mes</strong>
            <span className="text-xs text-[#4A154B]/70">
              Cobraremos tu mensualidad a esta tarjeta en cada fecha de pago. Puedes cancelarlo cuando quieras desde Planes.
            </span>
          </span>
        </label>
      )}
      <button onClick={pay} disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#4A154B] px-5 py-3 text-sm font-bold text-[#FAF5EF] hover:bg-[#6B21A8] disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {loading ? "Abriendo Pagadito…" : "Pagar con tarjeta"}
      </button>
      <p className="flex items-center justify-center gap-1 text-center text-xs text-[#4A154B]/60">
        <Lock className="h-3 w-3" /> Pago seguro con Pagadito. Markia nunca ve ni guarda los datos de tu tarjeta.
      </p>
      {error && <p className={errorCls}>{error}</p>}
    </div>
  );
}
