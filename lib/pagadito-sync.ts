// Sincroniza los cobros con tarjeta de Pagadito con Markia. Solo servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUSD } from "@/lib/billing/subscription-state";
import { layout, notifyPaymentConfirmed, sendOnce, siteUrl, userEmail } from "@/lib/notifications";
import { cancelPending, getPendingStatus, getRecurringStatus } from "@/lib/pagadito";

interface Charge {
  id: string;
  mandate_id: string;
  user_id: string;
  seq: number;
  ern: string;
  amount_cents: number;
  token_pending: string | null;
  processed_at: string | null;
  status: string;
}
interface Mandate {
  id: string;
  user_id: string;
  purpose: string;
  status: string;
  auth_token: string | null;
  initial_payment_id: string | null;
}

const FAILED = ["FAILED", "REVOKED", "UNCOLLECTABLE", "CANCELED", "EXPIRED"];

async function cardFailedEmail(admin: SupabaseClient, c: Charge) {
  const to = await userEmail(admin, c.user_id);
  if (!to) return;
  await sendOnce(admin, {
    userId: c.user_id,
    kind: "card_failed",
    ref: c.id,
    to,
    subject: "No pudimos cobrar tu tarjeta · Markia",
    html: layout(
      "No pudimos cobrar tu tarjeta",
      `<p>Intentamos cobrar <strong>${formatUSD(c.amount_cents)}</strong> de tu plan con tu tarjeta, pero el pago no se completó.
       Tu cobro automático quedó desactivado.</p>
       <p>Para no perder tu acceso, paga desde Markia con Yappy, cripto o tarjeta. Si pagas con tarjeta puedes volver a activar el cobro automático.</p>`,
      { label: "Pagar ahora", url: `${siteUrl()}/dashboard/planes` }
    ),
  });
}

/** Aplica el resultado de un cobro según el estado que informa Pagadito. */
export async function processChargeStatus(admin: SupabaseClient, c: Charge, status: string, reference?: string | null) {
  if (c.processed_at) return "ya procesado";
  const st = status.toUpperCase();

  if (st === "COMPLETED") {
    const { data, error } = await admin.rpc("apply_card_charge", { p_charge_id: c.id, p_reference: reference || null });
    if (error) throw new Error(error.message);
    const pay = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
    if (pay?.id) await notifyPaymentConfirmed(admin, pay.id);
    return "aplicado";
  }

  if (FAILED.includes(st)) {
    await admin.from("card_charges").update({ status: st, reference: reference || null, processed_at: new Date().toISOString() }).eq("id", c.id);
    const { data: m } = await admin.from("card_mandates").select("*").eq("id", c.mandate_id).single();
    if (c.seq === 0) {
      // El pago inicial no se hizo.
      await admin.from("card_mandates").update({ status: st === "EXPIRED" || st === "CANCELED" ? "expired" : "failed", last_error: st }).eq("id", c.mandate_id);
      if (m?.initial_payment_id) {
        await admin.from("payments").update({ status: st === "EXPIRED" || st === "CANCELED" ? "expired" : "failed" })
          .eq("id", m.initial_payment_id).eq("status", "pending");
      }
    } else if (m?.status === "active") {
      await admin.from("card_mandates").update({ status: "failed", last_error: st }).eq("id", c.mandate_id);
      await cardFailedEmail(admin, c);
    }
    return "fallido";
  }

  // PENDING, VERIFYING, REGISTERED…
  if (st !== c.status) await admin.from("card_charges").update({ status: st }).eq("id", c.id);
  return "en espera";
}

/** Tras el pago inicial: guarda los tokens de Pagadito y procesa el cobro de hoy. */
export async function finalizeMandate(admin: SupabaseClient, m: Mandate) {
  if (!m.auth_token) return "sin token";
  const r = await getRecurringStatus(m.auth_token);
  if (r.code !== "PG1009" || !r.data) return `pagadito ${r.code}`;

  if (r.data.oauth_token) await admin.from("card_mandates").update({ oauth_token: r.data.oauth_token }).eq("id", m.id);

  const { data: charges } = await admin.from("card_charges").select("*").eq("mandate_id", m.id).order("seq");
  let initial = "sin datos";
  for (const pc of r.data.pending_charges ?? []) {
    const c = (charges as Charge[] | null)?.find((x) => x.ern === pc.ern);
    if (!c) continue;
    if (pc.token_pending && pc.token_pending !== c.token_pending) {
      await admin.from("card_charges").update({ token_pending: pc.token_pending }).eq("id", c.id);
      c.token_pending = pc.token_pending;
    }
    if (c.seq === 0) initial = await processChargeStatus(admin, c, pc.status, pc.reference);
    else if (pc.status && pc.status !== "PENDING" && pc.status !== c.status) {
      await processChargeStatus(admin, c, pc.status, pc.reference);
    }
  }
  return initial;
}

/** Cancela en Pagadito los cobros pendientes de un mandato. */
export async function cancelMandate(admin: SupabaseClient, mandateId: string) {
  const { data: pend } = await admin
    .from("card_charges")
    .select("id, token_pending")
    .eq("mandate_id", mandateId)
    .is("processed_at", null)
    .gt("seq", 0);
  const tokens = (pend ?? []).map((p) => p.token_pending).filter(Boolean) as string[];
  if (tokens.length) {
    const r = await cancelPending(tokens);
    if (r.code !== "PG1011") throw new Error(`Pagadito ${r.code}: ${r.message}`);
  }
  const now = new Date().toISOString();
  await admin.from("card_charges").update({ status: "CANCELED", processed_at: now }).eq("mandate_id", mandateId).is("processed_at", null).gt("seq", 0);
  await admin.from("card_mandates").update({ status: "canceled", canceled_at: now, cancel_requested: false }).eq("id", mandateId);
}

/** Tarea periódica: cancelaciones pendientes, pagos iniciales sin confirmar y cobros del día. */
export async function syncPagadito(admin: SupabaseClient) {
  const out = { canceled: 0, finalized: 0, expired: 0, charges: 0, errors: [] as string[] };

  // 1. Cancelaciones solicitadas
  const { data: toCancel } = await admin.from("card_mandates").select("id").eq("cancel_requested", true).in("status", ["active", "pending"]);
  for (const m of toCancel ?? []) {
    try {
      await cancelMandate(admin, m.id);
      out.canceled++;
    } catch (e) {
      out.errors.push(`cancelar ${m.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 2. Pagos iniciales que el cliente no terminó de confirmar (cerró la ventana, etc.)
  const { data: pending } = await admin
    .from("card_mandates")
    .select("*")
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 15 * 60000).toISOString());
  for (const m of (pending ?? []) as (Mandate & { created_at: string })[]) {
    try {
      const r = m.auth_token ? await finalizeMandate(admin, m) : "sin token";
      if (r === "aplicado") out.finalized++;
      else if (Date.now() - new Date(m.created_at).getTime() > 2 * 86400000 && r !== "en espera") {
        await admin.from("card_mandates").update({ status: "expired" }).eq("id", m.id).eq("status", "pending");
        if (m.initial_payment_id) await admin.from("payments").update({ status: "expired" }).eq("id", m.initial_payment_id).eq("status", "pending");
        out.expired++;
      }
    } catch (e) {
      out.errors.push(`inicial ${m.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 3. Cobros mensuales que ya llegaron a su fecha
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
  const { data: due } = await admin
    .from("card_charges")
    .select("*, card_mandates!inner(status)")
    .is("processed_at", null)
    .gt("seq", 0)
    .lte("due_date", today)
    .not("token_pending", "is", null)
    .eq("card_mandates.status", "active")
    .limit(200);
  const charges = (due ?? []) as Charge[];
  for (let i = 0; i < charges.length; i += 50) {
    const batch = charges.slice(i, i + 50);
    try {
      const statuses = await getPendingStatus(batch.map((c) => c.token_pending!));
      for (const s of statuses) {
        const c = batch.find((x) => x.token_pending === s.token || x.ern === s.ern);
        if (!c) continue;
        const r = await processChargeStatus(admin, c, s.status, s.reference);
        if (r === "aplicado") out.charges++;
      }
    } catch (e) {
      out.errors.push(`cobros: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}
