import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { STATUS_IGNORAR } from "./dre";
import { intervalo, type DrePeriodo } from "./dre";

/**
 * Rentabilidade por cliente.
 *
 * Receita = cobranças do cliente com vencimento no período.
 * Custo    = despesas vinculadas àquele cliente (client_id) no mesmo período.
 *
 * Só entra custo DIRETO — o que foi explicitamente atribuído ao cliente.
 * Custo indireto (aluguel, ferramentas gerais) não é rateado: rateio exige um
 * critério que a agência precisa escolher, e um rateio errado engana mais do
 * que ajuda. Por isso a margem aqui é de contribuição, não lucro final.
 */
export type ClienteRentabilidade = {
  clientId: string;
  name: string;
  receita: number;
  custoDireto: number;
  contribuicao: number;
  margem: number | null;
};

export type Rentabilidade = {
  label: string;
  clientes: ClienteRentabilidade[];
  totalReceita: number;
  totalCustoDireto: number;
  /** Custos sem cliente vinculado — a "estrutura" que ninguém carrega sozinho. */
  custoIndireto: number;
  semVinculo: boolean;
};

const VAZIO: Rentabilidade = {
  label: "", clientes: [], totalReceita: 0, totalCustoDireto: 0, custoIndireto: 0, semVinculo: true,
};

export async function getRentabilidade(periodo: DrePeriodo = "mes", ref = new Date()): Promise<Rentabilidade> {
  if (!isSupabaseConfigured()) return VAZIO;
  try {
    const supabase = await createClient();
    const r = intervalo(periodo, ref);

    const [recRes, expRes] = await Promise.all([
      supabase.from("payments").select("client_id, value, status, clients(name)").gte("due_date", r.from).lte("due_date", r.to).limit(5000),
      supabase.from("expenses").select("client_id, amount").gte("due_date", r.from).lte("due_date", r.to).limit(5000),
    ]);

    const receitaPor = new Map<string, { nome: string; total: number }>();
    for (const p of (recRes.data ?? []) as Record<string, unknown>[]) {
      if (STATUS_IGNORAR.has(String(p.status ?? "")) || !p.client_id) continue;
      const c = p.clients as { name?: string } | { name?: string }[] | null;
      const nome = (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Cliente";
      const k = String(p.client_id);
      const cur = receitaPor.get(k) ?? { nome, total: 0 };
      cur.total += Number(p.value ?? 0);
      receitaPor.set(k, cur);
    }

    // expenses.client_id só existe após a 0136 → sem ela, não há custo direto.
    const semVinculo = Boolean(expRes.error);
    const custoPor = new Map<string, number>();
    let custoIndireto = 0;
    for (const e of (semVinculo ? [] : (expRes.data ?? [])) as Record<string, unknown>[]) {
      const v = Number(e.amount ?? 0);
      if (e.client_id) custoPor.set(String(e.client_id), (custoPor.get(String(e.client_id)) ?? 0) + v);
      else custoIndireto += v;
    }

    const ids = new Set([...receitaPor.keys(), ...custoPor.keys()]);
    const clientes: ClienteRentabilidade[] = [...ids].map((id) => {
      const receita = Math.round(receitaPor.get(id)?.total ?? 0);
      const custoDireto = Math.round(custoPor.get(id) ?? 0);
      const contribuicao = receita - custoDireto;
      return {
        clientId: id,
        name: receitaPor.get(id)?.nome ?? "Cliente",
        receita,
        custoDireto,
        contribuicao,
        margem: receita > 0 ? Math.round((contribuicao / receita) * 100) : null,
      };
    }).sort((a, b) => b.contribuicao - a.contribuicao);

    return {
      label: r.label,
      clientes,
      totalReceita: clientes.reduce((s, c) => s + c.receita, 0),
      totalCustoDireto: clientes.reduce((s, c) => s + c.custoDireto, 0),
      custoIndireto: Math.round(custoIndireto),
      semVinculo,
    };
  } catch {
    return VAZIO;
  }
}
