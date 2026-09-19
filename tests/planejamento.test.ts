/**
 * Planejamento: farol, metas e rotina.
 *
 * O farol decide o que a revisão do mês obriga a explicar, e a cor das metas
 * decide onde a diretoria olha. Errar aqui não quebra a tela — faz a agência
 * discutir o problema errado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LINHAS_GERENCIAIS, avaliarDesvio, avaliarMeta, brlCurto, exigeComentario,
  progressoDaMeta, proximoPasso, rotuloDaVersao, versaoVigente,
} from "../src/lib/data/planejamento.ts";

const R$ = (reais: number) => Math.round(reais * 100); // centavos

/* ── farol: o sinal da linha inverte a leitura ── */

test("receita abaixo do orçado é desfavorável; custo abaixo é a favor", () => {
  // O mesmo −R$ 10.000 significa coisas opostas conforme a linha.
  const rec = avaliarDesvio(R$(100000), R$(90000), "receita");
  const cus = avaliarDesvio(R$(100000), R$(90000), "custo");
  assert.equal(rec.desfavoravel, true);
  assert.equal(cus.desfavoravel, false);
  assert.equal(cus.farol, "verde", "gastar menos que o orçado nunca é alerta");
});

test("custo acima do orçado é desfavorável", () => {
  const r = avaliarDesvio(R$(10000), R$(13000), "custo");
  assert.equal(r.desfavoravel, true);
  assert.equal(r.percentual, 30);
  assert.equal(r.farol, "vermelho");
});

test("dentro de 10% é verde, mesmo desfavorável", () => {
  assert.equal(avaliarDesvio(R$(10000), R$(10900), "custo").farol, "verde");
  assert.equal(avaliarDesvio(R$(10000), R$(11000), "custo").farol, "verde", "10% é o limite inclusivo");
});

test("acima de 10% mas até R$ 500 é âmbar", () => {
  // R$ 100 orçado, R$ 400 realizado: 300% de desvio, mas só R$ 300.
  const r = avaliarDesvio(R$(100), R$(400), "custo");
  assert.equal(r.farol, "ambar");
  assert.equal(exigeComentario(r.farol), false, "âmbar não trava a revisão");
});

test("acima de 10% e acima de R$ 500 é vermelho e exige comentário", () => {
  const r = avaliarDesvio(R$(1000), R$(1600), "custo");
  assert.equal(r.farol, "vermelho");
  assert.equal(exigeComentario(r.farol), true);
});

test("sem orçado é cinza, não 100% de desvio", () => {
  // Categoria que ninguém orçou não é estouro de orçamento.
  const r = avaliarDesvio(0, R$(5000), "custo");
  assert.equal(r.farol, "cinza");
  assert.equal(r.percentual, null);
});

test("o resultado financeiro conta como custo na leitura do desvio", () => {
  // "ambos": só é desfavorável quando reduz o resultado.
  assert.equal(avaliarDesvio(R$(-100), R$(-900), "ambos").desfavoravel, true);
});

test("centavos, não float", () => {
  const r = avaliarDesvio(R$(0.1), R$(0.3), "custo");
  assert.equal(r.valor, 20, "20 centavos exatos, sem 0.19999");
});

/* ── metas ── */

test("a cor vem do projetado, não do realizado até agora", () => {
  // Em fevereiro o acumulado sempre parece ruim; o que informa é o pouso.
  assert.equal(avaliarMeta(100, 100, "revenue_year"), "verde");
  assert.equal(avaliarMeta(95, 100, "revenue_year"), "ambar");
  assert.equal(avaliarMeta(80, 100, "revenue_year"), "vermelho");
});

test("os cortes 98 e 92 são inclusivos na borda", () => {
  assert.equal(avaliarMeta(98, 100, "revenue_year"), "verde");
  assert.equal(avaliarMeta(92, 100, "revenue_year"), "ambar");
  assert.equal(avaliarMeta(91.9, 100, "revenue_year"), "vermelho");
});

test("margem usa pontos percentuais, não % da meta", () => {
  // 41,6% contra meta de 42% é 99% da meta, mas só 0,4 p.p. abaixo: verde.
  assert.equal(avaliarMeta(41.6, 42, "op_margin"), "verde");
  assert.equal(avaliarMeta(40.5, 42, "op_margin"), "ambar", "1,5 p.p. abaixo");
  assert.equal(avaliarMeta(39, 42, "op_margin"), "vermelho", "3 p.p. abaixo");
});

test("sem meta cadastrada não inventa cor", () => {
  assert.equal(avaliarMeta(100, 0, "revenue_year"), "sem-meta");
  assert.equal(avaliarMeta(null, 100, "revenue_year"), "sem-meta");
});

test("a barra de progresso não estoura", () => {
  assert.equal(progressoDaMeta(150, 100), 100);
  assert.equal(progressoDaMeta(-10, 100), 0);
  assert.equal(progressoDaMeta(50, 100), 50);
});

/* ── versões ── */

test("vale a aprovada mais recente, não a primeira", () => {
  const v = versaoVigente([
    { status: "approved", approvedAt: "2025-12-15" },
    { status: "approved", approvedAt: "2026-09-01" },
    { status: "draft", approvedAt: null },
  ]);
  assert.equal(v?.approvedAt, "2026-09-01");
});

test("rascunho não vira vigente", () => {
  assert.equal(versaoVigente([{ status: "draft", approvedAt: null }]), undefined);
  assert.match(rotuloDaVersao(undefined), /Nenhum orçamento aprovado/);
});

/* ── rotina: um passo só ── */

test("mensal tem prioridade sobre anual", () => {
  // Em novembro, com revisão pendente, a revisão vem primeiro (spec 4).
  const p = proximoPasso({ mesPendente: 8, desviosPendentes: 3, temOrcamentoProximoAno: false, mesAtual: 11 });
  assert.equal(p.ritmo, "mensal");
  assert.match(p.titulo, /agosto: 3 desvios/);
});

test("mês sem desvio ainda pede a revisão, mais curta", () => {
  const p = proximoPasso({ mesPendente: 8, desviosPendentes: 0, temOrcamentoProximoAno: false, mesAtual: 9 });
  assert.equal(p.acao, "revisao");
  assert.match(p.titulo, /Nenhum desvio relevante/);
});

test("novembro sem orçamento do ano seguinte pede o assistente", () => {
  const p = proximoPasso({ mesPendente: null, desviosPendentes: 0, temOrcamentoProximoAno: false, mesAtual: 11 });
  assert.equal(p.ritmo, "anual");
  assert.equal(p.acao, "orcamento");
});

test("novembro com orçamento já aprovado não insiste", () => {
  const p = proximoPasso({ mesPendente: null, desviosPendentes: 0, temOrcamentoProximoAno: true, mesAtual: 11 });
  assert.equal(p.ritmo, "em-dia");
  assert.equal(p.acao, null);
});

test("depois do fechamento trimestral, compara", () => {
  const p = proximoPasso({ mesPendente: null, desviosPendentes: 0, temOrcamentoProximoAno: true, mesAtual: 10 });
  assert.equal(p.ritmo, "trimestral");
  assert.match(p.titulo, /3º trimestre/);
});

/* ── formatação ── */

test("valor curto encolhe sem mentir o sinal", () => {
  assert.equal(brlCurto(R$(1250000)), "R$ 1,25 mi");
  assert.equal(brlCurto(R$(45600)), "R$ 45,6 mil");
  assert.equal(brlCurto(R$(-45600)), "−R$ 45,6 mil");
  assert.equal(brlCurto(R$(300)), "R$ 300");
});

test("as 12 linhas gerenciais da spec estão todas lá", () => {
  assert.equal(LINHAS_GERENCIAIS.length, 12);
  assert.equal(LINHAS_GERENCIAIS.filter((l) => l.sinal === "receita").length, 2);
  assert.equal(LINHAS_GERENCIAIS.find((l) => l.key === "financeiro")?.sinal, "ambos");
});
