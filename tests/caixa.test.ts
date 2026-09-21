/**
 * Caixa: blocos do fluxo, conferência de saldo e sugestão de conciliação.
 *
 * São as regras que decidem sozinhas o que o usuário vai aceitar com um
 * clique. Uma sugestão errada aqui não dá erro: ela cria uma baixa no lugar
 * errado, e a divergência aparece semanas depois sem ninguém saber de onde
 * veio.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blocoDaCategoria, conferirSaldo, estadoDaConta, impressaoDigital, interpretarDescricao,
  janelaDoFluxo, pendenciasDeFechamento, periodosDaJanela, somaExata, sugerirConciliacao,
  type ParcelaCandidata,
} from "../src/lib/data/caixa.ts";

const R$ = (reais: number) => Math.round(reais * 100);
const HOJE = "2026-09-21";

/* ── Blocos do fluxo (§2.2) ────────────────────────────────────────────── */

test("o bloco do caixa vem do tipo de impacto, igual à DRE", () => {
  // As duas páginas nunca podem discordar sobre o que é investimento.
  assert.deepEqual(blocoDaCategoria("investment"), { bloco: "investing", linha: "equipamentos" });
  assert.deepEqual(blocoDaCategoria("equity_financing"), { bloco: "financing", linha: "socios" });
  assert.deepEqual(blocoDaCategoria("operating_revenue"), { bloco: "operating", linha: "recebimentos" });
  assert.deepEqual(blocoDaCategoria("direct_cost"), { bloco: "operating", linha: "diretos" });
});

test("a categoria pode sobrescrever o bloco derivado", () => {
  // Aplicação na reserva não é despesa de ninguém: é dinheiro que mudou de
  // bolso, e só quem conhece a conta sabe disso.
  assert.deepEqual(
    blocoDaCategoria("operating_expense", { grupo: "internal", linha: "reserva" }),
    { bloco: "internal", linha: "reserva" },
  );
});

/* ── Horizonte e granularidade (§5.1) ──────────────────────────────────── */

test("a granularidade acompanha o horizonte sem o usuário escolher", () => {
  assert.equal(janelaDoFluxo(30).granularidade, "dia");
  assert.equal(janelaDoFluxo(60).granularidade, "dia");
  assert.equal(janelaDoFluxo(90).granularidade, "semana");
  assert.equal(janelaDoFluxo(365).granularidade, "mes");
  // 365 dias em barras diárias seriam 365 colunas de 3px.
  assert.equal(janelaDoFluxo(365).passadoDias, 183);
});

test("os períodos cobrem a janela e marcam onde está hoje", () => {
  const p = periodosDaJanela(HOJE, janelaDoFluxo(30));
  assert.equal(p.length, 61, "30 dias de passado + hoje + 30 de futuro");
  assert.equal(p.filter((x) => x.contemHoje).length, 1);
  assert.equal(p[0].inicio, "2026-08-22");
  assert.equal(p[p.length - 1].fim, "2026-10-21");

  const semanas = periodosDaJanela(HOJE, janelaDoFluxo(90));
  assert.ok(semanas.every((s) => s.fim >= s.inicio));
  assert.equal(semanas.filter((s) => s.contemHoje).length, 1, "hoje cai em uma semana só");

  const meses = periodosDaJanela(HOJE, janelaDoFluxo(365));
  assert.equal(meses.filter((m) => m.contemHoje).length, 1);
  assert.ok(meses.length >= 18, "6 meses de passado + 12 de futuro");
});

/* ── Conferência de saldo (§2.1) ───────────────────────────────────────── */

test("a conferência guarda o sinal da diferença, não só o tamanho", () => {
  // Sistema acima do banco é lançamento duplicado; abaixo é movimentação que
  // não foi importada. Procurar a coisa errada custa a tarde de alguém.
  const aMais = conferirSaldo(R$(10000), R$(10500), "2026-09-16");
  assert.equal(aMais.confere, false);
  assert.equal(aMais.diferencaCent, R$(500));

  const aMenos = conferirSaldo(R$(10000), R$(9500), "2026-09-16");
  assert.equal(aMenos.diferencaCent, R$(-500));
});

test("a tolerância da conferência é de um centavo", () => {
  assert.equal(conferirSaldo(1000, 1001, "2026-09-16").confere, true);
  assert.equal(conferirSaldo(1000, 1002, "2026-09-16").confere, false);
});

/* ── Estado do cartão da conta (§4.1) ──────────────────────────────────── */

const base = {
  tipo: "banco", diferencaAbertaCent: null, diasSemExtrato: null, diasParaAviso: 7,
  conferidoEmIso: null, pendentesDeConciliacao: 0, usaExtrato: true,
};

test("saldo divergente ganha de qualquer outro estado", () => {
  // Enquanto existir diferença, nenhum número da página é confiável.
  const e = estadoDaConta({
    ...base, diferencaAbertaCent: R$(312.4), diasSemExtrato: 12,
    conferidoEmIso: "2026-09-10", pendentesDeConciliacao: 5,
  });
  assert.equal(e.prioridade, 1);
  assert.match(e.texto, /Diferença de R\$\s?312,40/);
  assert.match(e.texto, /extrato há 12 dias/, "o atraso do extrato entra junto, não no lugar");
});

test("extrato parado vem antes de 'confere', e conta nunca conferida não mente", () => {
  assert.equal(estadoDaConta({ ...base, diasSemExtrato: 12 }).prioridade, 2);
  assert.equal(
    estadoDaConta({ ...base, conferidoEmIso: "2026-09-16", pendentesDeConciliacao: 3 }).prioridade, 3);
  assert.equal(estadoDaConta({ ...base, conferidoEmIso: "2026-09-16" }).tom, "ok");
  // Sem nenhuma conferência, dizer "confere" seria inventar a checagem.
  assert.match(estadoDaConta(base).texto, /Nunca conferida/);
});

/* ── Sugestão de conciliação (§8.4) ────────────────────────────────────── */

const parcela = (x: Partial<ParcelaCandidata> & { id: string }): ParcelaCandidata => ({
  descricao: "Mensalidade set/26", vencimentoIso: "2026-09-15", saldoCent: R$(4500),
  documento: "12.345.678/0001-90", direcao: "in", ...x,
});

const movimento = {
  id: "t1", dataIso: HOJE, valorCent: R$(4500),
  descricaoRaw: "PIX RECEB 12.345.678/0001-90 APTO INCORPORACOES",
  documentoContraparte: "12.345.678/0001-90", contaId: "c1",
};

const semNada = { baixasPendentes: [], movimentosDeOutrasContas: [], regra: null };

test("valor e documento batendo é correspondência exata", () => {
  const s = sugerirConciliacao({ ...semNada, movimento, candidatas: [parcela({ id: "p1" })] });
  assert.equal(s.nivel, "exata");
  assert.equal(s.exata, true);
  assert.deepEqual(s.parcelas, ["p1"]);
});

test("baixa manual aguardando extrato ganha de qualquer parcela", () => {
  // A baixa JÁ existe: conciliar com outra parcela criaria uma segunda baixa
  // para o mesmo dinheiro.
  const s = sugerirConciliacao({
    ...semNada, movimento, candidatas: [parcela({ id: "p1" })],
    baixasPendentes: [{ id: "b1", dataIso: "2026-09-20", valorCent: R$(4500), descricao: "APTO" }],
  });
  assert.equal(s.nivel, "confirma");
  assert.equal(s.exata, true);
});

test("transferência é detectada pelo par de sinal oposto em conta própria", () => {
  const s = sugerirConciliacao({
    ...semNada,
    movimento: { ...movimento, valorCent: R$(-9800), documentoContraparte: null },
    candidatas: [],
    movimentosDeOutrasContas: [
      { id: "t2", dataIso: HOJE, valorCent: R$(9800), contaNome: "Inter" },
    ],
  });
  assert.equal(s.nivel, "transf");
  assert.match(s.titulo, /Transferência para Inter/);
});

test("valor acima da parcela vencida vira encargos, dentro do teto", () => {
  const s = sugerirConciliacao({
    ...semNada,
    movimento: { ...movimento, valorCent: R$(5382.10) },
    candidatas: [parcela({ id: "p1", saldoCent: R$(5300), vencimentoIso: "2026-09-05" })],
  });
  assert.equal(s.nivel, "encargos");
  assert.equal(s.encargosCent, R$(82.10));
});

test("diferença grande demais não vira encargo silencioso", () => {
  // 10% é o teto: acima disso é outra coisa, e chamar de juros esconderia um
  // pagamento que não é daquela parcela.
  const s = sugerirConciliacao({
    ...semNada,
    movimento: { ...movimento, valorCent: R$(9000) },
    candidatas: [parcela({ id: "p1", saldoCent: R$(5300), vencimentoIso: "2026-09-05" })],
  });
  assert.notEqual(s.nivel, "encargos");
});

test("soma exata de duas parcelas do mesmo pagador vira sugestão multi", () => {
  const s = sugerirConciliacao({
    ...semNada,
    movimento: { ...movimento, valorCent: R$(3000) },
    candidatas: [
      parcela({ id: "p1", saldoCent: R$(1500) }),
      parcela({ id: "p2", saldoCent: R$(1500) }),
    ],
  });
  assert.equal(s.nivel, "multi");
  assert.deepEqual(s.parcelas.sort(), ["p1", "p2"]);
});

test("valor abaixo da parcela é pagamento parcial, com o saldo dito", () => {
  const s = sugerirConciliacao({
    ...semNada,
    movimento: { ...movimento, valorCent: R$(3000) },
    candidatas: [parcela({ id: "p1", saldoCent: R$(6000) })],
  });
  assert.equal(s.nivel, "parcial");
  assert.match(s.detalhe, /R\$\s?3\.000,00 segue em aberto/);
});

test("sem documento, a sugestão cai para média e nunca concilia sozinha", () => {
  const s = sugerirConciliacao({
    ...semNada,
    movimento: { ...movimento, documentoContraparte: null },
    candidatas: [parcela({ id: "p1" }), parcela({ id: "p2" })],
  });
  assert.equal(s.nivel, "media");
  assert.equal(s.exata, false, "média nunca entra no botão de conciliar em lote");
});

test("sem nada que explique, a sugestão é classificar", () => {
  const s = sugerirConciliacao({ ...semNada, movimento, candidatas: [] });
  assert.equal(s.nivel, "classif");
});

test("a regra aprendida só entra quando não há parcela que explique", () => {
  const comParcela = sugerirConciliacao({
    ...semNada, movimento, candidatas: [parcela({ id: "p1" })],
    regra: { categoria: "Transporte", contraparte: "Posto Shell", vezes: 4 },
  });
  assert.equal(comParcela.nivel, "exata", "parcela que bate ganha da regra");

  const semParcela = sugerirConciliacao({
    ...semNada, movimento: { ...movimento, valorCent: R$(-95), documentoContraparte: null },
    candidatas: [],
    regra: { categoria: "Transporte", contraparte: "Posto Shell", vezes: 4 },
  });
  assert.equal(semParcela.nivel, "regra");
});

test("a soma exata procura combinações de até três parcelas", () => {
  const cs = [
    parcela({ id: "a", saldoCent: R$(1000) }),
    parcela({ id: "b", saldoCent: R$(2000) }),
    parcela({ id: "c", saldoCent: R$(3000) }),
  ];
  assert.deepEqual(somaExata(cs, R$(6000)).map((c) => c.id), ["a", "b", "c"]);
  assert.deepEqual(somaExata(cs, R$(3000)).map((c) => c.id), ["a", "b"]);
  assert.deepEqual(somaExata(cs, R$(7777)), []);
});

/* ── Descrição interpretada (§6.3) ─────────────────────────────────────── */

test("a descrição do banco vira frase, sem perder a original", () => {
  const r = interpretarDescricao(
    "PIX RECEB 12.345.678/0001-90 APTO INCORPORACOES", R$(4500),
  );
  assert.equal(r.tipo, "PIX recebido");
  assert.equal(r.documento, "12.345.678/0001-90");
  assert.match(r.texto, /^PIX recebido de /);
});

test("com o nome do cadastro, a frase usa ele em vez do texto do banco", () => {
  const r = interpretarDescricao("PIX RECEB 12.345.678/0001-90 APTO INC", R$(4500), "APTO Incorporações");
  assert.equal(r.texto, "PIX recebido de APTO Incorporações");
});

test("tarifa e rendimento são reconhecidos pelo padrão do banco", () => {
  assert.equal(interpretarDescricao("TARIFA PACOTE SERVICOS 09/2026", R$(-62)).tipo, "Tarifa bancária");
  assert.equal(interpretarDescricao("RENDIMENTO APLIC AUTOMATICA", R$(18.4)).tipo, "Rendimento");
});

/* ── Deduplicação (§7) ─────────────────────────────────────────────────── */

test("a mesma linha importada duas vezes tem a mesma impressão digital", () => {
  const a = impressaoDigital({ contaId: "c1", dataIso: "2026-09-16", valorCent: R$(4500), descricaoRaw: "PIX  RECEB APTO" });
  const b = impressaoDigital({ contaId: "c1", dataIso: "2026-09-16", valorCent: R$(4500), descricaoRaw: "pix receb apto" });
  assert.equal(a, b, "espaço e caixa não podem criar uma linha nova");

  const outraConta = impressaoDigital({ contaId: "c2", dataIso: "2026-09-16", valorCent: R$(4500), descricaoRaw: "PIX RECEB APTO" });
  assert.notEqual(a, outraConta, "o mesmo valor em outra conta é outra movimentação");
});

/* ── Fechamento do mês (§12) ───────────────────────────────────────────── */

test("as três pendências que impedem o fechamento são de naturezas diferentes", () => {
  const r = pendenciasDeFechamento({
    movimentacoesPendentes: 2, baixasSemConfirmacao: 1, conferenciasAbertas: 1,
  });
  assert.equal(r.liberado, false);
  assert.equal(r.pendencias.length, 3);
  assert.equal(r.total, 4);

  assert.equal(
    pendenciasDeFechamento({ movimentacoesPendentes: 0, baixasSemConfirmacao: 0, conferenciasAbertas: 0 }).liberado,
    true,
  );
});
