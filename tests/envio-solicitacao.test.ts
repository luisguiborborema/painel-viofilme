/**
 * Envio de solicitação pelo portal do cliente.
 *
 * O formulário dizia "enviado" sempre — inclusive quando nada foi gravado.
 * Um cliente que acredita ter pedido e uma agência que não tem o pedido é o
 * tipo de falha que só aparece na reclamação, semanas depois.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerResposta } from "../src/lib/data/envio-solicitacao.ts";

test("sucesso de verdade", () => {
  assert.deepStrictEqual(lerResposta(200, { ok: true, persisted: true }), { ok: true });
});

test("200 sem gravar é falha", () => {
  // A rota responde ok depois de notificar a equipe. Sem a linha no banco, o
  // pedido não existe para quem vai atendê-lo.
  const r = lerResposta(200, { ok: true, persisted: false });
  assert.equal(r.ok, false);
});

test("erro do servidor é falha", () => {
  assert.equal(lerResposta(500, null).ok, false);
  assert.equal(lerResposta(400, { error: "tipo inválido" }).ok, false);
});

test("sessão expirada diz o que fazer", () => {
  const r = lerResposta(401, null);
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.erro : "", /sessão|Entre de novo/i);
});

test("corpo sem ok:true não passa", () => {
  assert.equal(lerResposta(200, {}).ok, false);
  assert.equal(lerResposta(200, null).ok, false);
});

test("ausência de persisted não reprova", () => {
  // Versão antiga da rota pode não mandar o campo; só `false` explícito reprova.
  assert.deepStrictEqual(lerResposta(200, { ok: true }), { ok: true });
});

test("a mensagem de erro do servidor chega ao cliente quando existe", () => {
  const r = lerResposta(200, { ok: false, error: "Cliente sem cadastro." });
  assert.equal(r.ok === false && r.erro, "Cliente sem cadastro.");
});
