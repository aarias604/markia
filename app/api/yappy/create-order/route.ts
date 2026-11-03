// POST /api/yappy/create-order · Crea el cobro en Markia (monto calculado en la BD) y la orden en Yappy.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createYappyOrder, newOrderId, normalizePhone } from "@/lib/yappy";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

interface PaymentRow {
  id: string;
  amount_cents: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Vuelve a iniciar sesión.", 401);

  const body = (await request.json().catch(() => null)) as {
    kind?: string;
    planId?: string;
    addonId?: string;
    phone?: string;
  } | null;
  if (!body || !["subscription", "addon", "upgrade"].includes(body.kind ?? "")) return fail("Solicitud inválida.", 400);

  const phone = normalizePhone(body.phone);
  if (!phone) return fail("Escribe tu número de celular de Yappy: 8 dígitos que empiezan con 6.", 400);
  // Lo guardamos para no pedirlo la próxima vez.
  await supabase.from("profiles").update({ phone }).eq("id", user.id);

  const admin = createAdminClient();

  // 1. Crear el cobro pendiente. El monto lo calcula la base de datos, nunca el navegador.
  const { data, error } =
    body.kind === "addon"
      ? await admin.rpc("create_addon_payment", { p_user_id: user.id, p_addon_id: body.addonId ?? "" })
      : body.kind === "upgrade"
        ? await admin.rpc("create_upgrade_payment", { p_user_id: user.id })
        : await admin.rpc("create_subscription_payment", { p_user_id: user.id, p_plan_id: body.planId ?? null });

  if (error) return fail(error.message, 400);
  const payment = (Array.isArray(data) ? data[0] : data) as PaymentRow | null;
  if (!payment?.id) return fail("No se pudo crear el cobro.", 500);

  // 2. Asignar un número de orden para Yappy
  const orderId = newOrderId();
  const { error: upErr } = await admin.from("payments").update({ yappy_order_id: orderId }).eq("id", payment.id);
  if (upErr) return fail(upErr.message, 500);

  // 3. Crear la orden en Yappy
  try {
    const order = await createYappyOrder({ orderId, total: (payment.amount_cents / 100).toFixed(2), phone });
    return NextResponse.json({ ...order, paymentId: payment.id, amountCents: payment.amount_cents });
  } catch (e) {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    console.error("[yappy] create-order:", e);
    return fail(e instanceof Error ? e.message : "Yappy no respondió.", 502);
  }
}
