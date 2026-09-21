/**
 * Recebimentos — as tabelas de prioridade da spec (§4.4, §4.5, §9.2, §10.3)
 * e as contas que decidem como a agência trata o cliente.
 *
 * Um perfil pagador errado muda o tratamento de quem paga em dia, e ninguém
 * vai conferir a conta. Um chip que esconde o atraso atrás de "parcial" faz
 * a cobrança não acontecer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acaoDeRecebimento, calcularEncargosReceber, chipDeRecebimento, dividirParcelas,
  estadoDaRegua, linhaDaCobranca, pendenciasDoCadastro, perfilPagador,
  podeReceberEmLote, rotuloDeRecebimento, vencimentoDaParcela,
  type EstadoDaCobranca, type EtapaRegua, type ParcelaReceber,
} from "../src/lib/data/recebimentos.ts";

const R$ = (reais: number) => Math.round(reais * 100);
const HOJE = "2026-09-21";

/* ── Chip de situação (§4.4) ───────────────────────────────────────────── */

const base: ParcelaReceber = {
  status: "open", dueDateIso: "2026-10-05", saldoCent: R$(1000), valorCent: R$(1000),
};

test("parcial e vencida coexistem: o chip diz as duas coisas", () => {
  const p: ParcelaReceber = { ...base, status: "partial", dueDateIso: "2026-09-10", saldoCent: R$(400) };
  assert.equal(chipDeRecebimento(p, HOJE), "parcial_vencida");
  assert.equal(rotuloDeRecebimento("parcial_vencida", p, HOJE), "Parcial, vencida há 11 dias");

  // Parcial e ainda no prazo é só parcial.
  const noPrazo: ParcelaReceber = { ...base, status: "partial", saldoCent: R$(400) };
  assert.equal(chipDeRecebimento(noPrazo, HOJE), "parcial");
});

test("a régua de prazo distingue hoje, até 7 dias e depois", () => {
  assert.equal(chipDeRecebimento({ ...base, dueDateIso: HOJE }, HOJE), "vence_hoje");
  assert.equal(chipDeRecebimento({ ...base, dueDateIso: "2026-09-28" }, HOJE), "vence_em_dias");
  assert.equal(chipDeRecebimento({ ...base, dueDateIso: "2026-09-29" }, HOJE), "a_vencer");
  assert.equal(chipDeRecebimento({ ...base, dueDateIso: "2026-09-15" }, HOJE), "vencida");
});

test("recebida e encerrada ganham de qualquer prazo", () => {
  assert.equal(chipDeRecebimento({ ...base, status: "settled", saldoCent: 0, dueDateIso: "2026-01-01" }, HOJE), "recebida");
  assert.equal(chipDeRecebimento({ ...base, status: "cancelled", dueDateIso: "2026-01-01" }, HOJE), "encerrada");
  assert.equal(chipDeRecebimento({ ...base, status: "renegotiated" }, HOJE), "encerrada");
});

/* ── Linha da cobrança (§4.5) ──────────────────────────────────────────── */

const cob: EstadoDaCobranca = {
  temCobranca: true, enviadaEm: null, visualizadaEm: null, falhou: false,
  envioProgramadoPara: null, viaSistema: true, recebida: false, confirmadaNoExtrato: false,
};

test("a cobrança tem eixo próprio, e visualizada ganha de enviada", () => {
  assert.equal(linhaDaCobranca({ ...cob, enviadaEm: "2026-09-16" }).texto, "Cobrança enviada em 16/09");
  assert.equal(
    linhaDaCobranca({ ...cob, enviadaEm: "2026-09-16", visualizadaEm: "2026-09-18" }).texto,
    "Visualizada pelo cliente",
  );
});

test("falha no envio é vermelha e ganha de tudo que não é recebimento", () => {
  const r = linhaDaCobranca({ ...cob, enviadaEm: "2026-09-16", falhou: true, falhaMotivo: "cliente sem e-mail" });
  assert.equal(r.texto, "Falha no envio: cliente sem e-mail");
  assert.equal(r.tom, "ruim");
});

test("'sem cobrança' só aparece quando alguém esperava uma", () => {
  assert.equal(linhaDaCobranca({ ...cob, temCobranca: false }).texto, "Sem cobrança");
  // Cobrança manual por transferência não tem o que emitir.
  assert.equal(linhaDaCobranca({ ...cob, temCobranca: false, viaSistema: false }).texto, "Cobrança manual");
});

test("recebida fala de conciliação, não de envio", () => {
  assert.equal(linhaDaCobranca({ ...cob, recebida: true }).texto, "Aguardando extrato");
  assert.equal(linhaDaCobranca({ ...cob, recebida: true, confirmadaNoExtrato: true }).tom, "ok");
});

test("a ação da linha segue a situação (§4.6)", () => {
  assert.equal(acaoDeRecebimento({ recebida: true, temCobranca: true, viaSistema: true }), "comprovante");
  assert.equal(acaoDeRecebimento({ recebida: false, temCobranca: false, viaSistema: true }), "enviar_cobranca");
  assert.equal(acaoDeRecebimento({ recebida: false, temCobranca: true, viaSistema: true }), "registrar");
  // Sem cobrança via sistema, não há o que emitir: registra direto.
  assert.equal(acaoDeRecebimento({ recebida: false, temCobranca: false, viaSistema: false }), "registrar");
});

/* ── Encargos (§6.2) ───────────────────────────────────────────────────── */

test("multa é fixa e juros são pro rata die", () => {
  // R$ 1.000 com 10 dias de atraso: 2% de multa + 1% ao mês × 10/30.
  const e = calcularEncargosReceber(R$(1000), "2026-09-11", HOJE);
  assert.equal(e.diasAtraso, 10);
  assert.equal(e.multaCent, R$(20));
  assert.equal(e.jurosCent, Math.round(R$(1000) * 0.01 / 30 * 10));
  assert.equal(e.atualizadoCent, R$(1000) + e.totalCent);
  assert.match(e.detalhe ?? "", /multa de 2%/);
  assert.match(e.detalhe ?? "", /10 dias/);
});

test("sem atraso não há encargo, e o valor atualizado é o saldo", () => {
  const e = calcularEncargosReceber(R$(1000), "2026-10-05", HOJE);
  assert.equal(e.totalCent, 0);
  assert.equal(e.atualizadoCent, R$(1000));
  assert.equal(e.detalhe, null);
});

test("o cliente pode ter percentuais próprios", () => {
  const e = calcularEncargosReceber(R$(1000), "2026-09-11", HOJE, { multaPct: 0, jurosMesPct: 0 });
  assert.equal(e.totalCent, 0, "zerar os dois desliga a cobrança de encargos");
});

/* ── Régua (§9.2, §5.3) ────────────────────────────────────────────────── */

const ETAPAS: EtapaRegua[] = [
  { offsetDias: -5, acao: "Envio da cobrança", modo: "automatic" },
  { offsetDias: 0, acao: "Lembrete no vencimento", modo: "automatic" },
  { offsetDias: 3, acao: "Aviso de atraso", modo: "automatic" },
  { offsetDias: 10, acao: "WhatsApp", modo: "manual" },
  { offsetDias: 20, acao: "CS acionado", modo: "automatic" },
  { offsetDias: 30, acao: "Diretoria", modo: "task" },
];

test("a etapa é derivada dos dias de atraso, não gravada", () => {
  const r = estadoDaRegua({
    etapas: ETAPAS, diasAtraso: 5, recebida: false,
    promessaAte: null, pausadaAte: null, hojeIso: HOJE,
  });
  assert.equal(r.etapaAtual?.offsetDias, 3, "5 dias de atraso está na etapa D+3");
  assert.equal(r.proximaEtapa?.offsetDias, 10);
  assert.match(r.frase, /Etapa atual: D\+3/);
  assert.match(r.frase, /Próximo: whatsapp no D\+10/i);
});

test("promessa e pausa têm prioridade sobre qualquer etapa", () => {
  const comPromessa = estadoDaRegua({
    etapas: ETAPAS, diasAtraso: 25, recebida: false,
    promessaAte: "2026-09-30", pausadaAte: null, hojeIso: HOJE,
  });
  assert.equal(comPromessa.pausada, true);
  assert.match(comPromessa.frase, /promessa de pagamento para 30\/09/);
  assert.equal(comPromessa.etapaAtual, null, "com promessa, nenhuma etapa dispara");

  const pausada = estadoDaRegua({
    etapas: ETAPAS, diasAtraso: 25, recebida: false, promessaAte: null,
    pausadaAte: "2026-10-01", motivoPausa: "negociação em curso", hojeIso: HOJE,
  });
  assert.match(pausada.frase, /pausada até 01\/10: negociação em curso/);
});

test("promessa vencida não pausa mais nada", () => {
  const r = estadoDaRegua({
    etapas: ETAPAS, diasAtraso: 25, recebida: false,
    promessaAte: "2026-09-15", pausadaAte: null, hojeIso: HOJE,
  });
  assert.equal(r.pausada, false);
  assert.equal(r.etapaAtual?.offsetDias, 20);
});

test("recebida encerra a régua", () => {
  const r = estadoDaRegua({
    etapas: ETAPAS, diasAtraso: 40, recebida: true,
    promessaAte: null, pausadaAte: null, hojeIso: HOJE,
  });
  assert.equal(r.frase, "Régua encerrada: parcela recebida.");
});

test("antes do vencimento, a frase depende do que foi feito", () => {
  const comum = { etapas: ETAPAS, diasAtraso: -3, recebida: false, promessaAte: null, pausadaAte: null, hojeIso: HOJE };
  assert.match(estadoDaRegua({ ...comum, cobrancaEnviada: true }).frase, /lembrete por e-mail no dia do vencimento/);
  assert.match(estadoDaRegua({ ...comum, envioProgramadoPara: "2026-09-25" }).frase, /programado para 25\/09/);
  assert.match(estadoDaRegua(comum).frase, /Sem cobrança emitida/);
});

/* ── Perfil pagador (§10.3) ────────────────────────────────────────────── */

const pago = (v: number, venc: string, pag: string) =>
  ({ vencimentoIso: venc, pagamentoIso: pag, valorCent: R$(v) });

test("o perfil é por VALOR, não por quantidade de parcelas", () => {
  // Três boletos de R$ 100 em dia e uma mensalidade de R$ 5.000 atrasada:
  // por quantidade seriam 75% em dia; por valor, 5,7%.
  const r = perfilPagador({
    liquidadas: [
      pago(100, "2026-01-05", "2026-01-05"),
      pago(100, "2026-02-05", "2026-02-05"),
      pago(100, "2026-03-05", "2026-03-05"),
      pago(5000, "2026-04-05", "2026-04-25"),
    ],
    promessasQuebradas: 0,
  });
  assert.equal(r.perfil, "frequente");
  assert.ok(r.pctEmDia != null && r.pctEmDia < 10);
});

test("os limites são 90% e 70%", () => {
  const noLimite = (pct: number) => perfilPagador({
    liquidadas: [
      pago(pct, "2026-01-05", "2026-01-05"),
      pago(100 - pct, "2026-02-05", "2026-02-20"),
      pago(0.01, "2026-03-05", "2026-03-05"),
    ],
    promessasQuebradas: 0,
  }).perfil;
  assert.equal(noLimite(95), "pontual");
  assert.equal(noLimite(80), "as_vezes");
  assert.equal(noLimite(50), "frequente");
});

test("duas promessas quebradas derrubam o perfil, mesmo pagando em dia", () => {
  const r = perfilPagador({
    liquidadas: [
      pago(1000, "2026-01-05", "2026-01-05"),
      pago(1000, "2026-02-05", "2026-02-05"),
      pago(1000, "2026-03-05", "2026-03-05"),
    ],
    promessasQuebradas: 2,
  });
  assert.equal(r.perfil, "frequente", "quem promete e não cumpre já mostrou o comportamento");
  assert.equal(r.pctEmDia, 100, "mas o percentual continua sendo reportado como é");
});

test("menos de 3 parcelas liquidadas é 'sem histórico', não 'pontual'", () => {
  const r = perfilPagador({
    liquidadas: [pago(1000, "2026-01-05", "2026-01-05"), pago(1000, "2026-02-05", "2026-02-05")],
    promessasQuebradas: 0,
  });
  assert.equal(r.perfil, "sem_historico");
  assert.equal(r.pctEmDia, null);
});

/* ── Lote (§4.7) ───────────────────────────────────────────────────────── */

test("recebimento em lote só vale para o mesmo cliente", () => {
  assert.equal(podeReceberEmLote([{ clienteId: "a" }, { clienteId: "a" }]).pode, true);
  const misto = podeReceberEmLote([{ clienteId: "a" }, { clienteId: "b" }]);
  assert.equal(misto.pode, false);
  assert.match(misto.motivo ?? "", /mesmo cliente/);
  assert.equal(podeReceberEmLote([]).pode, false);
});

/* ── Cadastro (§10.4) ──────────────────────────────────────────────────── */

test("só é bloqueado o que depende do dado faltante", () => {
  const vazio = {};
  assert.deepEqual(
    pendenciasDoCadastro(vazio, "asaas_boleto_pix", false),
    ["CPF ou CNPJ, exigido para boleto", "endereço, exigido para boleto"],
  );
  // PIX não precisa de endereço.
  assert.deepEqual(pendenciasDoCadastro(vazio, "asaas_pix", false), ["CPF ou CNPJ, exigido para PIX via Asaas"]);
  // Cobrança manual não exige nada do cadastro.
  assert.deepEqual(pendenciasDoCadastro(vazio, "manual", false), []);
  // O envio automático é que exige e-mail, não a forma.
  assert.deepEqual(pendenciasDoCadastro(vazio, "manual", true), ["e-mail de cobrança, exigido para o envio automático"]);
  assert.deepEqual(
    pendenciasDoCadastro({ documento: "11.222.333/0001-44", endereco: {} }, "asaas_boleto_pix", false),
    [],
  );
});

/* ── Parcelamento (§7.5, §18) ──────────────────────────────────────────── */

test("a ÚLTIMA parcela absorve o arredondamento, e a soma fecha", () => {
  for (const [total, n] of [[1000, 3], [1, 3], [99999, 7]] as const) {
    const p = dividirParcelas(total, n);
    assert.equal(p.reduce((s, v) => s + v, 0), total, `${total} em ${n}`);
  }
  assert.deepEqual(dividirParcelas(1000, 3), [333, 333, 334]);
});

test("dia 31 em mês curto vira o último dia, não escorrega de mês", () => {
  assert.equal(vencimentoDaParcela("2026-01-31", 0), "2026-01-31");
  assert.equal(vencimentoDaParcela("2026-01-31", 1), "2026-02-28", "fevereiro de 2026 tem 28");
  assert.equal(vencimentoDaParcela("2026-01-31", 3), "2026-04-30", "abril tem 30");
  assert.equal(vencimentoDaParcela("2024-01-31", 1), "2024-02-29", "2024 é bissexto");
});

test("o intervalo quinzenal soma 15 dias", () => {
  assert.equal(vencimentoDaParcela("2026-09-10", 1, false), "2026-09-25");
  assert.equal(vencimentoDaParcela("2026-09-10", 2, false), "2026-10-10");
});
