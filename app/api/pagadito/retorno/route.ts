// GET /api/pagadito/retorno?token={value}&ern={ern_value}
// Pagadito envía aquí al cliente después de pagar. Consultamos el estado y lo llevamos a su panel.
import { NextResponse, type NextRequest } from "next/server";
import { finalizeMandate } from "@/lib/pagadito-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const go = (path: string, result: string) => NextResponse.redirect(new URL(`${path}?tarjeta=${result}`, request.url));

  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) return go("/dashboard/planes", "error");

  const admin = createAdminClient();
  const { data: m } = await admin.from("card_mandates").select("*").eq("auth_token", token).maybeSingle();
  if (!m) return go("/dashboard/planes", "error");
  const back = m.purpose === "addon" ? "/dashboard/tienda" : "/dashboard/planes";

  try {
    const r = m.status === "pending" ? await finalizeMandate(admin, m) : "aplicado";
    return go(back, r === "aplicado" ? "ok" : r === "fallido" ? "fallido" : "revision");
  } catch (e) {
    console.error("[pagadito] retorno:", e);
    return go(back, "revision");
  }
}
