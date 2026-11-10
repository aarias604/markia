// Sincroniza los pagos con tarjeta de Tilopay con Markia. Solo servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUSD } from "@/lib/billing/subscription-state";
import { layout, notifyPaymentConfirmed, sendOnce, siteUrl, userEmail } from "@/lib/notifications";
import { chargeSavedCard, consultOrder } from "@/lib/tilopay";

/** Intentos por mensualidad (uno por día) antes de desactivar el cobro automático. */
export const MAX_ATTEMPTS = 3;

interface Charge {
  id: string;
  mandate_id: string;
  user_id: string;
  seq: number;
  ern: string;
  amount_cents: number;
  status: string;
  processed_at: string | null;
  created_at: string;
}
interface Mandate {
  id: string;
  user_id: string;
  purpose: string;
  status: string;
  autopay: boolean;
  initial_payment_id: string | null;
  card_token: string | null;
  created_at: string;
}

export interface CardInfo {
  token?: string | null;
  brand?: string | null;
  last4?: string | null;
  email?: string | null;
}

const TOKEN_RE = /^[A-Za-z0-9_\-:.|=+/]{6,200}$/;

async function applyCharge(admin: SupabaseClient, chargeId: string, reference: string | null) {
  const { data, error } = await admin.rpc("apply_card_charge", { p_charge_id: chargeId, p_reference: reference });
  if (error) throw new Error(error.message);
  const pay = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (pay?.id) await notifyPaymentConfirmed(admin, pay.id);
}

async function closeCharge(admin: SupabaseClient, id: string, status: string, error: string | null) {
  await admin.from("card_charges").update({ status, attempt_error: error?.slice(0, 300) ?? null, processed_at: new Date().toISOString() }).eq("id", id);
}

/**
 * Pago inicial (cobro 0): lo confirma con Tilopay y lo aplica.
 * Si el cliente activó la renovación automática, guarda el token de su tarjeta.
 */
export async function confirmInitial(admin: SupabaseClient, m: Mandate, card?: CardInfo) {
  const { data: ch } = await admin.from("card_charges").select("*").eq("mandate_id", m.id).eq("seq", 0).single();
  const charge = ch as Charge | null;
  if (!charge) return "error";
  if (charge.processed_at) return charge.status === "COMPLETED" ? "aplicado" : "fallido";

  const r = await consultOrder(charge.ern, charge.amount_cents);
  if (r.state === "not_found") return "en espera";

  if (r.state === "declined") {
    // En la primera hora el cliente aún puede reintentar con otra tarjeta en la misma pantalla.
    if (Date.now() - new Date(m.created_at).getTime() < 60 * 60000) return "fallido";
    await closeCharge(admin, charge.id, "FAILED", r.tx.response ?? null);
    await admin.from("card_mandates").update({ status: "failed", last_error: String(r.tx.response ?? "Rechazado").slice(0, 300) }).eq("id", m.id);
    if (m.initial_payment_id) await admin.from("payments").update({ status: "failed" }).eq("id", m.initial_payment_id).eq("status", "pending");
    return "fallido";
  }

  // Aprobado: primero guardamos la tarjeta (si aplica) y luego aplicamos el pago.
  if (m.autopay && card?.token && TOKEN_RE.test(card.token) && !m.card_token) {
    await admin.from("card_mandates").update({
      card_token: card.token,
      card_email: card.email ?? null,
      card_brand: card.brand ? card.brand.slice(0, 30) : null,
      card_last4: card.last4 ? card.last4.replace(/\D/g, "").slice(-4) || null : null,
    }).eq("id", m.id);
  }
  await applyCharge(admin, charge.id, String(r.tx.id_tilopay ?? r.tx.auth ?? "") || null);
  return "aplicado";
}

async function cardFailedEmail(admin: SupabaseClient, userId: string, ref: string, amountCents: number, final: boolean) {
  const to = await userEmail(admin, userId);
  if (!to) return;
  await sendOnce(admin, {
    userId,
    kind: final ? "card_failed" : "card_retry",
    ref,
    to,
    subject: final ? "No pudimos cobrar tu tarjeta · Markia" : "Tu tarjeta fue rechazada · lo intentaremos de nuevo",
    html: layout(
      "No pudimos cobrar tu tarjeta",
      final
        ? `<p>Intentamos cobrar <strong>${formatUSD(amountCents)}</strong> de tu plan con tu tarjeta varias veces, pero no se completó.
           Tu cobro automático quedó desactivado.</p>
           <p>Para no perder tu acceso, paga desde Markia con Yappy, tarjeta o cripto. Si pagas con tarjeta puedes volver a activar el cobro automático.</p>`
        : `<p>Intentamos cobrar <strong>${formatUSD(amountCents)}</strong> de tu plan con tu tarjeta y el banco lo rechazó.
           Lo intentaremos de nuevo mañana. Si prefieres, puedes pagar ahora desde Markia.</p>`,
      { label: "Pagar ahora", url: `${siteUrl()}/dashboard/planes` }
    ),
  });
}

async function handleDeclined(admin: SupabaseClient, c: Charge, message: string) {
  await closeCharge(admin, c.id, "FAILED", message);
  const { count } = await admin
    .from("card_charges")
    .select("id", { count: "exact", head: true })
    .eq("mandate_id", c.mandate_id)
    .gt("seq", 0)
    .eq("status", "FAILED")
    .gte("created_at", new Date(Date.now() - 6 * 86400000).toISOString());
  const attempts = count ?? 1;
  if (attempts >= MAX_ATTEMPTS) {
    await admin.from("card_mandates").update({ status: "failed", failed_attempts: attempts, last_error: message.slice(0, 300) }).eq("id", c.mandate_id);
    await cardFailedEmail(admin, c.user_id, c.mandate_id, c.amount_cents, true);
  } else {
    await admin.from("card_mandates").update({ failed_attempts: attempts, last_error: message.slice(0, 300) }).eq("id", c.mandate_id);
    await cardFailedEmail(admin, c.user_id, c.id, c.amount_cents, false);
  }
}

/** Cancela el cobro automático (Tilopay no necesita aviso: simplemente dejamos de cobrar). */
export async function cancelMandate(admin: SupabaseClient, mandateId: string) {
  await admin
    .from("card_mandates")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), cancel_requested: false, card_token: null })
    .eq("id", mandateId);
}

/** Tarea periódica: cancelaciones, pagos iniciales sin confirmar, cobros dudosos y mensualidades del día. */
export async function syncTilopay(admin: SupabaseClient) {
  const out = { canceled: 0, initial: 0, expired: 0, charged: 0, declined: 0, unknown: 0, errors: [] as string[] };
  const err = (where: string, e: unknown) => out.errors.push(`${where}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));

  // 1. Cancelaciones pedidas (por el cliente, por un cambio de plan o por otra tarjeta nueva)
  const { data: toCancel } = await admin.from("card_mandates").select("id").eq("provider", "tilopay").eq("cancel_requested", true).in("status", ["active", "pending"]);
  for (const m of toCancel ?? []) {
    await cancelMandate(admin, m.id);
    out.canceled++;
  }

  // 2. Pagos iniciales que no volvieron a Markia (el cliente cerró la ventana, etc.)
  const { data: pending } = await admin
    .from("card_mandates")
    .select("*")
    .eq("provider", "tilopay")
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 10 * 60000).toISOString())
    .limit(100);
  for (const m of (pending ?? []) as Mandate[]) {
    try {
      const r = await confirmInitial(admin, m);
      if (r === "aplicado") out.initial++;
      else if (r === "en espera" && Date.now() - new Date(m.created_at).getTime() > 2 * 86400000) {
        await admin.from("card_mandates").update({ status: "expired" }).eq("id", m.id).eq("status", "pending");
        await admin.from("card_charges").update({ status: "EXPIRED", processed_at: new Date().toISOString() }).eq("mandate_id", m.id).is("processed_at", null);
        if (m.initial_payment_id) await admin.from("payments").update({ status: "expired" }).eq("id", m.initial_payment_id).eq("status", "pending");
        out.expired++;
      }
    } catch (e) {
      err(`inicial ${m.id}`, e);
    }
  }

  // 3. Cobros mensuales con resultado dudoso (error de red): se consultan antes de reintentar
  const { data: doubtful } = await admin
    .from("card_charges")
    .select("*, card_mandates!inner(provider)")
    .eq("card_mandates.provider", "tilopay")
    .gt("seq", 0)
    .is("processed_at", null)
    .lt("created_at", new Date(Date.now() - 5 * 60000).toISOString())
    .limit(100);
  for (const c of (doubtful ?? []) as Charge[]) {
    try {
      const r = await consultOrder(c.ern, c.amount_cents);
      if (r.state === "approved") {
        await applyCharge(admin, c.id, String(r.tx.id_tilopay ?? r.tx.auth ?? "") || null);
        out.charged++;
      } else if (r.state === "declined") {
        await handleDeclined(admin, c, String(r.tx.response ?? "Rechazado"));
        out.declined++;
      } else if (Date.now() - new Date(c.created_at).getTime() > 2 * 3600000) {
        // Tilopay no tiene registro de la orden: no se cobró.
        await closeCharge(admin, c.id, "NOT_FOUND", "Tilopay no registró la orden");
      }
    } catch (e) {
      err(`consulta ${c.ern}`, e);
    }
  }

  // 4. Mensualidades que vencen hoy (o antes): un intento por día
  const { data: due, error: dueErr } = await admin.rpc("tilopay_due_charges", { p_limit: 100 });
  if (dueErr) err("vencidos", dueErr);
  const list = (due ?? []) as { mandate_id: string; user_id: string; due_date: string; amount_cents: number; card_token: string; card_email: string | null; attempts: number }[];
  for (const d of list) {
    try {
      const email = d.card_email || (await userEmail(admin, d.user_id));
      if (!email) {
        err(`mandato ${d.mandate_id}`, "sin correo");
        continue;
      }
      const { data: reserved, error: rErr } = await admin
        .rpc("reserve_tilopay_charge", { p_mandate_id: d.mandate_id, p_due: d.due_date, p_amount: d.amount_cents })
        .maybeSingle();
      const c = reserved as Charge | null;
      if (rErr) throw new Error(rErr.message);
      if (!c?.id) continue; // ya hay un cobro en curso

      const r = await chargeSavedCard({ orderNumber: c.ern, amountCents: c.amount_cents, email, card: d.card_token });
      if (r.state === "approved") {
        await applyCharge(admin, c.id, r.reference || r.auth || null);
        out.charged++;
      } else if (r.state === "declined") {
        await handleDeclined(admin, c, r.message);
        out.declined++;
      } else {
        // Se resolverá en la siguiente pasada con consultOrder (paso 3).
        await admin.from("card_charges").update({ status: "UNKNOWN", attempt_error: r.message.slice(0, 300) }).eq("id", c.id);
        out.unknown++;
      }
    } catch (e) {
      err(`cobro ${d.mandate_id}`, e);
    }
  }
  return out;
}
