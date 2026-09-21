import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ponte do núcleo transacional para o formato antigo (`payments`/`expenses`).
 *
 * POR QUE ISTO EXISTE, E POR QUANTO TEMPO
 *
 * O Dashboard foi escrito contra `payments` e `expenses` e está verificado
 * funcionando. Quando o núcleo chegou (migração 0149), ficaram DUAS fontes
 * para o mesmo dinheiro: uma baixa feita em Pagamentos não aparecia no
 * Dashboard. Duas fontes divergindo em silêncio é pior que qualquer uma das
 * duas sozinha.
 *
 * Em vez de reescrever mil linhas de lógica já provada, a troca acontece aqui:
 * as consultas passam a ler `installments`, `settlements` e `charges`, e
 * devolvem linhas com as MESMAS chaves de antes. O Dashboard não sabe que a
 * fonte mudou — e é isso que torna a troca segura.
 *
 * **Isto é transitório.** Quando `payments` e `expenses` saírem de vez, o
 * Dashboard deve ler o núcleo direto, e este arquivo some. O sinal de que a
 * hora chegou é este módulo precisar de um campo novo: traduzir shape é
 * aceitável, inventar shape não.
 */

type Linha = Record<string, unknown>;

/** Centavos → reais, exato: o inverso do `Math.round(reais * 100)` do outro lado. */
const paraReais = (cent: unknown) => (Math.round(Number(cent) || 0)) / 100;

const EMBED = "doc:documents!installments_document_id_fkey";

export type JanelaDoNucleo = {
  hoje: string;
  mesIni: string;
  mesFim: string;
  menos90: string;
  mais30: string;
  idsContas: string[];
};

export type LinhasLegadas = {
  saldoEntradas: Linha[];
  saldoSaidas: Linha[];
  recLiquidados: Linha[];
  recAbertos: Linha[];
  recMes: Linha[];
  recVencidos90: Linha[];
  despLiquidadas: Linha[];
  despAbertas: Linha[];
  despMes: Linha[];
};

const RECEBIDO_LEGADO = "RECEIVED";
const ABERTO_LEGADO = "PENDING";
const CANCELADO_LEGADO = "DELETED";

/** Lê o núcleo e devolve tudo no formato que o Dashboard já sabe consumir. */
export async function lerNucleoComoLegado(
  db: SupabaseClient,
  j: JanelaDoNucleo,
): Promise<LinhasLegadas> {
  // O parser de tipos do supabase-js não resolve o embed com FK nomeada e
  // devolve um tipo de erro no lugar das linhas. A leitura é feita campo a
  // campo abaixo, então o `unknown` aqui é a tradução honesta disso.
  const exigir = <T>(
    r: { data: unknown; error: { message: string } | null },
    onde: string,
  ): T => {
    if (r.error) throw new Error(`${onde}: ${r.error.message}`);
    return (r.data ?? []) as T;
  };

  // Uma leitura só das parcelas relevantes, nas duas direções. A janela é
  // generosa de propósito: o backlog vencido não tem mês, e cortá-lo por data
  // esconderia justamente quem está atrasado.
  const parcelas = exigir<Linha[]>(
    await db
      .from("installments")
      .select(
        "id, document_id, due_date, competence_month, amount_cents, open_balance_cents, " +
        `status, approval_status, ${EMBED}!inner(direction, description, client_id, ` +
        "recurrence_id, origin, party:parties!documents_party_id_fkey(name))",
      )
      .lte("due_date", j.mais30),
    "parcelas do núcleo",
  );

  const ids = parcelas.map((p) => String(p.id));
  const docIds = [...new Set(parcelas.map((p) => String(p.document_id)))];

  const [baixas, cobrancas, itens, movimentos] = await Promise.all([
    ids.length
      ? exigir<Linha[]>(
          await db.from("settlements")
            .select("installment_id, date, principal_cents, financial_account_id, reversed_at")
            .in("installment_id", ids.slice(0, 1000)),
          "baixas",
        )
      : [],
    ids.length
      ? exigir<Linha[]>(
          await db.from("charges").select("installment_id, url").in("installment_id", ids.slice(0, 1000)),
          "cobranças",
        )
      : [],
    docIds.length
      ? exigir<Linha[]>(
          await db.from("document_items").select("document_id, category_key")
            .in("document_id", docIds.slice(0, 1000)),
          "itens",
        )
      : [],
    // Para saber se a baixa já foi confirmada no extrato (exceção E8).
    j.idsContas.length
      ? exigir<Linha[]>(
          await db.from("transactions")
            .select("id, financial_account_id, confirmation_status")
            .in("financial_account_id", j.idsContas),
          "movimentações",
        )
      : [],
  ]);

  const confirmadaPorConta = new Map(
    movimentos.map((m) => [String(m.id), String(m.confirmation_status) === "confirmed"]),
  );
  void confirmadaPorConta;

  const baixaPorParcela = new Map<string, Linha[]>();
  for (const b of baixas) {
    if (b.reversed_at) continue;
    const k = String(b.installment_id);
    baixaPorParcela.set(k, [...(baixaPorParcela.get(k) ?? []), b]);
  }
  const urlPorParcela = new Map(cobrancas.map((c) => [String(c.installment_id), c.url]));
  const catPorDoc = new Map<string, string>();
  for (const i of itens) {
    const k = String(i.document_id);
    if (!catPorDoc.has(k) && i.category_key) catPorDoc.set(k, String(i.category_key));
  }

  const vazio: LinhasLegadas = {
    saldoEntradas: [], saldoSaidas: [], recLiquidados: [], recAbertos: [],
    recMes: [], recVencidos90: [], despLiquidadas: [], despAbertas: [], despMes: [],
  };

  for (const p of parcelas) {
    const doc = (Array.isArray(p.doc) ? p.doc[0] : p.doc) as Linha | undefined;
    if (!doc) continue;
    const entrada = String(doc.direction) === "in";
    const party = doc ? (Array.isArray(doc.party) ? doc.party[0] : doc.party) as Linha | undefined : undefined;

    const status = String(p.status ?? "open");
    const liquidada = status === "settled";
    const cancelada = status === "cancelled" || status === "renegotiated";
    const valor = paraReais(p.amount_cents);
    const saldo = paraReais(p.open_balance_cents);
    const venc = String(p.due_date ?? "");
    const comp = String(p.competence_month ?? venc);
    const bs = baixaPorParcela.get(String(p.id)) ?? [];
    const ultima = [...bs].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const dataBaixa = ultima ? String(ultima.date) : null;
    const contaBaixa = ultima?.financial_account_id ? String(ultima.financial_account_id) : null;

    // Só o saldo em aberto é "a receber"/"a pagar"; o já baixado é caixa.
    const comum = {
      id: String(p.id),
      due_date: venc,
      client_id: doc.client_id ?? null,
      description: doc.description ?? null,
      account_id: contaBaixa,
      // A confirmação no extrato ainda não é rastreada por baixa: sem o
      // vínculo, a exceção E8 não dispara — melhor calada que errada.
      reconciled_at: dataBaixa,
    };

    if (entrada) {
      const legadoStatus = cancelada ? CANCELADO_LEGADO : liquidada ? RECEBIDO_LEGADO : ABERTO_LEGADO;
      if (liquidada && contaBaixa) {
        vazio.saldoEntradas.push({ value: valor, status: legadoStatus, account_id: contaBaixa });
      }
      if (dataBaixa && dataBaixa >= j.menos90) {
        vazio.recLiquidados.push({ ...comum, value: valor, payment_date: dataBaixa, status: legadoStatus });
      }
      if (!liquidada && !cancelada) {
        vazio.recAbertos.push({
          ...comum,
          value: saldo,
          status: legadoStatus,
          invoice_url: urlPorParcela.get(String(p.id)) ?? null,
          source: String(doc.origin ?? "manual") === "integration" ? "asaas" : "manual",
          account_id: null,
        });
      }
      if (comp >= j.mesIni && comp <= j.mesFim) {
        vazio.recMes.push({
          value: valor, due_date: venc, status: legadoStatus,
          description: doc.description ?? null, client_id: doc.client_id ?? null,
          // `raw.subscription` era o jeito antigo de saber se era recorrente.
          // Agora a verdade é o vínculo com a recorrência.
          raw: doc.recurrence_id ? { subscription: String(doc.recurrence_id) } : null,
        });
      }
      if (venc >= j.menos90 && venc < j.hoje) {
        vazio.recVencidos90.push({ value: valor, status: legadoStatus });
      }
    } else {
      const legadoStatus = liquidada ? "paid" : "pending";
      if (liquidada && contaBaixa) {
        vazio.saldoSaidas.push({ amount: valor, status: "paid", account_id: contaBaixa });
      }
      if (dataBaixa && dataBaixa >= j.menos90) {
        vazio.despLiquidadas.push({ ...comum, amount: valor, paid_date: dataBaixa, status: legadoStatus,
          vendor: party?.name ?? null });
      }
      if (!liquidada && !cancelada) {
        vazio.despAbertas.push({
          ...comum,
          amount: saldo,
          status: legadoStatus,
          vendor: party?.name ?? null,
          account_id: null,
          approval_status: String(p.approval_status ?? "not_required") === "pending" ? "pending" : "approved",
        });
      }
      if (comp >= j.mesIni && comp <= j.mesFim) {
        vazio.despMes.push({
          amount: valor, due_date: venc, status: legadoStatus,
          category: catPorDoc.get(String(p.document_id)) ?? null,
        });
      }
    }
  }

  return vazio;
}
