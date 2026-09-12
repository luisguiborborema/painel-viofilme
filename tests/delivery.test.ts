/**
 * Apontamento de horas nas entregas.
 *
 * As colunas são `numeric(5,1)`. Um valor acima do teto não dá erro de
 * validação: o Postgres devolve "numeric field overflow", que chega na tela
 * como 500 sem explicação. Quem digitou 99999 por engano não faz ideia do que
 * aconteceu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { somarHoras, estimativaValida, MAX_HORAS } from "../src/lib/data/delivery-hours.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))));

/* ── soma de horas ── */

eq("lançamento normal", somarHoras(2.5, 1.5), { ok: true, total: 4 });
eq("primeiro lançamento", somarHoras(0, 3), { ok: true, total: 3 });
eq("total nulo conta como zero", somarHoras(null, 2), { ok: true, total: 2 });

// Negativo é correção de apontamento — permitido de propósito.
eq("negativo corrige para menos", somarHoras(5, -2), { ok: true, total: 3 });
eq("negativo além do total zera, não fica devendo", somarHoras(2.5, -10), { ok: true, total: 0 });

eq("zero não é lançamento", somarHoras(1, 0), { ok: false, erro: "Informe um valor diferente de zero." });
eq("texto não é hora", somarHoras(1, "abc"), { ok: false, erro: "Informe um número de horas válido." });
eq("indefinido", somarHoras(1, undefined), { ok: false, erro: "Informe um número de horas válido." });

test("lançamento gigante é recusado com explicação, não com 500", () => {
  const r = somarHoras(0, 99999);
  assert.equal(r.ok, false);
  assert.match((r as { erro: string }).erro, /fora do limite/);
});

test("total que passaria do teto é recusado", () => {
  const r = somarHoras(MAX_HORAS - 1, 5);
  assert.equal(r.ok, false);
  assert.match((r as { erro: string }).erro, /máximo que a tarefa comporta/);
});

eq("exatamente no teto ainda cabe", somarHoras(MAX_HORAS - 1, 1), { ok: true, total: MAX_HORAS });

test("arredonda para uma casa, como a coluna guarda", () => {
  // Sem isto o banco arredonda sozinho e o total exibido diverge do lançado.
  assert.deepStrictEqual(somarHoras(0, 1.26), { ok: true, total: 1.3 });
  assert.deepStrictEqual(somarHoras(1.15, 1.15), { ok: true, total: 2.3 });
});

/* ── estimativa ── */

eq("estimativa comum", estimativaValida(8), { ok: true, valor: 8 });
eq("estimativa ausente vira zero", estimativaValida(undefined), { ok: true, valor: 0 });
eq("string vazia vira zero", estimativaValida(""), { ok: true, valor: 0 });
eq("estimativa negativa é recusada", estimativaValida(-3), { ok: false, erro: "Estimativa inválida." });

test("estimativa acima do teto é recusada", () => {
  const r = estimativaValida(99999);
  assert.equal(r.ok, false);
  assert.match((r as { erro: string }).erro, /acima do limite/);
});

/* ── "hoje" de verdade, não o "hoje" dos dados de demonstração ── */
// O painel marcava "Qua (hoje)" em qualquer dia da semana e criava tarefas
// vencendo em 24/06/2026: a data fixa do mock tinha vazado para o modo real.

import { diaUtilPadrao, hojeIdxSemana, hojeIso } from "../src/lib/data/hoje.ts";

const emSegunda = new Date("2026-09-07T10:00:00");
const emSexta   = new Date("2026-09-11T10:00:00");
const emSabado  = new Date("2026-09-12T10:00:00");
const emDomingo = new Date("2026-09-13T10:00:00");

eq("segunda é o índice 0", hojeIdxSemana(emSegunda), 0);
eq("sexta é o índice 4", hojeIdxSemana(emSexta), 4);
// A régua só tem Seg–Sex: marcar um dia útil como "hoje" no sábado é mentira —
// foi exatamente o defeito relatado, com a quarta destacada num sábado.
eq("sábado não marca dia nenhum", hojeIdxSemana(emSabado), -1);
eq("domingo não marca dia nenhum", hojeIdxSemana(emDomingo), -1);

eq("no fim de semana a régua abre na segunda", diaUtilPadrao(emSabado), 0);
eq("em dia útil a régua abre no próprio dia", diaUtilPadrao(emSexta), 4);

test("hojeIso usa o fuso local, não UTC", () => {
  // Às 22h de Brasília já é o dia seguinte em UTC. Usar UTC faria a tarefa
  // nascer vencendo amanhã durante toda a noite.
  const noite = new Date(2026, 8, 12, 22, 30);
  assert.equal(hojeIso(noite), "2026-09-12");
});

eq("formata com dois dígitos", hojeIso(new Date(2026, 0, 5, 12)), "2026-01-05");

/* ── banco de horas do RH: mesma armadilha, outra tabela ── */
import { lancamentoDeHorasValido } from "../src/lib/data/delivery-hours.ts";

eq("lançamento normal", lancamentoDeHorasValido(8), { ok: true, horas: 8 });
eq("compensação é permitida", lancamentoDeHorasValido(-2), { ok: true, horas: -2 });
eq("fração vale", lancamentoDeHorasValido(1.5), { ok: true, horas: 1.5 });
eq("zero não é lançamento", lancamentoDeHorasValido(0).ok, false);
eq("texto não é hora", lancamentoDeHorasValido("oito").ok, false);

test("acima de 24h num dia é recusado com explicação, não com 500", () => {
  // 99999 devolvia "numeric field overflow" — a coluna é numeric(6,2).
  const r = lancamentoDeHorasValido(99999);
  assert.equal(r.ok, false);
  assert.match((r as { erro: string }).erro, /máximo 24h/);
});

eq("exatamente 24h passa", lancamentoDeHorasValido(24), { ok: true, horas: 24 });
eq("24h negativas passam", lancamentoDeHorasValido(-24), { ok: true, horas: -24 });
eq("arredonda em centésimos", lancamentoDeHorasValido(1.239), { ok: true, horas: 1.24 });
