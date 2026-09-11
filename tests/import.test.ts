/**
 * Importação de negócios em lote.
 *
 * O valor mensal importado alimenta MRR, valor de funil e projeção. Um erro de
 * parsing aqui não aparece em lugar nenhum: o negócio existe, o número está
 * escrito, e está errado por um fator de mil.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseValor } from "../src/lib/data/money.ts";

/** Como a rota converte o campo `valor_mensal` do CSV. */
const valorMensal = (v: string) => Math.max(0, parseValor(v) ?? 0);

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(a, b));

/* ── formato brasileiro: o que o Excel pt-BR escreve ── */

eq("R$ 1.500,00", valorMensal("R$ 1.500,00"), 1500);
eq("1.500,00 sem símbolo", valorMensal("1.500,00"), 1500);
eq("1500,00 sem separador de milhar", valorMensal("1500,00"), 1500);
eq("12.000,00", valorMensal("R$ 12.000,00"), 12000);
eq("2.500,50 com centavos", valorMensal("2.500,50"), 2500.5);
eq("milhão", valorMensal("1.234.567,89"), 1234567.89);

/* ── o que o modelo de CSV do painel gera ── */

eq("1500 puro", valorMensal("1500"), 1500);
eq("1500.00 formato US", valorMensal("1500.00"), 1500);

/* ── entradas que não deveriam virar número ── */

eq("vazio vira zero", valorMensal(""), 0);
eq("texto vira zero", valorMensal("a combinar"), 0);
eq("espaço vira zero", valorMensal("   "), 0);

// Valor negativo numa planilha é erro de digitação, não desconto: não faz
// sentido um negócio com mensalidade negativa entrando no MRR.
eq("negativo vira zero", valorMensal("-500"), 0);
eq("negativo brasileiro vira zero", valorMensal("R$ -1.500,00"), 0);

/* ── a regressão que motivou este arquivo ── */

test("o parsing antigo errava por mil; o novo não", () => {
  const antigo = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;
  assert.equal(antigo("R$ 1.500,00"), 1.5, "era assim que estava: mil e quinhentos virava um e meio");
  assert.equal(antigo("1500,00"), 150000, "e isto virava cento e cinquenta mil");
  assert.equal(valorMensal("R$ 1.500,00"), 1500);
  assert.equal(valorMensal("1500,00"), 1500);
});
