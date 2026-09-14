/**
 * Envio de solicitação pelo portal do cliente.
 *
 * Os dois formulários faziam `void fetch(...).catch(() => {})` seguido de
 * `setSent(true)` — disparavam e esqueciam, marcando "enviado" antes mesmo de a
 * resposta chegar. O cliente via a confirmação com a rede caída, com erro 500,
 * ou com a gravação recusada pelo banco.
 *
 * Pior: a rota notifica a equipe e cria o evento no Google **antes** de saber
 * se gravou. Então o cenário completo do erro era: cliente tranquilo achando
 * que pediu, equipe recebendo WhatsApp sobre um pedido, evento "[A confirmar]"
 * no calendário — e a tela de Solicitações vazia. Ninguém tinha como
 * desconfiar, porque todos os sinais diziam que deu certo.
 *
 * Client-safe: só o tipo e a leitura da resposta.
 */

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; erro: string };

const GENERICO = "Não conseguimos registrar sua solicitação. Tente de novo em instantes.";

/**
 * Interpreta a resposta da rota.
 *
 * `persisted: false` conta como falha mesmo com HTTP 200: a rota responde ok
 * depois de notificar a equipe, mas sem a linha no banco o pedido não existe
 * para quem vai atendê-lo.
 */
export function lerResposta(status: number, corpo: unknown): ResultadoEnvio {
  if (status === 401 || status === 403) {
    return { ok: false, erro: "Sua sessão expirou. Entre de novo e refaça o pedido." };
  }
  if (status < 200 || status >= 300) return { ok: false, erro: GENERICO };

  const o = (corpo ?? {}) as Record<string, unknown>;
  if (o.ok !== true) return { ok: false, erro: typeof o.error === "string" ? o.error : GENERICO };
  if (o.persisted === false) return { ok: false, erro: GENERICO };
  return { ok: true };
}

/** Envia e devolve o resultado já interpretado. Nunca lança. */
export async function enviarSolicitacao(
  type: "meeting" | "content",
  payload: Record<string, unknown>,
): Promise<ResultadoEnvio> {
  try {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    const corpo: unknown = await res.json().catch(() => null);
    return lerResposta(res.status, corpo);
  } catch {
    return { ok: false, erro: "Sem conexão. Verifique a internet e tente de novo." };
  }
}
