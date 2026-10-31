// =====================================================================
// Markia · Estado de suscripción
// Espejo exacto de public.compute_subscription_state() en SQL.
// La BD es la fuente de verdad para cobrar; esta función sirve para
// la UI, tests y lógica server-side en Node (Route Handlers, cron).
// =====================================================================

export type PlanId = "basic" | "pro";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "expiring_soon"
  | "grace_period"
  | "suspended"
  | "canceled";

export const PLAN_PRICES_CENTS: Record<PlanId, number> = {
  basic: 1900,
  pro: 3900,
};

export const WARNING_DAYS = 5;
export const GRACE_DAYS = 30;
export const REACTIVATION_DISCOUNT_PCT = 35;
export const BUSINESS_TZ = "America/Panama";

export interface SubscriptionState {
  status: SubscriptionStatus;
  /** Días hasta next_due_date (negativo si ya venció). */
  daysUntilDue: number | null;
  gracePeriodUntil: string | null; // YYYY-MM-DD
  daysLeftInGrace: number | null;
  unpaidMonths: number;
  monthsToPay: number;
  discountPct: number;
  baseAmountCents: number;
  amountDueCents: number;
  showBanner: boolean;
  canGenerate: boolean;
}

/** Fecha de hoy (YYYY-MM-DD) en hora de Panamá, sin importar el TZ del servidor. */
export function panamaToday(now: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Diferencia en días entre dos fechas YYYY-MM-DD (a - b), igual que `date - date` en Postgres. */
export function diffDays(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function computeSubscriptionState(input: {
  nextDueDate: string | null;
  priceCents: number;
  today?: string;
  storedStatus?: SubscriptionStatus;
}): SubscriptionState {
  const { nextDueDate, priceCents } = input;
  const today = input.today ?? panamaToday();
  const stored = input.storedStatus ?? "active";

  if (!nextDueDate || stored === "pending" || stored === "canceled") {
    const status: SubscriptionStatus = stored === "canceled" ? "canceled" : "pending";
    return {
      status,
      daysUntilDue: null,
      gracePeriodUntil: null,
      daysLeftInGrace: null,
      unpaidMonths: 0,
      monthsToPay: 1,
      discountPct: 0,
      baseAmountCents: priceCents,
      amountDueCents: priceCents,
      showBanner: false,
      canGenerate: false,
    };
  }

  const d = diffDays(nextDueDate, today);
  const graceUntil = addDays(nextDueDate, GRACE_DAYS);

  const base = {
    daysUntilDue: d,
    gracePeriodUntil: graceUntil,
  };

  if (d > WARNING_DAYS) {
    return {
      ...base,
      status: "active",
      daysLeftInGrace: null,
      unpaidMonths: 0,
      monthsToPay: 1,
      discountPct: 0,
      baseAmountCents: priceCents,
      amountDueCents: priceCents,
      showBanner: false,
      canGenerate: true,
    };
  }

  if (d >= 0) {
    return {
      ...base,
      status: "expiring_soon",
      daysLeftInGrace: null,
      unpaidMonths: 0,
      monthsToPay: 1,
      discountPct: 0,
      baseAmountCents: priceCents,
      amountDueCents: priceCents,
      showBanner: true,
      canGenerate: true,
    };
  }

  if (diffDays(graceUntil, today) >= 0) {
    return {
      ...base,
      status: "grace_period",
      daysLeftInGrace: diffDays(graceUntil, today),
      unpaidMonths: 1,
      monthsToPay: 2,
      discountPct: 0,
      baseAmountCents: priceCents * 2,
      amountDueCents: priceCents * 2,
      showBanner: true,
      canGenerate: true,
    };
  }

  const baseAmount = priceCents * 2;
  return {
    ...base,
    status: "suspended",
    daysLeftInGrace: 0,
    unpaidMonths: 2,
    monthsToPay: 2,
    discountPct: REACTIVATION_DISCOUNT_PCT,
    baseAmountCents: baseAmount,
    // Igual que round() de Postgres: $38.00 → $24.70, $78.00 → $50.70
    amountDueCents: Math.round((baseAmount * (100 - REACTIVATION_DISCOUNT_PCT)) / 100),
    showBanner: true,
    canGenerate: false,
  };
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Fila que devuelve `supabase.rpc('get_my_billing')`. */
export interface BillingRow {
  subscription_id: string;
  plan_id: PlanId;
  plan_name: string;
  plan_price_cents: number;
  next_due_date: string;
  status: SubscriptionStatus;
  days_until_due: number | null;
  grace_period_until: string | null;
  days_left_in_grace: number | null;
  unpaid_months: number;
  months_to_pay: number;
  discount_pct: number;
  amount_due_cents: number;
  show_banner: boolean;
  can_generate: boolean;
}
