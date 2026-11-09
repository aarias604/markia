// POST /api/pagadito/crear · Crea el cobro en Markia y la autorización en Pagadito.
// Devuelve la URL de la pantalla de pago de Pagadito.
import { NextResponse } from "next/server";
import { AUTOPAY_MONTHS, authorizeRecurring, pagaditoConfigured } from "@/lib/pagadito";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

const KIND_LABEL: Record<string, string> = {
  first_payment: "primer mes",
  renewal: "renovación",
  grace_catchup: "pago atrasado (2 meses)",
  reactivation: "reactivación (2 meses)",
};

export async function POST(request: Request) {
  if (!pagaditoConfigured() || process.env.NEXT_PUBLIC_PAGADITO_ENABLED !== "true") {
    return fail("El pago con tarjeta estará disponible muy pronto.", 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Vuelve a iniciar sesión.", 401);

  const body = (await request.json().catch(() => null)) as
    | { kind?: string; planId?: string; addonId?: string; autopay?: boolean }
    | null;
  if (!body || !["subscription", "addon", "upgrade"].includes(body.kind ?? "")) return fail("Solicitud inválida.");

  const admin = createAdminClient();

  // 1. Cobro pendiente en Markia (el monto lo calcula la base de datos).
  const { data, error } =
    body.kind === "addon"
      ? await admin.rpc("create_addon_payment", { p_user_id: user.id, p_addon_id: body.addonId ?? "" })
      : body.kind === "upgrade"
        ? await admin.rpc("create_upgrade_payment", { p_user_id: user.id })
        : await admin.rpc("create_subscription_payment", { p_user_id: user.id, p_plan_id: body.planId ?? null });
  if (error) return fail(error.message);
  const payment = (Array.isArray(data) ? data[0] : data) as
    | { id: string; kind: string; plan_id: string | null; addon_id: string | null; is_upgrade: boolean }
    | null;
  if (!payment?.id) return fail("No se pudo crear el cobro.", 500);

  // 2. Mandato con el cobro de hoy y, si aplica, los cobros mensuales.
  const autopay = body.kind !== "addon" && body.autopay !== false;
  const { data: mandate, error: mErr } = await admin.rpc("create_card_mandate", {
    p_payment_id: payment.id,
    p_months: autopay ? AUTOPAY_MONTHS : 0,
  });
  if (mErr || !mandate) return fail(mErr?.message ?? "No se pudo preparar el pago.", 500);
  const m = mandate as { mandate_id: string; charges: { seq: number; ern: string; due_date: string; amount_cents: number }[] };

  // 3. Descripciones que verá el cliente en Pagadito
  let what = "Markia";
  if (payment.addon_id) {
    const { data: addon } = await admin.from("addons").select("name").eq("id", payment.addon_id).maybeSingle();
    what = `Markia · ${addon?.name ?? "Compra"}`;
  } else {
    const { data: plan } = await admin.from("plans").select("name").eq("id", payment.plan_id ?? "").maybeSingle();
    what = `Markia · ${plan?.name ?? "Plan"}`;
  }
  const charges = m.charges.map((c) => ({
    ...c,
    description:
      c.seq === 0
        ? `${what}${payment.addon_id ? "" : ` · ${payment.is_upgrade ? "cambio a PRO (35% de descuento)" : KIND_LABEL[payment.kind] ?? "pago"}`}`
        : `${what} · mensualidad ${c.seq}`,
  }));

  // 4. Autorización en Pagadito
  try {
    const { url, token } = await authorizeRecurring(charges, autopay);
    await admin.from("card_mandates").update({ auth_token: token }).eq("id", m.mandate_id);
    return NextResponse.json({ url });
  } catch (e) {
    await admin.from("card_mandates").update({ status: "failed", last_error: String(e).slice(0, 300) }).eq("id", m.mandate_id);
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    console.error("[pagadito] crear:", e);
    return fail(e instanceof Error ? e.message : "Pagadito no respondió.", 502);
  }
}
