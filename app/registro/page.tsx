"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Gift, Loader2, MailCheck } from "lucide-react";
import { AuthShell, traducirError } from "@/components/auth/AuthShell";
import { readStoredRef } from "@/components/legal/RefCapture";
import { LEGAL } from "@/lib/legal";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, errorCls, inputCls, labelCls } from "@/lib/ui";

export default function RegistroPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    setRefCode(readStoredRef());
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!accepted) {
      setError("Debes aceptar los Términos y Condiciones y la Política de Privacidad.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        data: {
          full_name: fullName.trim(),
          terms_version: LEGAL.version,
          ...(refCode ? { ref: refCode } : {}),
        },
      },
    });
    setLoading(false);

    if (error) {
      setError(traducirError(error.message));
      return;
    }
    // Si la confirmación de correo está desactivada, ya hay sesión.
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthShell title="Revisa tu correo">
        <div className="rounded-2xl border border-[#D9B382]/50 bg-[#FDFBF7] p-6 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-[#8C338A]" />
          <p className="mt-4 text-sm">
            Te enviamos un enlace a <strong>{sentTo}</strong>. Ábrelo para confirmar tu cuenta y seguir con la
            configuración de tu marca.
          </p>
          <p className="mt-3 text-xs text-[#4A154B]/60">
            ¿No llega? Revisa la carpeta de spam. Si ya tenías una cuenta con ese correo,{" "}
            <Link href="/login" className="font-semibold underline">inicia sesión</Link>.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crea tu cuenta" subtitle="En 3 minutos tendrás tu kit de marca listo.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className={labelCls}>Tu nombre</label>
          <input id="name" required autoComplete="name" className={inputCls}
            value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ana Pérez" />
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>Correo electrónico</label>
          <input id="email" type="email" required autoComplete="email" className={inputCls}
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>Contraseña</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls}
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#4A154B]" checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)} />
          <span>
            Soy mayor de 18 años y acepto los{" "}
            <Link href="/legal/terminos" target="_blank" className="font-semibold underline">Términos y Condiciones</Link> y la{" "}
            <Link href="/legal/privacidad" target="_blank" className="font-semibold underline">Política de Privacidad</Link>, incluido
            el tratamiento de mis datos por proveedores fuera de Panamá para prestar el servicio.
          </span>
        </label>

        {refCode && (
          <p className="flex items-center gap-2 rounded-xl bg-[#D9B382]/20 px-4 py-2 text-sm">
            <Gift className="h-4 w-4 text-[#8C338A]" /> Te registras con el código de referido <strong>{refCode}</strong>
          </p>
        )}

        {error && <p className={errorCls}>{error}</p>}

        <button type="submit" disabled={loading || !accepted} className={`${btnPrimary} w-full`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-[#6B21A8] hover:underline">Inicia sesión</Link>
      </p>
    </AuthShell>
  );
}
