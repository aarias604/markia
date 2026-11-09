// Publicación en la Página de Facebook (junto con Instagram). Solo servidor.
// Permisos en la configuración de Meta: pages_show_list, pages_read_engagement, pages_manage_posts.
// Nota: Meta no permite publicar en perfiles personales desde apps; solo en Páginas.

const FB = "https://graph.facebook.com/v25.0";

async function call(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET") {
  const body = new URLSearchParams(params);
  const res = await fetch(method === "GET" ? `${FB}/${path}?${body}` : `${FB}/${path}`, method === "POST" ? { method, body } : undefined);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; error_user_msg?: string; code?: number };
  };
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(`Facebook: ${e?.error_user_msg || e?.message || `HTTP ${res.status}`}${e?.code ? ` (código ${e.code})` : ""}`);
  }
  return json;
}

export interface FbPage {
  pageId: string;
  pageName: string;
  pageToken: string;
}

/** Busca la Página vinculada al Instagram conectado (o la primera Página autorizada) y su token. */
export async function fbFindPage(userToken: string, igUserId?: string): Promise<FbPage | null> {
  try {
    const res = await call("me/accounts", { fields: "id,name,access_token,tasks,instagram_business_account{id}", access_token: userToken });
    type Row = { id: string; name?: string; access_token?: string; tasks?: string[]; instagram_business_account?: { id: string } };
    const pages = (res.data as Row[]) ?? [];
    const match = pages.find((p) => p.instagram_business_account?.id === igUserId) ?? pages[0];
    if (match?.access_token) return { pageId: match.id, pageName: match.name ?? "Página", pageToken: match.access_token };
  } catch (e) {
    console.warn("[facebook] me/accounts", e);
  }
  return null;
}

async function permalink(postId: string, token: string) {
  try {
    const j = await call(postId, { fields: "permalink_url", access_token: token });
    return j.permalink_url ? String(j.permalink_url) : null;
  } catch {
    return null;
  }
}

/**
 * Publica en la Página:
 * - feed + 1 imagen → foto con texto · feed + varias → publicación con varias fotos
 * - story → una historia por imagen
 */
export async function fbPublish(opts: { pageId: string; token: string; placement: "feed" | "story"; imageUrls: string[]; caption: string }) {
  const { pageId, token, placement, imageUrls, caption } = opts;
  if (!imageUrls.length) throw new Error("La publicación no tiene imágenes.");

  if (placement === "story") {
    let first: string | null = null;
    for (const url of imageUrls.slice(0, 10)) {
      const photo = await call(`${pageId}/photos`, { url, published: "false", access_token: token }, "POST");
      const story = await call(`${pageId}/photo_stories`, { photo_id: String(photo.id), access_token: token }, "POST");
      first ??= String(story.post_id ?? photo.id);
    }
    return { postId: first ?? "", permalink: null as string | null };
  }

  if (imageUrls.length === 1) {
    const r = await call(`${pageId}/photos`, { url: imageUrls[0], caption, published: "true", access_token: token }, "POST");
    const postId = String(r.post_id ?? r.id);
    return { postId, permalink: await permalink(postId, token) };
  }

  const params: Record<string, string> = { message: caption, access_token: token };
  let i = 0;
  for (const url of imageUrls.slice(0, 10)) {
    const p = await call(`${pageId}/photos`, { url, published: "false", access_token: token }, "POST");
    params[`attached_media[${i++}]`] = JSON.stringify({ media_fbid: String(p.id) });
  }
  const r = await call(`${pageId}/feed`, params, "POST");
  const postId = String(r.id);
  return { postId, permalink: await permalink(postId, token) };
}

/** Publica un video en la Página (Facebook lo procesa en segundo plano). */
export async function fbPublishVideo(opts: { pageId: string; token: string; videoUrl: string; caption: string; title?: string }) {
  const r = await call(`${opts.pageId}/videos`, {
    file_url: opts.videoUrl, description: opts.caption, ...(opts.title ? { title: opts.title.slice(0, 100) } : {}), access_token: opts.token,
  }, "POST");
  const id = String(r.id);
  return { postId: id, permalink: `https://www.facebook.com/${opts.pageId}/videos/${id}` };
}
