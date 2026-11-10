// Tilopay (API v1) · Pago con tarjeta y cobros automáticos con tarjeta guardada. Solo servidor.
// Documentación: https://tilopay.com/developers
// Las credenciales van SOLO en Vercel: TILOPAY_API_USER, TILOPAY_API_PASSWORD y TILOPAY_API_KEY.
// Tilopay usa el mismo servidor para pruebas y producción: el modo lo dan las credenciales.

const BASE = (process.env.TILOPAY_BASE_URL || "https://app.tilopay.com").replace(/\/+$/, "");
const clean = (v?: string) => (v ?? "").trim();

export const tilopayConfigured = () =>
  !!(clean(process.env.TILOPAY_API_USER) && clean(process.env.TILOPAY_API_PASSWORD) && clean(process.env.TILOPAY_API_KEY));

export const tilopayEnabled = () => tilopayConfigured() && process.env.NEXT_PUBLIC_TILOPAY_ENABLED === "true";

const key = () => clean(process.env.TILOPAY_API_KEY);
const money = (cents: number) => (cents / 100).toFixed(2);

// ---------------------------------------------------------------------
// Token de acceso (dura 24 h; lo renovamos antes)
// ---------------------------------------------------------------------
let cached: { token: string; until: number } | null = null;

async function accessToken(force = false) {
  if (!force && cached && cached.until > Date.now()) return cached.token;
  const res = await fetch(`${BASE}/api/v1/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apiuser: clean(process.env.TILOPAY_API_USER), password: clean(process.env.TILOPAY_API_PASSWORD) }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !json?.access_token) {
    throw new Error(`Tilopay no aceptó el usuario o la contraseña de la API (HTTP ${res.status}). Revisa TILOPAY_API_USER y TILOPAY_API_PASSWORD.`);
  }
  const secs = Number(json.expires_in) || 86400;
  cached = { token: json.access_token, until: Date.now() + Math.max(secs - 600, 300) * 1000 };
  return cached.token;
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<{ status: number; json: T }> {
  const send = async (token: string) =>
    fetch(`${BASE}/api/v1/${path}`, {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ key: key(), ...body }),
      cache: "no-store",
    });
  let res = await send(await accessToken());
  if (res.status === 401) res = await send(await accessToken(true));
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) as T };
  } catch {
    throw new Error(`Tilopay respondió HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

const errText = (j: unknown) => {
  const o = (j ?? {}) as Record<string, unknown>;
  return String(o.message ?? o.result ?? o.description ?? "sin detalle").slice(0, 200);
};

// ---------------------------------------------------------------------
// 1. Pantalla de pago (pago de hoy y, si se pide, guardar la tarjeta)
// ---------------------------------------------------------------------
export interface Customer {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export async function createPaymentLink(opts: {
  orderNumber: string;
  amountCents: number;
  saveCard: boolean;
  redirect: string;
  customer: Customer;
  returnData?: string;
}) {
  const c = opts.customer;
  const { status, json } = await call<{ type?: string; url?: string }>("processPayment", {
    amount: money(opts.amountCents),
    currency: "USD",
    orderNumber: opts.orderNumber,
    capture: "1",
    subscription: opts.saveCard ? "1" : "0",
    token_version: "v2",
    platform: "api",
    redirect: opts.redirect,
    returnData: opts.returnData ?? "",
    billToFirstName: c.firstName,
    billToLastName: c.lastName,
    billToAddress: "Ciudad de Panamá",
    billToAddress2: "Panamá",
    billToCity: "Panamá",
    billToState: "PA-8",
    billToZipPostCode: "00000",
    billToCountry: "PA",
    billToTelephone: c.phone,
    billToEmail: c.email,
  });
  if (String(json.type) !== "100" || !json.url) throw new Error(`Tilopay (HTTP ${status}): ${errText(json)}`);
  const url = new URL(json.url);
  if (url.protocol !== "https:" || !(url.hostname === "tilopay.com" || url.hostname.endsWith(".tilopay.com"))) {
    throw new Error("Tilopay devolvió un enlace de pago no válido.");
  }
  return url.toString();
}

// ---------------------------------------------------------------------
// 2. Consultar una orden (la fuente de verdad para aplicar pagos)
// ---------------------------------------------------------------------
export interface ConsultTx {
  code?: string | number;
  response?: string;
  auth?: string;
  amount?: string | number;
  currency?: string;
  orderNumber?: string;
  id_tilopay?: string | number;
  card?: string;
  last?: string;
  type?: string;
}

export type OrderStatus =
  | { state: "approved"; tx: ConsultTx }
  | { state: "declined"; tx: ConsultTx }
  | { state: "not_found" };

export async function consultOrder(orderNumber: string, expectedCents?: number): Promise<OrderStatus> {
  const { json } = await call<{ type?: string; response?: ConsultTx[] | ConsultTx }>("consult", { orderNumber });
  const list = Array.isArray(json.response) ? json.response : json.response ? [json.response] : [];
  const txs = list.filter((t) => !t.orderNumber || String(t.orderNumber) === orderNumber);
  if (!txs.length) return { state: "not_found" };
  const ok = txs.find((t) => String(t.code) === "1");
  if (ok) {
    // Si el monto no coincide, no lo damos por bueno.
    if (expectedCents != null && ok.amount != null && Math.round(Number(ok.amount) * 100) !== expectedCents) {
      return { state: "declined", tx: { ...ok, response: `Monto distinto (${ok.amount})` } };
    }
    return { state: "approved", tx: ok };
  }
  return { state: "declined", tx: txs[txs.length - 1] };
}

// ---------------------------------------------------------------------
// 3. Cobro con la tarjeta guardada (sin pantalla)
// ---------------------------------------------------------------------
export type ChargeResult =
  | { state: "approved"; auth: string; reference: string }
  | { state: "declined"; message: string }
  | { state: "unknown"; message: string };

export async function chargeSavedCard(opts: { orderNumber: string; amountCents: number; email: string; card: string }): Promise<ChargeResult> {
  try {
    const { status, json } = await call<Record<string, unknown>>("processRecurrentPayment", {
      amount: money(opts.amountCents),
      currency: "USD",
      orderNumber: opts.orderNumber,
      capture: "1",
      email: opts.email,
      card: opts.card,
    });
    if (String(json.response) === "1") {
      return {
        state: "approved",
        auth: String(json.auth ?? ""),
        reference: String(json.tilopayTransaction ?? json.tpt ?? json.auth ?? ""),
      };
    }
    // Respuesta clara de rechazo
    if (json.response != null || status === 300 || status === 400) return { state: "declined", message: errText(json) };
    return { state: "unknown", message: `HTTP ${status}: ${errText(json)}` };
  } catch (e) {
    // Error de red: no sabemos si se cobró. Se verifica después con consultOrder.
    return { state: "unknown", message: e instanceof Error ? e.message : String(e) };
  }
}
