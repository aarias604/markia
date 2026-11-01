// GET /api/admin/overview · Pagos cripto por aprobar, retiros pendientes y pedidos de logo.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { admin } = ctx;

  const [crypto, payouts, logos] = await Promise.all([
    admin
      .from("payments")
      .select("id, user_id, kind, plan_id, addon_id, amount_cents, crypto_network, crypto_tx_hash, crypto_submitted_at, status")
      .eq("method", "crypto")
      .not("crypto_tx_hash", "is", null)
      .is("applied_at", null)
      .neq("status", "failed")
      .order("crypto_submitted_at", { ascending: true }),
    admin.from("payout_requests").select("*").eq("status", "requested").order("created_at", { ascending: true }),
    admin
      .from("payments")
      .select("id, user_id, paid_at")
      .eq("addon_id", "logo_service")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(30),
  ]);

  const userIds = new Set<string>();
  for (const r of [...(crypto.data ?? []), ...(payouts.data ?? []), ...(logos.data ?? [])]) userIds.add(r.user_id as string);

  const emails: Record<string, string> = {};
  await Promise.all(
    [...userIds].map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      emails[id] = data.user?.email ?? id;
    })
  );

  return NextResponse.json({
    crypto: crypto.data ?? [],
    payouts: payouts.data ?? [],
    logos: logos.data ?? [],
    emails,
  });
}
