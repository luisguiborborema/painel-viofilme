/**
 * Assinatura da proposta via ZapSign.
 *
 * O que estes testes protegem é o que se pode provar depois. Um documento
 * marcado como assinado sem assinatura é pior que nenhum registro: dá aparência
 * de prova a um clique de qualquer um.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lerRespostaDocumento, lerWebhook, mapearStatus, montarDocumento, normalizarModo,
  partirTelefone, segredoConfere,
} from "../src/lib/data/zapsign.ts";

const base = {
  nome: "Proposta — Plano Social",
  urlPdf: "https://exemplo.com/p.pdf",
  signatario: { nome: "João da Silva", email: "joao@exemplo.com" },
};
const ok = (r: unknown) => r as Record<string, unknown>;
const signer = (r: unknown) => (ok(r).signers as Record<string, unknown>[])[0];

/* ── montagem ── */

test("monta o corpo que a API espera", () => {
  const r = ok(montarDocumento(base));
  assert.equal(r.url_pdf, "https://exemplo.com/p.pdf");
  assert.equal(r.lang, "pt-br");
  assert.equal(signer(r).name, "João da Silva");
  assert.equal(signer(r).auth_mode, "assinaturaTela");
  assert.equal(signer(r).send_automatic_email, true);
});

test("PDF precisa ser https público", () => {
  // A ZapSign busca o arquivo do lado dela; http ou caminho local não chega.
  assert.match(String(ok(montarDocumento({ ...base, urlPdf: "/tmp/p.pdf" })).erro), /https/);
  assert.match(String(ok(montarDocumento({ ...base, urlPdf: "http://x/p.pdf" })).erro), /https/);
});

test("sem forma de contato não envia", () => {
  const r = montarDocumento({ ...base, signatario: { nome: "João" } });
  assert.match(String(ok(r).erro), /e-mail ou WhatsApp/);
});

test("e-mail inválido não gasta crédito", () => {
  const r = montarDocumento({ ...base, signatario: { nome: "João", email: "joao@" } });
  assert.match(String(ok(r).erro), /inválido/);
});

test("sem nome de signatário não envia", () => {
  assert.match(String(ok(montarDocumento({ ...base, signatario: { nome: "  ", email: "a@b.co" } })).erro), /nome/);
});

test("modo de autenticação incoerente é barrado antes de gastar", () => {
  // Token por SMS sem telefone chegaria à ZapSign, custaria e falharia lá.
  const r = montarDocumento({ ...base, modo: "tokenSms" });
  assert.match(String(ok(r).erro), /telefone/);
  const r2 = montarDocumento({ ...base, signatario: { nome: "João", telefone: "27999998888" }, modo: "tokenEmail" });
  assert.match(String(ok(r2).erro), /e-mail/);
});

test("só telefone também serve", () => {
  const r = ok(montarDocumento({ ...base, signatario: { nome: "João", telefone: "(27) 99999-8888" } }));
  assert.equal(signer(r).phone_country, "55");
  assert.equal(signer(r).phone_number, "27999998888");
  assert.equal(signer(r).send_automatic_email, false, "sem e-mail não há e-mail automático");
});

test("modo desconhecido cai no que não custa crédito", () => {
  assert.equal(normalizarModo("certificadoDigital-inventado"), "assinaturaTela");
  assert.equal(normalizarModo(null), "assinaturaTela");
});

/* ── telefone ── */

test("telefone com e sem DDI", () => {
  assert.deepStrictEqual(partirTelefone("5527999998888"), { ddi: "55", numero: "27999998888" });
  assert.deepStrictEqual(partirTelefone("27999998888"), { ddi: "55", numero: "27999998888" });
  assert.deepStrictEqual(partirTelefone("2733334444"), { ddi: "55", numero: "2733334444" });
  assert.equal(partirTelefone("12345"), null);
  assert.equal(partirTelefone(""), null);
});

/* ── resposta ── */

test("lê token e link de assinatura", () => {
  const r = lerRespostaDocumento({
    token: "eb9c367a", status: "pending",
    signers: [{ token: "921c115d", sign_url: "https://app.zapsign.com.br/verificar/921c115d" }],
  });
  assert.deepStrictEqual(r, {
    docToken: "eb9c367a",
    signUrl: "https://app.zapsign.com.br/verificar/921c115d",
    signerToken: "921c115d",
    status: "pending",
  });
});

test("resposta sem token é erro, não sucesso silencioso", () => {
  // Sem o token não há como reconciliar o webhook depois.
  assert.match(String(ok(lerRespostaDocumento({ status: "pending" })).erro), /token/);
});

/* ── status ── */

test("pending vira enviado, não rascunho", () => {
  assert.equal(mapearStatus("pending"), "sent");
  assert.equal(mapearStatus("signed"), "signed");
  assert.equal(mapearStatus("refused"), "refused");
  assert.equal(mapearStatus("coisa-nova"), null, "status desconhecido não vira nada");
});

/* ── webhook ── */

test("lê o documento assinado", () => {
  const e = lerWebhook({
    event_type: "doc_signed",
    token: "eb9c367a",
    status: "signed",
    signed_file: "https://zapsign.s3/signed.pdf",
    signers: [{ name: "João da Silva", signed_at: "2026-09-13T12:00:00Z" }],
  });
  assert.equal(e?.docToken, "eb9c367a");
  assert.equal(e?.status, "signed");
  assert.equal(e?.signerName, "João da Silva");
  assert.equal(e?.signedFileUrl, "https://zapsign.s3/signed.pdf");
});

test("aceita o corpo aninhado", () => {
  // O formato não é documentado; já apareceu com o documento dentro de `doc`.
  const e = lerWebhook({ type: "doc_signed", doc: { token: "abc", status: "signed" } });
  assert.equal(e?.docToken, "abc");
  assert.equal(e?.status, "signed");
});

test("evento com nome inesperado mas status assinado conta", () => {
  const e = lerWebhook({ event_type: "documento_finalizado", token: "abc", status: "signed" });
  assert.equal(e?.status, "signed");
});

test("recusa sem status ainda é entendida", () => {
  const e = lerWebhook({ event_type: "doc_refused", token: "abc" });
  assert.equal(e?.status, "refused");
});

test("corpo sem token do documento é descartado", () => {
  assert.equal(lerWebhook({ event_type: "doc_signed" }), null);
  assert.equal(lerWebhook(null), null);
});

test("pega o signatário que assinou, não o primeiro da lista", () => {
  const e = lerWebhook({
    token: "abc", status: "signed",
    signers: [{ name: "Sem assinar" }, { name: "Quem assinou", signed_at: "2026-09-13T12:00:00Z" }],
  });
  assert.equal(e?.signerName, "Quem assinou");
});

/* ── segredo do webhook ── */

test("segredo confere com e sem o prefixo Bearer", () => {
  assert.equal(segredoConfere("Bearer s3gr3d0", "s3gr3d0"), true);
  assert.equal(segredoConfere("s3gr3d0", "s3gr3d0"), true);
});

test("segredo errado não passa", () => {
  assert.equal(segredoConfere("Bearer outro", "s3gr3d0"), false);
  assert.equal(segredoConfere("Bearer s3gr3d1", "s3gr3d0"), false);
});

test("sem segredo configurado nada passa", () => {
  // Fecha em vez de abrir: marcar documento como assinado é afirmação jurídica.
  assert.equal(segredoConfere("Bearer qualquer", ""), false);
  assert.equal(segredoConfere("", ""), false);
  assert.equal(segredoConfere(null, "s3gr3d0"), false);
});
