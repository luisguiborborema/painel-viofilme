import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";
import { hojeSP } from "@/lib/data/dashboard-financeiro";
import { impressaoDigital, interpretarDescricao } from "@/lib/data/caixa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escrita do Caixa: movimentação, transferência e conciliação.
 *
 * A regra que organiza tudo aqui é do documento-mãe (§13.4): **a DRE lê sempre
 * de itens de título, nunca de movimentações soltas**. Por isso toda entrada
 * ou saída que nasce no Caixa — uma tarifa, um rendimento, um gasto pago na
 * hora, uma classificação na conciliação — cria nos bastidores título + item
 * + parcela + baixa já liquidados. Sem isso o dinheiro apareceria no caixa e
 * sumiria do resultado.
 *
 * A outra regra é a anti-duplicidade (§13.3): em conta que confirma por
 * extrato, a movimentação nasce `pending_confirmation` e é a linha do banco
 * que a confirma depois — nunca um segundo registro.
 */

type Corpo = {
  action?: string;
  /** Nova movimentação. */
  contaId?: string;
  tipo?: "entrada" | "saida";
  categoriaKey?: string;
  descricao?: string;
  data?: string;
  valorCent?: number;
  /** Transferência. */
  deContaId?: string;
  paraContaId?: string;
  tarifaCent?: number;
  /** Conciliação. */
  transactionId?: string;
  parcelaIds?: string[];
  encargosCent?: number;
  /** Menor que o saldo: parcial (false) ou desconto com quitação (true). */
  quitar?: boolean;
  motivo?: string;
  lembrar?: boolean;
  contraparte?: string;
};

type Linha = Record<string, unknown>;
const cent = (v: unknown) => Math.round(Number(v) || 0);
const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return erro("não autorizado", 401);
  if (user.readOnly) return erro("acesso somente leitura", 403);
  if (!isSupabaseConfigured()) return erro("banco não configurado", 503);

  let b: Corpo;
  try {
    b = (await req.json()) as Corpo;
  } catch {
    return erro("JSON inválido");
  }

  const db = await createClient();
  const hoje = hojeSP();
  const acao = String(b.action ?? "");

  await logFromUser(user, {
    action: acao, area: "Financeiro · caixa",
    target: b.transactionId ?? b.contaId ?? null,
  });

  switch (acao) {
    case "movimentacao": return novaMovimentacao(db, user, b, hoje);
    case "transferencia": return novaTransferencia(db, user, b, hoje);
    case "conciliar": return conciliar(db, user, b);
    case "classificar": return classificar(db, user, b);
    case "ignorar": return ignorar(db, user, b);
    case "reativar": return reativar(db, b);
    case "desfazer": return desfazer(db, b);
    default: return erro("ação desconhecida");
  }
}

/* ── Título liquidado nos bastidores (§13.4) ───────────────────────────── */

/**
 * Cria título + item + parcela + baixa, tudo já liquidado.
 *
 * É o que faz um lançamento nascido no Caixa aparecer na DRE pela categoria.
 * Devolve o id da baixa, que é por onde a movimentação se liga a ele.
 */
async function criarTituloLiquidado(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  input: {
    direcao: "in" | "out";
    descricao: string;
    dataIso: string;
    valorCent: number;
    categoriaKey: string | null;
    contaId: string | null;
    origem: string;
  },
): Promise<{ baixaId: string; parcelaId: string } | { erro: string }> {
  const { data: doc, error: eDoc } = await db.from("documents").insert({
    direction: input.direcao,
    description: input.descricao,
    issue_date: input.dataIso,
    total_cents: input.valorCent,
    origin: input.origem,
    created_by: user.name || user.email,
  }).select("id").maybeSingle();
  if (eDoc || !doc) return { erro: eDoc?.message ?? "não foi possível criar o título" };

  const docId = String((doc as Linha).id);
  await db.from("document_items").insert({
    document_id: docId,
    amount_cents: input.valorCent,
    category_key: input.categoriaKey,
    description: input.descricao,
  });

  const { data: parcela, error: eParcela } = await db.from("installments").insert({
    document_id: docId,
    due_date: input.dataIso,
    competence_month: `${input.dataIso.slice(0, 7)}-01`,
    amount_cents: input.valorCent,
    // Nasce com o saldo cheio e é o GATILHO que o zera quando a baixa entra,
    // logo abaixo. Escrever zero aqui seria a rota decidindo um saldo que a
    // invariante §23.4 reserva ao banco.
    open_balance_cents: input.valorCent,
    status: "open",
    expected_account_id: input.contaId,
  }).select("id").maybeSingle();
  if (eParcela || !parcela) return { erro: eParcela?.message ?? "não foi possível criar a parcela" };

  const parcelaId = String((parcela as Linha).id);
  const { data: baixa, error: eBaixa } = await db.from("settlements").insert({
    installment_id: parcelaId,
    date: input.dataIso,
    principal_cents: input.valorCent,
    financial_account_id: input.contaId,
    origin: "manual",
    created_by: user.name || user.email,
  }).select("id").maybeSingle();
  if (eBaixa || !baixa) return { erro: eBaixa?.message ?? "não foi possível criar a baixa" };

  return { baixaId: String((baixa as Linha).id), parcelaId };
}

/** A conta confirma por extrato? Decide se a movimentação nasce pendente. */
async function contaExigeExtrato(
  db: Awaited<ReturnType<typeof createClient>>,
  contaId: string,
): Promise<{ exige: boolean; nome: string }> {
  const { data } = await db.from("financial_accounts")
    .select("name, requires_statement_confirmation").eq("id", contaId).maybeSingle();
  const c = (data ?? {}) as Linha;
  return {
    exige: c.requires_statement_confirmation !== false,
    nome: String(c.name ?? "conta"),
  };
}

/* ── Nova movimentação (§11.1) ─────────────────────────────────────────── */

async function novaMovimentacao(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  b: Corpo,
  hoje: string,
) {
  const contaId = String(b.contaId ?? "").trim();
  if (!contaId) return erro("Escolha a conta.");
  const valor = Math.abs(cent(b.valorCent));
  if (valor <= 0) return erro("Informe um valor maior que zero.");
  const data = String(b.data ?? hoje);
  if (data > hoje) return erro("A data não pode ser no futuro.");

  const trava = bloqueioPorFechamento(data, await periodoFechadoAte(db));
  if (trava) return erro(trava, 409);

  const entrada = b.tipo === "entrada";
  const descricao = String(b.descricao ?? "").trim() ||
    (entrada ? "Entrada lançada no Caixa" : "Saída lançada no Caixa");

  const titulo = await criarTituloLiquidado(db, user, {
    direcao: entrada ? "in" : "out",
    descricao, dataIso: data, valorCent: valor,
    categoriaKey: b.categoriaKey?.trim() || null,
    contaId, origem: "manual",
  });
  if ("erro" in titulo) return erro(titulo.erro, 500);

  const { exige, nome } = await contaExigeExtrato(db, contaId);
  const { data: mov } = await db.from("transactions").insert({
    financial_account_id: contaId,
    date: data,
    amount_cents: entrada ? valor : -valor,
    description_raw: descricao,
    description_clean: descricao,
    origin: "manual",
    confirmation_status: exige ? "pending_confirmation" : "confirmed",
    fingerprint: impressaoDigital({
      contaId, dataIso: data, valorCent: entrada ? valor : -valor, descricaoRaw: descricao,
    }),
  }).select("id").maybeSingle();

  if (mov) {
    await db.from("reconciliation_links").insert({
      transaction_id: String((mov as Linha).id),
      settlement_id: titulo.baixaId,
      amount_cents: valor,
      method: "manual",
      created_by: user.name || user.email,
    });
    await db.from("transactions")
      .update({ reconciliation_status: "reconciled" })
      .eq("id", String((mov as Linha).id));
  }

  return NextResponse.json({
    ok: true,
    mensagem: `Movimentação registrada em ${nome}.` +
      (exige ? " Aguardando a linha do extrato para confirmar." : ""),
  });
}

/* ── Nova transferência (§11.2) ────────────────────────────────────────── */

async function novaTransferencia(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  b: Corpo,
  hoje: string,
) {
  const de = String(b.deContaId ?? "").trim();
  const para = String(b.paraContaId ?? "").trim();
  if (!de || !para) return erro("Escolha as duas contas.");
  if (de === para) return erro("As contas precisam ser diferentes.");
  const valor = Math.abs(cent(b.valorCent));
  if (valor <= 0) return erro("Informe um valor maior que zero.");
  const data = String(b.data ?? hoje);
  if (data > hoje) return erro("A data não pode ser no futuro.");

  const trava = bloqueioPorFechamento(data, await periodoFechadoAte(db));
  if (trava) return erro(trava, 409);

  const [origem, destino] = await Promise.all([
    contaExigeExtrato(db, de), contaExigeExtrato(db, para),
  ]);
  const descricao = `Transferência ${origem.nome} → ${destino.nome}`;

  // Os dois lados, cada um na sua conta. Sem o par, a transferência viraria
  // despesa numa conta e receita na outra para quem olhasse só um lado.
  const nascer = (contaId: string, sinal: 1 | -1, exige: boolean) => ({
    financial_account_id: contaId,
    date: data,
    amount_cents: sinal * valor,
    description_raw: descricao,
    description_clean: descricao,
    origin: "manual",
    confirmation_status: exige ? "pending_confirmation" : "confirmed",
    // Transferência não é receita nem despesa: nasce conciliada, porque o que
    // a explica é o par, não um título.
    reconciliation_status: "reconciled",
    fingerprint: impressaoDigital({
      contaId, dataIso: data, valorCent: sinal * valor, descricaoRaw: descricao,
    }),
  });

  const { data: saida } = await db.from("transactions")
    .insert(nascer(de, -1, origem.exige)).select("id").maybeSingle();
  const { data: entrada } = await db.from("transactions")
    .insert(nascer(para, 1, destino.exige)).select("id").maybeSingle();

  let tarifaId: string | null = null;
  const tarifa = Math.abs(cent(b.tarifaCent));
  if (tarifa > 0) {
    // A tarifa é movimentação própria na origem, e vira resultado financeiro:
    // embutida na transferência, ela sumiria da DRE.
    const titulo = await criarTituloLiquidado(db, user, {
      direcao: "out", descricao: "Tarifa de transferência", dataIso: data,
      valorCent: tarifa, categoriaKey: null, contaId: de, origem: "manual",
    });
    const { data: movTarifa } = await db.from("transactions").insert({
      financial_account_id: de, date: data, amount_cents: -tarifa,
      description_raw: "Tarifa de transferência",
      description_clean: "Tarifa de transferência",
      origin: "manual",
      confirmation_status: origem.exige ? "pending_confirmation" : "confirmed",
      reconciliation_status: "reconciled",
    }).select("id").maybeSingle();
    if (movTarifa && !("erro" in titulo)) {
      tarifaId = String((movTarifa as Linha).id);
      await db.from("reconciliation_links").insert({
        transaction_id: tarifaId, settlement_id: titulo.baixaId,
        amount_cents: tarifa, method: "manual", created_by: user.name || user.email,
      });
    }
  }

  const { error } = await db.from("transfers").insert({
    from_account_id: de, to_account_id: para, date: data, amount_cents: valor,
    from_transaction_id: saida ? String((saida as Linha).id) : null,
    to_transaction_id: entrada ? String((entrada as Linha).id) : null,
    fee_transaction_id: tarifaId,
    created_by: user.name || user.email,
  });
  if (error) return erro(error.message, 500);

  return NextResponse.json({
    ok: true,
    mensagem: `${descricao} registrada. Sem impacto no resultado.`,
  });
}

/* ── Conciliar (§8.6) ──────────────────────────────────────────────────── */

async function conciliar(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  b: Corpo,
) {
  const movId = String(b.transactionId ?? "").trim();
  const parcelaIds = (b.parcelaIds ?? []).filter(Boolean);
  if (!movId) return erro("movimentação ausente");
  if (!parcelaIds.length) return erro("Escolha ao menos uma parcela.");

  const { data: mov } = await db.from("transactions")
    .select("id, date, amount_cents, financial_account_id, reconciliation_status")
    .eq("id", movId).maybeSingle();
  if (!mov) return erro("movimentação não encontrada", 404);
  if (String((mov as Linha).reconciliation_status) === "reconciled") {
    return erro("Esta movimentação já está conciliada.");
  }

  const m = mov as Linha;
  const valor = Math.abs(cent(m.amount_cents));
  const dataMov = String(m.date);
  const contaId = m.financial_account_id ? String(m.financial_account_id) : null;

  const { data: parcelas } = await db.from("installments")
    .select("id, due_date, amount_cents, open_balance_cents, status")
    .in("id", parcelaIds);
  const lista = ((parcelas ?? []) as Linha[]);
  if (!lista.length) return erro("parcelas não encontradas", 404);

  const trava = bloqueioPorFechamento(dataMov, await periodoFechadoAte(db));
  if (trava) return erro(trava, 409);

  const encargos = Math.max(0, cent(b.encargosCent));
  const paraPrincipal = Math.max(0, valor - encargos);
  const saldoTotal = lista.reduce((s, p) => s + cent(p.open_balance_cents), 0);

  // Reparte entre as parcelas na ordem do vencimento: a mais antiga primeiro,
  // que é como qualquer credor imputa um pagamento.
  const ordenadas = [...lista].sort((a, b2) => String(a.due_date).localeCompare(String(b2.due_date)));
  let restante = paraPrincipal;
  const baixas: string[] = [];

  for (const [i, p] of ordenadas.entries()) {
    const saldo = cent(p.open_balance_cents);
    const ultima = i === ordenadas.length - 1;
    // Na última, "quitar" fecha a parcela com desconto; senão paga o que
    // sobrou. O principal é sempre o saldo cheio quando quita: só ele abate.
    const principal = ultima && b.quitar && restante < saldo ? saldo : Math.min(saldo, restante);
    const desconto = ultima && b.quitar && restante < saldo ? saldo - restante : 0;
    restante -= principal - desconto;

    const { data: baixa } = await db.from("settlements").insert({
      installment_id: String(p.id),
      date: dataMov,
      principal_cents: principal,
      discount_cents: desconto,
      // Os encargos vão na primeira parcela: eles são do atraso dela.
      interest_cents: i === 0 ? encargos : 0,
      financial_account_id: contaId,
      origin: "manual",
      created_by: user.name || user.email,
    }).select("id").maybeSingle();
    if (baixa) baixas.push(String((baixa as Linha).id));
  }

  for (const baixaId of baixas) {
    await db.from("reconciliation_links").insert({
      transaction_id: movId, settlement_id: baixaId,
      amount_cents: Math.round(paraPrincipal / Math.max(1, baixas.length)),
      method: baixas.length > 1 ? "bulk" : "suggested",
      created_by: user.name || user.email,
    });
  }

  await db.from("transactions").update({
    reconciliation_status: "reconciled",
    confirmation_status: "confirmed",
  }).eq("id", movId);

  const sobra = saldoTotal - paraPrincipal;
  return NextResponse.json({
    ok: true,
    mensagem: `Conciliado: ${baixas.length} ${baixas.length === 1 ? "baixa" : "baixas"}.` +
      (encargos > 0 ? ` ${(encargos / 100).toFixed(2)} de encargos.` : "") +
      (sobra > 0 && !b.quitar ? " O saldo restante segue em aberto." : ""),
  });
}

/* ── Classificar o que não tem parcela (§8.4) ──────────────────────────── */

async function classificar(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  b: Corpo,
) {
  const movId = String(b.transactionId ?? "").trim();
  if (!movId) return erro("movimentação ausente");
  const categoria = String(b.categoriaKey ?? "").trim();
  if (!categoria) return erro("Escolha a categoria.");

  const { data: mov } = await db.from("transactions")
    .select("id, date, amount_cents, financial_account_id, description_raw, counterparty_document")
    .eq("id", movId).maybeSingle();
  if (!mov) return erro("movimentação não encontrada", 404);
  const m = mov as Linha;

  const trava = bloqueioPorFechamento(String(m.date), await periodoFechadoAte(db));
  if (trava) return erro(trava, 409);

  const valor = cent(m.amount_cents);
  const entrada = valor > 0;
  const contraparte = String(b.contraparte ?? "").trim();
  const descricao = contraparte ||
    interpretarDescricao(String(m.description_raw ?? ""), valor).texto;

  const titulo = await criarTituloLiquidado(db, user, {
    direcao: entrada ? "in" : "out",
    descricao, dataIso: String(m.date), valorCent: Math.abs(valor),
    categoriaKey: categoria,
    contaId: m.financial_account_id ? String(m.financial_account_id) : null,
    origem: "reconciliation",
  });
  if ("erro" in titulo) return erro(titulo.erro, 500);

  await db.from("reconciliation_links").insert({
    transaction_id: movId, settlement_id: titulo.baixaId,
    amount_cents: Math.abs(valor), method: "manual",
    created_by: user.name || user.email,
  });
  await db.from("transactions").update({
    reconciliation_status: "reconciled", confirmation_status: "confirmed",
  }).eq("id", movId);

  // "Lembrar para as próximas" é o que transforma classificação em regra: a
  // segunda vez que o mesmo texto aparecer, ele já vem sugerido.
  if (b.lembrar) {
    const texto = String(m.description_raw ?? "").toUpperCase().slice(0, 40).trim();
    if (texto) {
      await db.from("categorization_rules").insert({
        match_text: texto,
        match_type: m.counterparty_document ? "document" : "text_contains",
        category_key: categoria,
        account_id: m.financial_account_id ?? null,
        created_from_transaction_id: movId,
        hits: 1,
        active: true,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    mensagem: `Classificado como ${categoria}.` + (b.lembrar ? " Regra criada para as próximas." : ""),
  });
}

/* ── Ignorar, reativar e desfazer (§12) ────────────────────────────────── */

async function ignorar(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  b: Corpo,
) {
  const movId = String(b.transactionId ?? "").trim();
  if (!movId) return erro("movimentação ausente");
  const motivo = String(b.motivo ?? "").trim();
  // Motivo obrigatório: movimentação ignorada sai do saldo, e sem o porquê
  // ninguém consegue auditar um saldo que não bate depois.
  if (!motivo) return erro("Informe o motivo para ignorar.");

  const { error } = await db.from("transactions").update({
    ignored_reason: motivo,
    ignored_by: user.name || user.email,
    ignored_at: new Date().toISOString(),
    reconciliation_status: "ignored",
  }).eq("id", movId);
  if (error) return erro(error.message, 500);
  return (revalidateTag("financeiro", { expire: 0 }), NextResponse.json({ ok: true, mensagem: "Movimentação ignorada. Ela sai do saldo." }));
}

async function reativar(db: Awaited<ReturnType<typeof createClient>>, b: Corpo) {
  const movId = String(b.transactionId ?? "").trim();
  if (!movId) return erro("movimentação ausente");
  const { error } = await db.from("transactions").update({
    ignored_reason: null, ignored_by: null, ignored_at: null,
    reconciliation_status: "unreconciled",
  }).eq("id", movId);
  if (error) return erro(error.message, 500);
  return (revalidateTag("financeiro", { expire: 0 }), NextResponse.json({ ok: true, mensagem: "Movimentação reativada e de volta à fila." }));
}

async function desfazer(db: Awaited<ReturnType<typeof createClient>>, b: Corpo) {
  const movId = String(b.transactionId ?? "").trim();
  if (!movId) return erro("movimentação ausente");

  const { data: links } = await db.from("reconciliation_links")
    .select("id, settlement_id").eq("transaction_id", movId);
  const lista = ((links ?? []) as Linha[]);

  // As baixas criadas pela conciliação voltam atrás junto: deixá-las de pé
  // manteria a parcela quitada sem nada explicando o dinheiro.
  for (const l of lista) {
    await db.from("settlements").delete().eq("id", String(l.settlement_id));
  }
  await db.from("reconciliation_links").delete().eq("transaction_id", movId);
  await db.from("transactions")
    .update({ reconciliation_status: "unreconciled" })
    .eq("id", movId);

  return NextResponse.json({
    ok: true,
    mensagem: `Conciliação desfeita. ${lista.length} ${lista.length === 1 ? "baixa estornada" : "baixas estornadas"}.`,
  });
}
