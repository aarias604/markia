// GET /api/instagram/callback · Meta regresa aquí después de que el usuario autoriza.
import { NextResponse, type NextRequest } from "next/server";
import { fbFindPage } from "@/lib/facebook";
import { igConnect } from "@/lib/instagram";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (query: string) => {
    const res = NextResponse.redirect(`${origin}/dashboard/instagram?${query}`);
    res.cookies.delete("ig_state");
    return res;
  };

  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return back("error=cancelado");

  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state || state !== request.cookies.get("ig_state")?.value) return back("error=estado");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const acc = await igConnect(code);
    const now = new Date().toISOString();
    // Página de Facebook para publicar también allí (opcional).
    const page = acc.mode === "facebook" ? await fbFindPage(acc.token, acc.igUserId) : null;
    const { error } = await createAdminClient()
      .from("instagram_accounts")
      .upsert(
        {
          user_id: user.id,
          api_mode: acc.mode,
          ig_user_id: acc.igUserId,
          username: acc.username,
          access_token: acc.token,
          token_expires_at: acc.expiresAt,
          connected_at: now,
          refreshed_at: now,
          last_error: null,
          fb_page_id: page?.pageId ?? null,
          fb_page_name: page?.pageName ?? null,
          fb_page_token: page?.pageToken ?? null,
        },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(error.message);
    return back("ok=1");
  } catch (e) {
    console.error("[instagram] callback", e);
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 400) : "desconocido")}`);
  }
}
