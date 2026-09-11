/**
 * Chaves de API.
 *
 * Uma chave dá leitura de tudo pelo MCP. O que se testa aqui é o que impede a
 * lista de virar um monte de chave anônima que ninguém ousa revogar — e o
 * recorte do prefixo, que é a única parte do token que sobrevive à criação.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { desde, nomeValido, prefixoDe, situacao, PREFIXO } from "../src/lib/data/api-keys.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))));

/* ── nome ── */

eq("nome comum", nomeValido("Claude do Guilherme"), { ok: true, nome: "Claude do Guilherme" });
eq("apara espaços", nomeValido("  Time  "), { ok: true, nome: "Time" });
eq("curto demais é recusado", nomeValido("ab").ok, false);
eq("vazio é recusado", nomeValido("").ok, false);
eq("só espaço é recusado", nomeValido("    ").ok, false);
eq("ausente é recusado", nomeValido(undefined).ok, false);
eq("longo demais é recusado", nomeValido("x".repeat(61)).ok, false);
eq("no limite passa", nomeValido("x".repeat(60)).ok, true);

/* ── prefixo visível ── */

test("prefixo identifica a origem e mostra pouco do token", () => {
  const token = `${PREFIXO}a1b2c3d4e5f6a7b8c9d0`;
  const p = prefixoDe(token);
  assert.ok(p.startsWith(PREFIXO), "tem de começar com vio_");
  assert.equal(p, "vio_a1b2c3");
  // O que sobra guardado não pode ser suficiente para reconstruir a chave.
  assert.ok(p.length < token.length / 2, "prefixo revelaria demais");
});

/* ── situação ── */

eq("revogada", situacao({ revokedAt: "2026-09-01T00:00:00Z", lastUsedAt: "2026-08-01T00:00:00Z" }), "revogada");
eq("revogada vence sobre uso recente", situacao({ revokedAt: "2026-09-01T00:00:00Z", lastUsedAt: null }), "revogada");
eq("ativa", situacao({ revokedAt: null, lastUsedAt: "2026-09-01T00:00:00Z" }), "ativa");
eq("criada e nunca usada", situacao({ revokedAt: null, lastUsedAt: null }), "nunca usada");

/* ── último uso ── */

const agora = new Date("2026-09-11T12:00:00Z");
eq("nunca usada", desde(null, agora), "nunca");
eq("agora há pouco", desde("2026-09-11T11:59:30Z", agora), "agora há pouco");
eq("minutos", desde("2026-09-11T11:20:00Z", agora), "há 40 min");
eq("horas", desde("2026-09-11T06:00:00Z", agora), "há 6h");
eq("um dia", desde("2026-09-10T06:00:00Z", agora), "há 1 dia");
eq("dias no plural", desde("2026-09-05T12:00:00Z", agora), "há 6 dias");
eq("meses", desde("2026-06-11T12:00:00Z", agora), "há 3 meses");
eq("um mês no singular", desde("2026-08-05T12:00:00Z", agora), "há 1 mês");
