/**
 * Motor de simulação do Planejamento (spec §10).
 *
 * É a biblioteca única atrás do assistente, da projeção, dos cenários e das
 * perguntas rápidas. Um erro aqui aparece nas quatro telas ao mesmo tempo,
 * concordando entre si — que é o jeito mais convincente de estar errado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  impactoDePerderCliente, maximoDistribuivel, novosPorMesParaMeta, simular,
  type Alavancas, type EstadoInicial, type Funcao,
} from "../src/lib/data/simulacao.ts";

const R$ = (reais: number) => Math.round(reais * 100);

const SM: Funcao = { key: "sm", label: "Social Media", capacidadePorPessoa: 11, remuneracaoCent: R$(3500), vagasPorCliente: 1 };

const inicial = (p: Partial<EstadoInicial> = {}): EstadoInicial => ({
  mrrCent: R$(96400), clientes: 22,
  vagasUsadas: { sm: 22 }, capacidade: { sm: 22 },
  folhaCent: R$(28800), fixosCent: R$(20000), caixaCent: R$(84320), ...p,
});

const alav = (p: Partial<Alavancas> = {}): Alavancas => ({
  novosPorMes: 0, churnPct: 0, ticketCent: R$(4380),
  pontualCent: R$(16600), pontualAjustePct: 0, fixosAjustePct: 0,
  impostosPct: 6, variaveisPct: 6.8, comissaoPct: 0, ...p,
});

/* ── o básico: parado é parado ── */

test("sem churn e sem novos, o MRR não se move", () => {
  const r = simular(inicial(), alav(), [SM], { meses: 12 });
  assert.equal(r.mrrFinalCent, R$(96400));
  assert.equal(r.meses.length, 12);
});

test("churn sem reposição derrete o MRR", () => {
  const r = simular(inicial(), alav({ churnPct: 2.5 }), [SM], { meses: 12 });
  // 96.400 × 0,975^12 ≈ 71.100
  assert.ok(r.mrrFinalCent < R$(72000) && r.mrrFinalCent > R$(70000), `deu ${r.mrrFinalCent / 100}`);
});

test("novos compensam o churn no ritmo certo", () => {
  const r = simular(inicial(), alav({ churnPct: 2.5, novosPorMes: 0.55 }), [SM], { meses: 12 });
  assert.ok(Math.abs(r.mrrFinalCent - R$(96400)) < R$(2000), "fica perto do ponto de equilíbrio");
});

/* ── capacidade: o que separa plano de fantasia ── */

test("crescer sem vaga registra o estouro", () => {
  // 22 clientes, capacidade 22, entra 1 por mês e ninguém sai.
  const r = simular(inicial(), alav({ novosPorMes: 1 }), [SM], { meses: 12 });
  assert.equal(r.primeiroEstouro?.funcao, "sm");
  assert.equal(r.primeiroEstouro?.mes, 1, "estoura já no primeiro mês");
  assert.equal(r.contratacoesFeitas.length, 0, "sem automático, ninguém é contratado");
});

test("contratação automática resolve e cobra por isso", () => {
  const semAuto = simular(inicial(), alav({ novosPorMes: 1 }), [SM], { meses: 12 });
  const comAuto = simular(inicial(), alav({ novosPorMes: 1, contratarAutomatico: true }), [SM], { meses: 12 });
  assert.ok(comAuto.contratacoesFeitas.length > 0);
  assert.equal(comAuto.primeiroEstouro, null, "não estoura mais");
  assert.ok(comAuto.resultadoAnoCent < semAuto.resultadoAnoCent, "contratar custa");
});

test("a contratação pesa no mês em que foi preciso, não no seguinte", () => {
  const r = simular(inicial(), alav({ novosPorMes: 1, contratarAutomatico: true }), [SM], { meses: 3 });
  assert.ok(r.meses[0].contratou.includes("sm"));
  assert.ok(r.meses[0].equipeCent > R$(28800), "o custo já entra no mês 1");
});

test("churn libera vaga e adia o estouro", () => {
  const semChurn = simular(inicial(), alav({ novosPorMes: 1 }), [SM], { meses: 12 });
  const comChurn = simular(inicial({ vagasUsadas: { sm: 20 } }), alav({ novosPorMes: 1, churnPct: 5 }), [SM], { meses: 12 });
  assert.ok(!comChurn.primeiroEstouro || comChurn.primeiroEstouro.mes > semChurn.primeiroEstouro!.mes);
});

test("contratação planejada adiciona capacidade e custo a partir do mês", () => {
  const r = simular(
    inicial(),
    alav({ novosPorMes: 1, contratacoes: [{ funcao: "sm", mes: 6, remuneracaoCent: R$(3500) }] }),
    [SM], { meses: 12 },
  );
  assert.ok(r.meses[4].equipeCent < r.meses[5].equipeCent, "o custo entra no mês 6");
});

/* ── caixa: competência não é dinheiro ── */

test("o fator de conversão impede projeção de caixa otimista", () => {
  const cheio = simular(inicial(), alav(), [SM], { meses: 12, fatorCaixa: 1 });
  const real = simular(inicial(), alav(), [SM], { meses: 12, fatorCaixa: 0.95 });
  assert.ok(real.meses[11].caixaCent < cheio.meses[11].caixaCent);
});

test("distribuição e investimento saem do caixa sem passar pelo resultado", () => {
  // §10 do documento-mãe: distribuição é equity_financing e investimento fica
  // fora da DRE. Os dois consomem caixa e não mexem no resultado.
  const sem = simular(inicial(), alav(), [SM], { meses: 12 });
  const com = simular(inicial(), alav({
    distribuicoesCent: [{ mes: 6, valorCent: R$(90000) }],
    investimentosCent: [{ mes: 3, valorCent: R$(18900) }],
  }), [SM], { meses: 12 });
  assert.equal(sem.resultadoAnoCent, com.resultadoAnoCent, "o resultado não muda");
  assert.equal(
    sem.meses[11].caixaCent - com.meses[11].caixaCent,
    R$(90000) + R$(18900),
    "o caixa cai exatamente o que saiu",
  );
});

test("a reserva mínima é comparada com o menor saldo, não com o final", () => {
  const r = simular(inicial(), alav({ distribuicoesCent: [{ mes: 2, valorCent: R$(200000) }] }), [SM],
    { meses: 12, reservaCent: R$(30000) });
  assert.equal(r.abaixoDaReserva, true);
  assert.equal(r.menorCaixaMes, 2, "o furo é em fevereiro, mesmo que dezembro feche bem");
});

/* ── margem ── */

test("margem é sobre receita líquida, não bruta", () => {
  const r = simular(inicial(), alav(), [SM], { meses: 12 });
  const calc = Math.round((r.resultadoAnoCent / r.receitaLiquidaAnoCent) * 1000) / 10;
  assert.equal(r.margemPct, calc);
  assert.ok(r.receitaLiquidaAnoCent < r.receitaAnoCent, "líquida desconta imposto");
});

test("sem receita a margem é indefinida, não zero", () => {
  const r = simular(inicial({ mrrCent: 0 }), alav({ pontualCent: 0 }), [SM], { meses: 3 });
  assert.equal(r.margemPct, null);
});

/* ── reajustes ── */

test("o reajuste de preço entra só no mês definido", () => {
  const r = simular(inicial(), alav({ reajustePct: 10, reajusteMes: 1 }), [SM], { meses: 2 });
  assert.equal(r.meses[0].mrrCent, R$(106040));
  assert.equal(r.meses[1].mrrCent, R$(106040), "não reaplica");
});

test("o reajuste da folha também", () => {
  const r = simular(inicial(), alav({ folhaReajustePct: 5, folhaReajusteMes: 5 }), [SM], { meses: 6 });
  assert.ok(r.meses[4].equipeCent > r.meses[3].equipeCent);
  assert.equal(r.meses[4].equipeCent, r.meses[5].equipeCent, "uma vez só");
});

/* ── perguntas rápidas ── */

test("quanto vender considera o churn ao longo dos 12 meses", () => {
  // Sem churn, chegar de 96.400 a 120.000 com ticket 4.380 pede ~0,45/mês.
  const semChurn = novosPorMesParaMeta(R$(120000), R$(96400), R$(4380), 0, 12);
  const comChurn = novosPorMesParaMeta(R$(120000), R$(96400), R$(4380), 2.5, 12);
  assert.ok(comChurn > semChurn, "com churn exige mais");
  assert.ok(comChurn > 1 && comChurn < 3, `deu ${comChurn}`);
});

test("meta já atingida não pede venda negativa", () => {
  assert.equal(novosPorMesParaMeta(R$(50000), R$(96400), R$(4380), 0, 12), 0);
});

test("perder cliente derruba o resultado mais que a margem", () => {
  // É a resposta que a spec quer em destaque: a equipe continua sendo paga.
  const i = impactoDePerderCliente({
    feeMensalCent: R$(7800), custosDiretosCent: R$(1500), equipeAlocadaCent: R$(2482), aliquotaPct: 6,
  });
  assert.ok(i.quedaResultadoCent > i.margemPerdidaCent);
  assert.equal(i.quedaResultadoCent - i.margemPerdidaCent, i.ociosidadeCent, "a diferença é exatamente a ociosidade");
});

test("o máximo distribuível respeita a reserva e nunca é negativo", () => {
  assert.equal(maximoDistribuivel(R$(100000), R$(30000)), R$(70000));
  assert.equal(maximoDistribuivel(R$(20000), R$(30000)), 0, "abaixo da reserva, não distribui nada");
});

/* ── proteções ── */

test("horizonte absurdo não trava o servidor", () => {
  assert.equal(simular(inicial(), alav(), [SM], { meses: 9999 }).meses.length, 60);
  assert.equal(simular(inicial(), alav(), [SM], { meses: 0 }).meses.length, 1);
});

test("tudo em centavos inteiros, como manda o §24", () => {
  const r = simular(inicial(), alav({ churnPct: 2.5, novosPorMes: 1.2 }), [SM], { meses: 12 });
  for (const m of r.meses) {
    assert.equal(m.mrrCent, Math.round(m.mrrCent), `mês ${m.mes} com centavo fracionado`);
    assert.equal(m.caixaCent, Math.round(m.caixaCent));
    assert.equal(m.resultadoCent, Math.round(m.resultadoCent));
  }
});
