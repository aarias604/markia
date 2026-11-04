import Link from "next/link";
import type { ReactNode } from "react";
import { MarkiaLogo } from "@/components/ui/MarkiaLogo";
import { LEGAL } from "@/lib/legal";

export const LEGAL_PAGES = [
  { href: "/legal/terminos", label: "Términos y Condiciones" },
  { href: "/legal/privacidad", label: "Política de Privacidad" },
  { href: "/legal/reembolsos", label: "Pagos, cancelación y reembolsos" },
  { href: "/legal/referidos", label: "Términos del Programa de Referidos" },
  { href: "/legal/cookies", label: "Política de Cookies" },
  { href: "/legal/eliminacion-datos", label: "Eliminación de datos" },
];

export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[#D9B382]/40 bg-[#FDFBF7]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/"><MarkiaLogo /></Link>
          <Link href="/dashboard" className="text-sm font-semibold text-[#6B21A8] hover:underline">Ir a mi cuenta</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[240px_1fr]">
        <nav className="flex flex-col gap-1 text-sm lg:sticky lg:top-8 lg:self-start">
          <p className="mb-2 font-bold">Documentos legales</p>
          {LEGAL_PAGES.map((p) => (
            <Link key={p.href} href={p.href} className="rounded-lg px-3 py-2 hover:bg-[#4A154B]/5">{p.label}</Link>
          ))}
        </nav>
        <article className="legal max-w-3xl">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-[#4A154B]/60">Última actualización: {LEGAL.actualizado} · Versión {LEGAL.version}</p>
          <div className="mt-8 space-y-4 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:space-y-2 [&_a]:text-[#6B21A8] [&_a]:underline">
            {children}
          </div>
        </article>
      </div>
    </div>
  );
}

export function Responsable() {
  return (
    <ul>
      <li><strong>Titular:</strong> {LEGAL.razonSocial}</li>
      <li><strong>RUC:</strong> {LEGAL.ruc} · <strong>Aviso de Operación:</strong> {LEGAL.avisoOperacion}</li>
      <li><strong>Domicilio:</strong> {LEGAL.direccion}</li>
      <li><strong>Correo:</strong> {LEGAL.correoSoporte} · <strong>Teléfono:</strong> {LEGAL.telefono}</li>
    </ul>
  );
}
