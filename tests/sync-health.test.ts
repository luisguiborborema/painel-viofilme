/**
 * Aviso de sincronização parada.
 *
 * A decisão é sutil dos dois lados: avisar cedo demais vira ruído que a equipe
 * aprende a ignorar — e aí o aviso de verdade passa batido também. Avisar tarde
 * demais é o cliente perguntando por que o relatório parou.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIAS_ENTRE_AVISOS, FALHAS_PARA_AVISAR, deveAvisar, mensagemDeAviso, proximoEstado,
} from "../src/lib/meta/sync-health.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(a, b));

const AGORA = new Date("2026-09-12T06:00:00Z");
const limpo = { consecutiveFailures: 0, alertedAt: null };

/* ── quando avisar ── */

eq("sucesso nunca avisa", deveAvisar(limpo, false, AGORA), false);
// Uma falha isolada costuma ser instabilidade da API do Meta.
eq("primeira falha não avisa", deveAvisar(limpo, true, AGORA), false);
eq("segunda falha seguida avisa", deveAvisar({ consecutiveFailures: 1, alertedAt: null }, true, AGORA), true);
eq("terceira também avisaria se ninguém tivesse sido avisado",
  deveAvisar({ consecutiveFailures: 2, alertedAt: null }, true, AGORA), true);

test("não repete o aviso todo dia", () => {
  // Enquanto ninguém arruma, repetir diariamente treina a equipe a ignorar.
  const ontem = new Date(AGORA.getTime() - 86_400_000).toISOString();
  assert.equal(deveAvisar({ consecutiveFailures: 5, alertedAt: ontem }, true, AGORA), false);
});

test("volta a avisar depois do intervalo", () => {
  const antigo = new Date(AGORA.getTime() - (DIAS_ENTRE_AVISOS + 1) * 86_400_000).toISOString();
  assert.equal(deveAvisar({ consecutiveFailures: 5, alertedAt: antigo }, true, AGORA), true);
});

/* ── o que fica gravado ── */

test("sucesso limpa o histórico de falha", () => {
  const r = proximoEstado({ consecutiveFailures: 4, alertedAt: "2026-09-01T06:00:00Z" }, false, null, false, AGORA);
  assert.deepStrictEqual(r, {
    consecutive_failures: 0,
    last_error: null,
    last_synced_at: AGORA.toISOString(),
    alerted_at: null,
  });
});

test("falha soma e guarda o erro", () => {
  const r = proximoEstado(limpo, true, "token expirado", false, AGORA);
  assert.equal(r.consecutive_failures, 1);
  assert.equal(r.last_error, "token expirado");
  // last_synced_at marca a última vez que os NÚMEROS vieram — falha não atualiza.
  assert.equal(r.last_synced_at, null);
});

test("marca quando avisou, para não repetir", () => {
  const r = proximoEstado({ consecutiveFailures: 1, alertedAt: null }, true, "erro", true, AGORA);
  assert.equal(r.alerted_at, AGORA.toISOString());
});

test("sem avisar, mantém a marca anterior", () => {
  const antes = "2026-09-10T06:00:00Z";
  const r = proximoEstado({ consecutiveFailures: 3, alertedAt: antes }, true, "erro", false, AGORA);
  assert.equal(r.alerted_at, antes);
});

eq("erro gigante é cortado", proximoEstado(limpo, true, "x".repeat(9000), false, AGORA).last_error!.length, 500);
eq("erro ausente ganha texto", proximoEstado(limpo, true, null, false, AGORA).last_error, "erro desconhecido");

/* ── a mensagem ── */

test("diz o que fazer, não só que quebrou", () => {
  const m = mensagemDeAviso("Padaria do Zé", FALHAS_PARA_AVISAR, "OAuthException: token expired");
  assert.match(m, /Padaria do Zé/);
  assert.match(m, /relatório estão parados/);
  assert.match(m, /reconecte em Integrações/i, "precisa dizer o próximo passo");
});

test("erro longo não estoura a mensagem", () => {
  const m = mensagemDeAviso("Cliente", 5, "e".repeat(5000));
  assert.ok(m.length < 600);
});
