// GET /api/admin/clientes · Clientes con su plan, uso, compras, ingresos y costo estimado. Solo administradores.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

/**
 * Costos estimados por unidad (USD). Mismos supuestos del análisis de costos.
 * Si cambian tus proveedores, actualiza estos números.
 */
const COSTS = {
  post: 0.013, // publicación con IA (peor caso)
  carousel: 0.031, // carrusel con IA (peor caso)
  video: 0.65, // voz ElevenLabs + guion + render + almacenamiento
  videoAiImages: 0.15, // extra si el video usa imágenes con IA
  logo: 0.98, // Marca con IA (generación + ajuste)
  waUtility: 0.0113, // WhatsApp recordatorio (utilidad)
  waMarketing: 0.074 + 0.002, // WhatsApp inactividad (marketing) + idea con IA
  cardPct: 0.0375, // Tilopay 3.75 %
  cardFixed: 0.5, // Tilopay $0.50 por cobro
  yappyPct: 0.03, // Yappy (confirmar)
  itbms: 0.07 / 1.07, // ITBMS 7 % incluido en el precio
  fixedMonthly: 86.5, // Vercel, Supabase, Resend, ElevenLabs y dominio
};

interface Row {
  user_id: string;
  email: string;
  full_name: string | null;
  business_name: string | null;
  joined_at: string;
  is_admin: boolean;
  plan_id: string | null;
  plan_name: string | null;
  status: string | null;
  next_due_date: string | null;
  monthly_price_cents: number | null;
  price_locked: boolean;
  autopay: boolean;
  posts_used: number;
  posts_limit: number;
  extra_posts: number;
  carousels_used: number;
  carousels_limit: number;
  videos_used: number;
  videos_limit: number;
  extra_videos: number;
  posts_total: number;
  uploads_total: number;
  carousels_total: number;
  videos_total: number;
  videos_ai_images: number;
  wa_utility: number;
  wa_marketing: number;
  plan_revenue_cents: number;
  store_revenue_cents: number;
  store_items: { addon_id: string; name: string; count: number; cents: number }[];
  card_revenue_cents: number;
  card_payments: number;
  yappy_revenue_cents: number;
  referral_cents: number;
  last_payment_at: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await ctx.admin.rpc("admin_clients");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = ((data ?? []) as Row[]).map((c) => {
    const logos = c.store_items.find((i) => i.addon_id === "logo_service")?.count ?? 0;
    const revenue = (c.plan_revenue_cents + c.store_revenue_cents) / 100;
    const ai =
      c.posts_total * COSTS.post +
      c.carousels_total * COSTS.carousel +
      c.videos_total * COSTS.video +
      c.videos_ai_images * COSTS.videoAiImages +
      logos * COSTS.logo;
    const whatsapp = c.wa_utility * COSTS.waUtility + c.wa_marketing * COSTS.waMarketing;
    const fees =
      (c.card_revenue_cents / 100) * COSTS.cardPct + c.card_payments * COSTS.cardFixed + (c.yappy_revenue_cents / 100) * COSTS.yappyPct;
    const itbms = revenue * COSTS.itbms;
    const referral = c.referral_cents / 100;
    const cost = ai + whatsapp + fees + itbms + referral;
    return {
      ...c,
      revenue: r2(revenue),
      costs: { ai: r2(ai), whatsapp: r2(whatsapp), fees: r2(fees), itbms: r2(itbms), referral: r2(referral), total: r2(cost) },
      profit: r2(revenue - cost),
    };
  });

  const paying = clients.filter((c) => !c.is_admin);
  const sum = (f: (c: (typeof clients)[number]) => number) => r2(paying.reduce((a, c) => a + f(c), 0));
  const active = paying.filter((c) => c.status && ["active", "expiring_soon", "grace_period"].includes(c.status));

  return NextResponse.json({
    clients,
    totals: {
      clients: paying.length,
      active: active.length,
      basic: active.filter((c) => c.plan_id === "basic").length,
      pro: active.filter((c) => c.plan_id === "pro").length,
      mrr: r2(active.reduce((a, c) => a + (c.monthly_price_cents ?? 0) / 100, 0)),
      planRevenue: sum((c) => c.plan_revenue_cents / 100),
      storeRevenue: sum((c) => c.store_revenue_cents / 100),
      revenue: sum((c) => c.revenue),
      cost: sum((c) => c.costs.total),
      profit: sum((c) => c.profit),
    },
    fixedMonthly: COSTS.fixedMonthly,
  });
}
