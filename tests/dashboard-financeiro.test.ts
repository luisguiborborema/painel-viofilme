/**
 * Dashboard Financeiro — as regras que a spec escreve por extenso.
 *
 * São as que erram calado: ordenar exceção pela gravidade errada, contar uma
 * entrada vencida como caixa futuro, deixar a barra empilhada não fechar com o
 * total. Nada disso dá erro na tela — só mostra outro número.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aging, atrasoMedio, barraDiaADia, brlCheio, chaveDeExcecao, DIAS_DE_SILENCIO,
  diasEntre, emQuantoTempo, estaSilenciada, FAIXAS_ATRASO, folegoEmMeses, gravidadeCaixaMinimo,
  gravidadeConciliacao, gravidadeRecebimentosVencidos, janelaDesdeOntem, limitesDoMes,
  menorSaldo, ordenarExcecoes, pagosEmDia, PARAMETROS_PADRAO, podeSilenciar, progressoDoMes,
  rotuloDeDia, rotuloDePessoas, saldoProjetadoEm, separarExcecoes, serieProjecao,
  silencioAte, situacaoDoQueFaltaPagar, somarDias,
  type Excecao, type Gravidade,
} from "../src/lib/data/dashboard-financeiro.ts";

const R$ = (reais: number) => Math.round(reais * 100);
const HOJE = "2026-09-17";

function exc(g: Gravidade, valorReais: number, chave = `E1-${valorReais}`): Excecao {
  return {
    chave, tipo: "E1", gravidade: g, titulo: "", detalhe: "",
    destino: "", href: "", valorCent: R$(valorReais),
  };
}

/* ── Datas (§17) ───────────────────────────────────────────────────────── */

test("somarDias atravessa mês, ano e horário de verão sem escorregar", () => {
  assert.equal(somarDias("2026-09-30", 1), "2026-10-01");
  assert.equal(somarDias("2026-01-01", -1), "2025-12-31");
  assert.equal(somarDias("2026-02-28", 1), "2026-03-01", "2026 não é bissexto");
  assert.equal(somarDias("2024-02-28", 1), "2024-02-29", "2024 é");
  // A virada do horário de verão brasileiro já foi motivo de "hoje" pular um
  // dia em aritmética local; em UTC o dia sempre tem 24 h.
  assert.equal(somarDias("2026-10-17", 1), "2026-10-18");
  assert.equal(somarDias(HOJE, 0), HOJE);
});

test("diasEntre conta dias inteiros, com sinal", () => {
  assert.equal(diasEntre("2026-09-10", HOJE), 7);
  assert.equal(diasEntre(HOJE, "2026-09-10"), -7);
  assert.equal(diasEntre(HOJE, HOJE), 0);
});

test("limitesDoMes pega o último dia certo em mês de 30 e de 31", () => {
  assert.deepEqual(limitesDoMes("2026-09-17"), { primeiro: "2026-09-01", ultimo: "2026-09-30" });
  assert.deepEqual(limitesDoMes("2026-12-05"), { primeiro: "2026-12-01", ultimo: "2026-12-31" });
  assert.deepEqual(limitesDoMes("2024-02-10"), { primeiro: "2024-02-01", ultimo: "2024-02-29" });
});

/* ── Ordem e silêncio das exceções (§5.3) ──────────────────────────────── */

test("regra 1: ordena por gravidade e, dentro dela, por valor", () => {
  const ordem = ordenarExcecoes([
    exc("atencao", 8450), exc("aviso", 99000), exc("critico", 1850), exc("atencao", 5320),
  ]).map((e) => [e.gravidade, e.valorCent / 100]);

  assert.deepEqual(ordem, [
    ["critico", 1850],
    ["atencao", 8450],
    ["atencao", 5320],
    ["aviso", 99000],
  ], "valor alto não pode passar na frente de uma gravidade maior");
});

test("regras 2 e 5: ⚪ fica recolhido e não entra na contagem do título", () => {
  const { principais, avisos, totalPrincipais } = separarExcecoes([
    exc("critico", 1850), exc("atencao", 8450), exc("aviso", 1), exc("aviso", 2),
  ]);
  assert.equal(principais.length, 2);
  assert.equal(avisos.length, 2);
  assert.equal(totalPrincipais, 2, "a contagem considera apenas 🔴 e 🟠");
});

test("regra 3: crítico e atenção não podem ser dispensados", () => {
  assert.equal(podeSilenciar(exc("critico", 1)), false);
  assert.equal(podeSilenciar(exc("atencao", 1)), false);
  assert.equal(podeSilenciar(exc("aviso", 1)), true);
});

test("regra 4: a chave carrega o escopo, e o silêncio dura 7 dias", () => {
  assert.equal(chaveDeExcecao("E1"), "E1");
  assert.equal(chaveDeExcecao("I1", "conta-sicoob"), "I1:conta-sicoob");
  assert.notEqual(
    chaveDeExcecao("I1", "conta-sicoob"),
    chaveDeExcecao("I1", "conta-inter"),
    "trocar de conta tem que fazer o aviso voltar",
  );
  assert.equal(silencioAte(HOJE), somarDias(HOJE, DIAS_DE_SILENCIO));
});

test("silêncio vencido não cala mais nada", () => {
  const silencios = [
    { chave: "I1:conta-sicoob", ateIso: "2026-09-24" },
    { chave: "I2:softwares", ateIso: "2026-09-17" },
  ];
  assert.equal(estaSilenciada("I1:conta-sicoob", silencios, HOJE), true);
  assert.equal(estaSilenciada("I2:softwares", silencios, HOJE), false, "vence no próprio dia");
  assert.equal(estaSilenciada("I3", silencios, HOJE), false);
});

/* ── Gravidades que dependem de conta (§5.1) ───────────────────────────── */

test("E2 é crítico quando o buraco chega em até 7 dias", () => {
  assert.equal(gravidadeCaixaMinimo(0), "critico");
  assert.equal(gravidadeCaixaMinimo(7), "critico");
  assert.equal(gravidadeCaixaMinimo(8), "atencao");
  assert.equal(gravidadeCaixaMinimo(30), "atencao");
});

test("E3 sobe para crítico acima de 30 dias de atraso", () => {
  assert.equal(gravidadeRecebimentosVencidos(30), "atencao");
  assert.equal(gravidadeRecebimentosVencidos(31), "critico");
});

test("E7 passa de aviso para atenção pelo limite de qtd OU de dias", () => {
  const p = PARAMETROS_PADRAO;
  assert.equal(gravidadeConciliacao(5, 3, p), "aviso");
  assert.equal(gravidadeConciliacao(5, 8, p), "atencao", "a mais antiga passou de 7 dias");
  assert.equal(gravidadeConciliacao(21, 1, p), "atencao", "a fila passou de 20");
  assert.equal(gravidadeConciliacao(20, 7, p), "aviso", "exatamente no limite ainda não estoura");
});

/* ── Saldo projetado (§12) ─────────────────────────────────────────────── */

const ENTRADAS = [
  { dataIso: "2026-09-10", valorCent: R$(9000) }, // vencida: NÃO entra
  { dataIso: "2026-09-20", valorCent: R$(6000) },
  { dataIso: "2026-10-30", valorCent: R$(1000) }, // fora da janela de 30 dias
];
const SAIDAS = [
  { dataIso: "2026-09-15", valorCent: R$(1850) }, // vencida: entra como hoje
  { dataIso: "2026-09-25", valorCent: R$(4200) },
];

test("entrada vencida não entra na projeção; saída vencida entra como hoje", () => {
  const saldo = saldoProjetadoEm(R$(84320), ENTRADAS, SAIDAS, HOJE, "2026-09-30");
  assert.equal(saldo, R$(84320 + 6000 - 1850 - 4200));

  // No próprio dia de hoje a saída vencida já pesa, e a entrada vencida não.
  assert.equal(saldoProjetadoEm(R$(84320), ENTRADAS, SAIDAS, HOJE, HOJE), R$(84320 - 1850));
});

test("a série fecha com o saldo projetado do último dia", () => {
  const serie = serieProjecao(R$(84320), ENTRADAS, SAIDAS, HOJE, 30);
  assert.equal(serie.length, 31, "hoje e mais 30 dias, inclusive nas duas pontas");
  assert.equal(serie[0].dataIso, HOJE);
  assert.equal(serie[30].dataIso, somarDias(HOJE, 30));
  assert.equal(
    serie[30].saldoCent,
    saldoProjetadoEm(R$(84320), ENTRADAS, SAIDAS, HOJE, somarDias(HOJE, 30)),
    "o cartão de 30 dias e o gráfico têm que ser o mesmo número",
  );
});

test("o menor saldo é o mínimo da série, e no empate o dia mais próximo", () => {
  const serie = [
    { dataIso: "2026-09-17", saldoCent: R$(80000) },
    { dataIso: "2026-09-18", saldoCent: R$(40050) },
    { dataIso: "2026-09-19", saldoCent: R$(40050) },
  ];
  assert.deepEqual(menorSaldo(serie), { dataIso: "2026-09-18", saldoCent: R$(40050) });
  assert.equal(menorSaldo([]), null);
});

test("fôlego só existe quando há saída para dividir", () => {
  assert.equal(folegoEmMeses(R$(84320), 0), null);
  assert.equal(folegoEmMeses(R$(60000), R$(30000)), 2);
});

/* ── Aging (§7.2) ──────────────────────────────────────────────────────── */

test("as 5 faixas aparecem sempre, e os limites não deixam buraco", () => {
  const faixas = aging([
    { diasAtraso: 7, valorCent: R$(100) },
    { diasAtraso: 8, valorCent: R$(200) },
    { diasAtraso: 15, valorCent: R$(300) },
    { diasAtraso: 16, valorCent: R$(400) },
    { diasAtraso: 30, valorCent: R$(500) },
    { diasAtraso: 31, valorCent: R$(600) },
    { diasAtraso: 60, valorCent: R$(700) },
    { diasAtraso: 61, valorCent: R$(800) },
  ]);
  assert.equal(faixas.length, FAIXAS_ATRASO.length);
  assert.deepEqual(faixas.map((f) => f.valorCent / 100), [100, 500, 900, 1300, 800]);
  assert.equal(
    faixas.reduce((s, f) => s + f.valorCent, 0), R$(3600),
    "nenhum vencido pode cair fora das faixas",
  );
});

test("sem vencidos, toda faixa fica zerada e sem altura", () => {
  const faixas = aging([]);
  assert.equal(faixas.length, 5);
  assert.ok(faixas.every((f) => f.valorCent === 0 && f.alturaPct === 0));
});

/* ── Barra dia a dia (§7.2) ────────────────────────────────────────────── */

test("a barra tem 15 colunas, com hoje no meio, e separa realizado de previsto", () => {
  const b = barraDiaADia(
    [{ dataIso: "2026-09-13", valorCent: R$(8800) }, { dataIso: HOJE, valorCent: R$(999) }],
    [{ dataIso: HOJE, valorCent: R$(4800) }, { dataIso: "2026-09-21", valorCent: R$(6000) }],
    HOJE,
  );
  assert.equal(b.length, 15);
  assert.equal(b[0].dataIso, somarDias(HOJE, -7));
  assert.equal(b[7].dataIso, HOJE);
  assert.equal(b[14].dataIso, somarDias(HOJE, 7));
  assert.equal(b[7].hoje, true);
  assert.equal(b.filter((c) => c.hoje).length, 1);

  // A coluna de hoje é PREVISTO: a baixa de hoje não pode virar barra cheia
  // enquanto o dia ainda está correndo.
  assert.equal(b[7].previsto, true);
  assert.equal(b[7].valorCent, R$(4800));
  assert.equal(b[6].previsto, false);
  assert.equal(b[3].valorCent, R$(8800));

  // A altura é relativa ao maior valor do próprio painel.
  const maior = b.find((c) => c.valorCent === R$(8800));
  assert.equal(maior?.alturaPct, 100);
});

/* ── Situação do que falta pagar (§7.2) ────────────────────────────────── */

const A_PAGAR = [
  { valorCent: R$(1850), vencimentoIso: "2026-09-15", programadaParaIso: "2026-09-15", aguardandoAprovacao: false },
  { valorCent: R$(12700), vencimentoIso: "2026-09-25", programadaParaIso: "2026-09-25", aguardandoAprovacao: false },
  { valorCent: R$(4450), vencimentoIso: "2026-09-28", programadaParaIso: null, aguardandoAprovacao: false },
  { valorCent: R$(3000), vencimentoIso: "2026-09-29", programadaParaIso: null, aguardandoAprovacao: true },
];

test("a barra empilhada é uma partição: a legenda tem que fechar com o total", () => {
  const s = situacaoDoQueFaltaPagar(A_PAGAR, HOJE, true);
  assert.equal(
    s.vencidoCent + s.aguardandoAprovacaoCent + s.programadoCent + s.semProgramacaoCent,
    s.totalCent,
  );
  assert.equal(s.totalCent, R$(1850 + 12700 + 4450 + 3000));
  assert.equal(s.vencidoCent, R$(1850), "vencido vem primeiro, mesmo estando programado");
  assert.equal(s.aguardandoAprovacaoCent, R$(3000));
  assert.equal(s.programadoCent, R$(12700));
  assert.equal(s.semProgramacaoCent, R$(4450));
});

test("com a alçada desligada, aprovação some e o valor cai na faixa certa", () => {
  const s = situacaoDoQueFaltaPagar(A_PAGAR, HOJE, false);
  assert.equal(s.aguardandoAprovacaoCent, 0);
  assert.equal(s.semProgramacaoCent, R$(4450 + 3000));
  assert.equal(
    s.vencidoCent + s.aguardandoAprovacaoCent + s.programadoCent + s.semProgramacaoCent,
    s.totalCent,
  );
});

/* ── Pagos em dia e atraso médio (§12) ─────────────────────────────────── */

test("pagos em dia: sem liquidação não é 0%, é sem resposta", () => {
  assert.equal(pagosEmDia([]), null);
  assert.equal(pagosEmDia([
    { vencimentoIso: "2026-09-10", pagamentoIso: "2026-09-10", valorCent: R$(1000) },
  ]), 100, "pagar no dia do vencimento é em dia");
  assert.equal(pagosEmDia([
    { vencimentoIso: "2026-09-10", pagamentoIso: "2026-09-10", valorCent: R$(9600) },
    { vencimentoIso: "2026-09-10", pagamentoIso: "2026-09-12", valorCent: R$(400) },
  ]), 96, "a conta é por VALOR, não por quantidade");
});

test("atraso médio ignora quem pagou adiantado, em vez de compensar", () => {
  assert.equal(atrasoMedio([]), null);
  const m = atrasoMedio([
    { vencimentoIso: "2026-09-10", pagamentoIso: "2026-09-20" }, // 10 dias
    { vencimentoIso: "2026-09-10", pagamentoIso: "2026-09-01" }, // adiantado: 0
  ]);
  assert.equal(m, 5, "adiantamento não pode virar crédito e apagar o atraso alheio");
});

/* ── Progresso do mês (§7.1) ───────────────────────────────────────────── */

test("as larguras da barra nunca somam mais de 100%", () => {
  const p = progressoDoMes(R$(92300), R$(8450), R$(112500));
  assert.equal(p.pct, 82);
  assert.ok(p.larguraBaixada + p.larguraVencida <= 100);

  // Caso patológico: baixado + vencido passam do total (renegociação, encargo).
  const estouro = progressoDoMes(R$(100), R$(100), R$(100));
  assert.equal(estouro.larguraBaixada, 100);
  assert.equal(estouro.larguraVencida, 0, "a barra não pode transbordar do trilho");
});

test("mês sem nada a vencer não vira divisão por zero", () => {
  const p = progressoDoMes(0, 0, 0);
  assert.equal(p.pct, 0);
  assert.equal(p.larguraBaixada, 0);
});

/* ── Rótulos (§17) ─────────────────────────────────────────────────────── */

test("acima de dois nomes o rótulo passa a contar, não a listar", () => {
  assert.equal(rotuloDePessoas([]), "");
  assert.equal(rotuloDePessoas(["Adobe"]), "Adobe");
  assert.equal(rotuloDePessoas(["Adobe", "Google"]), "Adobe e Google");
  assert.equal(rotuloDePessoas(["Adobe", "Google", "EDP", "Inter"]), "4 contas");
  assert.equal(rotuloDePessoas(["Adobe", "Adobe"]), "Adobe", "o mesmo fornecedor não vira dois");
});

test("ninguém diz 'daqui a 0 dias'", () => {
  assert.equal(emQuantoTempo(0), "hoje");
  assert.equal(emQuantoTempo(-1), "hoje", "já passou também é hoje, não 'daqui a -1 dias'");
  assert.equal(emQuantoTempo(1), "amanhã");
  assert.equal(emQuantoTempo(12), "daqui a 12 dias");
});

test("hoje e amanhã têm nome; o resto vira data", () => {
  assert.equal(rotuloDeDia(HOJE, HOJE), "hoje");
  assert.equal(rotuloDeDia("2026-09-18", HOJE), "amanhã");
  assert.equal(rotuloDeDia("2026-09-16", HOJE), "ontem");
  assert.equal(rotuloDeDia("2026-09-21", HOJE), "21/09");
});

test("o dinheiro do Dashboard aparece sem centavo", () => {
  // O Intl separa "R$" do número com espaço fixo (U+00A0); comparar com espaço
  // comum falharia numa diferença que ninguém vê na tela.
  const semNbsp = (s: string) => s.replace(/\u00A0/g, " ");
  assert.equal(semNbsp(brlCheio(R$(84320))), "R$ 84.320");
  assert.equal(semNbsp(brlCheio(R$(-1850))), "-R$ 1.850");
  assert.ok(!brlCheio(R$(84320)).includes(","), "centavo é ruído neste bloco");
});

/* ── Faixa "Desde ontem" (§4) ──────────────────────────────────────────── */

test("a janela é ontem, e vira a última visita para quem ficou dias fora", () => {
  assert.deepEqual(janelaDesdeOntem(HOJE, null), {
    desdeIso: "2026-09-16", label: "Desde ontem",
  });
  assert.deepEqual(janelaDesdeOntem(HOJE, "2026-09-16"), {
    desdeIso: "2026-09-16", label: "Desde ontem",
  }, "quem esteve aqui ontem continua vendo 'desde ontem'");
  assert.deepEqual(janelaDesdeOntem(HOJE, "2026-09-11"), {
    desdeIso: "2026-09-11", label: "Desde a sua última visita",
  }, "quem sumiu por cinco dias não pode perder o que aconteceu neles");
});
