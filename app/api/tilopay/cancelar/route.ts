// POST /api/tilopay/cancelar · El cliente desactiva su cobro automático con tarjeta.
import { NextResponse } from "next/server";
import { cancelMandate } from "@/lib/tilopay-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  const admin = createAdminClient();
  const { data: mandates } = await admin
    .from("card_mandates")
    .select("id")
    .eq("user_id", user.id)
    .eq("purpose", "subscription")
    .eq("status", "active");

  for (const m of mandates ?? []) await cancelMandate(admin, m.id);
  return NextResponse.json({ ok: true });
}
