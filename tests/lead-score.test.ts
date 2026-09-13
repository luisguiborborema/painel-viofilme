/**
 * Lead score configurável.
 *
 * O score decide quem a equipe liga primeiro. Se ele não reflete como a agência
 * qualifica, vira número decorativo — e um score decorativo é pior que nenhum,
 * porque dá aparência de critério a uma fila arbitrária.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG_PADRAO, calcularScore, normalizarConfig, tetoTeorico,
} from "../src/lib/data/lead-score.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(a, b));

const base = {
  monthlyValue: 0,
  probability: 0,
  temTelefone: false,
  temEmail: false,
};

/* ── o padrão preserva o comportamento anterior ── */

test("lead vazio dá zero e fica frio", () => {
  const r = calcularScore(base);
  assert.equal(r.score, 0);
  assert.equal(r.tier, "cold");
  assert.deepStrictEqual(r.factors, [], "fator que soma zero não entra na lista");
});

test("os pesos padrão são os que o código usava", () => {
  const r = calcularScore({
    ...base,
    monthlyValue: 6000,
    bant: { budget: "sim", authority: "sim", need: "sim", timing: "sim" },
    probability: 100,
    source: "Indicação",
    diasDesdeInteracao: 1,
    temTelefone: true,
    temEmail: true,
  });
  // 25 + 20 + 20 + 10 + 15 + 5 + 5 = 100
  assert.equal(r.score, 100);
  assert.equal(r.tier, "hot");
});

/* ── faixas de valor ── */

eq("acima do alto", calcularScore({ ...base, monthlyValue: 9000 }).score, 25);
eq("na faixa média", calcularScore({ ...base, monthlyValue: 2000 }).score, 16);
eq("abaixo da média mas acima de zero", calcularScore({ ...base, monthlyValue: 500 }).score, 8);
eq("exatamente no corte alto", calcularScore({ ...base, monthlyValue: 5000 }).score, 25);
eq("valor zero não pontua", calcularScore({ ...base, monthlyValue: 0 }).score, 0);

/* ── origem ── */

test("acento e caixa não atrapalham", () => {
  // "Indicação" precisa casar com o termo "indica".
  for (const s of ["Indicação", "indicacao", "INDICAÇÃO de cliente", "veio por indicação"]) {
    assert.equal(calcularScore({ ...base, source: s }).score, 10, `falhou em ${s}`);
  }
});

eq("outra origem não pontua", calcularScore({ ...base, source: "Instagram" }).score, 0);

/* ── engajamento ── */

eq("interação de hoje", calcularScore({ ...base, diasDesdeInteracao: 0 }).score, 15);
eq("dentro de 7 dias", calcularScore({ ...base, diasDesdeInteracao: 5 }).score, 10);
eq("dentro de 14 dias", calcularScore({ ...base, diasDesdeInteracao: 14 }).score, 4);
eq("mais de 14 dias não pontua", calcularScore({ ...base, diasDesdeInteracao: 30 }).score, 0);
eq("sem interação registrada", calcularScore({ ...base, diasDesdeInteracao: null }).score, 0);

/* ── configuração própria ── */

test("mudar o peso muda o score", () => {
  // Agência que qualifica por valor, não por relacionamento.
  const cfg = { ...CONFIG_PADRAO, valorAlto: { minimo: 3000, pontos: 50 }, pontosPorBant: 2 };
  const lead = { ...base, monthlyValue: 3000, bant: { budget: "sim" } };
  assert.equal(calcularScore(lead, cfg).score, 52);
  assert.equal(calcularScore(lead).score, 21, "com o padrão dá outro número");
});

test("os cortes movem a faixa", () => {
  const lead = { ...base, monthlyValue: 6000 }; // 25 pontos
  assert.equal(calcularScore(lead).tier, "cold");
  assert.equal(calcularScore(lead, { ...CONFIG_PADRAO, corteMorno: 20, corteQuente: 24 }).tier, "hot");
});

/* ── configuração vinda do banco ── */

eq("vazia cai no padrão", normalizarConfig({}), CONFIG_PADRAO);
eq("nula cai no padrão", normalizarConfig(null), CONFIG_PADRAO);

test("campo ausente não zera o fator", () => {
  // Configuração salva por versão anterior pode estar incompleta. Zerar em
  // silêncio derrubaria o score de todo mundo sem explicação.
  const c = normalizarConfig({ pesoEtapa: 30 });
  assert.equal(c.pesoEtapa, 30);
  assert.equal(c.pontosPorBant, CONFIG_PADRAO.pontosPorBant);
  assert.deepStrictEqual(c.engajamento, CONFIG_PADRAO.engajamento);
});

eq("negativo cai no padrão", normalizarConfig({ pontosPorBant: -5 }).pontosPorBant, CONFIG_PADRAO.pontosPorBant);
eq("texto cai no padrão", normalizarConfig({ pesoEtapa: "muito" }).pesoEtapa, CONFIG_PADRAO.pesoEtapa);

test("corte quente nunca fica abaixo do morno", () => {
  // Invertidos, ou todo lead vira quente ou nenhum vira.
  const c = normalizarConfig({ corteMorno: 80, corteQuente: 30 });
  assert.ok(c.corteQuente > c.corteMorno, `${c.corteQuente} deveria ser maior que ${c.corteMorno}`);
});

test("faixas de engajamento saem ordenadas", () => {
  const c = normalizarConfig({ engajamento: [{ ateDias: 30, pontos: 2 }, { ateDias: 3, pontos: 12 }] });
  assert.deepStrictEqual(c.engajamento.map((e) => e.ateDias), [3, 30]);
  // Sem ordenar, um lead de 1 dia cairia na faixa de 30 e ganharia 2 pontos.
  assert.equal(calcularScore({ ...base, diasDesdeInteracao: 1 }, c).score, 12);
});

eq("termo vazio volta ao padrão", normalizarConfig({ origemQuente: { termo: "  " } }).origemQuente.termo, "indica");

/* ── teto ── */

eq("o padrão soma exatamente 100", tetoTeorico(CONFIG_PADRAO), 100);

test("teto abaixo de 100 impede alguém chegar a quente", () => {
  const cfg = normalizarConfig({ pesoEtapa: 0, pontosPorBant: 0 });
  const teto = tetoTeorico(cfg);
  assert.ok(teto < CONFIG_PADRAO.corteQuente + 5, "é a informação que a tela precisa mostrar");
});
