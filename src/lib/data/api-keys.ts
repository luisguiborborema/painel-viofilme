/**
 * Chaves de API — regras puras (client-safe).
 *
 * O token é mostrado UMA vez e só o hash é guardado. Isso não é burocracia:
 * significa que um vazamento do banco não entrega o acesso de ninguém, e que
 * nem quem administra o painel consegue ver a chave de outra pessoa.
 */

/** Prefixo que identifica a origem do token à primeira vista. */
export const PREFIXO = "vio_";

/** Tamanho mínimo aceito na validação (o gerado tem bem mais). */
export const MIN_TOKEN = 24;

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scope: string;
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
};

/** Parte visível do token, para reconhecer a linha na lista. */
export function prefixoDe(token: string): string {
  return token.slice(0, PREFIXO.length + 6);
}

/** Nome da chave: obrigatório, porque chave sem nome ninguém ousa revogar. */
export function nomeValido(raw: unknown): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = String(raw ?? "").trim();
  if (nome.length < 3) return { ok: false, erro: "Dê um nome de ao menos 3 caracteres — é como você vai saber qual revogar." };
  if (nome.length > 60) return { ok: false, erro: "Nome muito longo (máximo 60 caracteres)." };
  return { ok: true, nome };
}

export type SituacaoChave = "ativa" | "revogada" | "nunca usada";

export function situacao(k: Pick<ApiKey, "revokedAt" | "lastUsedAt">): SituacaoChave {
  if (k.revokedAt) return "revogada";
  return k.lastUsedAt ? "ativa" : "nunca usada";
}

/** "há 3 dias", "agora há pouco" — para a coluna de último uso. */
export function desde(iso: string | null, agora = new Date()): string {
  if (!iso) return "nunca";
  const ms = agora.getTime() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  const meses = Math.floor(d / 30);
  return `há ${meses} ${meses > 1 ? "meses" : "mês"}`;
}
