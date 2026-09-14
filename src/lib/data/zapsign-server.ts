import "server-only";
import {
  ZAPSIGN_API, ZAPSIGN_API_SANDBOX, lerRespostaDocumento, montarDocumento, type EntradaDocumento,
} from "@/lib/data/zapsign";

/**
 * Chamada à ZapSign. Só aqui o token sai do ambiente — nunca chega ao cliente.
 */

export function zapsignConfigurado(): boolean {
  return Boolean(process.env.ZAPSIGN_TOKEN);
}

/** Sandbox só quando pedido explicitamente: o padrão nunca pode ser o ambiente sem validade jurídica. */
export function zapsignSandbox(): boolean {
  return String(process.env.ZAPSIGN_SANDBOX ?? "").trim().toLowerCase() === "true";
}

export function baseZapsign(): string {
  return zapsignSandbox() ? ZAPSIGN_API_SANDBOX : ZAPSIGN_API;
}

export type ResultadoEnvio =
  | { ok: true; docToken: string; signUrl: string | null }
  | { ok: false; erro: string; status?: number };

export async function enviarParaAssinatura(entrada: EntradaDocumento): Promise<ResultadoEnvio> {
  const token = process.env.ZAPSIGN_TOKEN;
  if (!token) return { ok: false, erro: "ZapSign não configurada (falta ZAPSIGN_TOKEN).", status: 503 };

  const corpo = montarDocumento(entrada);
  if ("erro" in corpo) return { ok: false, erro: String(corpo.erro), status: 400 };

  let res: Response;
  try {
    res = await fetch(`${baseZapsign()}/docs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
      // A ZapSign baixa o PDF antes de responder; o padrão do fetch esperaria
      // indefinidamente e seguraria a função até o limite da plataforma.
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return {
      ok: false,
      status: 504,
      erro: timeout ? "A ZapSign demorou demais para responder." : "Não foi possível falar com a ZapSign.",
    };
  }

  // Lê como texto primeiro: erro da ZapSign às vezes vem vazio ou em HTML, e
  // `res.json()` transformaria isso num `null` indistinguível de corpo vazio.
  const bruto = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = bruto ? JSON.parse(bruto) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    // O motivo vem em campos variados — e às vezes por campo do formulário
    // (`{"url_pdf": ["..."]}`). Sem o status HTTP junto, "recusou: {}" não diz
    // nada a quem precisa arrumar.
    const o = (json ?? {}) as Record<string, unknown>;
    const primeiroCampo = Object.entries(o)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("; ") : String(v)}`)
      .join(" | ");
    const detalhe =
      (typeof o.error === "string" && o.error) ||
      (typeof o.detail === "string" && o.detail) ||
      (typeof o.message === "string" && o.message) ||
      primeiroCampo ||
      bruto.slice(0, 300) ||
      "sem corpo na resposta";
    return {
      ok: false,
      status: res.status === 401 || res.status === 403 ? 401 : 502,
      erro:
        res.status === 402
          ? `${detalhe} (Para testar sem plano, use o sandbox: ZAPSIGN_SANDBOX=true com o token de sandbox.app.zapsign.com.br.)`
          : `ZapSign recusou (HTTP ${res.status}): ${detalhe}`,
    };
  }

  const lido = lerRespostaDocumento(json);
  if ("erro" in lido) return { ok: false, erro: lido.erro, status: 502 };
  return { ok: true, docToken: lido.docToken, signUrl: lido.signUrl };
}
