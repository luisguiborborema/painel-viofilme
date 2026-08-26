/**
 * Caminhos por onde o dinheiro entra e sai.
 *
 * Webhook do Asaas (o dinheiro entrando) e geração de parcelas de despesa (o
 * dinheiro saindo, agendado). Nos dois, o erro típico não derruba nada: o
 * webhook responde 200 e a série aparece na tela — só o número está errado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisoDoEvento,
  chaveDoEvento,
  linhaDePagamento,
  valorParaAviso,
} from "../src/lib/asaas/webhook.ts";
import { safeEqual } from "../src/lib/asaas/config.ts";
import {
  avancar,
  completarSerieAberta,
  planejarParcelas,
  MAX_PARCELAS,
  JANELA_ABERTA_MESES,
} from "../src/lib/data/expense-series.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))));

/* ── autenticação do webhook ── */

eq("token igual passa", safeEqual("abc123", "abc123"), true);
eq("token diferente não passa", safeEqual("abc123", "abc124"), false);
eq("tamanho diferente não passa", safeEqual("abc", "abc123"), false);
eq("token vazio contra vazio", safeEqual("", ""), true);
eq("vazio contra preenchido", safeEqual("", "x"), false);

/* ── idempotência ── */

const pagamento = { id: "pay_1", status: "PENDING", value: 1000, dueDate: "2026-09-10" };

eq("usa o id do próprio Asaas quando vem",
  chaveDoEvento({ id: "evt_abc", event: "PAYMENT_RECEIVED", payment: pagamento }), "evt_abc");

test("reenvio idêntico produz a MESMA chave (é descartado)", () => {
  const corpo = { event: "PAYMENT_UPDATED", payment: pagamento };
  assert.equal(chaveDoEvento(corpo), chaveDoEvento({ ...corpo }));
});

test("segunda alteração real produz chave DIFERENTE (não é descartada)", () => {
  // O caso que a chave antiga `pagamento:evento` perdia: dois PAYMENT_UPDATED
  // legítimos do mesmo pagamento — valor corrigido depois de emitido.
  const primeiro = chaveDoEvento({ event: "PAYMENT_UPDATED", payment: pagamento });
  const segundo = chaveDoEvento({ event: "PAYMENT_UPDATED", payment: { ...pagamento, value: 1200 } });
  assert.notEqual(primeiro, segundo);
});

test("mudança de vencimento também gera chave nova", () => {
  const a = chaveDoEvento({ event: "PAYMENT_UPDATED", payment: pagamento });
  const b = chaveDoEvento({ event: "PAYMENT_UPDATED", payment: { ...pagamento, dueDate: "2026-10-10" } });
  assert.notEqual(a, b);
});

test("eventos diferentes do mesmo pagamento não colidem", () => {
  const a = chaveDoEvento({ event: "PAYMENT_CREATED", payment: pagamento });
  const b = chaveDoEvento({ event: "PAYMENT_RECEIVED", payment: pagamento });
  assert.notEqual(a, b);
});

eq("sem pagamento e sem id não há chave", chaveDoEvento({ event: "PAYMENT_RECEIVED" }), null);
eq("sem evento não há chave", chaveDoEvento({ payment: pagamento }), null);

/* ── mapeamento do pagamento ── */

const agora = new Date("2026-08-26T12:00:00Z");

test("mapeia os campos que importam", () => {
  const l = linhaDePagamento({
    id: "pay_9", customer: "cus_1", status: "RECEIVED", billingType: "PIX",
    value: 1500.5, netValue: 1470.2, dueDate: "2026-08-10", paymentDate: "2026-08-09",
    description: "Mensalidade", invoiceUrl: "https://x", externalReference: "cli-1",
  }, "cli-1", agora);
  assert.equal(l.asaas_payment_id, "pay_9");
  assert.equal(l.value, 1500.5);
  assert.equal(l.net_value, 1470.2, "líquido é o que sobra depois da taxa — não pode virar o bruto");
  assert.equal(l.payment_date, "2026-08-09");
  assert.equal(l.client_id, "cli-1");
});

eq("cai para clientPaymentDate quando paymentDate não vem",
  linhaDePagamento({ id: "p", clientPaymentDate: "2026-08-11" }, null, agora).payment_date, "2026-08-11");

eq("paymentDate tem precedência",
  linhaDePagamento({ id: "p", paymentDate: "2026-08-09", clientPaymentDate: "2026-08-11" }, null, agora).payment_date,
  "2026-08-09");

eq("sem nenhuma das duas datas, fica nulo",
  linhaDePagamento({ id: "p" }, null, agora).payment_date, null);

eq("valor ausente vira null, não zero",
  linhaDePagamento({ id: "p" }, null, agora).value, null);

eq("cliente não identificado fica nulo (não inventa)",
  linhaDePagamento({ id: "p" }, null, agora).client_id, null);

/* ── avisos ── */

eq("recebido", avisoDoEvento("PAYMENT_RECEIVED"), "recebido");
eq("confirmado também é recebido", avisoDoEvento("PAYMENT_CONFIRMED"), "recebido");
eq("em dinheiro também", avisoDoEvento("PAYMENT_RECEIVED_IN_CASH"), "recebido");
eq("vencido", avisoDoEvento("PAYMENT_OVERDUE"), "vencido");
eq("criado não avisa ninguém", avisoDoEvento("PAYMENT_CREATED"), null);
eq("estornado não avisa (não há mensagem para isso)", avisoDoEvento("PAYMENT_REFUNDED"), null);
eq("evento ausente", avisoDoEvento(undefined), null);

eq("valor formatado", valorParaAviso(1500.5), "R$ 1.500,50");
eq("sem valor, texto neutro", valorParaAviso(undefined), "sua fatura");
eq("valor inválido não vira 'R$ NaN'", valorParaAviso(Number.NaN), "sua fatura");

/* ── parcelas de despesa ── */

eq("mensal simples", avancar("2026-01-10", "monthly", 1), "2026-02-10");
eq("31/jan + 1 mês = 28/fev (não estoura para março)", avancar("2026-01-31", "monthly", 1), "2026-02-28");
eq("31/jan + 2 meses volta para 31/mar", avancar("2026-01-31", "monthly", 2), "2026-03-31");
eq("fevereiro bissexto", avancar("2028-01-31", "monthly", 1), "2028-02-29");
eq("31/mai + 1 = 30/jun", avancar("2026-05-31", "monthly", 1), "2026-06-30");
eq("vira o ano", avancar("2026-12-15", "monthly", 1), "2027-01-15");
eq("semanal", avancar("2026-01-01", "weekly", 3), "2026-01-22");
eq("semanal vira o mês", avancar("2026-01-29", "weekly", 1), "2026-02-05");
eq("anual", avancar("2026-03-10", "yearly", 2), "2028-03-10");
eq("29/fev + 1 ano = 28/fev", avancar("2028-02-29", "yearly", 1), "2029-02-28");
eq("passo zero devolve a própria data", avancar("2026-03-10", "monthly", 0), "2026-03-10");
eq("data inválida não quebra", avancar("sem-data", "monthly", 1), "sem-data");

test("12 parcelas mensais a partir de 31/jan nunca pulam para o mês seguinte", () => {
  const p = planejarParcelas("2026-01-31", "monthly", 12);
  assert.equal(p.length, 12);
  assert.deepStrictEqual(p.map((x) => x.dueDate), [
    "2026-01-31","2026-02-28","2026-03-31","2026-04-30","2026-05-31","2026-06-30",
    "2026-07-31","2026-08-31","2026-09-30","2026-10-31","2026-11-30","2026-12-31",
  ]);
  assert.deepStrictEqual(p.map((x) => x.installment), [1,2,3,4,5,6,7,8,9,10,11,12]);
});

eq("quantidade zero ainda gera uma parcela", planejarParcelas("2026-01-10", "monthly", 0).length, 1);
eq("negativo idem", planejarParcelas("2026-01-10", "monthly", -5).length, 1);
eq("acima do teto é limitado", planejarParcelas("2026-01-10", "monthly", 9999).length, MAX_PARCELAS);
eq("fracionário arredonda", planejarParcelas("2026-01-10", "monthly", 3.6).length, 4);

/* ── séries sem fim (a rotina diária mantém a janela cheia) ── */

test("gera o que falta para cobrir a janela", () => {
  const novas = completarSerieAberta("2026-09-10", "monthly", "2026-08-26", 12);
  assert.ok(novas.length > 0);
  assert.equal(novas[0], "2026-10-10", "continua de onde a série parou");
  assert.ok(novas.every((d) => d > "2026-09-10"), "nunca regride");
  assert.ok(novas.at(-1)! <= "2027-08-26", "não passa da janela");
});

test("série já em dia não gera nada", () => {
  // Último vencimento além da janela: não há o que completar.
  assert.deepStrictEqual(completarSerieAberta("2030-01-10", "monthly", "2026-08-26", 12), []);
});

test("rodar duas vezes no mesmo dia não duplica", () => {
  const primeira = completarSerieAberta("2026-09-10", "monthly", "2026-08-26", 12);
  const ultima = primeira.at(-1)!;
  // Segunda execução parte do último vencimento já criado.
  assert.deepStrictEqual(completarSerieAberta(ultima, "monthly", "2026-08-26", 12), []);
});

test("série parada há muito tempo é recuperada sem estourar o teto", () => {
  const novas = completarSerieAberta("2020-01-10", "monthly", "2026-08-26", 12);
  assert.ok(novas.length <= MAX_PARCELAS);
  assert.equal(novas[0], "2020-02-10");
  assert.ok(novas.at(-1)! <= "2027-08-26");
});

eq("janela padrão é de 12 meses", JANELA_ABERTA_MESES, 12);

test("semanal também respeita a janela", () => {
  const novas = completarSerieAberta("2026-08-26", "weekly", "2026-08-26", 3);
  assert.ok(novas.length >= 12 && novas.length <= 14, `esperava ~13 semanas, veio ${novas.length}`);
  assert.ok(novas.at(-1)! <= "2026-11-26");
});
