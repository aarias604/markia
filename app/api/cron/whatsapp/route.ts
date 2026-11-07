// GET /api/cron/whatsapp · Vercel Cron, una vez al día (9:00 a. m. de Panamá).
// A quien lleva 2+ días sin publicar le envía por WhatsApp (cada 2 días): cuántos días
// lleva sin publicar, una idea de publicación según sus publicaciones anteriores y por
// qué es importante mantenerse activo.
import { NextResponse, type NextRequest } from "next/server";
import { idleIdea } from "@/lib/idle-idea";
import { createAdminClient } from "@/lib/supabase/admin";
import { WA_TEMPLATES, motivoDelDia, sendWhatsAppOnce, waParam, waPhone, whatsappConfigured } from "@/lib/whatsapp";

const MAX_POR_DIA = 80;
const EN_PARALELO = 4;

interface Candidate {
  user_id: string;
  phone: string;
  full_name: string | null;
  business_name: string | null;
  days_idle: number;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!whatsappConfigured()) return NextResponse.json({ ok: true, skipped: "WhatsApp no configurado" });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("whatsapp_idle_candidates");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
  const dayNumber = Math.floor(Date.now() / 86400000);
  const list = ((data ?? []) as Candidate[]).slice(0, MAX_POR_DIA);
  let sent = 0;
  const errors: string[] = [];

  async function handle(c: Candidate) {
    const to = waPhone(c.phone);
    if (!to) return;
    const [{ data: kit }, { data: recent }] = await Promise.all([
      admin.from("brand_kits").select("niche, voice_tone").eq("user_id", c.user_id).maybeSingle(),
      admin
        .from("posts")
        .select("title, caption")
        .eq("user_id", c.user_id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    const business = c.business_name || "tu negocio";
    const idea = await idleIdea({
      businessName: business,
      niche: kit?.niche ?? null,
      voiceTone: kit?.voice_tone ?? null,
      recent: recent ?? [],
    });
    const res = await sendWhatsAppOnce(admin, {
      userId: c.user_id,
      kind: "idle",
      ref: today,
      to,
      template: WA_TEMPLATES.idle,
      bodyParams: [
        waParam((c.full_name ?? "").split(" ")[0] || "emprendedor", 30),
        String(c.days_idle),
        waParam(idea, 320),
        waParam(motivoDelDia(dayNumber + c.days_idle), 200),
      ],
    });
    if (res.ok) sent++;
    else if (res.error !== "ya enviado") errors.push(`${c.user_id}: ${res.error}`);
  }

  for (let i = 0; i < list.length; i += EN_PARALELO) {
    await Promise.all(list.slice(i, i + EN_PARALELO).map((c) => handle(c).catch((e) => errors.push(String(e)))));
  }

  return NextResponse.json({ ok: true, candidates: list.length, sent, errors: errors.slice(0, 20) });
}
