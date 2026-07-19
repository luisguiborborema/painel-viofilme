// vioflux-publish — Edge Function (CASCA / stub).
//
// FLX04.3/FLX04.4: publicação automática no Instagram/Facebook. Fica DESLIGADA
// até a App Review de publicação da Meta passar (instagram_business_content_publish
// + pages_manage_posts). Quando ligar: definir os secrets no Supabase e
// VIOFLUX_PUBLISH_ENABLED=true. Toda chamada sai daqui (token nunca no cliente).
//
// Deploy: supabase functions deploy vioflux-publish
//
// Fluxo real (2 passos, quando habilitado):
//   1) POST /{ig-user-id}/media           -> cria container (image_url/caption). Expira em 24h.
//   2) POST /{ig-user-id}/media_publish   -> publica o container (creation_id).
// Limite: 100 posts/conta em 24h (carrossel = 1). Mídia precisa de URL pública.

const GRAPH_VERSION = "v21.0"; // versão fixada num único ponto (FLX04.4)

interface PublishRequest {
  postId: string;
  igUserId: string;
  imageUrl: string;
  caption?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não permitido" }), { status: 405 });
  }

  const enabled = Deno.env.get("VIOFLUX_PUBLISH_ENABLED") === "true";
  const token = Deno.env.get("META_SYSTEM_USER_TOKEN"); // secret no Supabase

  if (!enabled || !token) {
    // Fase atual = modo MANUAL. A publicação humana continua no VioFlux.
    return new Response(
      JSON.stringify({
        ok: false,
        enabled: false,
        mode: "manual",
        reason: "Publicação automática desligada até a App Review de publicação da Meta passar.",
      }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: PublishRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  if (!body.igUserId || !body.imageUrl) {
    return new Response(JSON.stringify({ error: "igUserId/imageUrl ausente" }), { status: 400 });
  }

  const base = `https://graph.facebook.com/${GRAPH_VERSION}`;

  // 1) cria o container
  const createRes = await fetch(`${base}/${body.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: body.imageUrl, caption: body.caption ?? "", access_token: token }),
  });
  const created = await createRes.json();
  if (!createRes.ok || !created.id) {
    return new Response(JSON.stringify({ ok: false, step: "create", error: created }), { status: 502 });
  }

  // 2) publica o container
  const pubRes = await fetch(`${base}/${body.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: created.id, access_token: token }),
  });
  const published = await pubRes.json();
  if (!pubRes.ok || !published.id) {
    return new Response(JSON.stringify({ ok: false, step: "publish", error: published }), { status: 502 });
  }

  // media id retorna aqui — o chamador atualiza vioflux_posts.state='publicado'.
  return new Response(JSON.stringify({ ok: true, mediaId: published.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
