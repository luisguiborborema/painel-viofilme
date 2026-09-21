/**
 * Pagamentos e o núcleo transacional — as invariantes do documento-mãe (§23)
 * e as tabelas de prioridade da spec (§5.4, §5.5, §5.6, §8).
 *
 * São regras que erram calado: um chip na ordem errada mostra "A vencer" numa
 * conta vencida, e um desconto abatendo a categoria faz o orçamento parecer
 * cumprido por causa de uma negociação.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acaoDaLinha, chipDeSituacao, coberturaDosProximos7, diferencaDoEstimado,
  estimarValor, faturaDaCompra, favorecidoDivergente, itensFechamComTitulo,
  linhaDePagamento, parcelasFechamComTitulo, repartir, repartirPagamento,
  rotuloDaSituacao, saldoDaParcela, separarLote, statusDaParcela, statusDoTitulo,
  type ParcelaParaChip, type ContextoLinha,
} from "../src/lib/data/pagamentos.ts";

const R$ = (reais: number) => Math.round(reais * 100);
const HOJE = "2026-09-21";

/* ── Saldo e status da parcela (§23.4, §7.1) ───────────────────────────── */

test("só o principal abate o saldo; juros e multa não", () => {
  // Pagou R$ 1.050 numa conta de R$ 1.000: R$ 50 foram encargo, não dívida.
  assert.equal(saldoDaParcela(R$(1000), [{ principalCent: R$(1000) }]), 0);
  assert.equal(saldoDaParcela(R$(1000), [{ principalCent: R$(400) }]), R$(600));
});

test("o saldo nunca fica negativo", () => {
  assert.equal(saldoDaParcela(R$(1000), [{ principalCent: R$(1500) }]), 0);
});

test("baixa estornada volta a dever", () => {
  const baixas = [{ principalCent: R$(1000), estornada: true }];
  assert.equal(saldoDaParcela(R$(1000), baixas), R$(1000));
  assert.equal(statusDaParcela(R$(1000), baixas), "open");
});

test("o status acompanha o saldo", () => {
  assert.equal(statusDaParcela(R$(1000), []), "open");
  assert.equal(statusDaParcela(R$(1000), [{ principalCent: R$(400) }]), "partial");
  assert.equal(statusDaParcela(R$(1000), [{ principalCent: R$(1000) }]), "settled");
});

test("cancelada e renegociada não são desfeitas por uma baixa", () => {
  assert.equal(statusDaParcela(R$(1000), [{ principalCent: R$(1000) }], "cancelled"), "cancelled");
  assert.equal(statusDaParcela(R$(1000), [], "renegotiated"), "renegotiated");
});

test("o status do título é derivado das parcelas (§7.4)", () => {
  const p = (status: "open" | "partial" | "settled" | "cancelled") => ({ status } as const);
  assert.equal(statusDoTitulo([]), "empty");
  assert.equal(statusDoTitulo([p("settled"), p("settled")]), "settled");
  assert.equal(statusDoTitulo([p("settled"), p("open")]), "partial");
  assert.equal(statusDoTitulo([p("open"), p("open")]), "open");
  assert.equal(statusDoTitulo([p("cancelled"), p("cancelled")]), "cancelled");
  // Parcela cancelada não conta: o resto do título segue a própria vida.
  assert.equal(statusDoTitulo([p("cancelled"), p("settled")]), "settled");
});

/* ── Somas fecham (§23.3) ──────────────────────────────────────────────── */

test("itens e parcelas têm de somar o título", () => {
  assert.equal(itensFechamComTitulo([R$(300), R$(700)], R$(1000)), true);
  assert.equal(itensFechamComTitulo([R$(300), R$(699)], R$(1000)), false);
  assert.equal(parcelasFechamComTitulo([R$(500), R$(500)], R$(1000)), true);
});

test("repartir nunca perde nem inventa centavo", () => {
  for (const [total, partes] of [[1000, 3], [1, 3], [99999, 7], [0, 4]] as const) {
    const r = repartir(total, partes);
    assert.equal(r.length, partes);
    assert.equal(r.reduce((s, v) => s + v, 0), total, `${total} em ${partes} partes`);
  }
  // O resto vai para a PRIMEIRA, que é a que alguém já está pagando.
  assert.deepEqual(repartir(1000, 3), [334, 333, 333]);
  assert.deepEqual(repartir(0, 3), [0, 0, 0]);
});

/* ── Chip de situação (§5.4) ───────────────────────────────────────────── */

const base: ParcelaParaChip = {
  status: "open", dueDateIso: "2026-09-30", saldoCent: R$(1000),
  aprovacao: "not_required", valorStatus: "confirmed", programadaParaIso: null,
};

test("vencida vem antes de aprovação, de estimada e de programada", () => {
  const vencida = { ...base, dueDateIso: "2026-09-15" };
  assert.equal(chipDeSituacao(vencida, HOJE), "vencida");
  assert.equal(chipDeSituacao({ ...vencida, aprovacao: "pending" }, HOJE), "vencida");
  assert.equal(chipDeSituacao({ ...vencida, valorStatus: "estimated" }, HOJE), "vencida",
    "estimada vencida continua vencida — o atraso é o que decide o dia");
  assert.equal(chipDeSituacao({ ...vencida, programadaParaIso: "2026-09-25" }, HOJE), "vencida");
});

test("paga ganha de tudo; cancelada também", () => {
  assert.equal(chipDeSituacao({ ...base, status: "settled", saldoCent: 0 }, HOJE), "paga");
  assert.equal(chipDeSituacao({ ...base, status: "cancelled" }, HOJE), "cancelada");
});

test("a régua de prazo distingue hoje, até 7 dias e depois", () => {
  assert.equal(chipDeSituacao({ ...base, dueDateIso: HOJE }, HOJE), "vence_hoje");
  assert.equal(chipDeSituacao({ ...base, dueDateIso: "2026-09-28" }, HOJE), "vence_em_breve");
  assert.equal(chipDeSituacao({ ...base, dueDateIso: "2026-09-29" }, HOJE), "a_vencer");
});

test("o rótulo conta os dias na direção certa", () => {
  const v = { ...base, dueDateIso: "2026-09-18" };
  assert.equal(rotuloDaSituacao("vencida", v, HOJE), "Vencida há 3 dias");
  const f = { ...base, dueDateIso: "2026-09-22" };
  assert.equal(rotuloDaSituacao("vence_em_breve", f, HOJE), "Vence em 1 dia");
  const p = { ...base, programadaParaIso: "2026-10-05" };
  assert.equal(rotuloDaSituacao("programada", p, HOJE), "Programada para 05/10");
});

/* ── Linha de pagamento (§5.5) ─────────────────────────────────────────── */

const linhaBase: ContextoLinha = {
  detalhes: { barcode: "0001" }, debitoAutomatico: false, estimada: false,
  paga: false, temComprovante: false, exigeNota: false, temNota: false,
  favorecidoDivergente: false,
};

test("NF pendente tem prioridade sobre todo o resto", () => {
  const r = linhaDePagamento({ ...linhaBase, exigeNota: true, temNota: false, favorecidoDivergente: true });
  assert.equal(r.texto, "NF pendente, exigida para pagar");
});

test("favorecido diferente é vermelho e ganha dos dados salvos", () => {
  const r = linhaDePagamento({ ...linhaBase, favorecidoDivergente: true });
  assert.equal(r.texto, "Boleto, favorecido diferente");
  assert.equal(r.tom, "ruim");
});

test("estimada sem código diz que a guia não saiu", () => {
  const r = linhaDePagamento({ ...linhaBase, estimada: true, detalhes: null });
  assert.equal(r.texto, "Guia ainda não emitida");
});

test("paga fala de comprovante, não de como pagar", () => {
  assert.equal(linhaDePagamento({ ...linhaBase, paga: true }).texto, "Sem comprovante");
  assert.equal(linhaDePagamento({ ...linhaBase, paga: true, temComprovante: true }).tom, "ok");
});

test("sem dados de pagamento é aviso, não silêncio", () => {
  assert.equal(linhaDePagamento({ ...linhaBase, detalhes: null }).texto, "Sem dados de pagamento");
  assert.equal(linhaDePagamento({ ...linhaBase, detalhes: { pixKey: "x" } }).texto, "PIX, chave do fornecedor");
});

/* ── Favorecido divergente (§7.3) ──────────────────────────────────────── */

test("o documento manda; o nome só decide quando falta documento", () => {
  assert.equal(
    favorecidoDivergente({ documento: "11.222.333/0001-44" }, { nome: "Adobe", documento: "11222333000144" }),
    false, "pontuação diferente é o mesmo CNPJ");
  assert.equal(
    favorecidoDivergente({ documento: "99999999000199" }, { nome: "Adobe", documento: "11222333000144" }),
    true);
  // Sem documento, nome contido resolve: "Adobe" e "Adobe Systems" são o mesmo.
  assert.equal(favorecidoDivergente({ nome: "Adobe Systems Brasil" }, { nome: "Adobe" }), false);
  assert.equal(favorecidoDivergente({ nome: "Intermediadora XPTO" }, { nome: "Adobe" }), true);
  assert.equal(favorecidoDivergente(null, { nome: "Adobe" }), false);
});

/* ── Ação da linha (§5.6) ──────────────────────────────────────────────── */

test("a ação segue a ordem de prioridade da spec", () => {
  const c = {
    especial: null, aprovacao: "not_required" as const,
    estimada: false, debitoAutomatico: false, paga: false,
  };
  assert.equal(acaoDaLinha({ ...c, especial: "folha" }), "abrir_folha");
  assert.equal(acaoDaLinha({ ...c, especial: "fatura" }), "ver_fatura");
  assert.equal(acaoDaLinha({ ...c, paga: true }), "comprovante");
  assert.equal(acaoDaLinha({ ...c, aprovacao: "pending" }), "aprovar");
  assert.equal(acaoDaLinha({ ...c, estimada: true, debitoAutomatico: true }), "informar_valor",
    "sem valor real não dá para conferir o débito");
  assert.equal(acaoDaLinha({ ...c, debitoAutomatico: true }), "confirmar_debito");
  assert.equal(acaoDaLinha(c), "pagar");
});

/* ── Valor estimado (§2.1, §9) ─────────────────────────────────────────── */

test("cada método estima do seu jeito, e cai no fixo sem histórico", () => {
  const fixo = R$(500);
  assert.equal(estimarValor({ metodo: "fixed", valorFixoCent: fixo, ultimosPagosCent: [] }), fixo);
  assert.equal(estimarValor({ metodo: "last", valorFixoCent: fixo, ultimosPagosCent: [R$(620)] }), R$(620));
  assert.equal(
    estimarValor({ metodo: "avg3", valorFixoCent: fixo, ultimosPagosCent: [R$(300), R$(600), R$(900)] }),
    R$(600));
  // Com menos de 3, "média de 3" seria um número com confiança que não tem.
  assert.equal(
    estimarValor({ metodo: "avg3", valorFixoCent: fixo, ultimosPagosCent: [R$(700)] }), R$(700));
  assert.equal(
    estimarValor({ metodo: "revenue_pct", valorFixoCent: fixo, ultimosPagosCent: [], receitaBaseCent: R$(100000), aliquotaPct: 6 }),
    R$(6000));
  assert.equal(
    estimarValor({ metodo: "revenue_pct", valorFixoCent: fixo, ultimosPagosCent: [], receitaBaseCent: 0, aliquotaPct: 6 }),
    fixo, "sem receita de base, não inventa");
});

test("diferença acima de 20% sugere revisar o método", () => {
  assert.deepEqual(diferencaDoEstimado(R$(1000), R$(1100)), { pct: 10, revisar: false });
  assert.deepEqual(diferencaDoEstimado(R$(1000), R$(1250)), { pct: 25, revisar: true });
  assert.deepEqual(diferencaDoEstimado(R$(1000), R$(700)), { pct: -30, revisar: true },
    "estimar muito a mais também é estimar mal");
  assert.deepEqual(diferencaDoEstimado(0, R$(100)), { pct: null, revisar: false });
});

/* ── Cobertura dos próximos 7 dias (§4.1) ──────────────────────────────── */

test("a cobertura olha o pior dia da janela, não o total", () => {
  const serie = [
    { dataIso: "2026-09-21", saldoCent: R$(5000) },
    { dataIso: "2026-09-24", saldoCent: R$(-1200) },
    { dataIso: "2026-09-28", saldoCent: R$(9000) },
  ];
  const r = coberturaDosProximos7(serie, HOJE);
  assert.equal(r.coberto, false);
  if (!r.coberto) {
    assert.equal(r.faltaCent, R$(1200));
    assert.equal(r.dataIso, "2026-09-24", "aponta o dia que fura, não o fim da janela");
  }
});

test("tudo positivo é coberto, e a janela para em 7 dias", () => {
  const serie = [
    { dataIso: "2026-09-22", saldoCent: R$(3000) },
    // Fora dos 7 dias: não pode derrubar a cobertura da semana.
    { dataIso: "2026-10-15", saldoCent: R$(-9000) },
  ];
  const r = coberturaDosProximos7(serie, HOJE);
  assert.equal(r.coberto, true);
  if (r.coberto) assert.equal(r.saldoMinimoCent, R$(3000));
});

/* ── Repartir o pagamento (§8, §17) ────────────────────────────────────── */

test("pagou menos e quitou: a diferença é desconto, e a categoria fica cheia", () => {
  const r = repartirPagamento({ saldoCent: R$(1000), valorPagoCent: R$(950), quitar: true });
  assert.equal(r.principalCent, R$(950));
  assert.equal(r.descontoCent, R$(50));
  assert.equal(r.saldoRestanteCent, 0);
});

test("pagou menos e não quitou: vira baixa parcial", () => {
  const r = repartirPagamento({ saldoCent: R$(1000), valorPagoCent: R$(400), quitar: false });
  assert.equal(r.principalCent, R$(400));
  assert.equal(r.descontoCent, 0);
  assert.equal(r.saldoRestanteCent, R$(600));
});

test("juros e multa informados saem do principal, não somam à dívida", () => {
  // Pagou R$ 1.030: R$ 1.000 de conta + R$ 20 de juros + R$ 10 de multa.
  const r = repartirPagamento({
    saldoCent: R$(1000), valorPagoCent: R$(1030), quitar: true,
    jurosInformadoCent: R$(20), multaInformadaCent: R$(10),
  });
  assert.equal(r.principalCent, R$(1000), "a categoria recebe o valor da conta");
  assert.equal(r.jurosCent, R$(20));
  assert.equal(r.multaCent, R$(10));
  assert.equal(r.saldoRestanteCent, 0);
});

test("encargo maior que o pago não cria principal negativo", () => {
  const r = repartirPagamento({
    saldoCent: R$(1000), valorPagoCent: R$(30), quitar: false, jurosInformadoCent: R$(50),
  });
  assert.equal(r.principalCent, 0);
  assert.equal(r.saldoRestanteCent, R$(1000));
});

/* ── Cartão (§6.1, §23) ────────────────────────────────────────────────── */

test("compra depois do fechamento cai na próxima fatura", () => {
  // Fecha dia 18, vence dia 25 do mesmo ciclo.
  assert.deepEqual(faturaDaCompra("2026-09-10", 18, 25), {
    fechamentoIso: "2026-09-18", vencimentoIso: "2026-09-25",
  });
  assert.deepEqual(faturaDaCompra("2026-09-19", 18, 25), {
    fechamentoIso: "2026-10-18", vencimentoIso: "2026-10-25",
  }, "um dia depois do fechamento já é o ciclo seguinte");
});

test("vencimento antes do fechamento cai no mês seguinte", () => {
  // Fecha dia 28, vence dia 5.
  assert.deepEqual(faturaDaCompra("2026-09-10", 28, 5), {
    fechamentoIso: "2026-09-28", vencimentoIso: "2026-10-05",
  });
});

/* ── Lote (§5.8) ───────────────────────────────────────────────────────── */

test("o lote aceita fornecedores diferentes e recusa o que precisa de decisão", () => {
  const item = (over: Partial<Parameters<typeof separarLote>[0][number]> = {}) => ({
    estimada: false, exigeNota: false, temNota: false,
    aprovacao: "not_required" as const, paga: false, ...over,
  });
  const { dentro, fora } = separarLote([
    item(),
    item({ estimada: true }),
    item({ exigeNota: true, temNota: false }),
    item({ exigeNota: true, temNota: true }),
    item({ aprovacao: "pending" }),
    item({ paga: true }),
  ]);
  assert.equal(dentro.length, 2, "a normal e a que já tem NF");
  assert.deepEqual(fora.map((f) => f.motivo).sort(), [
    "aguardando_aprovacao", "estimada", "ja_paga", "nota_pendente",
  ]);
});
