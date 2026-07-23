// zapsign-send — Edge Function (CASCA / stub).
//
// Lead Ganho (§5 do Pipeline): ao fechar um negócio, envia o contrato para
// assinatura digital via ZapSign. Fica DESLIGADA até o token da ZapSign ser
// configurado. Toda chamada externa sai daqui (token nunca no cliente).
//
// Secrets (Supabase → Project Settings → Edge Functions → Secrets):
//   ZAPSIGN_ENABLED = "true"
//   ZAPSIGN_TOKEN   = <API token da ZapSign>
//   ZAPSIGN_TEMPLATE_ID (opcional) = <id do modelo de contrato>
//
// Deploy: supabase functions deploy zapsign-send
//
// Fluxo real (quando habilitado): cria um documento a partir do modelo com o
// signatário e devolve a URL de assinatura, que o app grava em deals.zapsign_url.

interface SignRequest {
  dealId: string;
  name: string;        // nome do signatário (cliente)
  email: string;       // e-mail do signatário
  templateId?: string; // sobrescreve ZAPSIGN_TEMPLATE_ID
  extra?: Record<string, string>; // variáveis do modelo (valor, plano…)
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não permitido" }), { status: 405 });
  }

  const enabled = Deno.env.get("ZAPSIGN_ENABLED") === "true";
  const token = Deno.env.get("ZAPSIGN_TOKEN");
  const defaultTemplate = Deno.env.get("ZAPSIGN_TEMPLATE_ID");

  if (!enabled || !token) {
    // Fase atual = MANUAL: o WinModal só guarda o link do contrato colado à mão.
    return new Response(
      JSON.stringify({
        ok: false,
        enabled: false,
        mode: "manual",
        reason: "ZapSign desligado — configure ZAPSIGN_TOKEN e ZAPSIGN_ENABLED=true.",
      }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: SignRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  if (!body.name || !body.email) {
    return new Response(JSON.stringify({ error: "name/email ausente" }), { status: 400 });
  }

  const templateId = body.templateId ?? defaultTemplate;
  const endpoint = templateId
    ? `https://api.zapsign.com.br/api/v1/models/create-doc/`
    : `https://api.zapsign.com.br/api/v1/docs/`;

  const payload = templateId
    ? {
        template_id: templateId,
        signer_name: body.name,
        data: Object.entries(body.extra ?? {}).map(([de, para]) => ({ de: `{{${de}}}`, para })),
      }
    : {
        name: `Contrato — ${body.name}`,
        signers: [{ name: body.name, email: body.email }],
      };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    return new Response(JSON.stringify({ ok: false, error: json }), { status: 502 });
  }

  // Devolve a URL de assinatura (o app grava em deals.zapsign_url / properties.n_zapsign).
  const signUrl = json.signers?.[0]?.sign_url ?? json.sign_url ?? null;
  return new Response(JSON.stringify({ ok: true, docToken: json.token ?? null, signUrl }), {
    headers: { "Content-Type": "application/json" },
  });
});
