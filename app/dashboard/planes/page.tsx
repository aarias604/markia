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

function features(p: Plan) {
  const list = [
    `${p.monthly_posts} publicaciones con IA al mes`,
    `${p.generic_templates} plantillas de diseño`,
    "Calendario de contenido",
    "Descarga de imágenes en PNG",
  ];
  if (p.custom_templates > 0) list.push(`${p.custom_templates} plantillas personalizadas propias`);
  if (p.instagram_autopost) list.push("Publicación automática en Instagram");
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
            const available = canChoose || current;
            return (
              <div key={p.id}
                className={`relative rounded-3xl p-7 ${featured ? "bg-[#4A154B] text-[#FAF5EF]" : "border border-[#D9B382]/50 bg-[#FDFBF7]"}`}>
                {current && (
                  <span className="absolute right-5 top-5 rounded-full bg-[#D9B382] px-3 py-1 text-xs font-bold text-[#4A154B]">
                    Tu plan actual
                  </span>
                )}
                <p className="font-semibold">{p.name}</p>
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
                <button className={`${btnGold} mt-8 w-full`} disabled={!available} onClick={() => setSelected(p)}>
                  {current ? `Pagar ${formatUSD(amountFor(p))} con Yappy` : `Elegir ${p.name} con Yappy`}
                </button>
                {!available && (
                  <p className={`mt-2 text-center text-xs ${featured ? "text-[#FAF5EF]/60" : "text-[#4A154B]/50"}`}>
                    Para cambiar de plan escríbenos a soporte.
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
    </div>
  );
}
