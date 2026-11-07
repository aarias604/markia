"use client";

// Mensaje al volver de la pantalla de pago de Pagadito (?tarjeta=ok|revision|fallido|error).
import { useEffect, useState } from "react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { errorCls, successCls } from "@/lib/ui";

const TEXT: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "¡Pago con tarjeta confirmado! Te enviamos el comprobante a tu correo." },
  revision: { ok: true, text: "Recibimos tu pago con tarjeta y lo estamos confirmando con Pagadito. Se aplicará en unos minutos." },
  fallido: { ok: false, text: "El pago con tarjeta no se completó. No se hizo ningún cargo. Puedes intentarlo de nuevo." },
  error: { ok: false, text: "No pudimos verificar el pago con tarjeta. Si se hizo el cargo, se aplicará en la próxima hora." },
};

export function CardReturnNotice() {
  const { refresh } = useDashboard();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const r = sp.get("tarjeta");
    if (!r) return;
    setMsg(TEXT[r] ?? TEXT.error);
    window.history.replaceState(null, "", window.location.pathname);
    void refresh();
  }, [refresh]);

  if (!msg) return null;
  return <p className={`${msg.ok ? successCls : errorCls} mb-6`}>{msg.text}</p>;
}
