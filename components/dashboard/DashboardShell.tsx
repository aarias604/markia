"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Palette,
  Gift,
  ShieldCheck,
  ShoppingBag,
  Send,
  Sparkles,
  Tag,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { LEGAL_PAGES } from "@/components/legal/LegalShell";
import { MarkiaLogo } from "@/components/ui/MarkiaLogo";
import { YappyRenewalBanner } from "@/components/billing/YappyRenewalBanner";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/dashboard/generador", label: "Generador IA", icon: Sparkles },
  { href: "/dashboard/subir", label: "Subir publicación", icon: Upload },
  { href: "/dashboard/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/dashboard/plantillas", label: "Plantillas", icon: LayoutTemplate },
  { href: "/dashboard/marca", label: "Kit de marca", icon: Palette },
  { href: "/dashboard/marca-ia", label: "Marca con IA", icon: Wand2 },
  { href: "/dashboard/planes", label: "Planes", icon: CreditCard },
  { href: "/dashboard/tienda", label: "Tienda", icon: ShoppingBag },
  { href: "/dashboard/referidos", label: "Referidos", icon: Gift },
];

function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [
        ...NAV,
        { href: "/dashboard/instagram", label: "Instagram (pruebas)", icon: Send },
        { href: "/dashboard/admin", label: "Administración", icon: ShieldCheck },
        { href: "/dashboard/admin/precios", label: "Precios y promos", icon: Tag },
      ]
    : NAV;
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = ["/dashboard", "/dashboard/admin"].includes(item.href)
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-[#D9B382] text-[#4A154B]" : "text-[#FAF5EF]/80 hover:bg-white/10 hover:text-[#FAF5EF]"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { billing, businessName, logoDataUrl, email, subscription, refresh, profile } = useDashboard();
  const [open, setOpen] = useState(false);

  async function logout() {
    try {
      await createClient().auth.signOut();
    } finally {
      // Recarga completa para limpiar todo el estado de la sesión anterior.
      window.location.assign("/login");
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-[#4A154B] p-4">
      <div className="mb-8 px-2 pt-2">
        <MarkiaLogo light />
      </div>
      <NavLinks onNavigate={() => setOpen(false)} isAdmin={!!profile?.is_admin} />
      <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 text-[11px] text-[#FAF5EF]/50">
          {LEGAL_PAGES.slice(0, 3).map((p, i) => (
            <Link key={p.href} href={p.href} target="_blank" className="hover:text-[#FAF5EF]">
              {["Términos", "Privacidad", "Reembolsos"][i]}
            </Link>
          ))}
        </div>
        <p className="truncate px-2 text-xs text-[#FAF5EF]/60">{email}</p>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#FAF5EF]/80 hover:bg-white/10"
        >
          <LogOut className="h-5 w-5" /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        {billing && <YappyRenewalBanner billing={billing} onPaid={refresh} />}

        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#D9B382]/40 bg-[#FDFBF7]/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 hover:bg-[#4A154B]/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex min-w-0 items-center gap-3">
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-1" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D9B382] font-bold">
                {businessName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{businessName}</p>
              <p className="text-xs text-[#4A154B]/60">{subscription?.plans?.name ?? "Sin plan activo"}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
