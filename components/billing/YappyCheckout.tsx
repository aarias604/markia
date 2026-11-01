"use client";

// Ventana de pago con el botón oficial de Yappy (<btn-yappy>).
// 1) Al tocar el botón, crea la orden en /api/yappy/create-order.
// 2) Yappy cobra en el celular del cliente.
// 3) Esperamos la confirmación (IPN) consultando /api/yappy/status.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, Loader2, Smartphone, X } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { errorCls, inputCls, labelCls } from "@/lib/ui";

function cleanPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").replace(/^507/, "");
  return /^6\d{7}$/.test(digits) ? digits : null;
}

const CDN =
  process.env.NEXT_PUBLIC_YAPPY_ENV === "prod"
    ? "https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js"
    : "https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js";

export type CheckoutRequest = { kind: "subscription"; planId?: string } | { kind: "addon"; addonId: string };

type YappyButton = HTMLElement & {
  eventPayment?: (p: { transactionId: string; documentName: string; token: string }) => void;
  isButtonLoading?: boolean;
};

type Stage = "ready" | "confirming" | "done" | "review" | "timeout";

function loadYappyScript() {
  if (document.getElementById("yappy-btn-script")) return;
  const s = document.createElement("script");
  s.id = "yappy-btn-script";
  s.type = "module";
  s.src = CDN;
  document.head.appendChild(s);
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  amountLabel: string;
  request: CheckoutRequest;
  onPaid?: () => void | Promise<void>;
}

export function YappyCheckout({ open, onClose, title, description, amountLabel, request, onPaid }: Props) {
  const { profile } = useDashboard();
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const phoneRef = useRef(phone);
  const holder = useRef<HTMLDivElement>(null);
  const requestRef = useRef(request);
  const paymentId = useRef<string | null>(null);
  const onPaidRef = useRef(onPaid);
  const [stage, setStage] = useState<Stage>("ready");
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    requestRef.current = request;
    onPaidRef.current = onPaid;
    phoneRef.current = phone;
  });

  useEffect(() => {
    if (!open) return;
    setStage("ready");
    setError(null);
    paymentId.current = null;
    loadYappyScript();

    const container = holder.current;
    if (!container) return;
    const btn = document.createElement("btn-yappy") as YappyButton;
    btn.setAttribute("theme", "darkBlue");
    btn.setAttribute("rounded", "true");
    container.innerHTML = "";
    container.appendChild(btn);

    let cancelled = false;

    async function waitForConfirmation() {
      setStage("confirming");
      for (let i = 0; i < 40 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!paymentId.current) continue;
        const res = await fetch(`/api/yappy/status?id=${paymentId.current}`).catch(() => null);
        const json = (await res?.json().catch(() => null)) as { applied?: boolean; needsReview?: boolean } | null;
        if (json?.needsReview) return setStage("review");
        if (json?.applied) {
          setStage("done");
          await onPaidRef.current?.();
          return;
        }
      }
      if (!cancelled) setStage("timeout");
    }

    const onClick = async () => {
      setError(null);
      const validPhone = cleanPhone(phoneRef.current);
      if (!validPhone) {
        setError("Escribe tu número de celular de Yappy: 8 dígitos que empiezan con 6.");
        return;
      }
      btn.isButtonLoading = true;
      try {
        const res = await fetch("/api/yappy/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...requestRef.current, phone: validPhone }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          transactionId?: string;
          documentName?: string;
          token?: string;
          paymentId?: string;
        };
        if (!res.ok || !json.transactionId) throw new Error(json.error ?? "No se pudo iniciar el pago.");
        paymentId.current = json.paymentId ?? null;
        btn.eventPayment?.({
          transactionId: json.transactionId,
          documentName: json.documentName ?? "",
          token: json.token ?? "",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
      } finally {
        btn.isButtonLoading = false;
      }
    };
    const onSuccess = () => void waitForConfirmation();
    const onError = () => setError("El pago no se completó. Puedes intentarlo de nuevo.");
    const onOnline = (e: Event) => setOffline((e as CustomEvent).detail === false);

    btn.addEventListener("eventClick", onClick);
    btn.addEventListener("eventSuccess", onSuccess);
    btn.addEventListener("eventError", onError);
    btn.addEventListener("isYappyOnline", onOnline);

    return () => {
      cancelled = true;
      btn.removeEventListener("eventClick", onClick);
      btn.removeEventListener("eventSuccess", onSuccess);
      btn.removeEventListener("eventError", onError);
      btn.removeEventListener("isYappyOnline", onOnline);
      btn.remove();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#4A154B]/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={stage === "confirming" ? undefined : onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-3xl bg-[#FDFBF7] p-6 text-[#4A154B] shadow-2xl"
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-[#4A154B]/5">
              <X className="h-5 w-5" />
            </button>

            <h2 className="pr-8 text-xl font-bold">{title}</h2>
            {description && <p className="mt-1 text-sm text-[#4A154B]/70">{description}</p>}

            <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-[#FAF5EF] px-4 py-3">
              <span className="text-sm">Total a pagar</span>
              <span className="text-2xl font-bold">{amountLabel}</span>
            </div>

            <div className={stage === "ready" ? "mt-5" : "hidden"}>
              <label htmlFor="yappy-phone" className={labelCls}>Tu número de celular con Yappy</label>
              <div className="relative">
                <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A154B]/40" />
                <input
                  id="yappy-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={9}
                  placeholder="6000-0000"
                  className={`${inputCls} pl-9 text-base tracking-wide`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div ref={holder} className="mt-5 flex min-h-12 justify-center" />
              <p className="mt-3 text-center text-xs text-[#4A154B]/60">
                Te llegará una solicitud de pago a tu app de Yappy. Ábrela y confírmala.
              </p>
            </div>

            {stage === "confirming" && (
              <p className="mt-6 flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-5 w-5 animate-spin" /> Confirmando tu pago con Yappy…
              </p>
            )}
            {stage === "done" && (
              <div className="mt-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <p className="mt-2 font-semibold">¡Pago confirmado!</p>
                <button onClick={onClose} className="mt-4 rounded-full bg-[#4A154B] px-5 py-2 text-sm font-semibold text-[#FAF5EF]">
                  Listo
                </button>
              </div>
            )}
            {(stage === "review" || stage === "timeout") && (
              <div className="mt-6 text-center text-sm">
                <Clock className="mx-auto h-8 w-8 text-amber-600" />
                <p className="mt-2">
                  {stage === "review"
                    ? "Recibimos tu pago y lo estamos revisando. Te avisaremos por correo."
                    : "Yappy aún no confirma el pago. Si ya pagaste, se aplicará en unos minutos; recarga la página más tarde."}
                </p>
              </div>
            )}

            {offline && stage === "ready" && (
              <p className="mt-4 text-center text-xs text-amber-700">Yappy no está disponible en este momento.</p>
            )}
            {error && <p className={`${errorCls} mt-4`}>{error}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
