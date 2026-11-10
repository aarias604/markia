// GET /api/tilopay/retorno · Tilopay envía aquí al cliente después de pagar
// (?code=…&order=…&crd=…&brand=…&last-digits=…). No confiamos en estos datos:
// confirmamos el pago directamente con Tilopay y luego lo llevamos a su panel.
import { NextResponse, type NextRequest } from "next/server";
import { confirmInitial } from "@/lib/tilopay-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const order = sp.get("order") ?? "";
  const go = (path: string, result: string) => NextResponse.redirect(new URL(`${path}?tarjeta=${result}`, request.url));

  if (!/^MK[A-Z0-9]{16}C0$/.test(order)) return go("/dashboard/planes", "error");

  const admin = createAdminClient();
  const { data: ch } = await admin.from("card_charges").select("mandate_id").eq("ern", order).eq("seq", 0).maybeSingle();
  if (!ch) return go("/dashboard/planes", "error");
  const { data: m } = await admin.from("card_mandates").select("*").eq("id", ch.mandate_id).single();
  if (!m) return go("/dashboard/planes", "error");
  const back = m.purpose === "addon" ? "/dashboard/tienda" : "/dashboard/planes";

  try {
    const r =
      m.status === "pending"
        ? await confirmInitial(admin, m, {
            token: sp.get("crd") || sp.get("token"),
            brand: sp.get("brand"),
            last4: sp.get("last-digits"),
            email: m.card_email,
          })
        : m.status === "failed" || m.status === "expired" ? "fallido" : "aplicado";
    return go(back, r === "aplicado" ? "ok" : r === "fallido" ? "fallido" : "revision");
  } catch (e) {
    console.error("[tilopay] retorno:", e);
    return go(back, "revision");
  }
}
