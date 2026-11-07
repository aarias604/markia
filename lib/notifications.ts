// Markia · Correos automáticos (solo servidor).
// Cada aviso se registra en email_log para no enviarlo dos veces.
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, sendEmail } from "@/lib/email";
import { formatUSD } from "@/lib/billing/subscription-state";

const e = escapeHtml;

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

export function adminEmail() {
  return process.env.ADMIN_EMAIL || "hola@markiapa.com";
}

/** Plantilla base con la marca Markia. */
export function layout(title: string, body: string, cta?: { label: string; url: string }) {
  const button = cta
    ? `<p style="margin:28px 0 8px"><a href="${cta.url}" style="background:#4A154B;color:#FAF5EF;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block">${e(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#FAF5EF;font-family:Arial,Helvetica,sans-serif;color:#4A154B">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:20px;font-weight:bold;margin:0 0 16px"><span style="background:#4A154B;color:#D9B382;border-radius:8px;padding:2px 8px">M</span> Markia</p>
    <div style="background:#FDFBF7;border:1px solid #ecdcc4;border-radius:16px;padding:24px;line-height:1.55">
      <h1 style="font-size:20px;margin:0 0 12px">${e(title)}</h1>
      ${body}
      ${button}
    </div>
    <p style="font-size:11px;color:#8a7a8a;margin-top:16px">Recibes este correo porque tienes una cuenta en Markia. ¿Dudas? Responde a este correo.</p>
  </div></body></html>`;
}

/**
 * Envía un correo una sola vez por (usuario, tipo, referencia).
 * Devuelve true si se envió ahora.
 */
export async function sendOnce(
  admin: SupabaseClient,
  opts: { userId: string | null; kind: string; ref: string; to: string; subject: string; html: string }
) {
  const { error } = await admin.from("email_log").insert({ user_id: opts.userId, kind: opts.kind, ref: opts.ref });
  if (error) {
    if (error.code === "23505") return false; // ya enviado
    console.error("[notificaciones] email_log", error);
    return false;
  }
  const sent = await sendEmail({ to: opts.to, subject: opts.subject, html: opts.html });
  if (!sent.ok) {
    // Si falló el envío, borramos el registro para reintentar mañana.
    const del = admin.from("email_log").delete().match({ kind: opts.kind, ref: opts.ref });
    await (opts.userId ? del.eq("user_id", opts.userId) : del.is("user_id", null));
    return false;
  }
  return true;
}

export async function userEmail(admin: SupabaseClient, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

const fecha = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-PA", { weekday: "long", day: "numeric", month: "long" });

// ---------------------------------------------------------------------
// Avisos de suscripción
// ---------------------------------------------------------------------

export function expiringEmail(name: string, plan: string, due: string, amountCents: number) {
  return {
    subject: `Tu ${plan} vence en 5 días`,
    html: layout(
      `${name}, tu plan vence pronto`,
      `<p>Tu <strong>${e(plan)}</strong> vence el <strong>${fecha(due)}</strong>.</p>
       <p>Renueva por <strong>${formatUSD(amountCents)}</strong> con Yappy o con cripto y suma 30 días más para seguir creando contenido sin interrupciones.</p>`,
      { label: "Renovar ahora", url: `${siteUrl()}/dashboard/planes` }
    ),
  };
}

export function graceEmail(name: string, plan: string, monthlyCents: number, dueCents: number, graceUntil: string) {
  return {
    subject: "Tu plan venció: tienes 30 días para ponerte al día",
    html: layout(
      `${name}, tu plan venció`,
      `<p>Tu cuenta sigue funcionando normalmente durante el período de gracia, hasta el <strong>${fecha(graceUntil)}</strong>.</p>
       <p>Tienes 1 mes vencido de tu ${e(plan)} (${formatUSD(monthlyCents)}). Para ponerte al día pagas los 2 meses acumulados:
       <strong>${formatUSD(dueCents)}</strong>.</p>
       <p>Si no recibimos el pago antes de esa fecha, tu cuenta se suspenderá y el generador se bloqueará.</p>`,
      { label: "Ponerme al día", url: `${siteUrl()}/dashboard/planes` }
    ),
  };
}

export function graceReminderEmail(name: string, daysLeft: number, dueCents: number) {
  return {
    subject: `Quedan ${daysLeft} días antes de la suspensión de tu cuenta`,
    html: layout(
      `${name}, último aviso`,
      `<p>Te quedan <strong>${daysLeft} día(s)</strong> de período de gracia. Paga <strong>${formatUSD(dueCents)}</strong> para mantener tu cuenta activa y no perder acceso al generador.</p>`,
      { label: "Pagar ahora", url: `${siteUrl()}/dashboard/planes` }
    ),
  };
}

export function suspendedEmail(name: string, originalCents: number, offerCents: number) {
  return {
    subject: "Tu cuenta fue suspendida · Reactívala con 35% de descuento",
    html: layout(
      `${name}, tu cuenta está suspendida`,
      `<p>Pasaron los 30 días de gracia sin recibir tu pago, así que bloqueamos el generador. Tus datos, tu kit de marca y tus publicaciones siguen guardados.</p>
       <p>Te ofrecemos un <strong>35% de descuento</strong> para volver: en lugar de ${formatUSD(originalCents)} pagas solo
       <strong>${formatUSD(offerCents)}</strong> y tu cuenta se reactiva al instante.</p>`,
      { label: "Reactivar mi cuenta", url: `${siteUrl()}/dashboard` }
    ),
  };
}

// ---------------------------------------------------------------------
// Confirmación de pago
// ---------------------------------------------------------------------

const ADDON_NAMES: Record<string, string> = {
  posts_boost_5: "Boost de 5 publicaciones",
  template_pack: "Pack de Plantillas",
  logo_service: "Generación de Marca con IA",
};

const KIND_TEXT: Record<string, string> = {
  first_payment: "Activaste tu plan",
  renewal: "Renovaste tu plan",
  grace_catchup: "Te pusiste al día con tu plan",
  reactivation: "Reactivaste tu cuenta",
};

/** Envía la confirmación de un pago ya aplicado (una sola vez por pago). */
export async function notifyPaymentConfirmed(admin: SupabaseClient, paymentId: string) {
  try {
    const { data: p } = await admin
      .from("payments")
      .select("id, user_id, kind, plan_id, addon_id, amount_cents, method, is_upgrade, applied_at, needs_review")
      .eq("id", paymentId)
      .maybeSingle();
    if (!p || !p.applied_at || p.needs_review) return;

    const [{ data: sub }, { data: profile }, to] = await Promise.all([
      admin.from("subscriptions").select("next_due_date, plans(name)").eq("user_id", p.user_id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", p.user_id).maybeSingle(),
      userEmail(admin, p.user_id),
    ]);
    if (!to) return;

    const name = (profile?.full_name ?? "").split(" ")[0] || "Hola";
    const planName = (sub?.plans as { name?: string } | null)?.name ?? "plan";
    let title: string;
    let detail: string;
    let cta = { label: "Ir a Markia", url: `${siteUrl()}/dashboard` };

    if (p.kind === "addon") {
      const item = ADDON_NAMES[p.addon_id ?? ""] ?? "tu compra";
      title = `Compra confirmada: ${item}`;
      detail = p.addon_id === "logo_service"
        ? "<p>Ya puedes crear tu marca. Entra a <strong>Marca con IA</strong>, cuéntanos de tu negocio y en 1 o 2 minutos tendrás tu logo, paleta y guía.</p>"
        : "<p>Ya está disponible en tu cuenta.</p>";
      if (p.addon_id === "logo_service") cta = { label: "Crear mi marca", url: `${siteUrl()}/dashboard/marca-ia` };
    } else {
      title = p.is_upgrade ? "¡Bienvenido al Plan PRO!" : KIND_TEXT[p.kind] ?? "Pago confirmado";
      detail = `<p>${p.is_upgrade ? "Tu cuenta ya tiene el Plan PRO con 35% de descuento en este primer pago." : `Tu ${e(planName)} está activo.`}
        ${sub?.next_due_date ? `Tu próxima fecha de pago es el <strong>${fecha(sub.next_due_date)}</strong>.` : ""}</p>`;
    }

    await sendOnce(admin, {
      userId: p.user_id,
      kind: "payment_confirmed",
      ref: p.id,
      to,
      subject: `${title} · ${formatUSD(p.amount_cents)}`,
      html: layout(
        `${name}, ${title.charAt(0).toLowerCase()}${title.slice(1)}`,
        `<p>Recibimos tu pago de <strong>${formatUSD(p.amount_cents)}</strong> por ${p.method === "crypto" ? "criptomonedas" : p.method === "card" ? "tarjeta" : "Yappy"}.</p>${detail}`,
        cta
      ),
    });
  } catch (err) {
    console.error("[notificaciones] pago confirmado", err);
  }
}

// ---------------------------------------------------------------------
// Recordatorios de publicación (clientes publican manualmente)
// ---------------------------------------------------------------------

export interface ReminderPost {
  id: string;
  title: string | null;
  caption: string | null;
  hashtags: string[] | null;
  placement: "feed" | "story" | null;
  scheduled_at: string;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-PA", { hour: "numeric", minute: "2-digit", timeZone: "America/Panama" });
const destino = (p: ReminderPost) => (p.placement === "story" ? "Historia" : "Publicación");

/** A la hora programada: "es hora de publicar", con la descripción lista para copiar. */
export function publishReminderEmail(name: string, p: ReminderPost, imageLinks: string[]) {
  const description = [p.caption ?? "", (p.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
  const links = imageLinks.length
    ? `<p>${imageLinks.map((u, i) => `<a href="${u}">Descargar imagen ${i + 1}</a>`).join(" · ")}<br><span style="font-size:12px;color:#8a7a8a">Los enlaces funcionan por 24 horas.</span></p>`
    : "";
  const desc =
    p.placement === "story"
      ? "<p>Es una <strong>historia</strong>: solo sube la imagen, no necesita descripción.</p>"
      : `<p><strong>Descripción para copiar y pegar:</strong></p>
         <div style="white-space:pre-wrap;background:#FAF5EF;border:1px solid #ecdcc4;border-radius:12px;padding:14px;font-size:14px">${e(description || "(sin descripción)")}</div>`;
  return {
    subject: `⏰ Es hora de publicar: ${p.title || destino(p)}`,
    html: layout(
      `${name}, es hora de publicar`,
      `<p>Programaste esta ${destino(p).toLowerCase()} para hoy a las <strong>${hora(p.scheduled_at)}</strong>:
       <strong>${e(p.title || "Publicación")}</strong>.</p>
       ${desc}
       ${links}
       <ol style="padding-left:18px">
         <li>Abre Markia y pulsa <strong>«Descargar imagen + descripción»</strong> en la publicación.</li>
         <li>Súbela a Instagram como ${destino(p).toLowerCase()}${p.placement === "story" ? "" : " y pega la descripción"}.</li>
         <li>Vuelve a Markia y pulsa <strong>«Marcar como publicado»</strong>.</li>
       </ol>`,
      { label: "Abrir mi calendario", url: `${siteUrl()}/dashboard/calendario` }
    ),
  };
}

/** Resumen de la mañana: todo lo que toca publicar hoy. */
export function dailyAgendaEmail(name: string, posts: ReminderPost[]) {
  const rows = posts
    .map(
      (p) => `<tr>
        <td style="padding:8px 12px 8px 0;font-weight:bold;white-space:nowrap">${hora(p.scheduled_at)}</td>
        <td style="padding:8px 0">${e(p.title || "Publicación")} <span style="color:#8C338A">· ${destino(p)}</span></td>
      </tr>`
    )
    .join("");
  return {
    subject: `📅 Hoy te toca publicar ${posts.length} ${posts.length === 1 ? "vez" : "veces"} en Instagram`,
    html: layout(
      `${name}, esto es lo que publicas hoy`,
      `<table style="border-collapse:collapse;width:100%">${rows}</table>
       <p>Te enviaremos otro correo a la hora de cada publicación con su descripción lista para copiar.</p>`,
      { label: "Ver y descargar", url: `${siteUrl()}/dashboard/calendario` }
    ),
  };
}

// ---------------------------------------------------------------------
// Avisos para el administrador
// ---------------------------------------------------------------------

export async function notifyAdminCrypto(admin: SupabaseClient, paymentId: string) {
  try {
    const { data: p } = await admin
      .from("payments")
      .select("id, user_id, amount_cents, crypto_network, crypto_tx_hash")
      .eq("id", paymentId)
      .maybeSingle();
    if (!p) return;
    const who = (await userEmail(admin, p.user_id)) ?? p.user_id;
    await sendOnce(admin, {
      userId: null,
      kind: "admin_crypto",
      ref: p.id,
      to: adminEmail(),
      subject: `Nuevo pago cripto por verificar · ${formatUSD(p.amount_cents)}`,
      html: layout(
        "Nuevo pago con cripto",
        `<p><strong>${e(who)}</strong> registró un pago de <strong>${formatUSD(p.amount_cents)}</strong>.</p>
         <p>Red: ${e(p.crypto_network ?? "")}<br>Comprobante: <code>${e(p.crypto_tx_hash ?? "")}</code></p>
         <p>Verifica en Lulubit que llegó el monto exacto y apruébalo.</p>`,
        { label: "Abrir Administración", url: `${siteUrl()}/dashboard/admin` }
      ),
    });
  } catch (err) {
    console.error("[notificaciones] admin cripto", err);
  }
}

export function adminDigestEmail(counts: { crypto: number; payouts: number; brands: number }) {
  const rows = [
    counts.crypto ? `<li><strong>${counts.crypto}</strong> pago(s) con cripto por verificar</li>` : "",
    counts.payouts ? `<li><strong>${counts.payouts}</strong> solicitud(es) de retiro de referidos (pagar en máx. 10 días hábiles)</li>` : "",
    counts.brands ? `<li><strong>${counts.brands}</strong> cliente(s) pagaron la Marca con IA y aún no la crean</li>` : "",
  ].join("");
  return {
    subject: "Markia · Pendientes de hoy",
    html: layout("Tienes pendientes en Markia", `<ul>${rows}</ul>`, {
      label: "Abrir Administración",
      url: `${siteUrl()}/dashboard/admin`,
    }),
  };
}
