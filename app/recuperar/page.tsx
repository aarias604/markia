"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, traducirError } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, errorCls, inputCls, labelCls, successCls } from "@/lib/ui";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/nueva-contrasena`,
    });
    setLoading(false);
    if (error) setError(traducirError(error.message));
    else setSent(true);
  }

  return (
    <AuthShell title="Recupera tu contraseña" subtitle="Te enviaremos un enlace para crear una nueva.">
      {sent ? (
        <p className={successCls}>
          Si existe una cuenta con <strong>{email}</strong>, te llegará un correo en unos minutos. Revisa también spam.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelCls}>Correo electrónico</label>
            <input id="email" type="email" required className={inputCls}
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          </div>
          {error && <p className={errorCls}>{error}</p>}
          <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar enlace
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-[#6B21A8] hover:underline">Volver a iniciar sesión</Link>
      </p>
    </AuthShell>
  );
}
