// POST /api/whatsapp/prueba · Envía un recordatorio de ejemplo al WhatsApp del usuario.
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { WA_TEMPLATES, sendWhatsAppOnce, waParam, waPhone, whatsappConfigured } from "@/lib/whatsapp";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  if (!whatsappConfigured()) {
    return NextResponse.json({ error: "Los avisos por WhatsApp aún no están disponibles. Inténtalo más tarde." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, phone, whatsapp_opt_in")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.whatsapp_opt_in) return NextResponse.json({ error: "Primero activa los avisos y guarda." }, { status: 400 });
  const to = waPhone(profile.phone);
  if (!to) return NextResponse.json({ error: "Tu número de WhatsApp no es válido." }, { status: 400 });

  // Máximo una prueba cada 10 minutos.
  const now = new Date();
  const slot = `${now.toISOString().slice(0, 15)}${Math.floor(now.getUTCMinutes() / 10)}`;
  const hora = now.toLocaleTimeString("es-PA", { timeZone: "America/Panama", hour: "numeric", minute: "2-digit" });

  const res = await sendWhatsAppOnce(admin, {
    userId: user.id,
    kind: "test",
    ref: slot,
    to,
    template: WA_TEMPLATES.reminder,
    headerImageUrl: `${siteUrl()}/whatsapp-prueba.jpg`,
    bodyParams: [
      waParam((profile.full_name ?? "").split(" ")[0] || "emprendedor", 30),
      hora,
      "tu publicación de prueba",
      "Así recibirás tus recordatorios: con la imagen, la descripción sugerida y los hashtags listos para copiar y pegar en Instagram.",
      "#markia #panama #emprendedores",
    ],
  });
  if (!res.ok) {
    const msg = res.error === "ya enviado" ? "Ya enviamos una prueba hace poco. Espera unos minutos." : `No se pudo enviar: ${res.error}`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
