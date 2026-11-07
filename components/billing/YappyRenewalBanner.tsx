"use client";

// =====================================================================
// Markia · Banner de vencimiento + Modal de reactivación (Yappy)
// Se muestra arriba del dashboard según get_my_billing():
//   expiring_soon → aviso morado (5 días antes)
//   grace_period  → advertencia ámbar (debe 2 meses)
//   suspended     → rojo + modal con 35 % de descuento
// =====================================================================

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BellRing, Lock, Sparkles, X } from "lucide-react";
import { YappyCheckout } from "@/components/billing/YappyCheckout";
import { formatUSD, type BillingRow } from "@/lib/billing/subscription-state";

type Variant = "expiring_soon" | "grace_period" | "suspended";

const STYLES: Record<Variant, { wrap: string; icon: string; button: string }> = {
  expiring_soon: {
    wrap: "bg-[#4A154B] text-[#FAF5EF] border-b-2 border-[#D9B382]",
    icon: "bg-[#D9B382]/20 text-[#D9B382]",
    button: "bg-[#D9B382] text-[#4A154B] hover:bg-[#e6c79e]",
  },
  grace_period: {
    wrap: "bg-amber-50 text-amber-950 border-b-2 border-amber-400",
    icon: "bg-amber-200 text-amber-800",
    button: "bg-[#4A154B] text-[#FAF5EF] hover:bg-[#6B21A8]",
  },
  suspended: {
    wrap: "bg-red-50 text-red-950 border-b-2 border-red-500",
    icon: "bg-red-200 text-red-800",
    button: "bg-[#4A154B] text-[#FAF5EF] hover:bg-[#6B21A8]",
  },
};

function diasTexto(n: number) {
  if (n === 0) return "hoy";
  if (n === 1) return "mañana (1 día)";
  return `en ${n} días`;
}

export function YappyRenewalBanner({
  billing,
  onPaid,
  autopayDate,
}: {
  billing: BillingRow;
  onPaid?: () => void | Promise<void>;
  /** Fecha del próximo cobro automático con tarjeta, si está activo. */
  autopayDate?: string | null;
}) {
  const [offerOpen, setOfferOpen] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  if (!billing.show_banner) return null;
  const variant = billing.status as Variant;
  if (!(variant in STYLES)) return null;

  const s = STYLES[variant];
  const monthly = formatUSD(billing.plan_price_cents);
  const due = formatUSD(billing.amount_due_cents);

  let Icon = BellRing;
  let title = "";
  let detail = "";
  let cta = "Renovar ahora";

  if (variant === "expiring_soon" && autopayDate) {
    // Cobro automático activo: solo informamos.
    const [y, m, d] = autopayDate.split("-").map(Number);
    const when = new Date(y, m - 1, d).toLocaleDateString("es-PA", { day: "numeric", month: "long" });
    return (
      <div role="status" className={`w-full ${s.wrap}`}>
        <p className="mx-auto max-w-7xl px-4 py-2.5 text-sm sm:px-6">
          💳 Tu {billing.plan_name} se renovará solo: el {when} cobraremos {monthly} a tu tarjeta.
        </p>
      </div>
    );
  }

  if (variant === "expiring_soon") {
    title = `Tu ${billing.plan_name} vence ${diasTexto(billing.days_until_due ?? 0)}`;
    detail = `Renueva ahora por ${monthly} y suma 30 días a tu fecha de vencimiento.`;
  } else if (variant === "grace_period") {
    Icon = AlertTriangle;
    title = `Tienes 1 mes vencido (${monthly}). Paga antes de 30 días para evitar suspensión.`;
    detail = `Para ponerte al día pagas 2 meses (vencido + entrante): ${due}. Te quedan ${billing.days_left_in_grace ?? 0} día(s) de gracia.`;
    cta = `Pagar ${due}`;
  } else {
    Icon = Lock;
    title = "Tu cuenta está suspendida";
    detail = "El generador de publicaciones está bloqueado. Reactiva con 35 % de descuento.";
    cta = "Ver oferta de reactivación";
  }

  const checkoutTitle =
    variant === "suspended" ? "Reactivar tu cuenta" : variant === "grace_period" ? "Ponerte al día" : `Renovar ${billing.plan_name}`;

  return (
    <>
      <motion.div
        role={variant === "expiring_soon" ? "status" : "alert"}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className={`sticky top-0 z-40 w-full ${s.wrap}`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.icon}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-snug sm:text-base">{title}</p>
              <p className="text-xs opacity-80 sm:text-sm">{detail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (variant === "suspended" ? setOfferOpen(true) : setCheckoutOpen(true))}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-md transition ${s.button}`}
          >
            {cta}
          </button>
        </div>
      </motion.div>

      {variant === "suspended" && (
        <ReactivationOffer
          open={offerOpen && !checkoutOpen}
          onClose={() => setOfferOpen(false)}
          billing={billing}
          onPay={() => setCheckoutOpen(true)}
        />
      )}

      <YappyCheckout
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={checkoutTitle}
        description={variant === "suspended" ? "Incluye 35 % de descuento sobre los 2 meses acumulados." : undefined}
        amountLabel={due}
        request={{ kind: "subscription" }}
        onPaid={onPaid}
      />
    </>
  );
}

function ReactivationOffer({
  open,
  onClose,
  billing,
  onPay,
}: {
  open: boolean;
  onClose: () => void;
  billing: BillingRow;
  onPay: () => void;
}) {
  const original = billing.plan_price_cents * 2;
  const savings = original - billing.amount_due_cents;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#4A154B]/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reactivation-title"
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#FDFBF7] shadow-2xl"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-[#4A154B] via-[#6B21A8] to-[#8C338A] px-6 pb-8 pt-6 text-[#FAF5EF]">
              <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 rounded-full p-1.5 text-[#FAF5EF]/80 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D9B382] px-3 py-1 text-xs font-bold text-[#4A154B]">
                <Sparkles className="h-3.5 w-3.5" /> Oferta especial · 35 % OFF
              </span>
              <h2 id="reactivation-title" className="mt-3 text-2xl font-bold">Reactiva tu cuenta Markia</h2>
              <p className="mt-1 text-sm text-[#FAF5EF]/80">
                Vuelve a generar contenido con tu marca hoy mismo y queda al día con tu {billing.plan_name}.
              </p>
            </div>

            <div className="space-y-4 px-6 py-6">
              <dl className="space-y-2 rounded-2xl border border-[#D9B382]/40 bg-[#FAF5EF] p-4 text-sm text-[#4A154B]">
                <div className="flex justify-between">
                  <dt>Saldo acumulado (2 meses)</dt>
                  <dd className="line-through opacity-60">{formatUSD(original)}</dd>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <dt>Descuento de reactivación (35 %)</dt>
                  <dd>−{formatUSD(savings)}</dd>
                </div>
                <div className="flex justify-between border-t border-[#D9B382]/40 pt-2 text-lg font-bold">
                  <dt>Total a pagar</dt>
                  <dd>{formatUSD(billing.amount_due_cents)}</dd>
                </div>
              </dl>
              <button
                onClick={onPay}
                className="w-full rounded-full bg-[#4A154B] px-5 py-3 text-sm font-bold text-[#FAF5EF] hover:bg-[#6B21A8]"
              >
                Reactivar por {formatUSD(billing.amount_due_cents)}
              </button>
              <p className="text-center text-xs text-[#4A154B]/60">
                Al confirmarse el pago tu cuenta se reactiva automáticamente.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default YappyRenewalBanner;
