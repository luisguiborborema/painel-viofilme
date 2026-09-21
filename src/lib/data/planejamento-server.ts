import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { unstable_cache } from "next/cache";
import { buscarTudo } from "@/lib/data/paginate-server";
import {
  LINHAS_GERENCIAIS, avaliarDesvio, proximoPasso, rotuloDaVersao, versaoVigente,
  type EstadoRotina, type Farol,
} from "@/lib/data/planejamento";

/**
 * Leitura do Planejamento.
 *
 * Converte na fronteira: as tabelas antigas do financeiro guardam reais em
 * `numeric(12,2)`, e o cálculo trabalha em centavos inteiros (§24 do
 * documento-mãe). A conversão acontece aqui, uma vez, e não se espalha.
 */

const TZ = "America/Sao_Paulo";
const paraCent = (reais: unknown) => Math.round((Number(reais) || 0) * 100);

export type LinhaOrcado = {
  key: string;
  label: string;
  orcadoCent: number;
  realizadoCent: number;
  desvioCent: number;
  desvioPct: number | null;
  farol: Farol;
  comentario: string | null;
  /** Vermelho sem comentário: a tabela marca "Comentar na revisão do mês". */
  comentarioPendente: boolean;
};

export type PlanejamentoView = {
  /** A migração 0146 rodou? Sem ela a página explica em vez de quebrar. */
  pendente: boolean;
  ano: number;
  mesAtual: number;
  versaoLabel: string;
  temVersao: boolean;
  temOrcamentoProximoAno: boolean;
  rotina: ReturnType<typeof proximoPasso>;
  linhas: LinhaOrcado[];
  totalOrcadoCent: number;
  totalRealizadoCent: number;
  resultadoOrcadoCent: number;
  resultadoRealizadoCent: number;
  /** Categorias sem `budget_line` definido — a tela avisa, não some com elas. */
  categoriasSemGrupo: string[];
};

const semMigracao = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return c === "42P01" || c === "42703" || /does not exist/i.test(m);
};

function limitesDoMes(ano: number, mes: number) {
  const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
  return { primeiro, ultimo };
}

/**
 * Monta a aba Orçamento para um mês, ou para o acumulado do ano.
 *
 * O realizado vem de `expenses` agrupado pelo `budget_line` da categoria. A
 * receita ainda não tem modelo de recorrência (a spec de Recebimentos não foi
 * implementada), então as duas linhas de receita ficam zeradas e a tela diz
 * isso — melhor do que exibir um número que parece receita e não é.
 */
const getPlanejamentoCached = unstable_cache(
  async (token: string, optsStr: string, ano: number, mesAtual: number) => {
    const opts = JSON.parse(optsStr) as { mes?: number; acumulado?: boolean };
    const mes = Math.max(1, Math.min(mesAtual, Math.round(opts.mes ?? mesAtual)));
    const db = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const vazio: PlanejamentoView = {
      pendente: true, ano, mesAtual, versaoLabel: rotuloDaVersao(undefined), temVersao: false,
      temOrcamentoProximoAno: false,
      rotina: proximoPasso({ mesPendente: null, desviosPendentes: 0, temOrcamentoProximoAno: false, mesAtual }),
      linhas: [], totalOrcadoCent: 0, totalRealizadoCent: 0,
      resultadoOrcadoCent: 0, resultadoRealizadoCent: 0, categoriasSemGrupo: [],
    };

    let versoes: { id: string; year: number; name: string; status: string; approvedAt: string | null }[] = [];
    try {
      const { data, error } = await db
        .from("budget_versions")
        .select("id, year, name, status, approved_at")
        .in("year", [ano, ano + 1]);
      if (error) throw error;
      versoes = (data ?? []).map((v) => ({
        id: String(v.id), year: Number(v.year), name: String(v.name ?? ""),
        status: String(v.status), approvedAt: v.approved_at ? String(v.approved_at) : null,
      }));
    } catch (e) {
      if (semMigracao(e)) return vazio;
      throw e;
    }

    const vigente = versaoVigente(versoes.filter((v) => v.year === ano));
    const temProximo = versoes.some((v) => v.year === ano + 1 && v.status === "approved");

    const meses = opts.acumulado ? Array.from({ length: mes }, (_, i) => i + 1) : [mes];
    const { primeiro } = limitesDoMes(ano, meses[0]);
    const { ultimo } = limitesDoMes(ano, meses[meses.length - 1]);

    const [catsRes, budRes, expRes, comRes, revRes] = await Promise.all([
      db.from("expense_categories").select("key, label, budget_line"),
      vigente
        ? db.from("budgets").select("category_key, amount, month").eq("version_id", vigente.id).gte("month", primeiro).lte("month", ultimo)
        : db.from("budgets").select("category_key, amount, month").gte("month", primeiro).lte("month", ultimo),
      buscarTudo<Record<string, unknown>>((a, b) =>
        db.from("expenses").select("category, amount").gte("due_date", primeiro).lte("due_date", ultimo).range(a, b)),
      vigente
        ? db.from("variance_comments").select("budget_line, text").eq("version_id", vigente.id).eq("month", primeiro)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      vigente
        ? db.from("budget_reviews").select("month").eq("version_id", vigente.id).eq("status", "done")
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    const grupoDaCategoria = new Map<string, string>();
    const semGrupo: string[] = [];
    for (const c of (catsRes.data ?? []) as Record<string, unknown>[]) {
      const linha = c.budget_line ? String(c.budget_line) : "";
      if (linha) grupoDaCategoria.set(String(c.key), linha);
      else semGrupo.push(String(c.label ?? c.key));
    }

    const orcadoPorGrupo = new Map<string, number>();
    for (const b of (budRes.data ?? []) as Record<string, unknown>[]) {
      const g = grupoDaCategoria.get(String(b.category_key));
      if (!g) continue;
      orcadoPorGrupo.set(g, (orcadoPorGrupo.get(g) ?? 0) + paraCent(b.amount));
    }

    const realPorGrupo = new Map<string, number>();
    for (const e of expRes.linhas) {
      const g = grupoDaCategoria.get(String(e.category ?? ""));
      if (!g) continue;
      realPorGrupo.set(g, (realPorGrupo.get(g) ?? 0) + paraCent(e.amount));
    }

    const comentarioPorGrupo = new Map<string, string>();
    for (const c of ((comRes as { data?: Record<string, unknown>[] }).data ?? [])) {
      if (c.text) comentarioPorGrupo.set(String(c.budget_line), String(c.text));
    }

    const linhas: LinhaOrcado[] = LINHAS_GERENCIAIS.map((l) => {
      const orc = orcadoPorGrupo.get(l.key) ?? 0;
      const real = realPorGrupo.get(l.key) ?? 0;
      const d = avaliarDesvio(orc, real, l.sinal);
      const com = comentarioPorGrupo.get(l.key) ?? null;
      return {
        key: l.key, label: l.label, orcadoCent: orc, realizadoCent: real,
        desvioCent: d.valor, desvioPct: d.percentual, farol: d.farol,
        comentario: com, comentarioPendente: d.farol === "vermelho" && !com,
      };
    });

    const soma = (f: (l: LinhaOrcado) => number) => linhas.reduce((a, l) => a + f(l), 0);
    const sinalDe = (k: string) => LINHAS_GERENCIAIS.find((x) => x.key === k)?.sinal ?? "custo";
    const resultado = (campo: "orcadoCent" | "realizadoCent") =>
      linhas.reduce((a, l) => a + (sinalDe(l.key) === "custo" ? -l[campo] : l[campo]), 0);

    const revisados = new Set(
      ((revRes as { data?: Record<string, unknown>[] }).data ?? []).map((r) => String(r.month).slice(0, 7)),
    );
    let mesPendente: number | null = null;
    for (let m = mesAtual - 1; m >= 1; m--) {
      const chave = `${ano}-${String(m).padStart(2, "0")}`;
      if (!revisados.has(chave)) { mesPendente = m; break; }
    }
    const desviosPendentes = linhas.filter((l) => l.comentarioPendente).length;

    const estado: EstadoRotina = {
      mesPendente: vigente ? mesPendente : null,
      desviosPendentes,
      temOrcamentoProximoAno: temProximo,
      mesAtual,
    };

    return {
      pendente: false, ano, mesAtual,
      versaoLabel: rotuloDaVersao(vigente), temVersao: !!vigente, temOrcamentoProximoAno: temProximo,
      rotina: proximoPasso(estado),
      linhas,
      totalOrcadoCent: soma((l) => l.orcadoCent),
      totalRealizadoCent: soma((l) => l.realizadoCent),
      resultadoOrcadoCent: resultado("orcadoCent"),
      resultadoRealizadoCent: resultado("realizadoCent"),
      categoriasSemGrupo: semGrupo,
    };
  },
  ["planejamento-dados"],
  { tags: ["financeiro"] }
);

export async function getPlanejamento(opts: { mes?: number; acumulado?: boolean } = {}): Promise<PlanejamentoView> {
  const agora = new Date();
  const ano = Number(agora.toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 4));
  const mesAtual = Number(agora.toLocaleDateString("en-CA", { timeZone: TZ }).slice(5, 7));

  if (!isSupabaseConfigured()) {
    return {
      pendente: true, ano, mesAtual, versaoLabel: rotuloDaVersao(undefined), temVersao: false,
      temOrcamentoProximoAno: false,
      rotina: proximoPasso({ mesPendente: null, desviosPendentes: 0, temOrcamentoProximoAno: false, mesAtual }),
      linhas: [], totalOrcadoCent: 0, totalRealizadoCent: 0,
      resultadoOrcadoCent: 0, resultadoRealizadoCent: 0, categoriasSemGrupo: [],
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return {
      pendente: true, ano, mesAtual, versaoLabel: rotuloDaVersao(undefined), temVersao: false,
      temOrcamentoProximoAno: false,
      rotina: proximoPasso({ mesPendente: null, desviosPendentes: 0, temOrcamentoProximoAno: false, mesAtual }),
      linhas: [], totalOrcadoCent: 0, totalRealizadoCent: 0,
      resultadoOrcadoCent: 0, resultadoRealizadoCent: 0, categoriasSemGrupo: [],
    };
  }

  return getPlanejamentoCached(token, JSON.stringify(opts), ano, mesAtual);
}
