"use client";

import { useEffect, useState } from "react";
import { Clapperboard, LayoutTemplate, Palette, Zap } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { CardReturnNotice } from "@/components/billing/CardReturnNotice";
import { YappyCheckout } from "@/components/billing/YappyCheckout";
import { InlineLoader } from "@/components/ui/Loader";
import { formatUSD } from "@/lib/billing/subscription-state";
import { createClient } from "@/lib/supabase/client";
import { btnGold, cardCls } from "@/lib/ui";

interface Addon {
  id: string;
  name: string;
  price_cents: number;
}

const INFO: Record<string, { icon: typeof Zap; text: string; needsPlan: boolean; after: string }> = {
  posts_boost_5: {
    icon: Zap,
    text: "Suma 5 publicaciones con IA a tu cupo. No vencen con el ciclo: se usan cuando se acabe tu cupo mensual.",
    needsPlan: true,
    after: "Se sumaron 5 publicaciones a tu cupo.",
  },
  video_pack_3: {
    icon: Clapperboard,
    text: "Suma 3 videos explicativos animados (1–2 minutos, con voz, efectos y tus colores). No vencen: se usan cuando se acaben los de tu plan.",
    needsPlan: true,
    after: "Se sumaron 3 videos. Entra a «Videos» para crearlos.",
  },
  template_pack: {
    icon: LayoutTemplate,
    text: "Te da 5 espacios más para crear plantillas propias, en cualquier plan.",
    needsPlan: true,
    after: "Ya puedes crear 5 plantillas propias más en «Plantillas».",
  },
  logo_service: {
    icon: Palette,
    text: "La IA crea tu logo en 3 versiones (principal, ícono y monocromo), una paleta de 5 colores, 2 tipografías y una guía de uso. Lo recibes al instante en tu correo y en tu cuenta. Incluye 1 ajuste.",
    needsPlan: false,
    after: "¡Pago confirmado! Entra a «Marca con IA» en el menú para crear tu marca.",
  },
};

export default function TiendaPage() {
  const { subscription, refresh } = useDashboard();
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [selected, setSelected] = useState<Addon | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("addons")
      .select("id, name, price_cents")
      .order("price_cents")
      .then(({ data }) => setAddons((data as Addon[]) ?? []));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Tienda</h1>
      <p className="mb-8 mt-1 text-[#4A154B]/70">Extras para tu marca. Pago único con Yappy, tarjeta o cripto.</p>

      <CardReturnNotice />

      {done && <p className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{done}</p>}

      {addons === null ? (
        <InlineLoader />
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {addons.map((a) => {
            const info = INFO[a.id];
            const Icon = info?.icon ?? Zap;
            const blocked = !!info?.needsPlan && !subscription;
            return (
              <div key={a.id} className={`${cardCls} flex flex-col`}>
                <Icon className="h-8 w-8 text-[#8C338A]" />
                <h2 className="mt-3 text-lg font-bold">{a.name}</h2>
                <p className="mt-1 flex-1 text-sm text-[#4A154B]/70">{info?.text}</p>
                <p className="mt-4 text-2xl font-bold">{formatUSD(a.price_cents)}</p>
                <button className={`${btnGold} mt-4`} disabled={blocked} onClick={() => { setDone(null); setSelected(a); }}>
                  Comprar con Yappy
                </button>
                {blocked && <p className="mt-2 text-center text-xs text-[#4A154B]/50">Necesitas un plan activo.</p>}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <YappyCheckout
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected.name}
          amountLabel={formatUSD(selected.price_cents)}
          request={{ kind: "addon", addonId: selected.id }}
          onPaid={async () => {
            setDone(INFO[selected.id]?.after ?? "¡Compra confirmada!");
            await refresh();
          }}
        />
      )}
    </div>
  );
}
