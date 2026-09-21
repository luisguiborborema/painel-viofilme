/**
 * Leitura de extrato: OFX, CSV e a classificação antes de gravar.
 *
 * O arquivo do banco é a fonte mais confiável que o sistema tem e a mais
 * fácil de duplicar: reimportar a mesma semana dobraria o saldo sem nenhum
 * erro aparecer na tela. É por isso que a dedupe tem teste próprio.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analisarImportacao, lerCsv, lerOfx, separadorDoCsv,
} from "../src/lib/data/extrato-import.ts";
import { impressaoDigital } from "../src/lib/data/caixa.ts";

const R$ = (reais: number) => Math.round(reais * 100);

const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>077<BRANCHID>0001<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260916120000[-3:BRT]<TRNAMT>4500.00
<FITID>2026091601<MEMO>PIX RECEB 12.345.678/0001-90 APTO INCORPORACOES</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260916000000<TRNAMT>-62.00
<FITID>2026091602<MEMO>TARIFA PACOTE SERVICOS 09/2026</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>11512.40<DTASOF>20260916</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

/* ── OFX ───────────────────────────────────────────────────────────────── */

test("o OFX vira linhas com data, valor em centavos e o FITID", () => {
  const r = lerOfx(OFX);
  assert.equal(r.erro, null);
  assert.equal(r.linhas.length, 2);

  const [entrada, saida] = r.linhas;
  assert.equal(entrada.dataIso, "2026-09-16");
  assert.equal(entrada.valorCent, R$(4500));
  assert.equal(entrada.idExterno, "2026091601");
  assert.equal(entrada.documento, "12.345.678/0001-90", "o CNPJ sai do texto para a conciliação");
  assert.equal(saida.valorCent, R$(-62), "débito mantém o sinal do arquivo");
});

test("o saldo final e a conta do arquivo são lidos", () => {
  const r = lerOfx(OFX);
  // É o saldo que a conferência compara com o do sistema.
  assert.equal(r.saldoFinalCent, R$(11512.4));
  assert.equal(r.saldoDataIso, "2026-09-16");
  // Agência e conta existem para barrar arquivo da conta errada (§18).
  assert.equal(r.agencia, "0001");
  assert.equal(r.conta, "12345-6");
});

test("arquivo que não é extrato é recusado com explicação, não com lista vazia", () => {
  const r = lerOfx("<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>");
  assert.equal(r.linhas.length, 0);
  assert.match(r.erro ?? "", /não parece um OFX/);
});

/* ── CSV ───────────────────────────────────────────────────────────────── */

test("o separador é descoberto pelo conteúdo, e empate vai para o ponto e vírgula", () => {
  // Banco brasileiro usa vírgula como decimal: por isso o empate não pode ir
  // para a vírgula, ou "1.234,56" viraria duas colunas.
  assert.equal(separadorDoCsv("data;descricao;valor\n16/09/2026;PIX;4.500,00"), ";");
  assert.equal(separadorDoCsv("data,descricao,valor\n2026-09-16,PIX,4500.00"), ",");
});

test("o CSV brasileiro é lido com uma coluna de valor com sinal", () => {
  const csv = [
    "Data;Histórico;Valor",
    "16/09/2026;PIX RECEBIDO APTO;4.500,00",
    "16/09/2026;TARIFA PACOTE;-62,00",
  ].join("\n");
  const r = lerCsv(csv, { data: 0, descricao: 1, valor: 2 });
  assert.equal(r.linhas.length, 2);
  assert.equal(r.linhas[0].valorCent, R$(4500));
  assert.equal(r.linhas[1].valorCent, R$(-62));
});

test("com colunas de débito e crédito, o sinal vem da coluna e não do número", () => {
  const csv = [
    "Data;Histórico;Débito;Crédito",
    "16/09/2026;PIX RECEBIDO;;4.500,00",
    "17/09/2026;ALUGUEL;2.000,00;",
  ].join("\n");
  const r = lerCsv(csv, { data: 0, descricao: 1, debito: 2, credito: 3 });
  assert.equal(r.linhas[0].valorCent, R$(4500));
  // O débito veio positivo no arquivo: quem dá o sinal é a coluna.
  assert.equal(r.linhas[1].valorCent, R$(-2000));
});

test("data e decimal seguem o mapeamento da conta, não o palpite", () => {
  const csv = "Date,Description,Amount\n2026-09-16,WIRE IN,4500.00";
  const r = lerCsv(csv, { data: 0, descricao: 1, valor: 2, formatoData: "ymd", separadorDecimal: "." });
  assert.equal(r.linhas[0].dataIso, "2026-09-16");
  assert.equal(r.linhas[0].valorCent, R$(4500));
});

test("CSV ilegível diz que o mapeamento está errado, em vez de importar nada em silêncio", () => {
  const r = lerCsv("lixo;sem;data", { data: 0, descricao: 1, valor: 2 });
  assert.equal(r.linhas.length, 0);
  assert.match(r.erro ?? "", /mapeamento de colunas/);
});

/* ── Análise antes de gravar (§7, passo 2) ─────────────────────────────── */

const linhas = lerOfx(OFX).linhas;
const CONTA = "c1";

test("reimportar o mesmo arquivo não duplica nada", () => {
  // Pelo FITID, que é a prova mais forte que o banco dá.
  const r = analisarImportacao({
    lidas: linhas, contaId: CONTA,
    jaExistentes: linhas.map((l) => ({ externalId: l.idExterno, fingerprint: null })),
    baixasPendentes: [],
  });
  assert.equal(r.novas, 0);
  assert.equal(r.existentes, 2);
});

test("sem FITID, a impressão digital segura a duplicata", () => {
  const r = analisarImportacao({
    lidas: linhas, contaId: CONTA,
    jaExistentes: linhas.map((l) => ({
      externalId: null,
      fingerprint: impressaoDigital({
        contaId: CONTA, dataIso: l.dataIso, valorCent: l.valorCent, descricaoRaw: l.descricaoRaw,
      }),
    })),
    baixasPendentes: [],
  });
  assert.equal(r.novas, 0, "CSV nunca traz FITID: é a digital que protege");
});

test("linha que bate com baixa manual CONFIRMA, em vez de criar outra movimentação", () => {
  // É a regra anti-duplicidade do §13.3: a baixa já contou o dinheiro uma vez.
  const r = analisarImportacao({
    lidas: linhas, contaId: CONTA, jaExistentes: [],
    baixasPendentes: [{ id: "b1", dataIso: "2026-09-14", valorCent: R$(4500) }],
  });
  assert.equal(r.confirmam, 1);
  assert.equal(r.novas, 1);
  assert.equal(r.linhas.find((l) => l.situacao === "confirma")?.baixaId, "b1");
});

test("uma baixa confirma uma linha só, mesmo com duas de mesmo valor", () => {
  const duas = [
    { dataIso: "2026-09-16", valorCent: R$(4500), descricaoRaw: "PIX A", idExterno: "a", documento: null },
    { dataIso: "2026-09-16", valorCent: R$(4500), descricaoRaw: "PIX B", idExterno: "b", documento: null },
  ];
  const r = analisarImportacao({
    lidas: duas, contaId: CONTA, jaExistentes: [],
    baixasPendentes: [{ id: "b1", dataIso: "2026-09-16", valorCent: R$(4500) }],
  });
  assert.equal(r.confirmam, 1, "a segunda é movimentação nova, não outra confirmação da mesma baixa");
  assert.equal(r.novas, 1);
});

test("baixa fora da tolerância de data não confirma", () => {
  const r = analisarImportacao({
    lidas: linhas, contaId: CONTA, jaExistentes: [],
    baixasPendentes: [{ id: "b1", dataIso: "2026-09-01", valorCent: R$(4500) }],
  });
  assert.equal(r.confirmam, 0);
});

test("o período coberto sai do próprio arquivo", () => {
  const r = analisarImportacao({ lidas: linhas, contaId: CONTA, jaExistentes: [], baixasPendentes: [] });
  assert.equal(r.periodoInicio, "2026-09-16");
  assert.equal(r.periodoFim, "2026-09-16");
  assert.equal(r.total, 2);
});
