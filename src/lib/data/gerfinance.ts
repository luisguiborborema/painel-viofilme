export type RuleStage = {
  stage: string;
  title: string;
  desc: string;
  tag: string;
};

export type Receivable = {
  id: string;
  client: string;
  segment: string;
  description: string;
  dueLabel: string;
  value: number;
  status: { label: string; tone: "ok" | "warn" | "danger" | "info" };
  ruler: string;
  statusKey: "avencer" | "vencida" | "pago";
  action: "pix" | "whatsapp" | "cs" | "download";
  /** "asaas" (veio do gateway) ou "manual" (lançado no painel). */
  source?: "asaas" | "manual";
  accountName?: string | null;
  /** Só nos manuais: permite editar/excluir. */
  rowId?: string | null;
};

export type CriticalDelinquent = {
  id: string;
  name: string;
  value: number;
  note: string;
  action: "cs" | "whatsapp";
};

import { CATEGORIAS_PADRAO, type ExpenseCategoryDef } from "./expense-categories";

/** Conta por onde o dinheiro entra/sai (Asaas, BTG, Inter, caixa…). */
export type AccountKind = "banco" | "gateway" | "caixa";

export const ACCOUNT_KINDS: { key: AccountKind; label: string }[] = [
  { key: "banco", label: "Banco" },
  { key: "gateway", label: "Gateway de pagamento" },
  { key: "caixa", label: "Caixa / dinheiro" },
];

export type FinancialAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  institution: string | null;
  openingBalance: number;
  active: boolean;
  isDefault: boolean;
  /** Saldo: inicial + recebido − pago + transferências recebidas − enviadas. */
  balance?: number;
  received?: number;
  paid?: number;
  transferIn?: number;
  transferOut?: number;
};

export type AccountTransfer = {
  id: string;
  fromAccount: string;
  fromName: string;
  toAccount: string;
  toName: string;
  amount: number;
  date: string;
  note: string | null;
};

/** Formas de recebimento manual (fora do Asaas). */
export const MANUAL_METHODS: { key: string; label: string }[] = [
  { key: "PIX", label: "Pix" },
  { key: "CASH", label: "Dinheiro" },
  { key: "TRANSFER", label: "Transferência" },
  { key: "CARD", label: "Cartão" },
  { key: "BARTER", label: "Permuta" },
  { key: "OTHER", label: "Outro" },
];

export type ExpenseCategory =
  | "salarios"
  | "ferramentas"
  | "comissoes"
  | "impostos"
  | "variavel"
  | "outros";

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "salarios", label: "Salários & pró-labore" },
  { key: "ferramentas", label: "Ferramentas & infraestrutura" },
  { key: "comissoes", label: "Comissões comerciais" },
  { key: "impostos", label: "Impostos & deduções" },
  { key: "variavel", label: "Custos variáveis" },
  { key: "outros", label: "Outros" },
];

export const EXPENSE_CATEGORY_LABEL = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<ExpenseCategory, string>;

export type Expense = {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  dueDate: string; // ISO date
  paidDate: string | null;
  status: "pending" | "paid";
  recurring: boolean;
  vendor: string | null;
  /** Série de recorrência: agrupa as parcelas geradas juntas. */
  clientId?: string | null;
  seriesId?: string | null;
  installment?: number | null;
  installmentsTotal?: number | null;
  recurrence?: "monthly" | "weekly" | "yearly" | null;
  openEnded?: boolean;
  accountId?: string | null;
  accountName?: string | null;
};

export type GerFinance = {
  periodLabel: string;
  kpis: {
    mrr: number;
    mrrDelta: string;
    forecast30: number;
    forecastNote: string;
    overdue: number;
    overdueNote: string;
    margin: number;
    marginDelta: string;
  };
  cashflow: { month: string; entradas: number; saidas: number; saldo: number }[];
  cashflowNote: string;
  revenue: { mrr: number; projetos: number; outros: number; mrrPct: number };
  receiptStatus: { received: number; dueSoon: number; overdue: number };
  rule: RuleStage[];
  critical: CriticalDelinquent[];
  delinquencyTotal: number;
  receivables: Receivable[];
  receivablesTotals: { count: number; received: number; open: number };
  dre: {
    grossRevenue: number;
    taxes: number;
    taxPct: number;
    netRevenue: number;
    salaries: number;
    tools: number;
    commissions: number;
    variableCosts: number;
    netProfit: number;
    margin: number;
    metaMargin: number;
  };
  topExpenses: { label: string; value: number }[];
  revenueByClient: { name: string; value: number }[];
  expenses: Expense[];
  accounts: FinancialAccount[];
  /** Categorias cadastradas (personalizáveis). */
  categories: ExpenseCategoryDef[];
  transfers: AccountTransfer[];
  /** Clientes, para vincular custo direto. */
  clients: { id: string; name: string }[];
};

export function getGerFinance(): GerFinance {
  return {
    periodLabel: "Junho 2026",
    kpis: {
      mrr: 31000,
      mrrDelta: "+R$ 6,4k vs. maio",
      forecast30: 29200,
      forecastNote: "8 faturas · 2 parcelas",
      overdue: 5600,
      overdueNote: "2 clientes · ação próx. 7d",
      margin: 38,
      marginDelta: "+4pp vs. maio",
    },
    cashflow: [
      { month: "Jul", entradas: 31000, saidas: 19200, saldo: 11800 },
      { month: "Ago", entradas: 33000, saidas: 20000, saldo: 13000 },
      { month: "Set", entradas: 35000, saidas: 21000, saldo: 14000 },
    ],
    cashflowNote:
      "Jul · entradas R$ 31k · saídas R$ 19,2k · saldo previsto R$ 11,8k",
    revenue: { mrr: 31000, projetos: 8600, outros: 3400, mrrPct: 72 },
    receiptStatus: { received: 25400, dueSoon: 8460, overdue: 5600 },
    rule: [
      { stage: "D+0", title: "Dia do vencimento", desc: "Fatura gerada e enviada via e-mail + PIX ao cliente", tag: "Automático" },
      { stage: "D+3", title: "3 dias após vencimento", desc: "Lembrete amigável por e-mail com link de 2ª via e código PIX", tag: "E-mail automático" },
      { stage: "D+10", title: "10 dias após vencimento", desc: "WhatsApp via API com urgência e link de pagamento direto", tag: "WhatsApp API" },
      { stage: "D+20", title: "20 dias após vencimento", desc: "Notifica o CS responsável para ligar + alerta no Hub C-Level", tag: "Intervenção humana" },
    ],
    critical: [
      { id: "fit", name: "Academia FitBody", value: 2800, note: "Vencida há 12 dias · D+10 enviado", action: "cs" },
      { id: "moda", name: "Loja ModaVerde", value: 2200, note: "Vencida há 5 dias · D+3 enviado", action: "whatsapp" },
    ],
    delinquencyTotal: 5000,
    receivables: [
      { id: "r1", client: "Academia FitBody", segment: "Fitness", description: "Fee mensal jun/26", dueLabel: "05/06", value: 2800, status: { label: "Vencida 12d", tone: "danger" }, ruler: "D+10 enviado", statusKey: "vencida", action: "cs" },
      { id: "r2", client: "Loja ModaVerde", segment: "Moda", description: "Fee mensal jun/26", dueLabel: "18/06", value: 2200, status: { label: "Vencida 5d", tone: "danger" }, ruler: "D+3 enviado", statusKey: "vencida", action: "whatsapp" },
      { id: "r3", client: "Clínica Odonto Plus", segment: "Saúde", description: "Fee mensal jul/26", dueLabel: "05/07 · 5d", value: 3500, status: { label: "Vence em 5d", tone: "warn" }, ruler: "Aguardando", statusKey: "avencer", action: "pix" },
      { id: "r4", client: "Rede Farmácia BH", segment: "Varejo", description: "Fee mensal jul/26", dueLabel: "05/07 · 12d", value: 8500, status: { label: "A vencer", tone: "info" }, ruler: "Aguardando", statusKey: "avencer", action: "pix" },
      { id: "r5", client: "Rest. Sabor do Mar", segment: "Gastronomia", description: "Fee mensal jun/26", dueLabel: "05/06", value: 2800, status: { label: "Pago 05/06", tone: "ok" }, ruler: "PIX · 10h14", statusKey: "pago", action: "download" },
      { id: "r6", client: "Advocacia Menezes", segment: "Jurídico", description: "Fee mensal jun/26", dueLabel: "05/06", value: 3600, status: { label: "Pago 04/06", tone: "ok" }, ruler: "PIX · 14h32", statusKey: "pago", action: "download" },
    ],
    receivablesTotals: { count: 6, received: 25400, open: 5600 },
    dre: {
      grossRevenue: 43000,
      taxes: 5590,
      taxPct: 13,
      netRevenue: 37410,
      salaries: 12800,
      tools: 1420,
      commissions: 960,
      variableCosts: 2240,
      netProfit: 19990,
      margin: 46.5,
      metaMargin: 42,
    },
    topExpenses: [
      { label: "Salários / pró-labore", value: 12800 },
      { label: "Custo variável", value: 2240 },
      { label: "Ferramentas", value: 1420 },
      { label: "Comissões", value: 960 },
    ],
    revenueByClient: [
      { name: "Rede Farmácia BH", value: 8900 },
      { name: "Rest. Sabor do Mar", value: 6400 },
      { name: "Advocacia Menezes", value: 4800 },
      { name: "Academia FitBody", value: 3200 },
    ],
    expenses: [
      { id: "e1", description: "Folha de pagamento — equipe", category: "salarios", amount: 12800, dueDate: "2026-07-05", paidDate: "2026-07-05", status: "paid", recurring: true, vendor: null },
      { id: "e2", description: "Ferramentas & infraestrutura (SaaS)", category: "ferramentas", amount: 1420, dueDate: "2026-07-10", paidDate: null, status: "pending", recurring: true, vendor: "Diversos" },
      { id: "e3", description: "Comissões comerciais — junho", category: "comissoes", amount: 960, dueDate: "2026-07-08", paidDate: null, status: "pending", recurring: false, vendor: null },
      { id: "e4", description: "Simples Nacional — competência jun", category: "impostos", amount: 5590, dueDate: "2026-07-20", paidDate: null, status: "pending", recurring: true, vendor: "Receita Federal" },
      { id: "e5", description: "Custos de produção (freelas/impressão)", category: "variavel", amount: 2240, dueDate: "2026-07-15", paidDate: null, status: "pending", recurring: false, vendor: null },
    ],
    accounts: [],
    categories: CATEGORIAS_PADRAO,
    transfers: [],
    clients: [],
  };
}
