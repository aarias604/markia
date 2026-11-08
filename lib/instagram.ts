// Markia · Publicación en Instagram con el "inicio de sesión unificado" de Meta
// (Facebook Login for Business con config_id). Solo servidor.
//
// Variables en Vercel:
//   META_APP_ID      = Identificador de la app   (Configuración de la app → Básica)
//   META_APP_SECRET  = Clave secreta de la app    (Configuración de la app → Básica)
//   META_CONFIG_ID   = Identificador de configuración (Instagram → API setup with Unified login)
//
// Después de autorizar, Markia descubre cómo hablar con la cuenta:
//   modo "instagram": el token sirve en graph.instagram.com (/me/media)
//   modo "facebook":  el token sirve en graph.facebook.com (/{ig-id}/media)

const FB = "https://graph.facebook.com/v25.0";
const IG = "https://graph.instagram.com/v25.0";

export type IgMode = "instagram" | "facebook";

export interface IgAccount {
  mode: IgMode;
  igUserId: string;
  username: string;
  token: string;
  expiresAt: string;
}

export function igRedirectUri() {
  return `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "")}/api/instagram/callback`;
}

function creds() {
  const id = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID;
  const secret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;
  const config = process.env.META_CONFIG_ID;
  if (!id || !secret || !config) throw new Error("Faltan META_APP_ID, META_APP_SECRET o META_CONFIG_ID en Vercel.");
  return { id, secret, config };
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok || json.error) {
    const e = json.error;
    const msg = e?.error_user_msg || e?.message || `HTTP ${res.status}`;
    throw new Error(`${msg}${e?.code ? ` (código ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""})` : ""}`);
  }
  return json;
}

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

export function igAuthorizeUrl(state: string) {
  const { id, config } = creds();
  return `https://www.facebook.com/dialog/oauth?${q({
    client_id: id,
    config_id: config,
    override_default_response_type: "true",
    redirect_uri: igRedirectUri(),
    response_type: "code",
    state,
  })}`;
}

/** Cambia el código por un token y, si se puede, por uno de larga duración. */
async function exchangeCode(code: string) {
  const { id, secret } = creds();
  const first = await getJson(
    `${FB}/oauth/access_token?${q({ client_id: id, client_secret: secret, redirect_uri: igRedirectUri(), code: code.replace(/#_$/, "") })}`
  );
  let token = String(first.access_token ?? "");
  let expiresIn = Number(first.expires_in ?? 0);
  if (!token) throw new Error("Meta no devolvió un token.");

  try {
    const long = await getJson(
      `${FB}/oauth/access_token?${q({ grant_type: "fb_exchange_token", client_id: id, client_secret: secret, fb_exchange_token: token })}`
    );
    if (long.access_token) {
      token = String(long.access_token);
      expiresIn = Number(long.expires_in ?? 0);
    }
  } catch {
    // Algunos tokens (de usuario del sistema) no se pueden extender y no vencen.
  }
  // Sin fecha de vencimiento = token que no vence: lo revisamos de nuevo en un año.
  return { token, expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : inDays(365) };
}

/** Pregunta a Meta qué cuentas de Instagram y páginas autorizó el usuario con este token. */
async function grantedTargets(token: string) {
  const { id, secret } = creds();
  const info = await getJson(`${FB}/debug_token?${q({ input_token: token, access_token: `${id}|${secret}` })}`);
  const data = (info.data ?? {}) as {
    type?: string;
    scopes?: string[];
    granular_scopes?: { scope: string; target_ids?: string[] }[];
  };
  const ig = new Set<string>();
  const pages = new Set<string>();
  for (const g of data.granular_scopes ?? []) {
    if (g.scope.startsWith("instagram_")) (g.target_ids ?? []).forEach((t) => ig.add(t));
    if (g.scope.startsWith("pages_")) (g.target_ids ?? []).forEach((t) => pages.add(t));
  }
  return { type: data.type ?? "?", scopes: data.scopes ?? [], igIds: [...ig], pageIds: [...pages] };
}

/** Encuentra la cuenta profesional de Instagram a la que da acceso el token. */
async function discoverAccount(token: string): Promise<{ mode: IgMode; igUserId: string; username: string }> {
  const errors: string[] = [];

  // 0. Lo que el usuario autorizó (la forma más precisa con el inicio de sesión unificado)
  try {
    const g = await grantedTargets(token);
    errors.push(`token=${g.type}; permisos=${g.scopes.join(",") || "ninguno"}; ig=${g.igIds.length}; páginas=${g.pageIds.length}`);
    for (const igId of g.igIds) {
      try {
        const acc = await getJson(`${FB}/${igId}?${q({ fields: "id,username", access_token: token })}`);
        return { mode: "facebook", igUserId: String(acc.id ?? igId), username: String(acc.username ?? "") };
      } catch (e) {
        errors.push(`ig ${igId}: ${(e as Error).message}`);
      }
    }
    for (const pageId of g.pageIds) {
      try {
        const fields = "instagram_business_account{id,username},connected_instagram_account{id,username},access_token";
        const page = await getJson(`${FB}/${pageId}?${q({ fields, access_token: token })}`);
        type Acc = { id?: string; username?: string } | undefined;
        let acc = (page.instagram_business_account ?? page.connected_instagram_account) as Acc;
        // Algunas cuentas solo muestran el Instagram con el token de la página.
        if (!acc?.id && typeof page.access_token === "string") {
          const viaPage = await getJson(
            `${FB}/${pageId}?${q({ fields: "instagram_business_account{id,username},connected_instagram_account{id,username}", access_token: page.access_token })}`
          );
          acc = (viaPage.instagram_business_account ?? viaPage.connected_instagram_account) as Acc;
        }
        if (acc?.id) return { mode: "facebook", igUserId: acc.id, username: acc.username ?? "" };
        errors.push(`página ${pageId}: sin Instagram vinculado`);
      } catch (e) {
        errors.push(`página ${pageId}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    errors.push(`debug_token: ${(e as Error).message}`);
  }

  // 1. Token de Instagram (graph.instagram.com)
  try {
    const me = await getJson(`${IG}/me?${q({ fields: "user_id,username", access_token: token })}`);
    if (me.user_id || me.id) return { mode: "instagram", igUserId: String(me.user_id ?? me.id), username: String(me.username ?? "") };
  } catch (e) {
    errors.push(`instagram.me: ${(e as Error).message}`);
  }

  // 2. Páginas de Facebook con cuenta de Instagram vinculada
  try {
    const pages = await getJson(
      `${FB}/me/accounts?${q({ fields: "name,instagram_business_account{id,username},connected_instagram_account{id,username}", access_token: token })}`
    );
    type PageRow = { instagram_business_account?: { id: string; username?: string }; connected_instagram_account?: { id: string; username?: string } };
    for (const p of (pages.data as PageRow[]) ?? []) {
      const acc = p.instagram_business_account ?? p.connected_instagram_account;
      if (acc?.id) return { mode: "facebook", igUserId: acc.id, username: acc.username ?? "" };
    }
    errors.push("me/accounts: ninguna página tiene Instagram vinculado");
  } catch (e) {
    errors.push(`me/accounts: ${(e as Error).message}`);
  }

  // 3. Cuentas de Instagram asignadas directamente (token de negocio)
  for (const edge of ["assigned_instagram_accounts", "instagram_accounts"]) {
    try {
      const res = await getJson(`${FB}/me/${edge}?${q({ fields: "id,username", access_token: token })}`);
      const first = ((res.data as { id: string; username?: string }[]) ?? [])[0];
      if (first?.id) return { mode: "facebook", igUserId: first.id, username: first.username ?? "" };
      errors.push(`${edge}: vacío`);
    } catch (e) {
      errors.push(`${edge}: ${(e as Error).message}`);
    }
  }

  console.error("[instagram] no se encontró la cuenta", errors);
  throw new Error(`No encontramos una cuenta profesional de Instagram con este acceso. Detalle: ${errors.join(" | ")}`);
}

export async function igConnect(code: string): Promise<IgAccount> {
  const { token, expiresAt } = await exchangeCode(code);
  const acc = await discoverAccount(token);
  return { ...acc, token, expiresAt };
}

/** Renueva la conexión (60 días más) cuando es posible. */
export async function igRefresh(mode: IgMode, token: string) {
  if (mode === "instagram") {
    try {
      const json = await getJson(`https://graph.instagram.com/refresh_access_token?${q({ grant_type: "ig_refresh_token", access_token: token })}`);
      return { token: String(json.access_token), expiresAt: new Date(Date.now() + Number(json.expires_in ?? 5184000) * 1000).toISOString() };
    } catch {
      /* intentar como token de Facebook */
    }
  }
  const { id, secret } = creds();
  const json = await getJson(
    `${FB}/oauth/access_token?${q({ grant_type: "fb_exchange_token", client_id: id, client_secret: secret, fb_exchange_token: token })}`
  );
  const expiresIn = Number(json.expires_in ?? 0);
  return { token: String(json.access_token), expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : inDays(365) };
}

// ---------------------------------------------------------------------
// Publicación
// ---------------------------------------------------------------------

interface Target {
  mode: IgMode;
  igUserId: string;
  token: string;
}

const base = (t: Target) => (t.mode === "instagram" ? IG : FB);
const owner = (t: Target) => (t.mode === "instagram" ? "me" : t.igUserId);

async function createContainer(t: Target, params: Record<string, string>) {
  const json = await getJson(`${base(t)}/${owner(t)}/media`, {
    method: "POST",
    body: new URLSearchParams({ ...params, access_token: t.token }),
  });
  return String(json.id);
}

async function waitReady(t: Target, containerId: string) {
  for (let i = 0; i < 8; i++) {
    const json = await getJson(`${base(t)}/${containerId}?${q({ fields: "status_code", access_token: t.token })}`);
    const status = String(json.status_code ?? "FINISHED");
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Instagram no pudo procesar la imagen (${status}).`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Instagram tardó demasiado en procesar la imagen. Se reintentará.");
}

async function publishContainer(t: Target, creationId: string) {
  const json = await getJson(`${base(t)}/${owner(t)}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: creationId, access_token: t.token }),
  });
  return String(json.id);
}

async function permalink(t: Target, mediaId: string) {
  try {
    const json = await getJson(`${base(t)}/${mediaId}?${q({ fields: "permalink", access_token: t.token })}`);
    return json.permalink ? String(json.permalink) : null;
  } catch {
    return null;
  }
}

/**
 * Publica en Instagram.
 * - feed + 1 imagen → publicación · feed + 2 a 10 → carrusel
 * - story → una historia por imagen (sin texto)
 */
export async function igPublish(opts: Target & { placement: "feed" | "story"; imageUrls: string[]; caption: string }) {
  const t: Target = { mode: opts.mode, igUserId: opts.igUserId, token: opts.token };
  const { placement, imageUrls, caption } = opts;
  if (imageUrls.length === 0) throw new Error("La publicación no tiene imágenes.");

  if (placement === "story") {
    const ids: string[] = [];
    for (const url of imageUrls.slice(0, 10)) {
      const c = await createContainer(t, { image_url: url, media_type: "STORIES" });
      await waitReady(t, c);
      ids.push(await publishContainer(t, c));
    }
    return { mediaId: ids[0], permalink: null as string | null };
  }

  let creationId: string;
  if (imageUrls.length === 1) {
    creationId = await createContainer(t, { image_url: imageUrls[0], caption });
  } else {
    const children: string[] = [];
    for (const url of imageUrls.slice(0, 10)) children.push(await createContainer(t, { image_url: url, is_carousel_item: "true" }));
    for (const c of children) await waitReady(t, c);
    creationId = await createContainer(t, { media_type: "CAROUSEL", children: children.join(","), caption });
  }
  await waitReady(t, creationId);
  const mediaId = await publishContainer(t, creationId);
  return { mediaId, permalink: await permalink(t, mediaId) };
}
