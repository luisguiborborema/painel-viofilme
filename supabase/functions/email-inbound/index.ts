// email-inbound — Edge Function (CASCA / stub).
//
// Comunicações (inbox de e-mail): recebe e-mails via webhook de um provedor de
// inbound parsing (SendGrid Inbound Parse, Postmark, Mailgun Routes…) e os
// transforma em conversas/mensagens do inbox (channel="email"). DESLIGADA até o
// provedor ser configurado.
//
// Secrets:
//   EMAIL_ENABLED       = "true"
//   EMAIL_INBOUND_SECRET = <segredo compartilhado p/ validar o webhook>
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injetados automaticamente)
//
// Deploy: supabase functions deploy email-inbound
// Aponte o webhook de inbound do provedor para a URL desta função (?secret=…).

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não permitido" }), { status: 405 });
  }

  const enabled = Deno.env.get("EMAIL_ENABLED") === "true";
  const secret = Deno.env.get("EMAIL_INBOUND_SECRET");
  const url = new URL(req.url);
  if (!enabled) {
    return new Response(
      JSON.stringify({ ok: false, enabled: false, reason: "E-mail desligado — configure EMAIL_ENABLED=true." }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }
  if (secret && url.searchParams.get("secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  // Provedores mandam multipart/form-data OU json. Normalizamos o essencial.
  let from = "", subject = "", text = "";
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      from = String(j.from ?? j.sender ?? "");
      subject = String(j.subject ?? "");
      text = String(j.text ?? j.body ?? j["stripped-text"] ?? "");
    } else {
      const form = await req.formData();
      from = String(form.get("from") ?? form.get("sender") ?? "");
      subject = String(form.get("subject") ?? "");
      text = String(form.get("text") ?? form.get("stripped-text") ?? "");
    }
  } catch {
    return new Response(JSON.stringify({ error: "payload inválido" }), { status: 400 });
  }

  // TODO (ao ligar): upsert em conversations/messages (channel="email") via
  // service role e casar com o lead pelo e-mail do remetente (ver spec §8).
  return new Response(JSON.stringify({ ok: true, from, subject, hasText: text.length > 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
