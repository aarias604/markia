// POST /api/crypto/create-order · Crea una orden para pagar con cripto (USDT) y devuelve las billeteras.
import { NextResponse } from "next/server";
import { cryptoWallets } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Vuelve a iniciar sesión.", 401);

  const wallets = cryptoWallets();
  if (wallets.length === 0) return fail("El pago con cripto aún no está configurado.", 503);

  const body = (await request.json().catch(() => null)) as { kind?: string; planId?: string; addonId?: string } | null;
  if (!body || (body.kind !== "subscription" && body.kind !== "addon")) return fail("Solicitud inválida.", 400);

  const admin = createAdminClient();
  const { data, error } =
    body.kind === "addon"
      ? await admin.rpc("create_addon_payment", { p_user_id: user.id, p_addon_id: body.addonId ?? "" })
      : await admin.rpc("create_subscription_payment", { p_user_id: user.id, p_plan_id: body.planId ?? null });
  if (error) return fail(error.message, 400);

  const payment = (Array.isArray(data) ? data[0] : data) as { id: string; amount_cents: number } | null;
  if (!payment?.id) return fail("No se pudo crear la orden.", 500);

  const { error: upErr } = await admin.from("payments").update({ method: "crypto" }).eq("id", payment.id);
  if (upErr) return fail(upErr.message, 500);

  return NextResponse.json({ paymentId: payment.id, amountCents: payment.amount_cents, wallets });
}
