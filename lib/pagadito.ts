// Pagadito Connect (API v2) · Pago único con cobro programado. Solo servidor.
import crypto from "node:crypto";

const BASE = process.env.PAGADITO_ENV === "prod" ? "https://connect.pagadito.com" : "https://sandbox-connect.pagadito.com";

export const pagaditoConfigured = () => !!(process.env.PAGADITO_UID && process.env.PAGADITO_WSK);

/** Meses de cobro automático que se programan por adelantado (máx. 24). */
export const AUTOPAY_MONTHS = Math.min(Math.max(Number(process.env.PAGADITO_AUTOPAY_MONTHS ?? 12) || 12, 1), 24);

export interface PagaditoResponse<T> {
  code: string;
  message: string;
  data: T;
}

async function call<T>(path: string, body: unknown): Promise<PagaditoResponse<T>> {
  const auth = Buffer.from(`${process.env.PAGADITO_UID}:${process.env.PAGADITO_WSK}`).toString("base64");
  const res = await fetch(`${BASE}/api/v2/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: PagaditoResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Pagadito respondió HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

const money = (cents: number) => (cents / 100).toFixed(2);

export interface ChargeInput {
  ern: string;
  due_date: string; // YYYY-MM-DD
  amount_cents: number;
  description: string;
}

/** Crea la autorización y devuelve la URL de la pantalla de pago de Pagadito. */
export async function authorizeRecurring(charges: ChargeInput[], autopay: boolean) {
  const r = await call<{ url: string; token: string }>("authorization-recurring-payments", {
    permissions: autopay ? "initial_payment,automatic_charges" : "initial_payment",
    currency: "USD",
    pending_charges: charges.map((c) => ({
      ern: c.ern,
      description: c.description.slice(0, 250),
      date: c.due_date,
      amount: money(c.amount_cents),
      details: [{ quantity: 1, description: c.description.slice(0, 250), price: money(c.amount_cents) }],
    })),
  });
  if (r.code !== "PG1008" || !r.data?.url || !r.data?.token) {
    throw new Error(`Pagadito: ${r.code} ${r.message}`);
  }
  const url = new URL(r.data.url);
  if (url.protocol !== "https:" || !(url.hostname === "pagadito.com" || url.hostname.endsWith(".pagadito.com"))) {
    throw new Error("Pagadito devolvió un enlace de pago no válido.");
  }
  return { url: url.toString(), token: r.data.token };
}

export interface RecurringStatus {
  oauth_token?: string;
  pending_charges?: { token_pending: string; ern: string; amount: string; due_date: string; status: string; reference?: string }[];
}

export async function getRecurringStatus(token: string) {
  return call<RecurringStatus>("get-status-recurring-payments", { token });
}

export interface PendingStatus {
  status: string;
  ern: string;
  reference: string;
  date_trans: string;
  amount: string;
  token: string;
}

export async function getPendingStatus(tokens: string[]) {
  const r = await call<PendingStatus[]>("get-pending-payments-status", { token: tokens });
  return Array.isArray(r.data) ? r.data : [];
}

export async function cancelPending(tokens: string[]) {
  return call<{ total_canceled: number; transactions: { token: string; code: string; message: string }[] }>(
    "cancel-pending-payments",
    { token: tokens }
  );
}

// ---------------------------------------------------------------------
// Webhooks: verificación de la firma
// ---------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC32 igual al de PHP crc32() (entero sin signo). */
export function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function hashFromAlgo(algo: string) {
  const m = algo.toLowerCase().match(/sha-?(1|224|256|384|512)/);
  return m ? `sha${m[1]}` : "sha256";
}

const certCache = new Map<string, string>();

export async function verifyWebhook(headers: Headers, raw: Buffer, eventId: string) {
  const id = headers.get("pagadito-notification-id");
  const ts = headers.get("pagadito-notification-timestamp");
  const sig = headers.get("pagadito-signature");
  const algo = headers.get("pagadito-auth-algo") ?? "sha256";
  const certUrl = headers.get("pagadito-cert-url");
  if (!id || !ts || !sig || !certUrl) return false;

  const u = new URL(certUrl);
  if (u.protocol !== "https:" || !(u.hostname === "pagadito.com" || u.hostname.endsWith(".pagadito.com"))) return false;

  let cert = certCache.get(certUrl);
  if (!cert) {
    const res = await fetch(certUrl, { cache: "no-store" });
    if (!res.ok) return false;
    cert = await res.text();
    certCache.set(certUrl, cert);
  }

  const signed = `${id}|${ts}|${eventId}|${crc32(raw)}|${process.env.PAGADITO_WSK}`;
  try {
    const key = crypto.createPublicKey(cert);
    return crypto.verify(hashFromAlgo(algo), Buffer.from(signed), key, Buffer.from(sig, "base64"));
  } catch (e) {
    console.error("[pagadito] verificación de firma", e);
    return false;
  }
}
