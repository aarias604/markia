"use client";

// Carga una sola vez los datos del usuario (perfil, plan, kit de marca, plantillas)
// y los comparte con todas las páginas del dashboard.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { blobToDataUrl } from "@/lib/download";
import { normalizeDefinition } from "@/lib/templates";
import type { BillingRow } from "@/lib/billing/subscription-state";
import type { BrandKit, Profile, Subscription, Template } from "@/lib/types";
import { FullScreenLoader } from "@/components/ui/Loader";
import { btnPrimary } from "@/lib/ui";

interface DashboardData {
  userId: string;
  email: string;
  profile: Profile | null;
  subscription: Subscription | null;
  billing: BillingRow | null;
  kit: BrandKit | null;
  logoDataUrl: string | null;
  templates: Template[];
  instagram: { username: string | null; token_expires_at: string; last_error: string | null } | null;
  /** Cobro automático con tarjeta activo (Pagadito). */
  autopay: { mandate_id: string; plan_id: string; monthly_price_cents: number; next_charge_date: string | null; remaining: number; last_charge_date: string } | null;
}

interface DashboardCtx extends DashboardData {
  monthlyPosts: number;
  remainingPosts: number;
  canGenerate: boolean;
  /** Publicación automática habilitada (por ahora solo administradores, en pruebas). */
  planHasAutopost: boolean;
  /** Administrador + cuenta al día + Instagram conectado. */
  canAutopost: boolean;
  businessName: string;
  refresh: () => Promise<void>;
}

const Ctx = createContext<DashboardCtx | null>(null);

export function useDashboard() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useDashboard debe usarse dentro del dashboard");
  return value;
}

async function loadData(): Promise<DashboardData | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, subRes, billingRes, kitRes, tplRes, igRes, autopayRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("*, plans(*)").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("get_my_billing").maybeSingle(),
    supabase.from("brand_kits").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("templates").select("*").order("kind").order("name"),
    supabase.rpc("get_my_instagram").maybeSingle(),
    supabase.rpc("get_my_autopay").maybeSingle(),
  ]);

  const firstError = [profileRes, subRes, kitRes, tplRes].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const kit = (kitRes.data as BrandKit | null) ?? null;
  let logoDataUrl: string | null = null;
  if (kit?.logo_path) {
    const { data: blob } = await supabase.storage.from("brand-assets").download(kit.logo_path);
    if (blob) logoDataUrl = await blobToDataUrl(blob);
  }

  const templates = ((tplRes.data ?? []) as Template[]).map((t) => ({
    ...t,
    definition: normalizeDefinition(t.definition),
  }));

  return {
    userId: user.id,
    email: user.email ?? "",
    profile: (profileRes.data as Profile | null) ?? null,
    subscription: (subRes.data as Subscription | null) ?? null,
    billing: (billingRes.data as BillingRow | null) ?? null,
    kit,
    logoDataUrl,
    templates,
    instagram: (igRes.data as DashboardData["instagram"]) ?? null,
    autopay: (autopayRes.data as DashboardData["autopay"]) ?? null,
  };
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await loadData();
      if (!d) {
        router.replace("/login");
        return;
      }
      if (!d.profile?.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }
      setError(null);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
          <p className="mt-3 font-semibold">No pudimos cargar tu cuenta</p>
          <p className="mt-1 break-words text-sm text-[#4A154B]/70">{error}</p>
          <button className={`${btnPrimary} mt-4`} onClick={() => void refresh()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <FullScreenLoader text="Cargando tu cuenta…" />;

  const plan = data.subscription?.plans ?? null;
  const monthlyPosts = plan?.monthly_posts ?? 0;
  const used = data.subscription?.posts_used_this_cycle ?? 0;
  const extra = data.subscription?.extra_posts_balance ?? 0;

  const value: DashboardCtx = {
    ...data,
    monthlyPosts,
    remainingPosts: data.subscription ? Math.max(monthlyPosts - used, 0) + extra : 0,
    canGenerate: data.billing?.can_generate ?? false,
    planHasAutopost: !!data.profile?.is_admin,
    canAutopost: !!data.profile?.is_admin && !!data.instagram,
    businessName: data.profile?.business_name || "Mi marca",
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
