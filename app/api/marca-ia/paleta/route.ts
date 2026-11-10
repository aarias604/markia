// POST /api/marca-ia/paleta · Guarda la paleta de un kit de marca en «Mis paletas».
import { NextResponse } from "next/server";
import type { BrandBrief, BrandResult } from "@/lib/brand-ai";
import { savePackagePalette } from "@/lib/brand-palette";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { packageId?: string } | null;
  const admin = createAdminClient();
  const { data: pkg } = await admin
    .from("brand_packages")
    .select("id, status, brief, result")
    .eq("id", body?.packageId ?? "")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pkg || pkg.status !== "ready" || !pkg.result) return NextResponse.json({ error: "Kit no disponible." }, { status: 404 });

  const r = await savePackagePalette(admin, user.id, pkg.id, (pkg.brief as BrandBrief | null)?.nombre, pkg.result as BrandResult);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
