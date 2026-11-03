// POST /api/admin/action · Aprobar/rechazar pagos cripto y pagar/rechazar retiros.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { notifyPaymentConfirmed } from "@/lib/notifications";

type Action = "approve_crypto" | "reject_crypto" | "pay_payout" | "reject_payout";

export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { admin, user } = ctx;

  const body = (await request.json().catch(() => null)) as { action?: Action; id?: string; text?: string } | null;
  if (!body?.action || !body.id) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const text = (body.text ?? "").trim().slice(0, 200);

  let error: { message: string } | null = null;
  let result: unknown = null;

  switch (body.action) {
    case "approve_crypto": {
      const r = await admin.rpc("apply_payment", {
        p_payment_id: body.id,
        p_yappy_transaction_id: null,
        p_raw: { source: "crypto_manual", approved_by: user.email, approved_at: new Date().toISOString() },
      });
      error = r.error;
      result = r.data;
      break;
    }
    case "reject_crypto": {
      const r = await admin.from("payments").update({ status: "failed" }).eq("id", body.id).is("applied_at", null);
      error = r.error;
      break;
    }
    case "pay_payout": {
      if (!text) return NextResponse.json({ error: "Escribe la referencia del pago." }, { status: 400 });
      const r = await admin.rpc("complete_payout", { p_payout_id: body.id, p_reference: text });
      error = r.error;
      break;
    }
    case "reject_payout": {
      if (!text) return NextResponse.json({ error: "Escribe el motivo del rechazo." }, { status: 400 });
      const r = await admin.rpc("reject_payout", { p_payout_id: body.id, p_note: text });
      error = r.error;
      break;
    }
    default:
      return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (body.action === "approve_crypto") await notifyPaymentConfirmed(admin, body.id);

  const needsReview = !!(result && typeof result === "object" && (result as { needs_review?: boolean }).needs_review);
  return NextResponse.json({ ok: true, needsReview });
}
