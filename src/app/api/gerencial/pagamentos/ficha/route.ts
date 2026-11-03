import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { podeAprovar } from "@/lib/data/approval";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";
import { brlCheio, ddmm, diasEntre, hojeSP } from "@/lib/data/dashboard-financeiro";
import {
  chipDeSituacao, favorecidoDivergente, linhaDePagamento, rotuloDaSituacao,
  SITUACAO_TOM, type StatusAprovacao, type StatusParcela, type StatusValor,
} from "@/lib/data/pagamentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ficha da conta a pagar (spec §7).
 *
 * É a ficha universal do documento-mãe (§22), invocada por `installment_id`.
 * Tudo que ela mostra sai do núcleo — itens com as dimensões, baixas com
 * encargos, anexos e o histórico montado a partir das datas gravadas.
 */

type Linha = Record<string, unknown>;

const texto = (...v: unknown[]) => {
  for (const x of v) { const t = String(x ?? "").trim(); if (t) return t; }
  return "";
};

const MESES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export type FichaPagamento = {
  id: string;
  documentId: string;
  fornecedor: string;
  descricao: string;
  valorCent: number;
  saldoCent: number;
  estimada: boolean;
  estimadoOriginalCent: number | null;
  situacaoLabel: string;
  situacaoTom: string;
  linhaPagamento: { texto: string; tom: string };
  origem: string;
  vencimento: string;
  competencia: string;
  parcela: string;
  programadaPara: string | null;
  contaPrevista: string | null;
  favorecidoDivergente: boolean;
  dadosPagamento: { rotulo: string; valor: string }[];
  itens: { categoria: string; dimensoes: string; valor: string }[];
  baixas: { data: string; valor: string; encargos: string | null; conta: string | null }[];
  documentos: { kind: string; rotulo: string; anexado: boolean; obrigatorio: boolean }[];
  historico: { quando: string; texto: string }[];
  /** Decisões já tomadas no servidor: a tela não recalcula permissão. */
  podePagar: boolean;
  bloqueioPagar: string | null;
  podeAprovar: boolean;
  aguardandoAprovacao: boolean;
  acaoPrincipal: "pagar" | "informar-valor";
  contas: { id: string; nome: string }[];
  exigeNota: boolean;
  temNota: boolean;
};

export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "banco não configurado" }, { status: 503 });
  }
  const id = String(new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  const db = await createClient();
  const hoje = hojeSP();

  const { data, error } = await db
    .from("installments")
    .select(
      "id, document_id, number, total_number, due_date, competence_month, amount_cents, " +
      "open_balance_cents, status, approval_status, scheduled_payment_date, amount_status, " +
      "estimated_amount_cents, payment_details, cancelled_reason, created_at, " +
      "doc:documents!installments_document_id_fkey(id, description, origin, recurrence_id, " +
      "invoice_number, created_at, party:parties!documents_party_id_fkey(id, name, document, payment_method, pix_key))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "parcela não encontrada" }, { status: 404 });

  // O parser de tipos do supabase-js não resolve o embed com FK nomeada, e
  // devolve um tipo de erro no lugar do objeto. A leitura é feita à mão logo
  // abaixo, campo a campo.
  const p = data as unknown as Linha;
  const doc = (Array.isArray(p.doc) ? p.doc[0] : p.doc) as Linha | undefined;
  const party = doc ? (Array.isArray(doc.party) ? doc.party[0] : doc.party) as Linha | undefined : undefined;

  const [itensRes, baixasRes, anexosRes, contasRes, catsRes, fechadoAte] = await Promise.all([
    db.from("document_items")
      .select("amount_cents, category_key, description, clients(name), cost_centers(name)")
      .eq("document_id", String(p.document_id)),
    db.from("settlements")
      .select("date, principal_cents, interest_cents, fine_cents, discount_cents, financial_account_id, reversed_at")
      .eq("installment_id", id).order("date", { ascending: false }),
    db.from("attachments").select("kind").eq("installment_id", id),
    db.from("financial_accounts").select("id, name").eq("active", true).order("position"),
    db.from("expense_categories").select("key, label, requires_invoice, requires_receipt"),
    periodoFechadoAte(db),
  ]);

  const catDe = new Map(
    ((catsRes.data ?? []) as Linha[]).map((c) => [String(c.key), c]),
  );
  const contas = ((contasRes.data ?? []) as Linha[]).map((c) => ({
    id: String(c.id), nome: String(c.name ?? "Conta"),
  }));
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));

  const itens = (itensRes.data ?? []) as Linha[];
  const baixas = ((baixasRes.data ?? []) as Linha[]).filter((s) => !s.reversed_at);
  const anexos = new Set(((anexosRes.data ?? []) as Linha[]).map((a) => String(a.kind)));

  const catPrincipal = itens[0]?.category_key ? String(itens[0].category_key) : "";
  const cat = catDe.get(catPrincipal);
  const exigeNota = Boolean(cat?.requires_invoice);
  const temNota = anexos.has("invoice_nf");

  const status = String(p.status ?? "open") as StatusParcela;
  const paga = status === "settled";
  const estimada = String(p.amount_status ?? "confirmed") === "estimated";
  const aprovacao = String(p.approval_status ?? "not_required") as StatusAprovacao;
  const vencimentoIso = String(p.due_date ?? hoje);
  const saldoCent = Math.round(Number(p.open_balance_cents) || 0);
  const detalhes = (p.payment_details ?? null) as {
    method?: string | null; barcode?: string | null; pixKey?: string | null;
    payeeName?: string | null; payeeDocument?: string | null;
    bank?: string | null; branch?: string | null; account?: string | null;
  } | null;

  const paraChip = {
    status, dueDateIso: vencimentoIso, saldoCent, aprovacao,
    valorStatus: String(p.amount_status ?? "confirmed") as StatusValor,
    programadaParaIso: p.scheduled_payment_date ? String(p.scheduled_payment_date) : null,
  };
  const situacao = chipDeSituacao(paraChip, hoje);

  const divergente = favorecidoDivergente(
    detalhes ? { nome: detalhes.payeeName, documento: detalhes.payeeDocument } : null,
    { nome: texto(party?.name, ""), documento: party?.document as string | undefined },
  );

  // Trava mais forte por último: período fechado bloqueia qualquer escrita.
  const travaFechamento = bloqueioPorFechamento(vencimentoIso, fechadoAte);
  const bloqueio = paga
    ? "Esta conta já foi paga."
    : aprovacao === "pending"
      ? "Aguardando aprovação — um gestor precisa liberar antes do pagamento."
      : estimada
        ? "Informe o valor real antes de pagar: a conta ainda está estimada."
        : travaFechamento;

  const historico: { quando: string; texto: string }[] = [];
  if (doc?.created_at) {
    historico.push({
      quando: ddmm(String(doc.created_at).slice(0, 10)),
      texto: doc.recurrence_id ? "Gerada pela recorrência" : "Lançada no painel",
    });
  }
  for (const s of baixas) {
    historico.push({
      quando: ddmm(String(s.date)),
      texto: `Pagamento de ${brlCheio(Math.round(Number(s.principal_cents) || 0))}`,
    });
  }
  historico.sort((a, b) => b.quando.localeCompare(a.quando));

  const dados: { rotulo: string; valor: string }[] = [];
  if (detalhes?.barcode) dados.push({ rotulo: "Linha digitável", valor: detalhes.barcode });
  if (detalhes?.pixKey) dados.push({ rotulo: "Chave PIX", valor: detalhes.pixKey });
  if (detalhes?.payeeName) dados.push({ rotulo: "Favorecido", valor: detalhes.payeeName });
  if (detalhes?.bank) {
    dados.push({
      rotulo: "Conta bancária",
      valor: [detalhes.bank, detalhes.branch, detalhes.account].filter(Boolean).join(" · "),
    });
  }

  const total = Number(p.total_number ?? 1);
  const compIso = String(p.competence_month ?? vencimentoIso);

  const ficha: FichaPagamento = {
    id: String(p.id),
    documentId: String(p.document_id),
    fornecedor: texto(party?.name, "Não informado"),
    descricao: texto(doc?.description, "Despesa"),
    valorCent: Math.round(Number(p.amount_cents) || 0),
    saldoCent,
    estimada,
    estimadoOriginalCent: p.estimated_amount_cents
      ? Math.round(Number(p.estimated_amount_cents))
      : null,
    situacaoLabel: rotuloDaSituacao(situacao, paraChip, hoje),
    situacaoTom: SITUACAO_TOM[situacao],
    linhaPagamento: linhaDePagamento({
      detalhes, debitoAutomatico: String(detalhes?.method ?? "") === "debito_automatico",
      estimada, paga, temComprovante: anexos.has("receipt"),
      exigeNota, temNota, favorecidoDivergente: divergente,
    }),
    origem: doc?.recurrence_id
      ? "Gerada por recorrência"
      : String(doc?.origin ?? "manual") === "integration"
        ? "Veio de integração"
        : "Criada manualmente",
    vencimento: ddmm(vencimentoIso),
    competencia: `${MESES[Number(compIso.slice(5, 7))]} de ${compIso.slice(0, 4)}`,
    parcela: total > 1 ? `${Number(p.number ?? 1)} de ${total}` : "Única",
    programadaPara: p.scheduled_payment_date ? ddmm(String(p.scheduled_payment_date)) : null,
    contaPrevista: null,
    favorecidoDivergente: divergente,
    dadosPagamento: dados,
    itens: itens.map((i) => {
      const cliente = (Array.isArray(i.clients) ? i.clients[0] : i.clients) as Linha | undefined;
      const cc = (Array.isArray(i.cost_centers) ? i.cost_centers[0] : i.cost_centers) as Linha | undefined;
      return {
        categoria: texto(catDe.get(String(i.category_key ?? ""))?.label, i.category_key, "Sem categoria"),
        dimensoes: [
          cliente?.name && `Cliente ${cliente.name}`,
          cc?.name && `Centro de custo ${cc.name}`,
        ].filter(Boolean).join(", ") || "Sem dimensões cadastradas",
        valor: brlCheio(Math.round(Number(i.amount_cents) || 0)),
      };
    }),
    baixas: baixas.map((s) => {
      const juros = Math.round(Number(s.interest_cents) || 0);
      const multa = Math.round(Number(s.fine_cents) || 0);
      const desconto = Math.round(Number(s.discount_cents) || 0);
      const extras = [
        juros > 0 && `juros ${brlCheio(juros)}`,
        multa > 0 && `multa ${brlCheio(multa)}`,
        desconto > 0 && `desconto ${brlCheio(desconto)}`,
      ].filter(Boolean).join(", ");
      return {
        data: ddmm(String(s.date)),
        valor: brlCheio(Math.round(Number(s.principal_cents) || 0)),
        encargos: extras || null,
        conta: s.financial_account_id ? nomeConta.get(String(s.financial_account_id)) ?? null : null,
      };
    }),
    documentos: [
      { kind: "boleto", rotulo: "Boleto ou fatura", anexado: anexos.has("boleto"), obrigatorio: false },
      { kind: "invoice_nf", rotulo: "NF do fornecedor", anexado: temNota, obrigatorio: exigeNota },
      { kind: "receipt", rotulo: "Comprovante", anexado: anexos.has("receipt"), obrigatorio: Boolean(cat?.requires_receipt) },
    ],
    historico,
    podePagar: !bloqueio,
    bloqueioPagar: bloqueio,
    podeAprovar: aprovacao === "pending" && podeAprovar(user.tier),
    aguardandoAprovacao: aprovacao === "pending",
    acaoPrincipal: estimada ? "informar-valor" : "pagar",
    contas,
    exigeNota,
    temNota,
  };

  // Vencida: a ficha diz há quanto tempo, porque isso muda o que se digita
  // no pagamento (os encargos são do fornecedor, não calculados aqui).
  if (!paga && vencimentoIso < hoje) {
    const d = diasEntre(vencimentoIso, hoje);
    ficha.origem = `${ficha.origem} · vencida há ${d} ${d === 1 ? "dia" : "dias"}`;
  }

  return NextResponse.json(ficha);
}
