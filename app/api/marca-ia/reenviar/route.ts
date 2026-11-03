// POST /api/marca-ia/reenviar · Reenvía por correo un paquete de marca ya generado.
import { NextResponse } from "next/server";
import { brandEmail, type BrandBrief, type BrandResult } from "@/lib/brand-ai";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { packageId?: string } | null;
  const { data: pkg } = await supabase.from("brand_packages").select("*").eq("id", body?.packageId ?? "").maybeSingle();
  if (!pkg || pkg.status !== "ready") return NextResponse.json({ error: "Paquete no disponible." }, { status: 404 });

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const brief = pkg.brief as BrandBrief;
  const sent = await sendEmail({ to: brief.correo, ...brandEmail(brief, pkg.result as BrandResult, site) });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });

  await createAdminClient().from("brand_packages").update({ emailed_at: new Date().toISOString() }).eq("id", pkg.id);
  return NextResponse.json({ ok: true });
}
