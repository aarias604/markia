// GET /api/cron/tilopay · Vercel Cron, cada hora.
// Cobra las mensualidades del día, confirma pagos sin respuesta y aplica cancelaciones.
export const maxDuration = 300;

import { NextResponse, type NextRequest } from "next/server";
import { tilopayConfigured } from "@/lib/tilopay";
import { syncTilopay } from "@/lib/tilopay-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!tilopayConfigured()) return NextResponse.json({ ok: true, skipped: "Tilopay no configurado" });
  const result = await syncTilopay(createAdminClient());
  return NextResponse.json({ ok: true, ...result });
}
