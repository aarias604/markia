// GET /api/cron/pagadito · Vercel Cron, cada hora.
// Confirma cobros con tarjeta del día, pagos iniciales sin confirmar y cancelaciones pendientes.
import { NextResponse, type NextRequest } from "next/server";
import { pagaditoConfigured } from "@/lib/pagadito";
import { syncPagadito } from "@/lib/pagadito-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!pagaditoConfigured()) return NextResponse.json({ ok: true, skipped: "Pagadito no configurado" });
  const result = await syncPagadito(createAdminClient());
  return NextResponse.json({ ok: true, ...result });
}
