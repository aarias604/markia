// GET /api/yappy/ipn · Yappy avisa aquí el resultado de cada pago.
// Valida la firma, y si el pago se ejecutó (E) lo aplica: extiende la suscripción o entrega el add-on.
import { after, NextResponse, type NextRequest } from "next/server";
import { notifyPaymentConfirmed } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIpnHash } from "@/lib/yappy";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const orderId = sp.get("orderId") ?? "";
  const hash = sp.get("hash") ?? "";
  const status = sp.get("status") ?? "";
  const domain = sp.get("domain") ?? "";
  const confirmationNumber = sp.get("confirmationNumber");

  if (!orderId || !hash || !status || !domain) {
    return NextResponse.json({ success: false, error: "Faltan parámetros" }, { status: 400 });
  }
  if (!verifyIpnHash({ orderId, status, domain, hash })) {
    console.warn("[yappy] IPN con firma inválida", { orderId, status });
    return NextResponse.json({ success: false, error: "Firma inválida" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, status")
    .eq("yappy_order_id", orderId)
    .maybeSingle();
  if (!payment) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });

  const raw = Object.fromEntries(sp.entries());

  if (status === "E") {
    const { error } = await admin.rpc("apply_payment", {
      p_payment_id: payment.id,
      p_yappy_transaction_id: confirmationNumber,
      p_raw: raw,
    });
    if (error) {
      console.error("[yappy] apply_payment:", error);
      return NextResponse.json({ success: false }, { status: 500 });
    }
    // Correo de confirmación sin hacer esperar a Yappy (debe responder en menos de 5 segundos).
    after(() => notifyPaymentConfirmed(admin, payment.id));
  } else if (payment.status === "pending") {
    await admin
      .from("payments")
      .update({ status: status === "X" ? "expired" : "failed", raw_webhook: raw })
      .eq("id", payment.id);
  }

  return NextResponse.json({ success: true });
}
