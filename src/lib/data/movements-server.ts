import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { STATUS_IGNORAR } from "./dre";

/**
 * Movimentações consolidadas do Financeiro.
 *
 * Uma visão única de tudo que entra e sai — recebimentos (Asaas e manuais),
 * pagamentos e transferências entre contas. É a base do extrato, do fluxo de
 * caixa projetado e da conciliação, para os três não divergirem.
 */
export type MovKind = "entrada" | "saida" | "transferencia";

export type Movement = {
  id: string;
  /** Tabela de origem — define o que a UI pode fazer com a linha. */
  origem: "payment" | "expense" | "transfer";
  kind: MovKind;
  date: string;          // vencimento (previsto) ou data efetiva
  description: string;
  value: number;         // sempre positivo; `kind` diz o sinal
  liquidado: boolean;    // já pago/recebido?
  liquidadoEm: string | null;
  accountId: string | null;
  accountName: string | null;
  clientName: string | null;
  categoria: string | null;
  reconciliadoEm: string | null;
  anexo: string | null;
};

const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);

export type MovimentacoesFiltro = {
  from?: string;
  to?: string;
  accountId?: string;
  kind?: MovKind;
  /** "pendente" | "liquidado" | "naoConciliado" */
  situacao?: string;
};

export type MovimentacoesResultado = {
  movimentos: Movement[];
  totais: { entradas: number; saidas: number; saldo: number; pendenteEntrada: number; pendenteSaida: number };
  semTabelas: boolean;
};

const VAZIO: MovimentacoesResultado = {
  movimentos: [],
  totais: { entradas: 0, saidas: 0, saldo: 0, pendenteEntrada: 0, pendenteSaida: 0 },
  semTabelas: false,
};

export async function getMovimentacoes(f: MovimentacoesFiltro = {}): Promise<MovimentacoesResultado> {
  if (!isSupabaseConfigured()) return VAZIO;
  try {
    const supabase = await createClient();
    const from = f.from ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const to = f.to ?? new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

    // Nomes das contas (uma vez, para rotular tudo).
    const contasRes = await supabase.from("financial_accounts").select("id, name");
    const contaNome = new Map(
      (contasRes.error ? [] : (contasRes.data ?? [])).map((c) => [String((c as { id: unknown }).id), String((c as { name: unknown }).name)]),
    );

    // Recebimentos — tolerante às colunas novas.
    const PAY_BASE = "id, description, value, due_date, payment_date, status, clients(name)";
    const payV2 = await supabase
      .from("payments")
      .select(`${PAY_BASE}, account_id, reconciled_at, attachment_url`)
      .gte("due_date", from).lte("due_date", to).limit(3000);
    const payRes = payV2.error
      ? await supabase.from("payments").select(PAY_BASE).gte("due_date", from).lte("due_date", to).limit(3000)
      : payV2;

    // Despesas — idem.
    const EXP_BASE = "id, description, amount, due_date, paid_date, status, category";
    const expV2 = await supabase
      .from("expenses")
      .select(`${EXP_BASE}, account_id, reconciled_at, attachment_url, clients(name)`)
      .gte("due_date", from).lte("due_date", to).limit(3000);
    const expRes = expV2.error
      ? await supabase.from("expenses").select(EXP_BASE).gte("due_date", from).lte("due_date", to).limit(3000)
      : expV2;

    const transfRes = await supabase
      .from("account_transfers")
      .select("id, from_account, to_account, amount, date, note")
      .gte("date", from).lte("date", to).limit(1000);

    const semTabelas = Boolean(payRes.error && expRes.error);

    const nomeCliente = (r: Record<string, unknown>): string | null => {
      const c = r.clients as { name?: string } | { name?: string }[] | null | undefined;
      const o = Array.isArray(c) ? c[0] : c;
      return o?.name ?? null;
    };

    const movimentos: Movement[] = [];

    for (const r of (payRes.data ?? []) as Record<string, unknown>[]) {
      if (STATUS_IGNORAR.has(String(r.status ?? ""))) continue;
      const pago = PAGO.has(String(r.status ?? ""));
      movimentos.push({
        id: `p-${String(r.id)}`,
        origem: "payment",
        kind: "entrada",
        date: String(r.due_date ?? ""),
        description: String(r.description ?? "Recebimento"),
        value: Number(r.value ?? 0),
        liquidado: pago,
        liquidadoEm: (r.payment_date as string) ?? null,
        accountId: (r.account_id as string) ?? null,
        accountName: r.account_id ? (contaNome.get(String(r.account_id)) ?? null) : null,
        clientName: nomeCliente(r),
        categoria: null,
        reconciliadoEm: (r.reconciled_at as string) ?? null,
        anexo: (r.attachment_url as string) ?? null,
      });
    }

    for (const r of (expRes.data ?? []) as Record<string, unknown>[]) {
      movimentos.push({
        id: `e-${String(r.id)}`,
        origem: "expense",
        kind: "saida",
        date: String(r.due_date ?? ""),
        description: String(r.description ?? "Despesa"),
        value: Number(r.amount ?? 0),
        liquidado: r.status === "paid",
        liquidadoEm: (r.paid_date as string) ?? null,
        accountId: (r.account_id as string) ?? null,
        accountName: r.account_id ? (contaNome.get(String(r.account_id)) ?? null) : null,
        clientName: nomeCliente(r),
        categoria: (r.category as string) ?? null,
        reconciliadoEm: (r.reconciled_at as string) ?? null,
        anexo: (r.attachment_url as string) ?? null,
      });
    }

    for (const r of (transfRes.error ? [] : (transfRes.data ?? [])) as Record<string, unknown>[]) {
      const de = contaNome.get(String(r.from_account)) ?? "—";
      const para = contaNome.get(String(r.to_account)) ?? "—";
      movimentos.push({
        id: `t-${String(r.id)}`,
        origem: "transfer",
        kind: "transferencia",
        date: String(r.date ?? ""),
        description: `${de} → ${para}${r.note ? ` · ${String(r.note)}` : ""}`,
        value: Number(r.amount ?? 0),
        liquidado: true,
        liquidadoEm: String(r.date ?? ""),
        accountId: String(r.from_account),
        accountName: de,
        clientName: null,
        categoria: null,
        reconciliadoEm: null,
        anexo: null,
      });
    }

    // Filtros.
    let lista = movimentos;
    if (f.accountId) lista = lista.filter((m) => m.accountId === f.accountId);
    if (f.kind) lista = lista.filter((m) => m.kind === f.kind);
    if (f.situacao === "pendente") lista = lista.filter((m) => !m.liquidado);
    else if (f.situacao === "liquidado") lista = lista.filter((m) => m.liquidado);
    else if (f.situacao === "naoConciliado") lista = lista.filter((m) => m.liquidado && !m.reconciliadoEm);

    lista.sort((a, b) => b.date.localeCompare(a.date));

    const soma = (k: MovKind, liq: boolean) =>
      lista.filter((m) => m.kind === k && m.liquidado === liq).reduce((s, m) => s + m.value, 0);
    const entradas = soma("entrada", true);
    const saidas = soma("saida", true);

    return {
      movimentos: lista.slice(0, 500),
      totais: {
        entradas: Math.round(entradas),
        saidas: Math.round(saidas),
        saldo: Math.round(entradas - saidas),
        pendenteEntrada: Math.round(soma("entrada", false)),
        pendenteSaida: Math.round(soma("saida", false)),
      },
      semTabelas,
    };
  } catch {
    return VAZIO;
  }
}
