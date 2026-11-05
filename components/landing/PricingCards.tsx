"use client";

// Tarjetas de planes de la página de inicio. Lee los precios de la base de datos,
// así que cualquier cambio desde Administración → Precios se ve aquí al instante.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { formatUSD } from "@/lib/billing/subscription-state";
import { fetchPublicPricing, formatDateEs, hasPromo, planFeatures, type PublicPlan } from "@/lib/pricing";
import { btnGold, btnPrimary } from "@/lib/ui";

export function PricingCards() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchPublicPricing().then(setPlans).catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p className="mt-10 text-center text-[#4A154B]/70">
        No pudimos cargar los precios. <Link href="/registro" className="font-semibold underline">Crea tu cuenta</Link> para verlos.
      </p>
    );
  }

  if (!plans) {
    return (
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-[30rem] animate-pulse rounded-3xl bg-[#4A154B]/5" />
        ))}
      </div>
    );
  }

  const promoEnd = plans.find((p) => hasPromo(p) && p.ends_on)?.ends_on;

  return (
    <>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {plans.map((p) => {
          const featured = p.plan_id === "pro";
          const promo = hasPromo(p);
          return (
            <div key={p.plan_id}
              className={`rounded-3xl p-7 ${featured ? "bg-[#4A154B] text-[#FAF5EF] shadow-2xl" : "border border-[#D9B382]/50 bg-[#FDFBF7]"}`}>
              <p className="font-semibold">{p.name}</p>
              {promo && (
                <>
                  <span className="mt-3 inline-block rounded-full bg-[#D9B382] px-3 py-1 text-xs font-bold text-[#4A154B]">
                    🚀 {p.label ?? "Promoción"}
                  </span>
                  <p className="mt-2 text-lg line-through opacity-60">{formatUSD(p.regular_cents)}/mes</p>
                </>
              )}
              <p className={`${promo ? "" : "mt-2"} text-5xl font-bold`}>
                {formatUSD(p.price_cents)}<span className="text-base font-normal opacity-70">/mes</span>
              </p>
              {promo && <p className="mt-1 text-xs opacity-70">Tu precio se mantiene mientras sigas suscrito.</p>}
              <ul className="mt-6 space-y-2.5 text-sm">
                {planFeatures(p).map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className={`h-5 w-5 shrink-0 ${featured ? "text-[#D9B382]" : "text-[#8C338A]"}`} /> {i}
                  </li>
                ))}
              </ul>
              <Link href="/registro" className={`${featured ? btnGold : btnPrimary} mt-8 w-full`}>Elegir {p.name}</Link>
            </div>
          );
        })}
      </div>
      {promoEnd && (
        <p className="mt-4 text-center text-xs text-[#4A154B]/60">
          Precio promocional válido para nuevas suscripciones hasta el {formatDateEs(promoEnd)}. Los clientes suscritos
          conservan su precio mientras su suscripción siga activa. <Link href="/legal/terminos" className="underline">Ver términos</Link>.
        </p>
      )}
    </>
  );
}
