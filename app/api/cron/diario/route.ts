// GET /api/cron/diario · Lo ejecuta Vercel Cron cada día (ver vercel.json).
// Envía avisos de vencimiento, gracia y suspensión, y el resumen de pendientes al administrador.
import { NextResponse, type NextRequest } from "next/server";
import { computeSubscriptionState, type SubscriptionStatus } from "@/lib/billing/subscription-state";
import {
  adminDigestEmail,
  adminEmail,
  expiringEmail,
  graceEmail,
  graceReminderEmail,
  sendOnce,
  suspendedEmail,
  userEmail,
} from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

interface SubRow {
  user_id: string;
  next_due_date: string | null;
  subscription_status: SubscriptionStatus;
  plans: { name: string; price_cents: number } | null;
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

  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("user_id, next_due_date, subscription_status, plans(name, price_cents)")
    .not("next_due_date", "is", null)
    .not("subscription_status", "in", "(pending,canceled)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const s of (subs ?? []) as unknown as SubRow[]) {
    try {
      if (!s.plans || !s.next_due_date) continue;
      const st = computeSubscriptionState({
        nextDueDate: s.next_due_date,
        priceCents: s.plans.price_cents,
        storedStatus: s.subscription_status,
      });

      const plan = s.plans;
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

  return NextResponse.json({ ok: true, ...summary });
}
