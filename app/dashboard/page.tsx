"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, CreditCard, Palette, Sparkles } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { InlineLoader } from "@/components/ui/Loader";
import { createClient } from "@/lib/supabase/client";
import { STATUS_INFO, formatFechaHora } from "@/lib/posts";
import type { Post } from "@/lib/types";
import { btnGold, btnSecondary, cardCls } from "@/lib/ui";

export default function DashboardHome() {
  const { profile, subscription, monthlyPosts, remainingPosts, kit, billing } = useDashboard();
  const [upcoming, setUpcoming] = useState<Post[] | null>(null);

  useEffect(() => {
    createClient()
      .from("posts")
      .select("*")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5)
      .then(({ data }) => setUpcoming((data as Post[]) ?? []));
  }, []);

  const firstName = (profile?.full_name ?? "").split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Hola{firstName ? `, ${firstName}` : ""} 👋</h1>
        <p className="mt-1 text-[#4A154B]/70">Esto es lo que pasa con tu marca este mes.</p>
      </div>

      {!subscription && (
        <div className="flex flex-col gap-3 rounded-2xl bg-[#4A154B] p-6 text-[#FAF5EF] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Aún no tienes un plan activo</p>
            <p className="text-sm text-[#FAF5EF]/75">Elige un plan para empezar a generar publicaciones con IA.</p>
          </div>
          <Link href="/dashboard/planes" className={btnGold}>Ver planes</Link>
        </div>
      )}

      {subscription?.plan_id === "basic" && ["active", "expiring_soon"].includes(billing?.status ?? "") && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-[#D9B382] bg-[#FDFBF7] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Pásate a PRO con 35% de descuento en tu primer mes</p>
            <p className="text-sm text-[#4A154B]/70">26 publicaciones, 3 carruseles y 20 plantillas al mes.</p>
          </div>
          <Link href="/dashboard/planes" className={btnGold}>Ver oferta</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cardCls}>
          <CreditCard className="h-6 w-6 text-[#8C338A]" />
          <p className="mt-3 text-sm text-[#4A154B]/70">Tu plan</p>
          <p className="text-xl font-bold">{subscription?.plans?.name ?? "Sin plan"}</p>
          {billing?.next_due_date && (
            <p className="mt-1 text-xs text-[#4A154B]/60">
              Vence el {new Date(`${billing.next_due_date}T12:00:00`).toLocaleDateString("es-PA", { day: "numeric", month: "long" })}
            </p>
          )}
        </div>
        <div className={cardCls}>
          <Sparkles className="h-6 w-6 text-[#8C338A]" />
          <p className="mt-3 text-sm text-[#4A154B]/70">Publicaciones disponibles</p>
          <p className="text-xl font-bold">
            {remainingPosts}
            <span className="text-sm font-normal text-[#4A154B]/60"> de {monthlyPosts} este ciclo</span>
          </p>
          {(subscription?.extra_posts_balance ?? 0) > 0 && (
            <p className="mt-1 text-xs text-[#4A154B]/60">Incluye {subscription?.extra_posts_balance} extra del Boost</p>
          )}
        </div>
        <div className={cardCls}>
          <Palette className="h-6 w-6 text-[#8C338A]" />
          <p className="mt-3 text-sm text-[#4A154B]/70">Kit de marca</p>
          <div className="mt-1 flex gap-1.5">
            {kit &&
              [kit.color_primary, kit.color_secondary, kit.color_accent, kit.color_cream].map((c, i) => (
                <span key={i} className="h-7 w-7 rounded-full border border-black/10" style={{ background: c }} />
              ))}
          </div>
          <Link href="/dashboard/marca" className="mt-2 inline-block text-xs font-semibold text-[#6B21A8] hover:underline">
            Editar
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/generador" className={btnGold}>
          <Sparkles className="h-4 w-4" /> Generar publicaciones
        </Link>
        <Link href="/dashboard/calendario" className={btnSecondary}>
          <CalendarDays className="h-4 w-4" /> Abrir calendario
        </Link>
      </div>

      <section className={cardCls}>
        <h2 className="font-bold">Próximas publicaciones</h2>
        <div className="mt-4">
          {upcoming === null ? (
            <InlineLoader />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-[#4A154B]/60">
              No tienes publicaciones programadas. Genera algunas y asígnales fecha en el calendario.
            </p>
          ) : (
            <ul className="divide-y divide-[#D9B382]/30">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.title || p.image_headline || "Publicación"}</p>
                    <p className="text-xs text-[#4A154B]/60">{p.scheduled_at && formatFechaHora(p.scheduled_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_INFO[p.status].cls}`}>
                    {STATUS_INFO[p.status].label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
