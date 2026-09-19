import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { buscarTudo } from "@/lib/data/paginate-server";
import {
  explicarVariacao, montarDre, paraCadaCem,
  type Dre, type ImpactType, type ImpactoNaVariacao, type SegmentoCem, type TotaisPorImpacto,
} from "@/lib/data/resultados";

/**
 * Leitura de Resultados, por competência.
 *
 * Converte na fronteira: as tabelas antigas guardam reais em `numeric(12,2)` e
 * o cálculo trabalha em centavos (§24 do documento-mãe).
 *
 * A receita vem de `payments`; o custo, de `expenses` agrupado pelo
 * `impact_type` da categoria. As recorrências e a alocação de equipe ainda não
 * existem no banco, então margem de contribuição por cliente e ponte de MRR
 * ficam de fora — e a tela diz isso, em vez de mostrar meia conta.
 */

const TZ = "America/Sao_Paulo";
const paraCent = (reais: unknown) => Math.round((Number(reais) || 0) * 100);

export type LinhaCategoria = {
  key: string;
  label: string;
  impacto: ImpactType;
  valorCent: number;
  anteriorCent: number;
};

export type ResultadosView = {
  /** A migração 0147 rodou? */
  pendente: boolean;
  ano: number;
  mes: number;
  mesLabel: string;
  dre: Dre;
  dreAnterior: Dre;
  cem: { segmentos: SegmentoCem[]; prejuizoCent: number | null };
  variacao: { top: ImpactoNaVariacao[]; demaisCent: number; totalCent: number };
  categorias: LinhaCategoria[];
  /** Categorias sem tipo de impacto: ficam de fora e a tela avisa. */
  semImpacto: string[];
  comparacaoLabel: string;
};

const semMigracao = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return c === "42P01" || c === "42703" || /does not exist/i.test(m);
};

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function limites(ano: number, mes: number) {
  return {
    primeiro: `${ano}-${String(mes).padStart(2, "0")}-01`,
    ultimo: new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10),
  };
}

export async function getResultados(opts: { mes?: number; ano?: number } = {}): Promise<ResultadosView> {
  const agora = new Date();
  const hoje = agora.toLocaleDateString("en-CA", { timeZone: TZ });
  const anoAtual = Number(hoje.slice(0, 4));
  const mesAtual = Number(hoje.slice(5, 7));
  const ano = Number(opts.ano) || anoAtual;
  const mes = Math.max(1, Math.min(12, Math.round(opts.mes ?? mesAtual)));

  const vazioDre = montarDre({});
  const vazio: ResultadosView = {
    pendente: true, ano, mes, mesLabel: `${MESES[mes]} de ${ano}`,
    dre: vazioDre, dreAnterior: vazioDre,
    cem: { segmentos: [], prejuizoCent: null },
    variacao: { top: [], demaisCent: 0, totalCent: 0 },
    categorias: [], semImpacto: [], comparacaoLabel: "mês anterior",
  };
  if (!isSupabaseConfigured()) return vazio;

  const supabase = await createClient();

  // Categorias com tipo de impacto. Sem a 0147, a página vira o aviso.
  let cats: { key: string; label: string; impacto: ImpactType | null }[] = [];
  try {
    const { data, error } = await supabase.from("expense_categories").select("key, label, impact_type");
    if (error) throw error;
    cats = (data ?? []).map((c) => ({
      key: String(c.key), label: String(c.label ?? c.key),
      impacto: (c.impact_type as ImpactType) ?? null,
    }));
  } catch (e) {
    if (semMigracao(e)) return vazio;
    throw e;
  }

  const impactoDa = new Map(cats.filter((c) => c.impacto).map((c) => [c.key, c.impacto as ImpactType]));
  const labelDa = new Map(cats.map((c) => [c.key, c.label]));
  const semImpacto = cats.filter((c) => !c.impacto).map((c) => c.label);

  const antMes = mes === 1 ? 12 : mes - 1;
  const antAno = mes === 1 ? ano - 1 : ano;
  const a = limites(ano, mes);
  const b = limites(antAno, antMes);

  const [despAtual, despAnt, recAtual, recAnt] = await Promise.all([
    buscarTudo<Record<string, unknown>>((x, y) =>
      supabase.from("expenses").select("category, amount").gte("due_date", a.primeiro).lte("due_date", a.ultimo).range(x, y)),
    buscarTudo<Record<string, unknown>>((x, y) =>
      supabase.from("expenses").select("category, amount").gte("due_date", b.primeiro).lte("due_date", b.ultimo).range(x, y)),
    buscarTudo<Record<string, unknown>>((x, y) =>
      supabase.from("payments").select("value, due_date").gte("due_date", a.primeiro).lte("due_date", a.ultimo).range(x, y)),
    buscarTudo<Record<string, unknown>>((x, y) =>
      supabase.from("payments").select("value, due_date").gte("due_date", b.primeiro).lte("due_date", b.ultimo).range(x, y)),
  ]);

  function agrupar(despesas: Record<string, unknown>[], receitas: Record<string, unknown>[]) {
    const porCategoria = new Map<string, number>();
    const totais: TotaisPorImpacto = {};
    for (const d of despesas) {
      const k = String(d.category ?? "");
      const imp = impactoDa.get(k);
      if (!imp) continue;
      const v = paraCent(d.amount);
      porCategoria.set(k, (porCategoria.get(k) ?? 0) + v);
      totais[imp] = (totais[imp] ?? 0) + v;
    }
    // Receita não tem categoria no modelo atual: entra inteira como
    // operating_revenue. Quando Recebimentos existir, virá por item de título.
    const receita = receitas.reduce((s, p) => s + paraCent(p.value), 0);
    totais.operating_revenue = (totais.operating_revenue ?? 0) + receita;
    return { porCategoria, totais, receita };
  }

  const at = agrupar(despAtual.linhas, recAtual.linhas);
  const an = agrupar(despAnt.linhas, recAnt.linhas);

  const categorias: LinhaCategoria[] = [...at.porCategoria.entries()]
    .map(([k, v]) => ({
      key: k, label: labelDa.get(k) ?? k, impacto: impactoDa.get(k) as ImpactType,
      valorCent: v, anteriorCent: an.porCategoria.get(k) ?? 0,
    }))
    .sort((x, y) => y.valorCent - x.valorCent);

  if (at.receita > 0) {
    categorias.unshift({
      key: "__receita", label: "Receita de clientes", impacto: "operating_revenue",
      valorCent: at.receita, anteriorCent: an.receita,
    });
  }

  const anteriorPorKey: Record<string, number> = {};
  for (const c of categorias) anteriorPorKey[c.key] = c.anteriorCent;

  return {
    pendente: false, ano, mes, mesLabel: `${MESES[mes]} de ${ano}`,
    dre: montarDre(at.totais),
    dreAnterior: montarDre(an.totais),
    cem: paraCadaCem(at.totais),
    variacao: explicarVariacao(categorias, anteriorPorKey),
    categorias,
    semImpacto,
    comparacaoLabel: `${MESES[antMes].toLowerCase()}`,
  };
}
