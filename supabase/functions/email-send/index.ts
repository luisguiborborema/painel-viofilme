// email-send — Edge Function (CASCA / stub).
//
// Comunicações: envia e-mail (resposta do atendente) via provedor transacional
// (Resend por padrão; trocar a chamada se usar SendGrid/Postmark). DESLIGADA até
// a chave do provedor ser configurada.
//
// Secrets:
//   EMAIL_ENABLED   = "true"
//   EMAIL_API_KEY   = <API key do provedor (ex.: Resend)>
//   EMAIL_FROM      = <remetente verificado, ex.: comercial@viofilme.com>
//
// Deploy: supabase functions deploy email-send

interface SendRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não permitido" }), { status: 405 });
  }

  const enabled = Deno.env.get("EMAIL_ENABLED") === "true";
  const key = Deno.env.get("EMAIL_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!enabled || !key || !from) {
    return new Response(
      JSON.stringify({ ok: false, enabled: false, mode: "manual", reason: "E-mail desligado — configure EMAIL_API_KEY e EMAIL_FROM." }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  if (!body.to || !body.subject) {
    return new Response(JSON.stringify({ error: "to/subject ausente" }), { status: 400 });
  }

  // Resend API (https://resend.com/docs). Trocar o endpoint/campos p/ outro provedor.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: body.to, subject: body.subject, html: body.html, text: body.text }),
  });
  const json = await res.json();
  if (!res.ok) return new Response(JSON.stringify({ ok: false, error: json }), { status: 502 });
  return new Response(JSON.stringify({ ok: true, id: json.id ?? null }), {
    headers: { "Content-Type": "application/json" },
  });
});
