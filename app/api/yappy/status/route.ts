// GET /api/yappy/status?id=<paymentId> · El navegador pregunta si el pago ya se confirmó.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("status, applied_at, needs_review")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

  return NextResponse.json({
    status: data.status,
    applied: !!data.applied_at,
    needsReview: !!data.needs_review,
  });
}
