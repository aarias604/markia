// POST /api/marca-ia/generar · Genera (o ajusta) el paquete de marca con IA y lo envía por correo.
import { NextResponse } from "next/server";
import { brandEmail, generateBrand, type BrandBrief, type BrandResult } from "@/lib/brand-ai";
import { savePackagePalette } from "@/lib/brand-palette";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function validBrief(raw: unknown, fallbackEmail: string): BrandBrief | string {
  const b = (raw ?? {}) as Record<string, unknown>;
  const brief: BrandBrief = {
    nombre: s(b.nombre, 60),
    eslogan: s(b.eslogan, 80),
    nicho: s(b.nicho, 80),
    descripcion: s(b.descripcion, 600),
    publico: s(b.publico, 200),
    estilo: s(b.estilo, 60),
    colores: s(b.colores, 120),
    evitar: s(b.evitar, 200),
    correo: s(b.correo, 120) || fallbackEmail,
  };
  if (!brief.nombre) return "Escribe el nombre del negocio.";
  if (!brief.nicho) return "Escribe a qué se dedica el negocio.";
  if (brief.descripcion.length < 20) return "Describe tu negocio con un poco más de detalle (mínimo 20 caracteres).";
  if (!brief.estilo) return "Elige un estilo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief.correo)) return "Escribe un correo válido para recibir tu marca.";
  return brief;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Vuelve a iniciar sesión.", 401);

  const body = (await request.json().catch(() => null)) as { packageId?: string; brief?: unknown; feedback?: string } | null;
  if (!body?.packageId) return fail("Solicitud inválida.", 400);

  const admin = createAdminClient();
  const { data: pkg } = await admin
    .from("brand_packages")
    .select("*")
    .eq("id", body.packageId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pkg) return fail("No encontramos tu paquete de marca.", 404);

  const isRevision = pkg.status === "ready";
  if (pkg.status === "generating" && Date.now() - new Date(pkg.updated_at).getTime() < 4 * 60 * 1000) {
    return fail("Tu marca ya se está generando. Espera un momento y recarga la página.", 409);
  }
  if (isRevision && pkg.revisions_left <= 0) return fail("Ya usaste el ajuste incluido en tu paquete.", 400);

  let brief: BrandBrief;
  if (isRevision) {
    if (!body.feedback || body.feedback.trim().length < 10) return fail("Cuéntanos qué quieres cambiar (mínimo 10 caracteres).", 400);
    brief = pkg.brief as BrandBrief;
  } else {
    const v = validBrief(body.brief, user.email ?? "");
    if (typeof v === "string") return fail(v, 400);
    brief = v;
  }

  await admin.from("brand_packages").update({ status: "generating", brief }).eq("id", pkg.id);

  let result: BrandResult;
  try {
    result = await generateBrand(
      brief,
      isRevision ? { previous: pkg.result as BrandResult, feedback: body.feedback!.trim().slice(0, 600) } : undefined
    );
  } catch (e) {
    console.error("[marca-ia] generar:", e);
    await admin.from("brand_packages").update({ status: isRevision ? "ready" : "failed" }).eq("id", pkg.id);
    return fail("La IA no pudo crear tu marca en este intento. Inténtalo de nuevo (no se gastó tu ajuste).", 502);
  }

  const { data: updated, error } = await admin
    .from("brand_packages")
    .update({
      status: "ready",
      result,
      revisions_left: isRevision ? pkg.revisions_left - 1 : pkg.revisions_left,
    })
    .eq("id", pkg.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  // La paleta del kit queda en «Mis paletas» para elegirla al generar imágenes y videos.
  const palette = await savePackagePalette(admin, user.id, pkg.id, brief.nombre, result);

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const mail = brandEmail(brief, result, site);
  const sent = await sendEmail({ to: brief.correo, ...mail });
  if (sent.ok) await admin.from("brand_packages").update({ emailed_at: new Date().toISOString() }).eq("id", pkg.id);

  return NextResponse.json({ package: updated, emailed: sent.ok, emailError: sent.error, paletteSaved: palette.ok, paletteError: palette.error });
}
