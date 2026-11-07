// POST /api/pagadito/webhook · Pagadito avisa cada cambio de estado de una transacción.
// Verificamos la firma y aplicamos el cobro correspondiente (por su ERN).
import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/pagadito";
import { finalizeMandate, processChargeStatus } from "@/lib/pagadito-sync";
import { createAdminClient } from "@/lib/supabase/admin";

interface PagaditoEvent {
  id?: string;
  event_type?: string;
  resource?: { token?: string; ern?: string; status?: string; reference?: string };
}

export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  let event: PagaditoEvent;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const valid = await verifyWebhook(request.headers, raw, event.id ?? "");
  if (!valid) {
    console.warn("[pagadito] webhook con firma inválida", event.id);
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const ern = event.resource?.ern;
  const status = event.resource?.status;
  if (event.event_type !== "TRANSACTION.STATUS.CHANGE" || !ern || !status) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: charge } = await admin.from("card_charges").select("*").eq("ern", ern).maybeSingle();
  if (!charge) return NextResponse.json({ ok: true, ignored: "ERN desconocido" });

  try {
    const { data: m } = await admin.from("card_mandates").select("*").eq("id", charge.mandate_id).single();
    // Pago inicial: además guardamos los tokens de los cobros futuros.
    if (charge.seq === 0 && m?.status === "pending") await finalizeMandate(admin, m);
    else await processChargeStatus(admin, charge, status, event.resource?.reference);
  } catch (e) {
    console.error("[pagadito] webhook:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 }); // Pagadito reintenta
  }
  return NextResponse.json({ ok: true });
}
