/**
 * Categorias de despesa — personalizáveis pela agência.
 *
 * Client-safe. A chave (`key`) é o que fica gravado em `expenses.category`,
 * então renomear o rótulo não quebra histórico.
 */

/** Onde a categoria entra no DRE. */
export type DreGroup = "deducao" | "custo";

export const DRE_GROUPS: { key: DreGroup; label: string; hint: string }[] = [
  { key: "deducao", label: "Dedução da receita", hint: "Abate da receita bruta (impostos, taxas)" },
  { key: "custo", label: "Custo / despesa", hint: "Abate da receita líquida (vira lucro)" },
];

export type ExpenseCategoryDef = {
  id: string;
  key: string;
  label: string;
  dreGroup: DreGroup;
  color: string | null;
  position: number;
  active: boolean;
};

/** Usadas quando a migração 0133 ainda não rodou (espelham o código antigo). */
export const CATEGORIAS_PADRAO: ExpenseCategoryDef[] = [
  { id: "d-impostos", key: "impostos", label: "Impostos & deduções", dreGroup: "deducao", color: null, position: 0, active: true },
  { id: "d-salarios", key: "salarios", label: "Salários & pró-labore", dreGroup: "custo", color: null, position: 1, active: true },
  { id: "d-ferramentas", key: "ferramentas", label: "Ferramentas & infraestrutura", dreGroup: "custo", color: null, position: 2, active: true },
  { id: "d-comissoes", key: "comissoes", label: "Comissões comerciais", dreGroup: "custo", color: null, position: 3, active: true },
  { id: "d-variavel", key: "variavel", label: "Custos variáveis", dreGroup: "custo", color: null, position: 4, active: true },
  { id: "d-outros", key: "outros", label: "Outros", dreGroup: "custo", color: null, position: 5, active: true },
];

/** Gera uma chave estável a partir do rótulo (sem acento, minúscula). */
export function chaveDe(label: string): string {
  return (label ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "categoria";
}
