// Verifica que quien llama a una ruta /api/admin sea administrador. Solo servidor.
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!data?.is_admin) return null;
  return { admin, user };
}
