"use client";

// Avisos por WhatsApp: número, permiso y mensaje de prueba.
import { useState, type FormEvent } from "react";
import { BellRing, CalendarClock, Lightbulb, Loader2, MessageCircle, Send } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { createClient } from "@/lib/supabase/client";
import { btnGold, btnSecondary, cardCls, errorCls, inputCls, labelCls, successCls } from "@/lib/ui";

/** Acepta 8 dígitos de Panamá (6000-0000) o un número internacional con código de país. */
function validPhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^00/, "");
  return d.length === 8 || (d.length >= 10 && d.length <= 15);
}

export default function WhatsAppPage() {
  const { userId, profile, refresh } = useDashboard();
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [optIn, setOptIn] = useState(!!profile?.whatsapp_opt_in);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saved = (profile?.phone ?? "") === phone && !!profile?.whatsapp_opt_in === optIn;

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (optIn && !validPhone(phone)) return setMsg({ ok: false, text: "Escribe tu número de WhatsApp, por ejemplo 6000-0000." });
    setSaving(true);
    const { error } = await createClient()
      .from("profiles")
      .update({ phone: phone.trim() || null, whatsapp_opt_in: optIn })
      .eq("id", userId);
    setSaving(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: optIn ? "¡Listo! Recibirás tus avisos por WhatsApp." : "Avisos por WhatsApp desactivados." });
    await refresh();
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    const res = await fetch("/api/whatsapp/prueba", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setTesting(false);
    setMsg(res.ok ? { ok: true, text: "Mensaje enviado. Revisa tu WhatsApp." } : { ok: false, text: json.error ?? "No se pudo enviar." });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><MessageCircle className="h-6 w-6 text-[#8C338A]" /> Avisos por WhatsApp</h1>
        <p className="mt-1 text-[#4A154B]/70">Te avisamos por WhatsApp para que nunca se te pase publicar.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={cardCls}>
          <p className="flex items-center gap-2 font-semibold"><CalendarClock className="h-5 w-5 text-[#8C338A]" /> El día y la hora de cada publicación</p>
          <p className="mt-1 text-sm text-[#4A154B]/70">
            Recibes la imagen, la descripción sugerida, los hashtags y el enlace a Markia. Solo descargas, copias y publicas.
          </p>
        </div>
        <div className={cardCls}>
          <p className="flex items-center gap-2 font-semibold"><Lightbulb className="h-5 w-5 text-[#8C338A]" /> Si llevas días sin publicar</p>
          <p className="mt-1 text-sm text-[#4A154B]/70">
            Cada 2 días sin publicaciones programadas te enviamos una idea de qué publicar, pensada para tu negocio.
          </p>
        </div>
      </div>

      <form onSubmit={save} className={`${cardCls} space-y-4`}>
        <div className="max-w-sm">
          <label className={labelCls}>Tu número de WhatsApp</label>
          <input className={inputCls} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="6000-0000" maxLength={20} />
          <p className="mt-1 text-xs text-[#4A154B]/60">Si no es de Panamá, escríbelo con el código de país (por ejemplo +57…).</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4A154B]" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          <span>
            Acepto recibir por WhatsApp los recordatorios de mis publicaciones y sugerencias de contenido de Markia. Puedo
            desactivarlo aquí cuando quiera.
          </span>
        </label>
        {msg && <p className={msg.ok ? successCls : errorCls}>{msg.text}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={btnGold} disabled={saving || saved}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Guardar
          </button>
          {profile?.whatsapp_opt_in && saved && (
            <button type="button" className={btnSecondary} onClick={test} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviarme un mensaje de prueba
            </button>
          )}
        </div>
      </form>

      <p className="text-xs text-[#4A154B]/60">
        Los mensajes llegan desde el WhatsApp oficial de Markia. Solo los recibes si tu plan está activo. También seguirás recibiendo
        los recordatorios por correo.
      </p>
    </div>
  );
}
