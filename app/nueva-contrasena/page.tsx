"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, traducirError } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, errorCls, inputCls, labelCls } from "@/lib/ui";

export default function NuevaContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes("session")
          ? "El enlace venció. Pide uno nuevo desde «¿La olvidaste?»."
          : traducirError(error.message)
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell title="Crea una nueva contraseña">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="p1" className={labelCls}>Nueva contraseña</label>
          <input id="p1" type="password" required minLength={8} autoComplete="new-password" className={inputCls}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label htmlFor="p2" className={labelCls}>Repite la contraseña</label>
          <input id="p2" type="password" required autoComplete="new-password" className={inputCls}
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className={errorCls}>{error}</p>}
        <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar contraseña
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/recuperar" className="font-semibold text-[#6B21A8] hover:underline">Pedir un enlace nuevo</Link>
      </p>
    </AuthShell>
  );
}
