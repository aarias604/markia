// POST /api/crypto/submit · El cliente registra el comprobante (hash) de su envío.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { paymentId?: string; network?: string; txHash?: string } | null;
  if (!body?.paymentId || !body.network || !body.txHash) {
    return NextResponse.json({ error: "Faltan datos del comprobante." }, { status: 400 });
  }

  const { error } = await supabase.rpc("submit_crypto_payment", {
    p_payment_id: body.paymentId,
    p_network: body.network.slice(0, 60),
    p_tx_hash: body.txHash.trim().slice(0, 200),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
