// /api/admin/precios · Precios de planes y tienda, y promociones. Solo administradores.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "14.99" → 1499. Entre $1 y $1,000. */
function toCents(v: unknown): number | null {
  const n = Math.round(Number(String(v ?? "").replace(",", ".")) * 100);
  return Number.isFinite(n) && n >= 100 && n <= 100000 ? n : null;
}

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { admin } = ctx;

  const [plans, addons, promos, pricing, subs] = await Promise.all([
    admin.from("plans").select("id, name, price_cents, is_active").order("price_cents"),
    admin.from("addons").select("id, name, price_cents, is_active").order("price_cents"),
    admin.from("promotions").select("*").order("created_at", { ascending: false }),
    admin.rpc("get_public_pricing"),
    admin
      .from("subscriptions")
      .select("plan_id, locked_price_cents")
      .not("locked_price_cents", "is", null)
      .in("subscription_status", ["active", "expiring_soon", "grace_period"]),
  ]);
  const err = [plans, addons, promos, pricing, subs].find((r) => r.error)?.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  // Cuántos clientes pagan cada precio congelado.
  const locked: Record<string, number> = {};
  for (const s of (subs.data ?? []) as { plan_id: string; locked_price_cents: number }[]) {
    const key = `${s.plan_id}:${s.locked_price_cents}`;
    locked[key] = (locked[key] ?? 0) + 1;
  }

  return NextResponse.json({
    plans: plans.data,
    addons: addons.data,
    promotions: promos.data,
    pricing: pricing.data,
    locked: Object.entries(locked).map(([k, count]) => {
      const [plan_id, cents] = k.split(":");
      return { plan_id, price_cents: Number(cents), count };
    }),
  });
}

interface Body {
  action?: "plan_price" | "addon_price" | "save_promo" | "toggle_promo" | "delete_promo";
  id?: string;
  price?: string;
  is_active?: boolean;
  promo?: {
    name?: string;
    label?: string;
    plan_id?: string | null;
    mode?: "pct" | "price";
    value?: string;
    starts_on?: string;
    ends_on?: string | null;
  };
}

export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { admin } = ctx;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.action) return bad("Solicitud inválida");

  switch (body.action) {
    case "plan_price":
    case "addon_price": {
      const cents = toCents(body.price);
      if (!body.id || !cents) return bad("Escribe un precio entre $1.00 y $1,000.00.");
      const table = body.action === "plan_price" ? "plans" : "addons";
      const { error } = await admin.from(table).update({ price_cents: cents }).eq("id", body.id);
      if (error) return bad(error.message);
      break;
    }

    case "save_promo": {
      const p = body.promo ?? {};
      const name = (p.name ?? "").trim().slice(0, 80);
      const label = (p.label ?? "").trim().slice(0, 40) || "Promoción";
      const planId = p.plan_id || null;
      if (!name) return bad("Ponle un nombre a la promoción.");
      if (!isDate(p.starts_on)) return bad("Elige la fecha de inicio.");
      if (p.ends_on && !isDate(p.ends_on)) return bad("La fecha de fin no es válida.");
      if (p.ends_on && p.ends_on < p.starts_on) return bad("La fecha de fin debe ser igual o posterior al inicio.");

      const row: Record<string, unknown> = {
        name,
        label,
        plan_id: planId,
        starts_on: p.starts_on,
        ends_on: p.ends_on || null,
        discount_pct: null,
        promo_price_cents: null,
      };
      if (p.mode === "price") {
        if (!planId) return bad("Un precio fijo necesita un plan específico. Para todos los planes usa un % de descuento.");
        const cents = toCents(p.value);
        if (!cents) return bad("Escribe un precio entre $1.00 y $1,000.00.");
        const { data: plan } = await admin.from("plans").select("price_cents").eq("id", planId).single();
        if (plan && cents >= plan.price_cents) return bad("El precio promocional debe ser menor que el precio regular del plan.");
        row.promo_price_cents = cents;
      } else {
        const pct = Number(String(p.value ?? "").replace(",", "."));
        if (!(pct >= 1 && pct <= 90)) return bad("El descuento debe estar entre 1% y 90%.");
        row.discount_pct = Math.round(pct * 100) / 100;
      }

      const { error } = body.id
        ? await admin.from("promotions").update(row).eq("id", body.id)
        : await admin.from("promotions").insert(row);
      if (error) return bad(error.message);
      break;
    }

    case "toggle_promo": {
      if (!body.id) return bad("Solicitud inválida");
      const { error } = await admin.from("promotions").update({ is_active: !!body.is_active }).eq("id", body.id);
      if (error) return bad(error.message);
      break;
    }

    case "delete_promo": {
      if (!body.id) return bad("Solicitud inválida");
      const { error } = await admin.from("promotions").delete().eq("id", body.id);
      if (error) return bad(error.message);
      break;
    }

    default:
      return bad("Acción desconocida");
  }

  return NextResponse.json({ ok: true });
}
