"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, traducirError } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, errorCls, inputCls, labelCls } from "@/lib/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "enlace") {
      setError("El enlace del correo no es válido o ya venció. Inicia sesión o pide uno nuevo.");
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setError(traducirError(error?.message ?? "No se pudo iniciar sesión."));
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    router.replace(profile?.onboarding_completed ? "/dashboard" : "/onboarding");
    router.refresh();
  }

  return (
    <AuthShell title="Bienvenido de vuelta" subtitle="Entra a tu cuenta de Markia.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={labelCls}>Correo electrónico</label>
          <input id="email" type="email" required autoComplete="email" className={inputCls}
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelCls}>Contraseña</label>
            <Link href="/recuperar" className="mb-1.5 text-xs font-medium text-[#6B21A8] hover:underline">
              ¿La olvidaste?
            </Link>
          </div>
          <input id="password" type="password" required autoComplete="current-password" className={inputCls}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className={errorCls}>{error}</p>}

        <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Entrando…" : "Iniciar sesión"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-[#6B21A8] hover:underline">Crea una gratis</Link>
      </p>
    </AuthShell>
  );
}
