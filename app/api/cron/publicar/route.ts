// GET /api/cron/publicar · Vercel Cron cada 5 minutos (ver vercel.json).
// Publica en Instagram las publicaciones programadas con "publicar automáticamente".
import { NextResponse, type NextRequest } from "next/server";
import { fbPublish, fbPublishVideo } from "@/lib/facebook";
import { igPublish, igPublishReel } from "@/lib/instagram";
import { layout, publishReminderEmail, sendOnce, siteUrl, userEmail, type ReminderPost } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { WA_TEMPLATES, sendWhatsAppOnce, waParam, waPhone, whatsappConfigured } from "@/lib/whatsapp";

const MAX_POR_VUELTA = 5;
// Los Reels pueden tardar varios minutos en procesarse: damos tiempo a la función.
export const maxDuration = 300;
const MAX_INTENTOS = 3;

interface DuePost {
  id: string;
  user_id: string;
  title: string | null;
  caption: string | null;
  hashtags: string[] | null;
  placement: "feed" | "story";
  media_paths: string[] | null;
  publish_attempts: number;
  also_facebook: boolean;
  source: string;
  video_path: string | null;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: due, error } = await admin
    .from("posts")
    .select("id, user_id, title, caption, hashtags, placement, media_paths, publish_attempts, also_facebook, source, video_path")
    .eq("auto_publish", true)
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .lt("publish_attempts", MAX_INTENTOS)
    .order("scheduled_at", { ascending: true })
    .limit(MAX_POR_VUELTA);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { id: string; ok: boolean; error?: string }[] = [];

  const started = Date.now();
  for (const post of (due ?? []) as DuePost[]) {
    // Si ya usamos más de 2 minutos (p. ej. un Reel), dejamos el resto para la próxima vuelta.
    if (Date.now() - started > 120000) break;
    // Bloqueo: solo una ejecución toma cada publicación.
    const { data: claimed } = await admin
      .from("posts")
      .update({ status: "publishing", publish_attempts: post.publish_attempts + 1 })
      .eq("id", post.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const attempt = post.publish_attempts + 1;
    try {
      const { data: allowed } = await admin.rpc("can_autopost", { p_user_id: post.user_id });
      if (!allowed) throw new Error("Tu plan actual no incluye publicación automática o tu cuenta no está al día.");

      const { data: account } = await admin
        .from("instagram_accounts")
        .select("access_token, token_expires_at, api_mode, ig_user_id, fb_page_id, fb_page_token")
        .eq("user_id", post.user_id)
        .maybeSingle();
      if (!account) throw new Error("Tu cuenta de Instagram no está conectada.");
      if (new Date(account.token_expires_at) < new Date()) throw new Error("La conexión con Instagram venció. Vuelve a conectarla.");

      const caption = [post.caption ?? "", (post.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);

      // Videos: Reel en Instagram y video en la Página de Facebook.
      if (post.source === "video") {
        if (!post.video_path) throw new Error("La publicación no tiene imágenes preparadas: falta el video.");
        const { data: v } = await admin.storage.from("videos").createSignedUrl(post.video_path, 7200);
        if (!v?.signedUrl) throw new Error("No se pudo preparar el video.");
        const { mediaId, permalink } = await igPublishReel({
          mode: account.api_mode, igUserId: account.ig_user_id, token: account.access_token, videoUrl: v.signedUrl, caption,
        });
        await admin
          .from("posts")
          .update({ status: "published", published_at: new Date().toISOString(), instagram_media_id: mediaId, ig_permalink: permalink, error_message: null })
          .eq("id", post.id);
        if (post.also_facebook) {
          try {
            if (!account.fb_page_id || !account.fb_page_token) throw new Error("No hay una Página de Facebook conectada. Vuelve a conectar tu cuenta.");
            const fb = await fbPublishVideo({ pageId: account.fb_page_id, token: account.fb_page_token, videoUrl: v.signedUrl, caption, title: post.title ?? undefined });
            await admin.from("posts").update({ fb_post_id: fb.postId, fb_permalink: fb.permalink, fb_error: null }).eq("id", post.id);
          } catch (fbErr) {
            await admin.from("posts").update({ fb_error: (fbErr instanceof Error ? fbErr.message : "Error en Facebook").slice(0, 300) }).eq("id", post.id);
          }
        }
        results.push({ id: post.id, ok: true });
        continue;
      }

      const paths = post.media_paths ?? [];
      if (paths.length === 0) throw new Error("La publicación no tiene imágenes preparadas. Vuelve a programarla.");
      const { data: signed, error: signErr } = await admin.storage.from("post-media").createSignedUrls(paths, 3600);
      if (signErr || !signed) throw new Error("No se pudieron preparar las imágenes.");
      const urls = signed.map((s) => s.signedUrl).filter(Boolean) as string[];
      const { mediaId, permalink } = await igPublish({
        mode: account.api_mode,
        igUserId: account.ig_user_id,
        token: account.access_token,
        placement: post.placement,
        imageUrls: urls,
        caption,
      });

      await admin
        .from("posts")
        .update({ status: "published", published_at: new Date().toISOString(), instagram_media_id: mediaId, ig_permalink: permalink, error_message: null })
        .eq("id", post.id);

      // También en la Página de Facebook (si se pidió). Un error aquí no deshace lo de Instagram.
      if (post.also_facebook) {
        try {
          if (!account.fb_page_id || !account.fb_page_token) throw new Error("No hay una Página de Facebook conectada. Vuelve a conectar tu cuenta.");
          const fb = await fbPublish({ pageId: account.fb_page_id, token: account.fb_page_token, placement: post.placement, imageUrls: urls, caption });
          await admin.from("posts").update({ fb_post_id: fb.postId, fb_permalink: fb.permalink, fb_error: null }).eq("id", post.id);
        } catch (fbErr) {
          await admin.from("posts").update({ fb_error: (fbErr instanceof Error ? fbErr.message : "Error en Facebook").slice(0, 300) }).eq("id", post.id);
        }
      }
      results.push({ id: post.id, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error desconocido";
      const final = attempt >= MAX_INTENTOS || /plan|conectada|venció|no tiene imágenes/.test(message);
      await admin
        .from("posts")
        .update({ status: final ? "failed" : "scheduled", error_message: message.slice(0, 500) })
        .eq("id", post.id);
      if (/venció|token|OAuth|session/i.test(message)) {
        await admin.from("instagram_accounts").update({ last_error: message.slice(0, 300) }).eq("user_id", post.user_id);
      }
      if (final) {
        const to = await userEmail(admin, post.user_id);
        if (to) {
          await sendOnce(admin, {
            userId: post.user_id,
            kind: "publish_failed",
            ref: post.id,
            to,
            subject: "No pudimos publicar en tu Instagram",
            html: layout(
              "Tu publicación no se pudo publicar",
              `<p>La publicación «${(post.title ?? "sin título").replace(/</g, "&lt;")}» no se publicó en Instagram.</p>
               <p><strong>Motivo:</strong> ${message.replace(/</g, "&lt;")}</p>
               <p>Puedes descargarla y subirla tú, o corregir el problema y volver a programarla.</p>`,
              { label: "Ver en el calendario", url: `${siteUrl()}/dashboard/calendario` }
            ),
          });
        }
      }
      results.push({ id: post.id, ok: false, error: message });
    }
  }

  // Recordatorios para quienes publican manualmente (clientes): a la hora programada.
  let reminders = 0;
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data: manual } = await admin
    .from("posts")
    .select("id, user_id, title, caption, hashtags, placement, scheduled_at, source, media_paths")
    .eq("status", "scheduled")
    .eq("auto_publish", false)
    .lte("scheduled_at", new Date().toISOString())
    .gte("scheduled_at", since)
    .limit(50);

  for (const p of (manual ?? []) as (ReminderPost & { user_id: string; source: string | null; media_paths: string[] | null })[]) {
    try {
      const { data: already } = await admin
        .from("email_log").select("id").eq("user_id", p.user_id).eq("kind", "publish_reminder").eq("ref", p.id).maybeSingle();
      if (already) continue;
      const [to, { data: profile }] = await Promise.all([
        userEmail(admin, p.user_id),
        admin.from("profiles").select("full_name").eq("id", p.user_id).maybeSingle(),
      ]);
      if (!to) continue;
      let links: string[] = [];
      if (p.media_paths?.length) {
        const { data: signed } = await admin.storage.from("post-media").createSignedUrls(p.media_paths, 86400);
        links = (signed ?? []).map((x) => x.signedUrl).filter(Boolean) as string[];
      }
      const name = (profile?.full_name ?? "").split(" ")[0] || "Hola";
      const sent = await sendOnce(admin, { userId: p.user_id, kind: "publish_reminder", ref: p.id, to, ...publishReminderEmail(name, p, links) });
      if (sent) reminders++;
    } catch (err) {
      console.error("[cron] recordatorio", p.id, err);
    }
  }

  // Recordatorio por WhatsApp (imagen + descripción + hashtags + enlace), para quien lo activó.
  let whatsapp = 0;
  if (whatsappConfigured()) {
    for (const p of (manual ?? []) as (ReminderPost & { user_id: string; scheduled_at: string; media_paths: string[] | null })[]) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("full_name, phone, whatsapp_opt_in")
          .eq("id", p.user_id)
          .maybeSingle();
        const to = profile?.whatsapp_opt_in ? waPhone(profile.phone) : null;
        if (!to || !p.media_paths?.length) continue;
        const { data: active } = await admin.rpc("can_generate_posts", { p_user_id: p.user_id });
        if (!active) continue;

        const { data: signed } = await admin.storage.from("post-media").createSignedUrl(p.media_paths[0], 86400);
        if (!signed?.signedUrl) continue;

        const hora = new Date(p.scheduled_at).toLocaleTimeString("es-PA", { timeZone: "America/Panama", hour: "numeric", minute: "2-digit" });
        const isStory = p.placement === "story";
        const extra = p.media_paths.length > 1 ? ` (${p.media_paths.length} imágenes, descárgalas en Markia)` : "";
        const sent = await sendWhatsAppOnce(admin, {
          userId: p.user_id,
          kind: "post_reminder",
          ref: p.id,
          to,
          template: WA_TEMPLATES.reminder,
          headerImageUrl: signed.signedUrl,
          bodyParams: [
            waParam((profile?.full_name ?? "").split(" ")[0] || "emprendedor", 30),
            waParam(hora, 20),
            waParam(`${p.title || (isStory ? "tu historia" : "tu publicación")}${extra}`, 120),
            isStory ? "Es una historia: Instagram no muestra descripción. Puedes agregar texto o stickers en la app." : waParam(p.caption, 550),
            isStory ? "—" : waParam((p.hashtags ?? []).join(" "), 200),
          ],
        });
        if (sent.ok) whatsapp++;
      } catch (err) {
        console.error("[cron] whatsapp", p.id, err);
      }
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results, reminders, whatsapp });
}
