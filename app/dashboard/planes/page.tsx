"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { AutopayCard } from "@/components/billing/AutopayCard";
import { CardReturnNotice } from "@/components/billing/CardReturnNotice";
import { YappyCheckout } from "@/components/billing/YappyCheckout";
import { InlineLoader } from "@/components/ui/Loader";
import { formatUSD } from "@/lib/billing/subscription-state";
import { fetchPublicPricing, formatDateEs, hasPromo, planFeatures, type PublicPlan } from "@/lib/pricing";
import { btnGold, errorCls } from "@/lib/ui";

export default function PlanesPage() {
  const { subscription, billing, refresh } = useDashboard();
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PublicPlan | null>(null);
  const [upgrading, setUpgrading] = useState<PublicPlan | null>(null);

  useEffect(() => {
    fetchPublicPricing()
      .then(setPlans)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // Sin suscripción (o pendiente/cancelada) se puede elegir cualquier plan; si ya tiene uno, solo renueva el suyo.
  const canChoose = !subscription || ["pending", "canceled"].includes(billing?.status ?? subscription.subscription_status);
  const isCurrent = (p: PublicPlan) => !canChoose && subscription?.plan_id === p.plan_id;
  const amountFor = (p: PublicPlan) => (isCurrent(p) && billing ? billing.amount_due_cents : p.price_cents);
  // Cambio de Básico a PRO: primer pago con 35% de descuento sobre el precio PRO de hoy, solo si está al día.
  const canUpgrade = (p: PublicPlan) =>
    !canChoose && subscription?.plan_id === "basic" && p.plan_id === "pro" && ["active", "expiring_soon"].includes(billing?.status ?? "");
  const upgradeCents = (p: PublicPlan) => Math.round(p.price_cents * 0.65);

  return (
    <div>
      <h1 className="text-2xl font-bold">Planes</h1>
      <p className="mb-8 mt-1 text-[#4A154B]/70">Paga con Yappy, tarjeta o cripto. Con tarjeta puedes activar la renovación automática. Sin contratos.</p>

      <CardReturnNotice />
      <AutopayCard />

      {loadError && <p className={errorCls}>No se pudieron cargar los planes: {loadError}</p>}

      {plans === null ? (
        !loadError && <InlineLoader />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((p) => {
            const current = isCurrent(p);
            const featured = p.plan_id === "pro";
            const upgrade = canUpgrade(p);
            const available = canChoose || current || upgrade;
            const muted = featured ? "text-[#FAF5EF]/70" : "text-[#4A154B]/60";

            // Plan actual: se muestra el precio que paga el cliente (congelado).
            const shownPrice = current && billing ? billing.plan_price_cents : p.price_cents;
            const regular = current && billing?.regular_price_cents ? billing.regular_price_cents : p.regular_cents;
            const locked = current && !!billing?.price_locked && shownPrice < regular;
            const promo = !current && hasPromo(p);

            return (
              <div key={p.plan_id}
                className={`relative rounded-3xl p-7 ${featured ? "bg-[#4A154B] text-[#FAF5EF]" : "border border-[#D9B382]/50 bg-[#FDFBF7]"}`}>
                {current && (
                  <span className="absolute right-5 top-5 rounded-full bg-[#D9B382] px-3 py-1 text-xs font-bold text-[#4A154B]">
                    Tu plan actual
                  </span>
                )}
                <p className="font-semibold">{p.name}</p>

                {(promo || locked) && (
                  <>
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#D9B382] px-3 py-1 text-xs font-bold text-[#4A154B]">
                      {locked ? <><Lock className="h-3 w-3" /> Tu precio congelado</> : <>🚀 {p.label ?? "Promoción"}</>}
                    </span>
                    <p className="mt-2 text-lg line-through opacity-60">{formatUSD(regular)}/mes</p>
                  </>
                )}
                <p className={`${promo || locked ? "" : "mt-2"} text-4xl font-bold`}>
                  {formatUSD(shownPrice)}
                  <span className="text-base font-normal opacity-70">/mes</span>
                </p>
                {promo && p.ends_on && (
                  <p className={`mt-1 text-xs ${muted}`}>
                    Válido para nuevas suscripciones hasta el {formatDateEs(p.ends_on)}. Lo conservas mientras sigas suscrito.
                  </p>
                )}
                {locked && (
                  <p className={`mt-1 text-xs ${muted}`}>Mantienes este precio mientras tu suscripción siga activa.</p>
                )}

                <ul className="mt-6 space-y-2.5 text-sm">
                  {planFeatures(p).map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className={`h-5 w-5 shrink-0 ${featured ? "text-[#D9B382]" : "text-[#8C338A]"}`} /> {f}
                    </li>
                  ))}
                </ul>

                {upgrade ? (
                  <>
                    <span className="mt-8 inline-block rounded-full bg-[#D9B382] px-3 py-1 text-xs font-bold text-[#4A154B]">
                      35% de descuento en tu primer mes PRO
                    </span>
                    <button className={`${btnGold} mt-3 w-full`} onClick={() => setUpgrading(p)}>
                      Cambiarme a PRO por {formatUSD(upgradeCents(p))}
                    </button>
                    <p className="mt-2 text-center text-xs text-[#FAF5EF]/70">
                      Pasas a PRO apenas se confirme el pago y se suman 30 días a tu fecha de vencimiento. Desde el siguiente
                      mes pagas {formatUSD(p.price_cents)}{hasPromo(p) ? " y conservas ese precio mientras sigas suscrito" : ""}.
                    </p>
                  </>
                ) : (
                  <button className={`${btnGold} mt-8 w-full`} disabled={!available} onClick={() => setSelected(p)}>
                    {current ? `Pagar ${formatUSD(amountFor(p))}` : `Elegir ${p.name}`}
                  </button>
                )}
                {!available && (
                  <p className={`mt-2 text-center text-xs ${featured ? "text-[#FAF5EF]/60" : "text-[#4A154B]/50"}`}>
                    {subscription?.plan_id === "basic" && p.plan_id === "pro"
                      ? "Ponte al día con tu pago pendiente para poder cambiarte a PRO."
                      : "Para cambiar de plan escríbenos a hola@markiapa.com."}
                  </p>
                )}
                {current && billing?.status === "active" && (
                  <p className={`mt-2 text-center text-xs ${featured ? "text-[#FAF5EF]/60" : "text-[#4A154B]/50"}`}>
                    Pagar ahora adelanta 30 días tu próxima fecha de vencimiento.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <YappyCheckout
          open={!!selected}
          onClose={() => setSelected(null)}
          title={isCurrent(selected) ? `Pagar ${selected.name}` : `Activar ${selected.name}`}
          amountLabel={formatUSD(amountFor(selected))}
          request={{ kind: "subscription", planId: selected.plan_id }}
          onPaid={refresh}
        />
      )}

      {upgrading && (
        <YappyCheckout
          open={!!upgrading}
          onClose={() => setUpgrading(null)}
          title="Cambiarme al Plan PRO"
          description={`Primer mes con 35% de descuento (luego ${formatUSD(upgrading.price_cents)} al mes).`}
          amountLabel={formatUSD(upgradeCents(upgrading))}
          request={{ kind: "upgrade" }}
          onPaid={refresh}
        />
      )}
    </div>
  );
}
