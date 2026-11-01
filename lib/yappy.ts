// Markia · Integración con el Botón de Pago Yappy (solo servidor).
// Documentación: https://www.yappy.com.pa/comercial/desarrolladores/boton-de-pago-yappy-nueva-integracion/
import crypto from "node:crypto";

const IS_PROD = process.env.NEXT_PUBLIC_YAPPY_ENV === "prod";
const API = IS_PROD ? "https://apipagosbg.bgeneral.cloud" : "https://api-comecom-uat.yappycloud.com";

const MESSAGES: Record<string, string> = {
  E005: "Este número no está registrado en Yappy.",
  E007: "Este pedido ya fue registrado. Intenta de nuevo.",
  E009: "El número de orden es demasiado largo.",
  E010: "El monto no es válido.",
  E011: "Yappy rechazó las URL. Revisa que el dominio registrado en Yappy Comercial sea igual a NEXT_PUBLIC_SITE_URL.",
  E100: "Yappy recibió una solicitud inválida.",
};

interface YappyResponse {
  status?: { code?: string; description?: string };
  body?: Record<string, unknown> | null;
}

function yappyError(json: YappyResponse | null, fallback: string, httpStatus?: number, rawText?: string) {
  const code = json?.status?.code;
  if (code && MESSAGES[code]) return `${MESSAGES[code]} (${code})`;
  if (code) return `${fallback} (${code}${json?.status?.description ? `: ${json.status.description}` : ""})`;
  const env = IS_PROD ? "prod" : "uat";
  const detail = rawText ? ` Respuesta: ${rawText.slice(0, 160)}` : "";
  return `${fallback} [ambiente ${env}, HTTP ${httpStatus ?? "?"}]${detail}`;
}

async function readJson(res: Response) {
  const text = await res.text().catch(() => "");
  let json: YappyResponse | null = null;
  try {
    json = JSON.parse(text) as YappyResponse;
  } catch {
    json = null;
  }
  return { json, text };
}

/** Dominio exacto registrado en Yappy, sin "/" al final. */
export function siteDomain() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
}

/** orderId alfanumérico de 15 caracteres (máximo que acepta Yappy). */
export function newOrderId() {
  return ("MK" + crypto.randomBytes(8).toString("hex")).toUpperCase().slice(0, 15);
}

export async function createYappyOrder({ orderId, total }: { orderId: string; total: string }) {
  const merchantId = process.env.YAPPY_MERCHANT_ID;
  if (!merchantId || !process.env.YAPPY_SECRET_KEY) {
    throw new Error("Faltan YAPPY_MERCHANT_ID o YAPPY_SECRET_KEY en las variables de entorno.");
  }
  const domain = siteDomain();
  if (!domain.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_SITE_URL debe ser tu dirección pública con https:// (Yappy no funciona con localhost).");
  }

  // Paso 1: validar el comercio
  const validateRes = await fetch(`${API}/payments/validate/merchant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchantId, urlDomain: domain }),
  });
  const { json: validate, text: validateText } = await readJson(validateRes);
  const token = validate?.body?.token;
  if (!validateRes.ok || typeof token !== "string") {
    console.error("[yappy] validate/merchant", validateRes.status, validateText.slice(0, 500), { domain });
    throw new Error(
      yappyError(validate, "Yappy no validó el comercio.", validateRes.status, validateText) + ` Dominio enviado: ${domain}`
    );
  }

  // Paso 2: crear la orden
  const order: Record<string, unknown> = {
    merchantId,
    orderId,
    domain,
    paymentDate: validate?.body?.epochTime ?? Math.floor(Date.now() / 1000),
    ipnUrl: `${domain}/api/yappy/ipn`,
    discount: "0.00",
    taxes: "0.00",
    subtotal: total,
    total,
  };
  if (process.env.YAPPY_TEST_ALIAS) order.aliasYappy = process.env.YAPPY_TEST_ALIAS;

  const orderRes = await fetch(`${API}/payments/payment-wc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(order),
  });
  const { json: created, text: createdText } = await readJson(orderRes);
  const body = created?.body;
  if (!orderRes.ok || !body?.transactionId) {
    console.error("[yappy] payment-wc", orderRes.status, createdText.slice(0, 500));
    throw new Error(yappyError(created, "Yappy no pudo crear la orden.", orderRes.status, createdText));
  }

  return {
    transactionId: String(body.transactionId),
    token: String(body.token ?? ""),
    documentName: String(body.documentName ?? ""),
  };
}

/** Valida la firma del aviso de pago (IPN) que envía Yappy. */
export function verifyIpnHash(p: { orderId: string; status: string; domain: string; hash: string }) {
  const secret = process.env.YAPPY_SECRET_KEY;
  if (!secret) return false;
  const key = Buffer.from(secret, "base64").toString("utf-8").split(".")[0];
  const expected = crypto.createHmac("sha256", key).update(p.orderId + p.status + p.domain).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(p.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}