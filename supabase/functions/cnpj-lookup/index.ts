// cnpj-lookup — Edge Function.
//
// Novo negócio (§3): consulta de CNPJ para pré-preencher razão social, cidade/UF
// e segmento. Ponto ÚNICO do provedor e da versão da API (decisão-mãe: chamada
// externa sai daqui). Funciona de graça com ReceitaWS; se houver um provedor
// pago configurado (CNPJá), usa ele.
//
// Secret (opcional): CNPJA_TOKEN = <token do CNPJá> — sem ele, usa ReceitaWS.
// Deploy: supabase functions deploy cnpj-lookup
// O app aponta CNPJ_LOOKUP_URL para esta função; sem isso, cai no ReceitaWS
// inline da rota /api/crm/cnpj (fallback manual sempre disponível).
//
// Uso: GET ?cnpj=<14 dígitos>  ou  POST { cnpj }.

const RECEITAWS = "https://receitaws.com.br/v1/cnpj";
const CNPJA = "https://api.cnpja.com/office"; // versão/base fixada aqui

function json(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  let cnpjRaw = url.searchParams.get("cnpj") ?? "";
  if (!cnpjRaw && req.method === "POST") {
    cnpjRaw = String(((await req.json().catch(() => ({}))) as { cnpj?: string }).cnpj ?? "");
  }
  const cnpj = cnpjRaw.replace(/\D/g, "");
  if (cnpj.length !== 14) return json({ ok: false, reason: "CNPJ inválido" });

  const token = Deno.env.get("CNPJA_TOKEN");
  try {
    if (token) {
      const r = await fetch(`${CNPJA}/${cnpj}`, { headers: { Authorization: token }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return json({ ok: false, reason: "indisponível" });
      const d = await r.json();
      return json({
        ok: true,
        provider: "cnpja",
        name: d.company?.name ?? d.alias ?? "",
        cidadeUf: d.address ? `${d.address.city}/${d.address.state}` : "",
        segment: d.mainActivity?.text ?? "",
      });
    }

    const r = await fetch(`${RECEITAWS}/${cnpj}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return json({ ok: false, reason: "indisponível" });
    const d = await r.json();
    if (d.status === "ERROR") return json({ ok: false, reason: "não encontrado" });
    return json({
      ok: true,
      provider: "receitaws",
      name: d.nome ?? d.fantasia ?? "",
      cidadeUf: d.municipio && d.uf ? `${d.municipio}/${d.uf}` : d.uf ?? "",
      segment: d.atividade_principal?.[0]?.text ?? "",
    });
  } catch {
    return json({ ok: false, reason: "falha na consulta" });
  }
});
