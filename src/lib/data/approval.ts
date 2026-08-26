/**
 * Alçada de aprovação de despesas.
 *
 * Controle interno básico: acima de um valor, quem lança não é quem libera.
 * A trava é sobre o PAGAMENTO, não sobre o registro — a despesa continua
 * aparecendo no fluxo de caixa e no DRE por competência, porque ela existe
 * independentemente de alguém ter aprovado.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected";

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  rejected: "Recusada",
};

/** Só admin e gestor aprovam — mesma regra de quem pode apagar cliente. */
export function podeAprovar(tier: string | null | undefined): boolean {
  return tier === "admin" || tier === "gestor";
}

/** `threshold` 0 desliga a alçada. */
export function precisaAprovacao(valor: number, threshold: number): boolean {
  const t = Number(threshold);
  if (!Number.isFinite(t) || t <= 0) return false;
  return Number(valor) >= t;
}

/** Status inicial de uma despesa recém-lançada. */
export function statusInicial(valor: number, threshold: number): ApprovalStatus {
  return precisaAprovacao(valor, threshold) ? "pending" : "approved";
}

/** Motivo pelo qual o pagamento está bloqueado, ou null se pode pagar. */
export function bloqueioDePagamento(status: string | null | undefined): string | null {
  const s = (status ?? "approved") as ApprovalStatus;
  if (s === "pending") return "Despesa aguardando aprovação — um gestor precisa liberar antes do pagamento.";
  if (s === "rejected") return "Despesa recusada. Reabra a aprovação antes de pagar.";
  return null;
}
