/**
 * Regras financeiras puras — leitura de extrato, conciliação, encargos por
 * atraso, provisão de imposto e alçada de aprovação.
 *
 * São as funções onde um erro NÃO aparece na tela: o número sai errado com
 * cara de certo. Rode com `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseValor, parseDataBr, parseDataOfx, parseOfx, parseCsvExtrato, lerExtrato } from "../src/lib/data/ofx.ts";
import { conciliar, resumoConciliacao } from "../src/lib/data/reconciliation.ts";
import { calcularEncargos, diasDeAtraso } from "../src/lib/data/late-fees.ts";
import { estimarImposto, vencimentoGuia } from "../src/lib/data/tax.ts";
import { precisaAprovacao, statusInicial, bloqueioDePagamento } from "../src/lib/data/approval.ts";

/** Compara por valor; a falha mostra os dois lados. */
const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))));


/* ── parseValor (formatos de extrato brasileiro) ── */
eq("1.234,56", parseValor("1.234,56"), 1234.56);
eq("1234.56", parseValor("1234.56"), 1234.56);
eq("R$ -1.234,56", parseValor("R$ -1.234,56"), -1234.56);
eq("(1.234,56) = negativo", parseValor("(1.234,56)"), -1234.56);
eq("1.234,56 D = débito", parseValor("1.234,56 D"), -1234.56);
eq("1.234,56 C = crédito", parseValor("1.234,56 C"), 1234.56);
eq("sem decimal 1.234 (milhar)", parseValor("1.234"), 1234);
eq("inteiro 850", parseValor("850"), 850);
eq("milhar duplo 1.234.567,89", parseValor("1.234.567,89"), 1234567.89);
eq("formato US 1,234.56", parseValor("1,234.56"), 1234.56);
eq("milhar US 1,234", parseValor("1,234"), 1234);
eq("decimal 1 casa 12,5", parseValor("12,5"), 12.5);
eq("OFX 3500.00", parseValor("3500.00"), 3500);
eq("centavos 0,99", parseValor("0,99"), 0.99);
eq("vazio", parseValor("  "), null);
eq("lixo", parseValor("abc"), null);


/* ── datas ── */
eq("OFX com fuso", parseDataOfx("20260815120000[-3:BRT]"), "2026-08-15");
eq("OFX curto", parseDataOfx("20260815"), "2026-08-15");
eq("OFX mês inválido", parseDataOfx("20261315"), null);
eq("br 05/08/2026", parseDataBr("05/08/2026"), "2026-08-05");
eq("br 5/8/2026 (sem zero)", parseDataBr("5/8/2026"), "2026-08-05");
eq("br 05-08-2026", parseDataBr("05-08-2026"), "2026-08-05");
eq("iso passa direto", parseDataBr("2026-08-05"), "2026-08-05");
eq("ano 2 dígitos", parseDataBr("05/08/26"), "2026-08-05");


/* ── OFX real (SGML, sem tags de fechamento) ── */
const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL<BANKACCTFROM><BANKID>341<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260801<DTEND>20260831
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260805120000[-3:BRT]<TRNAMT>3500.00<FITID>A1<MEMO>PIX RECEBIDO CLIENTE X</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260810120000[-3:BRT]<TRNAMT>-1200.50<FITID>A2<MEMO>ALUGUEL</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const lidoOfx = parseOfx(ofx);
eq("2 lançamentos", lidoOfx.entries.length, 2);
eq("crédito positivo", lidoOfx.entries[0].amount, 3500);
eq("débito negativo", lidoOfx.entries[1].amount, -1200.5);
eq("fitid", lidoOfx.entries[0].fitid, "A1");
eq("memo", lidoOfx.entries[1].memo, "ALUGUEL");
eq("período do arquivo", [lidoOfx.from, lidoOfx.to], ["2026-08-01", "2026-08-31"]);
eq("conta do arquivo", lidoOfx.accountHint, "12345-6");
eq("detecção automática", lerExtrato(ofx).formato, "ofx");


/* ── CSV com cabeçalho (ponto-e-vírgula) ── */
const csv = `Data;Histórico;Valor
05/08/2026;PIX RECEBIDO;3.500,00
10/08/2026;ALUGUEL;-1.200,50
12/08/2026;TARIFA;-45,00`;
const lidoCsv = parseCsvExtrato(csv);
eq("3 linhas", lidoCsv.entries.length, 3);
eq("valores", lidoCsv.entries.map((e) => e.amount), [3500, -1200.5, -45]);
eq("histórico", lidoCsv.entries[0].memo, "PIX RECEBIDO");
eq("detecção automática", lerExtrato(csv).formato, "csv");


/* ── CSV com colunas separadas de débito/crédito ── */
const csv2 = `Data,Descricao,Credito,Debito
05/08/2026,Recebimento,3500.00,
10/08/2026,Aluguel,,1200.50`;
eq("sinais corretos", parseCsvExtrato(csv2).entries.map((e) => e.amount), [3500, -1200.5]);


/* ── conciliação ── */
const extrato = [
  { id: "b1", date: "2026-08-05", amount: 3500, memo: "PIX" },
  { id: "b2", date: "2026-08-10", amount: -1200.5, memo: "ALUGUEL" },
  { id: "b3", date: "2026-08-12", amount: -45, memo: "TARIFA" },
];
const movs = [
  { id: "p-1", kind: "entrada" as const, date: "2026-08-05", value: 3500, description: "Mensalidade" },
  { id: "e-1", kind: "saida" as const, date: "2026-08-09", value: 1200.5, description: "Aluguel" },
];
const r = conciliar(extrato, movs);
eq("casou os dois", r.sugestoes.map((s) => [s.entryId, s.movId, s.automatico]), [["b1","p-1",true],["b2","e-1",true]]);
eq("tarifa sem candidato", r.semCandidato, ["b3"]);
eq("distância em dias", r.sugestoes[1].dias, 1);


/* ── conciliação: casos que precisam NÃO casar sozinho ── */
const ambiguo = conciliar(
  [{ id: "b1", date: "2026-08-05", amount: -500, memo: "?" }],
  [
    { id: "e-1", kind: "saida", date: "2026-08-05", value: 500, description: "A" },
    { id: "e-2", kind: "saida", date: "2026-08-05", value: 500, description: "B" },
  ],
);
eq("empate → não automático", ambiguo.sugestoes[0].automatico, false);
eq("empate → oferece alternativa", ambiguo.sugestoes[0].alternativas, ["e-2"]);

eq("sinal errado não casa",
  conciliar([{ id: "b1", date: "2026-08-05", amount: 500, memo: "?" }],
            [{ id: "e-1", kind: "saida", date: "2026-08-05", value: 500, description: "A" }]).semCandidato,
  ["b1"]);

eq("fora da janela de dias não casa",
  conciliar([{ id: "b1", date: "2026-08-20", amount: 500, memo: "?" }],
            [{ id: "p-1", kind: "entrada", date: "2026-08-05", value: 500, description: "A" }]).semCandidato,
  ["b1"]);

eq("valor diferente não casa",
  conciliar([{ id: "b1", date: "2026-08-05", amount: 500.5, memo: "?" }],
            [{ id: "p-1", kind: "entrada", date: "2026-08-05", value: 500, description: "A" }]).semCandidato,
  ["b1"]);

const doisIguais = conciliar(
  [{ id: "b1", date: "2026-08-05", amount: 300, memo: "?" }, { id: "b2", date: "2026-08-05", amount: 300, memo: "?" }],
  [
    { id: "p-1", kind: "entrada", date: "2026-08-05", value: 300, description: "A" },
    { id: "p-2", kind: "entrada", date: "2026-08-06", value: 300, description: "B" },
  ],
);
eq("um lançamento não casa com duas linhas", doisIguais.sugestoes.map((s) => s.movId), ["p-1", "p-2"]);

eq("lançamento já casado é ignorado",
  conciliar([{ id: "b1", date: "2026-08-05", amount: 300, memo: "?" }],
            [{ id: "p-1", kind: "entrada", date: "2026-08-05", value: 300, description: "A", jaCasado: true }]).semCandidato,
  ["b1"]);

eq("resumo", resumoConciliacao(10, 7, 1), { total: 10, casados: 7, ignorados: 1, pendentes: 2, pct: 70, fechado: false });
eq("resumo fechado", resumoConciliacao(5, 4, 1).fechado, true);


/* ── multa e juros ── */
const cfg = { fine: 2, interestMonth: 1, graceDays: 0 };
const h = new Date("2026-08-31T12:00:00Z");
eq("dias de atraso", diasDeAtraso("2026-08-01", h), 30);
const e30 = calcularEncargos(1000, "2026-08-01", cfg, h);
eq("multa 2%", e30.multa, 20);
eq("juros 1% a.m. por 30 dias", e30.juros, 10);
eq("valor atualizado", e30.atualizado, 1030);
eq("a vencer não gera encargo", calcularEncargos(1000, "2026-09-10", cfg, h).total, 0);
eq("vence hoje não gera encargo", calcularEncargos(1000, "2026-08-31", cfg, h).total, 0);
eq("dentro da carência não cobra", calcularEncargos(1000, "2026-08-28", { ...cfg, graceDays: 5 }, h).total, 0);
const carencia = calcularEncargos(1000, "2026-08-21", { ...cfg, graceDays: 5 }, h);
eq("carência desconta dias (10 atraso − 5)", [carencia.diasAtraso, carencia.diasCobrados], [10, 5]);
eq("config zerada não cobra nada", calcularEncargos(1000, "2026-01-01", { fine: 0, interestMonth: 0, graceDays: 0 }, h).total, 0);
eq("arredonda em centavos", calcularEncargos(333.33, "2026-08-24", cfg, h).multa, 6.67);


/* ── impostos ── */
eq("Simples 6% sobre 50k", estimarImposto("2026-08", 50000, { regime: "simples", rate: 6, dueDay: 20 }).valor, 3000);
eq("guia vence no mês seguinte", vencimentoGuia("2026-08", 20), "2026-09-20");
eq("dezembro vira janeiro do ano seguinte", vencimentoGuia("2026-12", 20), "2027-01-20");
eq("dia 31 em fevereiro cai no último dia", vencimentoGuia("2027-01", 31), "2027-02-28");
eq("fevereiro bissexto", vencimentoGuia("2028-01", 31), "2028-02-29");
eq("regime nenhum não provisiona", estimarImposto("2026-08", 50000, { regime: "nenhum", rate: 6, dueDay: 20 }).ativo, false);
eq("alíquota zero não provisiona", estimarImposto("2026-08", 50000, { regime: "simples", rate: 0, dueDay: 20 }).valor, 0);
eq("faturamento zero não provisiona", estimarImposto("2026-08", 0, { regime: "simples", rate: 6, dueDay: 20 }).valor, 0);


/* ── alçada ── */
eq("abaixo do limite passa direto", precisaAprovacao(499, 500), false);
eq("no limite exato exige aprovação", precisaAprovacao(500, 500), true);
eq("acima exige", precisaAprovacao(5000, 500), true);
eq("limite 0 desliga a alçada", precisaAprovacao(999999, 0), false);
eq("status inicial pendente", statusInicial(1000, 500), "pending");
eq("status inicial aprovado", statusInicial(100, 500), "approved");
eq("pendente bloqueia pagamento", Boolean(bloqueioDePagamento("pending")), true);
eq("recusada bloqueia pagamento", Boolean(bloqueioDePagamento("rejected")), true);
eq("aprovada libera", bloqueioDePagamento("approved"), null);
eq("sem status (linha antiga) libera", bloqueioDePagamento(null), null);

