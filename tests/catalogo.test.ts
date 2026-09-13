/**
 * Catálogo e montador de pacotes.
 *
 * O que estes testes protegem: o número que aparece enquanto a proposta é
 * montada. Se ele estiver errado, a agência fecha negócio no prejuízo achando
 * que está na meta — e descobre meses depois, no DRE.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avaliarMargem, fatorMensal, normalizarCadencia, textoDaProposta, totaisDoPacote,
  type ItemPacote,
} from "../src/lib/data/catalogo.ts";

const item = (o: Partial<ItemPacote>): ItemPacote =>
  ({ label: "Item", qty: 1, price: 0, cost: 0, cadence: "mensal", ...o });

/* ── cadência ── */

test("rascunhos antigos de schema viram pontual", () => {
  for (const s of ["avulso", "projeto", "pontual", "UNICO"]) {
    assert.equal(normalizarCadencia(s), "unico", `falhou em ${s}`);
  }
});
test("cadência desconhecida cai em mensal", () => {
  assert.equal(normalizarCadencia("quinzenal"), "mensal");
  assert.equal(normalizarCadencia(null), "mensal");
});
test("pontual não tem fator mensal", () => {
  assert.equal(fatorMensal("unico"), null);
  assert.equal(fatorMensal("trimestral"), 1 / 3);
});

/* ── recorrente e pontual não se somam ── */

test("mensal e setup ficam em blocos separados", () => {
  const t = totaisDoPacote([
    item({ price: 3000, cost: 1500 }),
    item({ price: 5000, cost: 2000, cadence: "unico" }),
  ]);
  assert.equal(t.mensal.receita, 3000, "o setup não pode entrar no mensal");
  assert.equal(t.unico.receita, 5000);
  // 12 meses de recorrente + o pontual.
  assert.equal(t.ano.receita, 41000);
  assert.equal(t.ano.custo, 20000);
  assert.equal(t.ano.margemPct, 51);
});

test("trimestral vira equivalente mensal", () => {
  const t = totaisDoPacote([item({ price: 900, cost: 300, cadence: "trimestral" })]);
  assert.equal(t.mensal.receita, 300);
  assert.equal(t.mensal.custo, 100);
  assert.equal(t.ano.receita, 3600, "um ano são quatro trimestres de 900");
});

test("quantidade multiplica preço e custo", () => {
  const t = totaisDoPacote([item({ qty: 4, price: 500, cost: 200 })]);
  assert.equal(t.mensal.receita, 2000);
  assert.equal(t.mensal.custo, 800);
});

test("item com quantidade zero não entra", () => {
  const t = totaisDoPacote([item({ qty: 0, price: 9999, cost: 1 })]);
  assert.equal(t.mensal.receita, 0);
});

/* ── desconto ── */

test("desconto corta receita, nunca custo", () => {
  // Dar desconto não torna a entrega mais barata — é por isso que a margem cai.
  const t = totaisDoPacote([item({ price: 1000, cost: 600 })], 20);
  assert.equal(t.mensal.receita, 800);
  assert.equal(t.mensal.custo, 600, "o custo não pode se mover");
  assert.equal(t.mensal.margemPct, 25, "de 40% para 25% com 20% de desconto");
});

test("desconto fora da faixa não explode a conta", () => {
  assert.equal(totaisDoPacote([item({ price: 100 })], 150).mensal.receita, 0);
  assert.equal(totaisDoPacote([item({ price: 100 })], -10).mensal.receita, 100);
});

/* ── margem indefinida ── */

test("pacote sem receita tem margem indefinida, não zero", () => {
  // 0% diria "margem péssima"; a verdade é que não há o que medir.
  const t = totaisDoPacote([item({ price: 0, cost: 500 })]);
  assert.equal(t.mensal.margemPct, null);
  assert.equal(avaliarMargem(t.mensal.margemPct, 42).nivel, "sem-receita");
});

/* ── centavos ── */

test("a soma não acumula lixo de float", () => {
  const t = totaisDoPacote([item({ qty: 3, price: 0.1, cost: 0.2 })]);
  assert.equal(t.mensal.receita, 0.3);
  assert.equal(t.mensal.margem, -0.3);
});

/* ── veredicto contra a meta do Financeiro ── */

test("abaixo da meta diz de quanto", () => {
  const v = avaliarMargem(30, 42);
  assert.equal(v.nivel, "abaixo");
  assert.match(v.texto, /12 pontos abaixo/);
});
test("dentro da meta não alarma", () => {
  assert.equal(avaliarMargem(42, 42).nivel, "ok");
  assert.equal(avaliarMargem(90, 42).nivel, "ok");
});
test("custo acima do preço é prejuízo, não margem baixa", () => {
  const t = totaisDoPacote([item({ price: 100, cost: 150 })]);
  assert.equal(t.mensal.margemPct, -50);
  assert.equal(avaliarMargem(t.mensal.margemPct, 42).nivel, "prejuizo");
});

/* ── texto da proposta ── */

test("a proposta separa recorrente de pontual", () => {
  const txt = textoDaProposta(
    { name: "Plano Social", clientHint: "Padaria X" },
    [item({ label: "Gestão", price: 3000 }), item({ label: "Setup", price: 5000, cadence: "unico" })],
  );
  assert.match(txt, /SERVIÇOS RECORRENTES/);
  assert.match(txt, /INVESTIMENTO PONTUAL/);
  assert.match(txt, /por mês/);
  assert.match(txt, /Padaria X/);
});

test("a proposta não inventa seção vazia", () => {
  const txt = textoDaProposta({ name: "Só mensal" }, [item({ label: "Gestão", price: 3000 })]);
  assert.ok(!txt.includes("INVESTIMENTO PONTUAL"), "seção sem item não deve aparecer");
  assert.ok(!txt.includes("**"), "a página pública não renderiza markdown");
});

test("custo não vaza para a proposta do cliente", () => {
  const txt = textoDaProposta({ name: "P" }, [item({ label: "Gestão", price: 3000, cost: 1234.56 })]);
  assert.ok(!txt.includes("1.234,56"), "o cliente não pode ver o custo interno");
});
