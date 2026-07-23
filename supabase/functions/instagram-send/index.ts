// instagram-send — Edge Function (CASCA / stub).
//
// Comunicações: envia uma DM de Instagram (resposta do atendente). DESLIGADA
// até a App Review da Meta (instagram_manage_messages) passar.
//
// Secrets:
//   INSTAGRAM_ENABLED      = "true"
//   META_SYSTEM_USER_TOKEN = <token do System User>
//   IG_BUSINESS_ID         = <id da conta Instagram Business>
//
// Deploy: supabase functions deploy instagram-send
// Janela de 24h: fora dela, só templates aprovados (como no WhatsApp).

const GRAPH_VERSION = "v21.0";

interface SendRequest {
  recipientId: string; // IGSID do destinatário
  text: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não permitido" }), { status: 405 });
  }

  const enabled = Deno.env.get("INSTAGRAM_ENABLED") === "true";
  const token = Deno.env.get("META_SYSTEM_USER_TOKEN");
  const igId = Deno.env.get("IG_BUSINESS_ID");
  if (!enabled || !token || !igId) {
    return new Response(
      JSON.stringify({ ok: false, enabled: false, mode: "manual", reason: "Instagram desligado — configure os secrets da Meta." }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  if (!body.recipientId || !body.text) {
    return new Response(JSON.stringify({ error: "recipientId/text ausente" }), { status: 400 });
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: body.recipientId },
      message: { text: body.text },
      access_token: token,
    }),
  });
  const json = await res.json();
  if (!res.ok) return new Response(JSON.stringify({ ok: false, error: json }), { status: 502 });
  return new Response(JSON.stringify({ ok: true, messageId: json.message_id ?? null }), {
    headers: { "Content-Type": "application/json" },
  });
});
