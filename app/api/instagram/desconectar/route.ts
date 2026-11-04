// POST /api/instagram/desconectar · Borra la conexión (y el token) de Instagram del usuario.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("instagram_accounts").delete().eq("user_id", user.id);
  // Las publicaciones programadas para publicarse solas vuelven a modo manual.
  await admin.from("posts").update({ auto_publish: false }).eq("user_id", user.id).eq("status", "scheduled");
  return NextResponse.json({ ok: true });
}
