"use client";

// Estado del cobro automático con tarjeta y botón para cancelarlo.
import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { formatUSD } from "@/lib/billing/subscription-state";
import { formatDateEs } from "@/lib/pricing";
import { btnSecondary, cardCls, errorCls } from "@/lib/ui";

export function AutopayCard() {
  const { autopay, refresh } = useDashboard();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!autopay) return null;

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tilopay/cancelar", { method: "POST" });
    setBusy(false);
    if (!res.ok) return setError("No se pudo cancelar. Inténtalo de nuevo o escríbenos a hola@markiapa.com.");
    setConfirm(false);
    await refresh();
  }

  return (
    <div className={`${cardCls} mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
      <div>
        <p className="flex items-center gap-2 font-semibold">
          <CreditCard className="h-5 w-5 text-[#8C338A]" /> Cobro automático con tarjeta activo
          {autopay.card_last4 && (
            <span className="text-sm font-normal text-[#4A154B]/70">· {autopay.card_brand ?? "Tarjeta"} terminada en {autopay.card_last4}</span>
          )}
        </p>
        <p className="mt-1 text-sm text-[#4A154B]/70">
          {autopay.next_charge_date
            ? <>Próximo cobro: <strong>{formatUSD(autopay.monthly_price_cents)}</strong> el {formatDateEs(autopay.next_charge_date)}. </>
            : null}
          {autopay.remaining != null && autopay.last_charge_date
            ? <>Quedan {autopay.remaining} cobro(s) programados, hasta el {formatDateEs(autopay.last_charge_date)}.</>
            : <>Se renueva cada mes hasta que lo canceles.</>}
        </p>
        {error && <p className={`${errorCls} mt-2`}>{error}</p>}
      </div>
      {confirm ? (
        <div className="flex gap-2">
          <button className={`${btnSecondary} text-red-700`} onClick={cancel} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sí, cancelar
          </button>
          <button className={btnSecondary} onClick={() => setConfirm(false)} disabled={busy}>No</button>
        </div>
      ) : (
        <button className={btnSecondary} onClick={() => setConfirm(true)}>Cancelar cobro automático</button>
      )}
    </div>
  );
}
