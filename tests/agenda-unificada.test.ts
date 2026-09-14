/**
 * Agenda unificada (painel + Google).
 *
 * O "Meu dia" é a primeira tela que o time de operações abre. Uma agenda fora
 * de ordem ou com o mesmo compromisso duas vezes não é detalhe estético: é a
 * pessoa se preparando para a reunião errada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  idsGoogleVinculados, instanteDe, porInstante, reunioesDoDia,
} from "../src/lib/data/agenda-unificada.ts";

const local = (o: Partial<{ id: string; title: string; startAt: string; meetLink: string; googleEventId: string | null }>) =>
  ({ id: "1", title: "Local", startAt: "2026-09-14 09:00:00+00", ...o });
const google = (o: Partial<{ id: string; summary: string; start: string; allDay: boolean; hangoutLink: string }>) =>
  ({ id: "g1", summary: "Google", start: "2026-09-14T09:00:00-03:00", ...o });

/* ── o bug que originou isto ── */

test("o formato do Postgres não pula a fila", () => {
  // "2026-09-14 21:00:00+00" vs "2026-09-14T09:00:00-03:00": comparando texto,
  // o espaço vence o "T" e a reunião das 21h subia para o topo do dia.
  const r = reunioesDoDia(
    [local({ id: "noite", title: "Reunião da noite", startAt: "2026-09-14 21:00:00+00" })],
    [google({ id: "manha", summary: "Reunião da manhã", start: "2026-09-14T09:00:00-03:00" })],
  );
  assert.deepStrictEqual(r.map((e) => e.title), ["Reunião da manhã", "Reunião da noite"]);
});

test("os dois formatos comparam certo entre si", () => {
  assert.ok(instanteDe("2026-09-14 09:00:00+00") < instanteDe("2026-09-14T21:00:00+00:00"));
  // Mesmo instante escrito de dois jeitos. O `+00` sem minutos não é ISO
  // válido — normalizar cedo demais quebraria o que o parser já aceitava.
  assert.equal(instanteDe("2026-09-14 12:00:00+00"), instanteDe("2026-09-14T09:00:00-03:00"));
  assert.equal(instanteDe("2026-09-14T12:00:00+00"), instanteDe("2026-09-14T12:00:00+00:00"));
});

test("o evento de dia inteiro não vira reunião das 21:00", () => {
  // Google manda só a data em evento de dia inteiro. `new Date("2026-09-14")`
  // é meia-noite UTC, que em Brasília é 21:00 do dia ANTERIOR — e como texto
  // a data pura é prefixo de qualquer horário, subia para o topo do dia.
  const r = reunioesDoDia([], [
    google({ id: "feriado", summary: "[MD] dia inteiro", start: "2026-09-14", allDay: true }),
    google({ id: "cedo", summary: "Daily", start: "2026-09-14T09:00:00-03:00" }),
  ]);
  assert.deepStrictEqual(r.map((e) => e.title), ["Daily"]);
});

test("mesmo evento em dois calendários do Google conta uma vez", () => {
  // listUpcomingEvents consulta vários calendários e concatena as listas.
  const r = reunioesDoDia([], [
    google({ id: "mesmo", summary: "Reunião de sócios" }),
    google({ id: "mesmo", summary: "Reunião de sócios" }),
  ]);
  assert.equal(r.length, 1);
});

test("fuso diferente não engana a ordem", () => {
  // 10:00+00:00 é 07:00 em Brasília — vem antes de 09:00-03:00.
  const r = reunioesDoDia([], [
    google({ id: "a", summary: "nove BRT", start: "2026-09-14T09:00:00-03:00" }),
    google({ id: "b", summary: "dez UTC", start: "2026-09-14T10:00:00+00:00" }),
  ]);
  assert.deepStrictEqual(r.map((e) => e.title), ["dez UTC", "nove BRT"]);
});

/* ── duplicata ── */

test("compromisso espelhado no Google aparece uma vez só", () => {
  const r = reunioesDoDia(
    [local({ id: "1", title: "Daily", googleEventId: "g-daily" })],
    [google({ id: "g-daily", summary: "Daily" })],
  );
  assert.equal(r.length, 1, "o contador de reuniões contava cada compromisso duas vezes");
  assert.equal(r[0].title, "Daily");
  assert.ok(r[0].id.startsWith("o-"), "fica o local, que é o que carrega o link do Meet");
});

test("evento do Google sem par local continua aparecendo", () => {
  const r = reunioesDoDia([local({ googleEventId: "outro" })], [google({ id: "g1" })]);
  assert.equal(r.length, 2);
});

test("dois compromissos diferentes no mesmo horário não viram um", () => {
  // Dedupe é por id vinculado, nunca por título ou horário.
  const r = reunioesDoDia([], [
    google({ id: "a", summary: "Reunião" }),
    google({ id: "b", summary: "Reunião" }),
  ]);
  assert.equal(r.length, 2);
});

eqSet("local sem vínculo não entra no conjunto", idsGoogleVinculados([local({}), local({ googleEventId: null })]), []);
eqSet("recolhe os vinculados", idsGoogleVinculados([local({ googleEventId: "x" }), local({ googleEventId: "y" })]), ["x", "y"]);

function eqSet(nome: string, s: Set<string>, esperado: string[]) {
  test(nome, () => assert.deepStrictEqual([...s].sort(), esperado.sort()));
}

/* ── dia inteiro ── */

test("evento de dia inteiro fica de fora", () => {
  // Contaria como "reunião" e apareceria com hora inventada.
  const r = reunioesDoDia([], [google({ id: "f", summary: "Feriado", start: "2026-09-14", allDay: true })]);
  assert.equal(r.length, 0);
});

/* ── sem horário ── */

test("evento sem horário não bagunça a ordem", () => {
  // NaN numa comparação devolve sempre false e deixa a lista imprevisível.
  assert.equal(instanteDe(""), Infinity);
  assert.equal(instanteDe("data inválida"), Infinity);
  assert.equal(instanteDe(null), Infinity);
});

test("o comparador manda o sem-hora para o fim", () => {
  const itens = [{ q: "" }, { q: "2026-09-14T09:00:00Z" }, { q: "2026-09-14T08:00:00Z" }];
  assert.deepStrictEqual(
    [...itens].sort(porInstante((x) => x.q)).map((x) => x.q),
    ["2026-09-14T08:00:00Z", "2026-09-14T09:00:00Z", ""],
  );
});

test("lista vazia não quebra", () => {
  assert.deepStrictEqual(reunioesDoDia([], []), []);
});
