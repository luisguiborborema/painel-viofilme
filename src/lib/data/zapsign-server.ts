import "server-only";
import { ZAPSIGN_API, lerRespostaDocumento, montarDocumento, type EntradaDocumento } from "@/lib/data/zapsign";

/**
 * Chamada à ZapSign. Só aqui o token sai do ambiente — nunca chega ao cliente.
 */

export function zapsignConfigurado(): boolean {
  return Boolean(process.env.ZAPSIGN_TOKEN);
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
    res = await fetch(`${ZAPSIGN_API}/docs/`, {
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

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // A ZapSign devolve o motivo em campos variados; sem isto o usuário vê só
    // "502" e não descobre que era o PDF inacessível ou o plano sem crédito.
    const o = (json ?? {}) as Record<string, unknown>;
    const detalhe =
      (typeof o.error === "string" && o.error) ||
      (typeof o.detail === "string" && o.detail) ||
      (typeof o.message === "string" && o.message) ||
      JSON.stringify(json ?? {}).slice(0, 300);
    return { ok: false, status: res.status === 401 ? 401 : 502, erro: `ZapSign recusou: ${detalhe}` };
  }

  const lido = lerRespostaDocumento(json);
  if ("erro" in lido) return { ok: false, erro: lido.erro, status: 502 };
  return { ok: true, docToken: lido.docToken, signUrl: lido.signUrl };
}
