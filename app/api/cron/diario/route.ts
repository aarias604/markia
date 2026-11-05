// GET /api/cron/diario · Lo ejecuta Vercel Cron cada día (ver vercel.json).
// Envía avisos de vencimiento, gracia y suspensión, y el resumen de pendientes al administrador.
import { NextResponse, type NextRequest } from "next/server";
import { computeSubscriptionState, panamaToday, type SubscriptionStatus } from "@/lib/billing/subscription-state";
import {
  adminDigestEmail,
  adminEmail,
  dailyAgendaEmail,
  expiringEmail,
  graceEmail,
  graceReminderEmail,
  sendOnce,
  suspendedEmail,
  userEmail,
  type ReminderPost,
} from "@/lib/notifications";
import { igRefresh } from "@/lib/instagram";
import { createAdminClient } from "@/lib/supabase/admin";

interface SubRow {
  user_id: string;
  next_due_date: string | null;
  subscription_status: SubscriptionStatus;
  plan_name: string;
  monthly_price_cents: number; // precio congelado de cada cliente
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const summary = { expiring: 0, grace: 0, graceReminder: 0, suspended: 0, admin: 0, errors: 0 };

  // Mantener los estados al día (por si pg_cron no está activo).
  await admin.rpc("refresh_subscription_statuses");

  const { data: subs, error } = await admin.rpc("get_billing_snapshot");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const s of (subs ?? []) as SubRow[]) {
    try {
      if (!s.next_due_date) continue;
      const st = computeSubscriptionState({
        nextDueDate: s.next_due_date,
        priceCents: s.monthly_price_cents,
        storedStatus: s.subscription_status,
      });

      const plan = { name: s.plan_name, price_cents: s.monthly_price_cents };
      const due = s.next_due_date;
      let kind = "";
      let build: ((name: string) => { subject: string; html: string }) | null = null;
      if (st.status === "expiring_soon") {
        kind = "expiring";
        build = (n) => expiringEmail(n, plan.name, due, st.amountDueCents);
      } else if (st.status === "grace_period" && (st.daysLeftInGrace ?? 0) <= 5) {
        kind = "grace_reminder";
        build = (n) => graceReminderEmail(n, st.daysLeftInGrace ?? 0, st.amountDueCents);
      } else if (st.status === "grace_period") {
        kind = "grace";
        build = (n) => graceEmail(n, plan.name, plan.price_cents, st.amountDueCents, st.gracePeriodUntil ?? due);
      } else if (st.status === "suspended") {
        kind = "suspended";
        build = (n) => suspendedEmail(n, st.baseAmountCents, st.amountDueCents);
      }
      if (!build) continue;

      // Un aviso de cada tipo por fecha de vencimiento (si renueva, la fecha cambia y el ciclo empieza de nuevo).
      const { data: logged } = await admin
        .from("email_log")
        .select("id")
        .eq("user_id", s.user_id)
        .eq("kind", kind)
        .eq("ref", s.next_due_date)
        .maybeSingle();
      if (logged) continue;

      const [to, { data: profile }] = await Promise.all([
        userEmail(admin, s.user_id),
        admin.from("profiles").select("full_name").eq("id", s.user_id).maybeSingle(),
      ]);
      if (!to) continue;
      const name = (profile?.full_name ?? "").split(" ")[0] || "Hola";

      const sent = await sendOnce(admin, { userId: s.user_id, kind, ref: due, to, ...build(name) });
      if (sent) summary[kind === "grace_reminder" ? "graceReminder" : (kind as "expiring" | "grace" | "suspended")]++;
    } catch (err) {
      summary.errors++;
      console.error("[cron] usuario", s.user_id, err);
    }
  }

  // Agenda del día: a cada cliente, lo que le toca publicar hoy (hora de Panamá).
  let agendas = 0;
  const today = panamaToday();
  const dayStart = new Date(`${today}T00:00:00-05:00`).toISOString();
  const dayEnd = new Date(new Date(`${today}T00:00:00-05:00`).getTime() + 86400000).toISOString();
  const { data: todayPosts } = await admin
    .from("posts")
    .select("id, user_id, title, caption, hashtags, placement, scheduled_at")
    .eq("status", "scheduled")
    .eq("auto_publish", false)
    .gte("scheduled_at", dayStart)
    .lt("scheduled_at", dayEnd)
    .order("scheduled_at", { ascending: true });
  const byUser = new Map<string, ReminderPost[]>();
  for (const p of (todayPosts ?? []) as (ReminderPost & { user_id: string })[]) {
    byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p]);
  }
  for (const [uid, list] of byUser) {
    try {
      const [to, { data: profile }] = await Promise.all([
        userEmail(admin, uid),
        admin.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
      ]);
      if (!to) continue;
      const name = (profile?.full_name ?? "").split(" ")[0] || "Hola";
      if (await sendOnce(admin, { userId: uid, kind: "daily_agenda", ref: today, to, ...dailyAgendaEmail(name, list) })) agendas++;
    } catch (err) {
      console.error("[cron] agenda", uid, err);
    }
  }

  // Renovar conexiones de Instagram que vencen en menos de 20 días (duran 60).
  let igRefreshed = 0;
  const soon = new Date(Date.now() + 20 * 86400000).toISOString();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const { data: igs } = await admin
    .from("instagram_accounts")
    .select("user_id, access_token, api_mode")
    .lt("token_expires_at", soon)
    .gt("token_expires_at", new Date().toISOString())
    .lt("refreshed_at", dayAgo);
  for (const ig of igs ?? []) {
    try {
      const { token, expiresAt } = await igRefresh(ig.api_mode, ig.access_token);
      await admin
        .from("instagram_accounts")
        .update({
          access_token: token,
          token_expires_at: expiresAt,
          refreshed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("user_id", ig.user_id);
      igRefreshed++;
    } catch (err) {
      await admin
        .from("instagram_accounts")
        .update({ last_error: err instanceof Error ? err.message.slice(0, 300) : "No se pudo renovar" })
        .eq("user_id", ig.user_id);
    }
  }

  // Resumen diario para el administrador (solo si hay pendientes).
  const [crypto, payouts, brands] = await Promise.all([
    admin.from("payments").select("id", { count: "exact", head: true })
      .eq("method", "crypto").not("crypto_tx_hash", "is", null).is("applied_at", null).neq("status", "failed"),
    admin.from("payout_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
    admin.from("brand_packages").select("id", { count: "exact", head: true }).eq("status", "awaiting_brief"),
  ]);
  const counts = { crypto: crypto.count ?? 0, payouts: payouts.count ?? 0, brands: brands.count ?? 0 };
  if (counts.crypto + counts.payouts > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const sent = await sendOnce(admin, { userId: null, kind: "admin_digest", ref: today, to: adminEmail(), ...adminDigestEmail(counts) });
    if (sent) summary.admin++;
  }

  return NextResponse.json({ ok: true, ...summary, igRefreshed, agendas });
}
