/**
 * Resultados: DRE, rentabilidade e receita.
 *
 * A spec (§10) e o documento-mãe (§23) dizem quais regras devem virar teste
 * automatizado. Estas são elas — "divergência é bug", nas palavras da spec,
 * não margem de arredondamento.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IMPACT_TYPES, churnDeMrr, concentracao, custoPorVaga, explicarVariacao,
  feeParaMargem, margemComFee, montarDre, paraCadaCem, ponteFechaComCaixa,
  rentabilidadeFechaComDre, saudeDaMargem, tomDoDelta,
} from "../src/lib/data/resultados.ts";

const R$ = (reais: number) => Math.round(reais * 100);

/* ── tipos de impacto ── */

test("os 7 tipos do §10 existem e só 5 entram na DRE", () => {
  assert.equal(IMPACT_TYPES.length, 7);
  assert.equal(IMPACT_TYPES.filter((t) => t.naDre).length, 5);
  // Investimento e sócios ficam fora: uma câmera não é prejuízo operacional.
  assert.equal(IMPACT_TYPES.find((t) => t.key === "investment")?.naDre, false);
  assert.equal(IMPACT_TYPES.find((t) => t.key === "equity_financing")?.naDre, false);
});

/* ── DRE (§11) ── */

test("a DRE encadeia os totais na ordem do documento-mãe", () => {
  const d = montarDre({
    operating_revenue: R$(119000), revenue_deduction: R$(7140),
    direct_cost: R$(45000), operating_expense: R$(35000), financial_result: R$(-200),
  });
  assert.equal(d.receitaLiquidaCent, R$(111860));
  assert.equal(d.margemBrutaCent, R$(66860));
  assert.equal(d.resultadoOperacionalCent, R$(31860));
  assert.equal(d.resultadoLiquidoCent, R$(31660), "financeiro entra somando");
});

test("investimento e distribuição não tocam o resultado", () => {
  const base = { operating_revenue: R$(100000), direct_cost: R$(40000) };
  const sem = montarDre(base);
  const com = montarDre({ ...base, investment: R$(18900), equity_financing: R$(90000) });
  assert.equal(sem.resultadoLiquidoCent, com.resultadoLiquidoCent);
  assert.equal(com.investimentosCent, R$(18900), "mas aparecem no informativo");
  assert.equal(com.sociosCent, R$(90000));
});

test("rendimento positivo melhora o resultado; tarifa piora", () => {
  const ganho = montarDre({ operating_revenue: R$(1000), financial_result: R$(50) });
  const perda = montarDre({ operating_revenue: R$(1000), financial_result: R$(-50) });
  assert.equal(ganho.resultadoLiquidoCent - perda.resultadoLiquidoCent, R$(100));
});

test("sem receita líquida a margem é indefinida, não zero", () => {
  assert.equal(montarDre({}).margemBrutaPct, null);
  assert.equal(montarDre({}).margemOperacionalPct, null);
});

/* ── Para cada R$ 100 (§5.1) ── */

test("as fatias somam a receita inteira", () => {
  const { segmentos, prejuizoCent } = paraCadaCem({
    operating_revenue: R$(100000), revenue_deduction: R$(6000),
    direct_cost: R$(40000), operating_expense: R$(30000), financial_result: R$(-500),
  });
  assert.equal(prejuizoCent, null);
  assert.equal(segmentos.reduce((a, s) => a + s.valorCent, 0), R$(100000));
  assert.equal(segmentos.find((s) => s.key === "resultado")?.valorCent, R$(23500));
});

test("prejuízo vira aviso, não fatia negativa", () => {
  // Fatia negativa desenha uma barra que o olho lê como resultado.
  const r = paraCadaCem({ operating_revenue: R$(10000), direct_cost: R$(15000) });
  assert.equal(r.prejuizoCent, R$(5000));
  assert.equal(r.segmentos.some((s) => s.key === "resultado"), false);
});

test("rendimento não vira fatia de consumo", () => {
  const r = paraCadaCem({ operating_revenue: R$(10000), financial_result: R$(300) });
  assert.equal(r.segmentos.some((s) => s.key === "financeiro"), false);
});

/* ── variação (§5.3) ── */

test("receita que sobe ajuda; custo que sobe atrapalha", () => {
  const r = explicarVariacao(
    [
      { key: "mens", label: "Mensalidades", valorCent: R$(96000), impacto: "operating_revenue" },
      { key: "soft", label: "Softwares", valorCent: R$(9440), impacto: "operating_expense" },
    ],
    { mens: R$(93800), soft: R$(8000) },
  );
  const mens = r.top.find((x) => x.key === "mens")!;
  const soft = r.top.find((x) => x.key === "soft")!;
  assert.equal(mens.impactoCent, R$(2200), "receita +2.200 ajuda em +2.200");
  assert.equal(soft.impactoCent, R$(-1440), "custo +1.440 atrapalha em −1.440");
  assert.equal(r.totalCent, R$(760));
});

test("ordena por impacto absoluto e agrupa o resto", () => {
  const cats = Array.from({ length: 8 }, (_, i) => ({
    key: `c${i}`, label: `C${i}`, valorCent: R$(1000 * (i + 1)), impacto: "operating_expense" as const,
  }));
  const r = explicarVariacao(cats, {}, 5);
  assert.equal(r.top.length, 5);
  assert.equal(r.top[0].key, "c7", "o maior impacto vem primeiro");
  assert.ok(r.demaisCent < 0);
  assert.equal(r.top.reduce((a, x) => a + x.impactoCent, 0) + r.demaisCent, r.totalCent);
});

/* ── cor do delta (§4) ── */

test("a mesma variação tem cores opostas em receita e em custo", () => {
  assert.equal(tomDoDelta(R$(5000), false), "bom", "receita subiu");
  assert.equal(tomDoDelta(R$(5000), true), "ruim", "custo subiu");
  assert.equal(tomDoDelta(R$(-5000), true), "bom", "custo caiu");
});

test("variação de centavo não vira notícia", () => {
  assert.equal(tomDoDelta(50), "neutro");
  assert.equal(tomDoDelta(R$(1)), "bom", "R$ 1 já conta");
});

/* ── saúde (§6.4) ── */

test("os limites de saúde são inclusivos na borda", () => {
  assert.equal(saudeDaMargem(55), "saudavel");
  assert.equal(saudeDaMargem(54.9), "atencao");
  assert.equal(saudeDaMargem(40), "atencao");
  assert.equal(saudeDaMargem(39.9), "critica");
  assert.equal(saudeDaMargem(-10), "critica");
  assert.equal(saudeDaMargem(null), "sem-dados");
});

/* ── simulador (§8.2) ── */

test("o fee para a margem alvo devolve a margem pedida", () => {
  const custo = R$(3000);
  const fee = feeParaMargem(custo, 6, 55)!;
  assert.ok(Math.abs(margemComFee(fee, custo, 6)! - 55) < 0.2, "fecha o círculo");
});

test("margem alvo de 100% é impossível, não infinita", () => {
  assert.equal(feeParaMargem(R$(3000), 6, 100), null);
});

/* ── concentração (§7.5) ── */

test("o acumulado cresce e o limite de 15% dispara", () => {
  const c = concentracao([
    { nome: "Grande", receitaCent: R$(30000) },
    { nome: "Médio", receitaCent: R$(10000) },
    { nome: "Pequeno", receitaCent: R$(5000) },
  ]);
  assert.equal(c[0].nome, "Grande");
  assert.equal(c[0].acima, true, "66% passa de 15%");
  assert.equal(c[2].acima, false, "11% não passa");
  assert.ok(c[2].acumuladoPct > c[0].acumuladoPct);
  assert.ok(Math.abs(c[2].acumuladoPct - 100) < 0.5, "os três somam tudo");
});

/* ── custo por vaga (§15.1 do documento-mãe) ── */

test("divide pela capacidade, não pelos clientes atuais", () => {
  // O caso do documento-mãe: R$ 2.800, capacidade 10, atende 7.
  const r = custoPorVaga(R$(2800), 10, 7);
  assert.equal(r.custoVagaCent, R$(280));
  assert.equal(r.ociosidadeCent, R$(840), "3 vagas livres viram ociosidade");
});

test("perder cliente não encarece os que ficam", () => {
  // A razão da regra: dividir pelos atuais faria o cliente parecer pior só
  // porque a agência perdeu outro.
  assert.equal(custoPorVaga(R$(2800), 10, 7).custoVagaCent, custoPorVaga(R$(2800), 10, 5).custoVagaCent);
});

test("acima da capacidade o divisor passa a ser o real", () => {
  const r = custoPorVaga(R$(2800), 10, 14);
  assert.equal(r.acimaDaCapacidade, true);
  assert.equal(r.ociosidadeCent, 0);
  assert.ok(r.custoVagaCent * 14 <= R$(2800) + 14, "as vagas não somam mais que a função");
});

test("capacidade zero joga tudo na ociosidade, com alerta", () => {
  const r = custoPorVaga(R$(5000), 0, 0);
  assert.equal(r.ociosidadeCent, R$(5000));
  assert.equal(r.custoVagaCent, 0);
});

/* ── INVARIANTES (§10 da spec, §23 do documento-mãe) ── */

test("rentabilidade fecha com a DRE", () => {
  // Σ margem − ociosidade − operação geral − despesas ± financeiro = resultado.
  const r = rentabilidadeFechaComDre({
    margemClientesCent: R$(66860), ociosidadeCent: R$(3000), operacaoGeralCent: R$(610),
    despesasOperacionaisCent: R$(35000), resultadoFinanceiroCent: R$(-200),
    resultadoLiquidoDreCent: R$(28050),
  });
  assert.equal(r.confere, true, `diferença de ${r.diferencaCent / 100}`);
});

test("a tolerância é R$ 1 absoluto, não percentual", () => {
  // Percentual cresceria junto com a empresa e nunca dispararia.
  const base = {
    margemClientesCent: R$(1000000), ociosidadeCent: 0, operacaoGeralCent: 0,
    despesasOperacionaisCent: 0, resultadoFinanceiroCent: 0,
  };
  assert.equal(rentabilidadeFechaComDre({ ...base, resultadoLiquidoDreCent: R$(1000000) - 100 }).confere, true);
  assert.equal(rentabilidadeFechaComDre({ ...base, resultadoLiquidoDreCent: R$(1000000) - 101 }).confere, false);
});

test("a ponte fecha com a variação do disponível", () => {
  const r = ponteFechaComCaixa(R$(28050), [R$(-28400), R$(48900), R$(-1890), R$(-60000)], R$(-13340));
  assert.equal(r.confere, true, `diferença de ${r.diferencaCent / 100}`);
});

test("a ponte aponta a diferença quando não fecha", () => {
  const r = ponteFechaComCaixa(R$(1000), [R$(500)], R$(2000));
  assert.equal(r.confere, false);
  assert.equal(r.diferencaCent, R$(-500), "faltam R$ 500 para explicar");
});

/* ── churn (§7.1) ── */

test("churn acima de 2% ao mês é alerta", () => {
  assert.equal(churnDeMrr(R$(900), R$(91900)).alerta, false);
  assert.equal(churnDeMrr(R$(3000), R$(91900)).alerta, true);
});

test("pausa não é churn", () => {
  // Contá-la inflaria justamente o indicador que dispara o alerta.
  const so = churnDeMrr(R$(900), R$(91900));
  const comPausa = churnDeMrr(R$(900) + R$(1200), R$(91900));
  assert.ok(comPausa.pct! > so.pct!, "se somasse, o número subiria");
});

test("sem MRR inicial não inventa percentual", () => {
  assert.equal(churnDeMrr(R$(900), 0).pct, null);
});
