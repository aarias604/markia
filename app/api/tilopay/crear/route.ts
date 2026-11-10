// POST /api/tilopay/crear · Crea el cobro en Markia y la pantalla de pago en Tilopay.
// Devuelve la URL de la pantalla segura de Tilopay.
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/notifications";
import { createPaymentLink, tilopayEnabled } from "@/lib/tilopay";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  if (!tilopayEnabled()) return fail("El pago con tarjeta estará disponible muy pronto.", 503);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return fail("Tu sesión venció. Vuelve a iniciar sesión.", 401);

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
  const payment = (Array.isArray(data) ? data[0] : data) as { id: string } | null;
  if (!payment?.id) return fail("No se pudo crear el cobro.", 500);

  // 2. Mandato con el número de orden para Tilopay
  const autopay = body.kind !== "addon" && body.autopay !== false;
  const { data: mData, error: mErr } = await admin.rpc("create_tilopay_mandate", { p_payment_id: payment.id, p_autopay: autopay });
  if (mErr || !mData) return fail(mErr?.message ?? "No se pudo preparar el pago.", 500);
  const m = mData as { mandate_id: string; ern: string; amount_cents: number };

  // 3. Datos del cliente que pide Tilopay
  const { data: profile } = await admin.from("profiles").select("full_name, business_name, phone").eq("id", user.id).maybeSingle();
  const name = (profile?.full_name || profile?.business_name || "Cliente Markia").trim().split(/\s+/);
  const firstName = name[0].slice(0, 40);
  const lastName = (name.slice(1).join(" ") || "Markia").slice(0, 40);
  const phone = (profile?.phone ?? "").replace(/\D/g, "").slice(-8) || "60000000";

  // 4. Pantalla de pago en Tilopay
  try {
    const url = await createPaymentLink({
      orderNumber: m.ern,
      amountCents: m.amount_cents,
      saveCard: autopay,
      redirect: `${siteUrl()}/api/tilopay/retorno`,
      customer: { email: user.email, firstName, lastName, phone: `507${phone}` },
      returnData: Buffer.from(m.mandate_id).toString("base64"),
    });
    await admin.from("card_mandates").update({ card_email: user.email }).eq("id", m.mandate_id);
    return NextResponse.json({ url });
  } catch (e) {
    await admin.from("card_mandates").update({ status: "failed", last_error: String(e).slice(0, 300) }).eq("id", m.mandate_id);
    await admin.from("card_charges").update({ status: "FAILED", processed_at: new Date().toISOString() }).eq("mandate_id", m.mandate_id);
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    console.error("[tilopay] crear:", e);
    return fail(e instanceof Error ? e.message : "Tilopay no respondió.", 502);
  }
}
