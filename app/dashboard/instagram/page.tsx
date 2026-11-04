"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Send } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { btnGold, btnSecondary, cardCls, errorCls, successCls } from "@/lib/ui";

const ERRORS: Record<string, string> = {
  plan: "La publicación automática está en pruebas: por ahora solo los administradores pueden conectarla.",
  config: "La conexión con Instagram aún no está configurada en Markia. Escríbenos a hola@markiapa.com.",
  cancelado: "Cancelaste la autorización en Instagram.",
  estado: "La autorización venció o no es válida. Inténtalo de nuevo.",
};

export default function InstagramPage() {
  const { instagram, planHasAutopost, canGenerate, refresh } = useDashboard();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("ok")) setMsg({ ok: true, text: "¡Instagram conectado! Ya puedes programar publicaciones automáticas." });
    const err = sp.get("error");
    if (err) setMsg({ ok: false, text: ERRORS[err] ?? `No se pudo conectar: ${err}` });
    if (sp.get("ok") || err) window.history.replaceState(null, "", "/dashboard/instagram");
  }, []);

  async function disconnect() {
    setBusy(true);
    const res = await fetch("/api/instagram/desconectar", { method: "POST" });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: "No se pudo desconectar." });
    setMsg({ ok: true, text: "Instagram desconectado. Tus publicaciones programadas pasaron a modo manual." });
    await refresh();
  }

  const expires = instagram ? new Date(instagram.token_expires_at) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Send className="h-6 w-6 text-[#8C338A]" /> Instagram</h1>
        <p className="mt-1 text-[#4A154B]/70">Conecta tu cuenta y Markia publicará por ti a la hora que programes.</p>
      </div>

      {msg && <p className={msg.ok ? successCls : errorCls}>{msg.text}</p>}

      {!planHasAutopost ? (
        <div className={`${cardCls} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <p className="flex items-center gap-2"><Lock className="h-5 w-5 text-[#8C338A]" /> La publicación automática está en pruebas y pronto estará disponible.</p>
          <Link href="/dashboard/calendario" className={btnGold}>Ir al calendario</Link>
        </div>
      ) : instagram ? (
        <div className={`${cardCls} space-y-3`}>
          <p className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Conectado como @{instagram.username}
          </p>
          <p className="text-sm text-[#4A154B]/70">
            La conexión se renueva sola. Vence el {expires?.toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" })} si no se renueva.
          </p>
          {instagram.last_error && (
            <p className="flex gap-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" /> {instagram.last_error} — vuelve a conectar tu cuenta.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <a href="/api/instagram/conectar" className={btnSecondary}>Volver a conectar</a>
            <button className={btnSecondary} onClick={disconnect} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Desconectar
            </button>
          </div>
        </div>
      ) : (
        <div className={`${cardCls} space-y-4`}>
          <h2 className="text-lg font-bold">Conecta tu cuenta de Instagram</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Tu cuenta debe ser <strong>profesional</strong> (empresa o creador). En la app de Instagram: Configuración → Tipo de cuenta y herramientas → Cambiar a cuenta profesional.</li>
            <li>Pulsa «Conectar Instagram», inicia sesión y acepta los permisos.</li>
            <li>Al volver aquí verás tu usuario conectado.</li>
          </ol>
          <a href="/api/instagram/conectar" className={`${btnGold} ${!canGenerate ? "pointer-events-none opacity-60" : ""}`}>
            <Send className="h-4 w-4" /> Conectar Instagram
          </a>
        </div>
      )}

      <div className={cardCls}>
        <h2 className="font-bold">Cómo funciona</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>En cada publicación eliges <strong>Publicación</strong> o <strong>Historia</strong>, la fecha y la hora, y marcas «Publicar automáticamente».</li>
          <li>Markia revisa cada 5 minutos y publica las que ya llegaron a su hora.</li>
          <li>Las historias se publican sin descripción; Instagram no permite stickers ni enlaces por esta vía.</li>
          <li>Si algo falla, lo reintentamos hasta 3 veces y te avisamos por correo.</li>
        </ul>
      </div>
    </div>
  );
}
