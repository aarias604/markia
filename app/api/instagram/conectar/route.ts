// GET /api/instagram/conectar · Envía al usuario a Instagram para autorizar a Markia.
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { igAuthorizeUrl } from "@/lib/instagram";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: allowed } = await createAdminClient().rpc("can_autopost", { p_user_id: user.id });
  if (!allowed) return NextResponse.redirect(`${origin}/dashboard/instagram?error=plan`);

  let url: string;
  try {
    const state = crypto.randomBytes(16).toString("hex");
    url = igAuthorizeUrl(state);
    const res = NextResponse.redirect(url);
    res.cookies.set("ig_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return res;
  } catch (e) {
    console.error("[instagram] conectar", e);
    return NextResponse.redirect(`${origin}/dashboard/instagram?error=config`);
  }
}
