// instagram-webhook — Edge Function (CASCA / stub).
//
// Comunicações (inbox multicanal): recebe DMs do Instagram (Meta webhook) e os
// transforma em conversas/mensagens do inbox. Fica DESLIGADA até a App Review
// da Meta (instagram_manage_messages) passar e os secrets serem configurados.
//
// Secrets:
//   INSTAGRAM_ENABLED       = "true"
//   META_VERIFY_TOKEN       = <token de verificação do webhook>
//   META_SYSTEM_USER_TOKEN  = <token do System User (Graph API)>
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injetados automaticamente)
//
// Configurar o webhook no App da Meta apontando para a URL desta função.
// Deploy: supabase functions deploy instagram-webhook
//
// GET  = handshake de verificação (hub.challenge).
// POST = eventos de mensagem (entry[].messaging[]).

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1) Verificação do webhook (Meta faz um GET com hub.*).
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const verify = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("META_VERIFY_TOKEN");
    if (mode === "subscribe" && verify && verify === expected) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não permitido" }), { status: 405 });
  }

  const enabled = Deno.env.get("INSTAGRAM_ENABLED") === "true";
  if (!enabled) {
    return new Response(
      JSON.stringify({ ok: false, enabled: false, reason: "Instagram desligado — configure INSTAGRAM_ENABLED=true e os secrets da Meta." }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  let payload: {
    entry?: { messaging?: { sender?: { id?: string }; message?: { text?: string; mid?: string } }[] }[];
  };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  // Extrai as mensagens recebidas. Quando ligado, persistir numa conversa do
  // inbox (channel="instagram") com service role — ver spec Comunicações (§8):
  // conversations/messages + conversation_links p/ agrupar canais da pessoa.
  const events: { igUserId: string; text: string; mid?: string }[] = [];
  for (const e of payload.entry ?? []) {
    for (const m of e.messaging ?? []) {
      if (m.sender?.id && m.message?.text) {
        events.push({ igUserId: m.sender.id, text: m.message.text, mid: m.message.mid });
      }
    }
  }

  // TODO (ao ligar): upsert em conversations/messages via SUPABASE_SERVICE_ROLE_KEY
  // e casar com o lead por indício (nome/handle). Por ora só confirma o recebimento.
  return new Response(JSON.stringify({ ok: true, received: events.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
