"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { YappyCheckout } from "@/components/billing/YappyCheckout";
import { InlineLoader } from "@/components/ui/Loader";
import { formatUSD } from "@/lib/billing/subscription-state";
import { createClient } from "@/lib/supabase/client";
import type { Plan } from "@/lib/types";
import { btnGold } from "@/lib/ui";

// Precio normal (se muestra tachado mientras dure el precio de lanzamiento).
const PRECIO_REGULAR: Record<string, number> = { basic: 1900, pro: 3900 };

function features(p: Plan) {
  const carruseles = p.monthly_carousels ?? 0;
  const list = [
    `${p.monthly_posts} publicaciones con IA al mes`,
    `${carruseles} carrusel${carruseles === 1 ? "" : "es"} con IA al mes`,
    `${p.generic_templates} plantillas de diseño`,
    "Descripción sugerida y hashtags en cada publicación",
    "Calendario de contenido",
    "Descarga de imágenes en PNG",
  ];
  if (p.custom_templates > 0) list.push(`${p.custom_templates} plantillas personalizadas propias`);
  if (p.instagram_autopost) list.push("Publicación automática en Instagram (próximamente)");
  return list;
}

export default function PlanesPage() {
  const { subscription, billing, refresh } = useDashboard();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);

  useEffect(() => {
    createClient()
      .from("plans")
      .select("*")
      .order("price_cents")
      .then(({ data }) => setPlans((data as Plan[]) ?? []));
  }, []);

  // Sin suscripción (o pendiente/cancelada) se puede elegir cualquier plan; si ya tiene uno, solo renueva el suyo.
  const canChoose = !subscription || ["pending", "canceled"].includes(billing?.status ?? subscription.subscription_status);
  const isCurrent = (p: Plan) => !canChoose && subscription?.plan_id === p.id;
  const amountFor = (p: Plan) => (isCurrent(p) && billing ? billing.amount_due_cents : p.price_cents);
  // Cambio de Básico a PRO: primer pago con 35% de descuento, solo si está al día.
  const canUpgrade = (p: Plan) =>
    !canChoose && subscription?.plan_id === "basic" && p.id === "pro" && ["active", "expiring_soon"].includes(billing?.status ?? "");
  const upgradeCents = (p: Plan) => Math.round(p.price_cents * 0.65);
  const [upgrading, setUpgrading] = useState<Plan | null>(null);

  return (
    <div>
      <h1 className="text-2xl font-bold">Planes</h1>
      <p className="mb-8 mt-1 text-[#4A154B]/70">Paga mes a mes con Yappy Comercial. Sin contratos.</p>

      {plans === null ? (
        <InlineLoader />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((p) => {
            const current = isCurrent(p);
            const featured = p.id === "pro";
            const upgrade = canUpgrade(p);
            const available = canChoose || current || upgrade;
            return (
              <div key={p.id}
                className={`relative rounded-3xl p-7 ${featured ? "bg-[#4A154B] text-[#FAF5EF]" : "border border-[#D9B382]/50 bg-[#FDFBF7]"}`}>
                {current && (
                  <span className="absolute right-5 top-5 rounded-full bg-[#D9B382] px-3 py-1 text-xs font-bold text-[#4A154B]">
                    Tu plan actual
                  </span>
                )}
                <p className="font-semibold">{p.name}</p>
                                {(PRECIO_REGULAR[p.id] ?? 0) > p.price_cents && (
                  <>
                    <span className="mt-3 inline-block rounded-full bg-[#D9B382] px-3 py-1 text-xs font-bold text-[#4A154B]">🚀 Precio de lanzamiento</span>
                    <p className="mt-2 text-lg line-through opacity-60">{formatUSD(PRECIO_REGULAR[p.id])}/mes</p>
                  </>
                )}
                <p className="mt-2 text-4xl font-bold">
                  {formatUSD(p.price_cents)}
                  <span className="text-base font-normal opacity-70">/mes</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {features(p).map((f) => (
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
                      mes pagas {formatUSD(p.price_cents)}.
                    </p>
                  </>
                ) : (
                  <button className={`${btnGold} mt-8 w-full`} disabled={!available} onClick={() => setSelected(p)}>
                    {current ? `Pagar ${formatUSD(amountFor(p))}` : `Elegir ${p.name}`}
                  </button>
                )}
                {!available && (
                  <p className={`mt-2 text-center text-xs ${featured ? "text-[#FAF5EF]/60" : "text-[#4A154B]/50"}`}>
                    {subscription?.plan_id === "basic" && p.id === "pro"
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
          request={{ kind: "subscription", planId: selected.id }}
          onPaid={refresh}
        />
      )}

      {upgrading && (
        <YappyCheckout
          open={!!upgrading}
          onClose={() => setUpgrading(null)}
          title="Cambiarme al Plan PRO"
          description={`Primer mes con 35% de descuento (precio normal ${formatUSD(upgrading.price_cents)}).`}
          amountLabel={formatUSD(upgradeCents(upgrading))}
          request={{ kind: "upgrade" }}
          onPaid={refresh}
        />
      )}
    </div>
  );
}
