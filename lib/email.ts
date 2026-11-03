// Envío de correos con Resend (https://resend.com). Solo servidor.
// Variables en Vercel:
//   RESEND_API_KEY = re_...
//   EMAIL_FROM     = Markia <hola@markiapa.com>   (dominio verificado en Resend)

export interface EmailAttachment {
  filename: string;
  /** Contenido en base64 */
  content: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "El envío de correos no está configurado (RESEND_API_KEY / EMAIL_FROM)." };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, attachments: opts.attachments }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[email] Resend", res.status, text.slice(0, 300));
    return { ok: false, error: `No se pudo enviar el correo (HTTP ${res.status}).` };
  }
  return { ok: true };
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
