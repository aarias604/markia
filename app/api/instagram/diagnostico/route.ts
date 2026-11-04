// GET /api/instagram/diagnostico · Solo administradores.
// Revisa la configuración de Meta en Vercel sin mostrar la clave secreta.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { igRedirectUri } from "@/lib/instagram";

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Solo para administradores. Inicia sesión con tu cuenta de administrador." }, { status: 403 });

  const appId = process.env.META_APP_ID ?? "";
  const secret = process.env.META_APP_SECRET ?? "";
  const configId = process.env.META_CONFIG_ID ?? "";
  const old = { INSTAGRAM_APP_ID: !!process.env.INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET: !!process.env.INSTAGRAM_APP_SECRET };

  // Prueba real: Meta solo entrega un token de app si el ID y la clave son correctos y de la misma app.
  let prueba = "No se probó: faltan META_APP_ID o META_APP_SECRET.";
  if (appId && secret) {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: secret,
        grant_type: "client_credentials",
      })}`
    );
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
    prueba = json.access_token
      ? "✅ CORRECTA: Meta aceptó el ID y la clave secreta."
      : `❌ INCORRECTA: ${json.error?.message ?? `HTTP ${res.status}`}`;
  }

  return NextResponse.json({
    "1_META_APP_ID": appId || "❌ falta",
    "2_META_APP_SECRET": secret
      ? `presente · ${secret.length} caracteres · termina en …${secret.slice(-4)}${/\s/.test(secret) ? " · ⚠️ TIENE ESPACIOS" : ""}`
      : "❌ falta",
    "3_META_CONFIG_ID": configId || "❌ falta",
    "4_redirect_uri": igRedirectUri(),
    "5_prueba_de_la_clave": prueba,
    "6_variables_viejas": old.INSTAGRAM_APP_ID || old.INSTAGRAM_APP_SECRET
      ? "⚠️ Borra INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET de Vercel"
      : "ok",
  });
}
