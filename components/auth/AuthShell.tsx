import Link from "next/link";
import type { ReactNode } from "react";
import { MarkiaLogo } from "@/components/ui/MarkiaLogo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#4A154B] via-[#6B21A8] to-[#8C338A] p-12 text-[#FAF5EF] lg:flex lg:flex-col lg:justify-between">
        <Link href="/">
          <MarkiaLogo light />
        </Link>
        <div>
          <p className="text-4xl font-bold leading-tight">
            Tu marca publica
            <br />
            con constancia,
            <br />
            <span className="text-[#D9B382]">sin que pierdas tiempo.</span>
          </p>
          <p className="mt-4 max-w-sm text-[#FAF5EF]/75">
            Markia escribe, diseña y programa tus publicaciones con los colores y la voz de tu negocio.
          </p>
        </div>
        <p className="text-xs text-[#FAF5EF]/50">Hecho en Panamá · Pagos con Yappy</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D9B382]/20" />
      </aside>

      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <MarkiaLogo />
          </Link>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[#4A154B]/70">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

const ERRORES: Record<string, string> = {
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "Email not confirmed": "Aún no confirmas tu correo. Revisa tu bandeja de entrada (y la carpeta de spam).",
  "User already registered": "Ya existe una cuenta con ese correo. Inicia sesión.",
  "Password should be at least 6 characters.": "La contraseña debe tener al menos 8 caracteres.",
  "New password should be different from the old password.": "La nueva contraseña debe ser distinta de la anterior.",
};

export function traducirError(message: string) {
  if (ERRORES[message]) return ERRORES[message];
  if (/rate limit/i.test(message)) return "Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.";
  return message;
}
