import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { bloqueioDePagamento, podeAprovar } from "@/lib/data/approval";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";
import { calcularEncargos, descreverEncargos } from "@/lib/data/late-fees";
import { getRegrasFinanceiras } from "@/lib/data/finance-guards-server";
import { brlCheio, ddmm, hojeSP } from "@/lib/data/dashboard-financeiro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ficha universal de uma parcela (spec §10.1).
 *
 * É o mesmo componente em todo o Financeiro, invocado por id + direção. Tudo
 * o que ela mostra sai de coluna que existe: o histórico é derivado das datas
 * gravadas na própria linha (criada, aprovada, baixada, conciliada), não de um
 * log por parcela — que este modelo ainda não tem. Histórico inventado numa
 * ficha financeira é pior que histórico ausente.
 */

type Linha = Record<string, unknown>;

const texto = (...v: unknown[]) => {
  for (const x of v) {
    const t = String(x ?? "").trim();
    if (t) return t;
  }
  return "";
};

const MESES = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const competencia = (iso: string) =>
  iso ? `${MESES[Number(iso.slice(5, 7))]} de ${iso.slice(0, 4)}` : "—";

const RECEBIDO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);

export type FichaItem = { categoria: string; dimensoes: string; valor: string };
export type FichaEvento = { quando: string; texto: string };

export type Ficha = {
  id: string;
  direcao: "in" | "out";
  tipo: string;
  pessoa: string;
  descricao: string;
  valorCent: number;
  valorLabel: string;
  /** Selo do estado armazenado (Aberta / Liquidada) + o derivado. */
  selos: { label: string; tom: "ok" | "atencao" | "neutro" | "info" }[];
  origem: string;
  vencimento: string;
  competencia: string;
  parcela: string;
  conta: string;
  contaId: string | null;
  itens: FichaItem[];
  cobranca: { texto: string; link: string | null } | null;
  historico: FichaEvento[];
  /** Ações do rodapé, já decididas no servidor. */
  podeBaixar: boolean;
  bloqueioBaixa: string | null;
  podeAprovar: boolean;
  aguardandoAprovacao: boolean;
  acaoPrincipal: string;
  /** Encargos que as regras configuradas implicam, se estiver em atraso. */
  encargos: string | null;
  contas: { id: string; nome: string }[];
};

export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "banco não configurado" }, { status: 503 });
  }

  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") ?? "").trim();
  const direcao = String(url.searchParams.get("direcao") ?? "");
  if (!id || (direcao !== "in" && direcao !== "out")) {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }

  const db = await createClient();
  const hoje = hojeSP();
  const [fechadoAte, regras, contasRes] = await Promise.all([
    periodoFechadoAte(db),
    getRegrasFinanceiras(db),
    db.from("financial_accounts").select("id, name").eq("active", true).order("position"),
  ]);
  const contas = ((contasRes.data ?? []) as Linha[]).map((c) => ({
    id: String(c.id), nome: String(c.name ?? "Conta"),
  }));
  const nomeDaConta = new Map(contas.map((c) => [c.id, c.nome]));

  const ficha = direcao === "in"
    ? await fichaDeEntrada(db, id, hoje, contas, nomeDaConta, regras)
    : await fichaDeSaida(db, id, hoje, contas, nomeDaConta, regras, podeAprovar(user.tier));
  if (!ficha) return NextResponse.json({ error: "lançamento não encontrado" }, { status: 404 });

  // Período fechado vale para os dois lados e vem depois: é a trava mais forte.
  const travaFechamento = bloqueioPorFechamento(ficha.vencimentoIso, fechadoAte);
  if (travaFechamento) {
    ficha.dados.podeBaixar = false;
    ficha.dados.bloqueioBaixa = travaFechamento;
  }
  return NextResponse.json(ficha.dados);
}

/* ── Entrada (payments) ────────────────────────────────────────────────── */

async function fichaDeEntrada(
  db: Awaited<ReturnType<typeof createClient>>,
  id: string,
  hoje: string,
  contas: { id: string; nome: string }[],
  nomeDaConta: Map<string, string>,
  regras: Awaited<ReturnType<typeof getRegrasFinanceiras>>,
) {
  const { data } = await db
    .from("payments")
    .select("id, value, due_date, payment_date, status, description, client_id, account_id, invoice_url, billing_type, source, reconciled_at, created_at, raw")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as Linha;

  let cliente = "";
  if (r.client_id) {
    const c = await db.from("clients").select("name").eq("id", String(r.client_id)).maybeSingle();
    cliente = texto((c.data as Linha | null)?.name);
  }

  const status = String(r.status ?? "");
  const liquidada = RECEBIDO.has(status);
  const vencimentoIso = String(r.due_date ?? "");
  const valorCent = Math.round((Number(r.value) || 0) * 100);
  const doAsaas = String(r.source ?? "asaas") === "asaas";
  const assinatura = Boolean((r.raw as { subscription?: string } | null)?.subscription);

  const selos: Ficha["selos"] = [
    { label: liquidada ? "Liquidada" : "Aberta", tom: liquidada ? "ok" : "neutro" },
  ];
  if (!liquidada && vencimentoIso && vencimentoIso < hoje) {
    selos.push({ label: "Vencida", tom: "atencao" });
  }
  selos.push({
    label: r.invoice_url ? "Cobrança enviada" : "Sem cobrança",
    tom: r.invoice_url ? "ok" : "atencao",
  });

  const historico: FichaEvento[] = [];
  if (r.created_at) historico.push({ quando: ddmm(String(r.created_at).slice(0, 10)), texto: doAsaas ? "Cobrança criada no Asaas" : "Lançado manualmente no painel" });
  if (r.payment_date) historico.push({ quando: ddmm(String(r.payment_date)), texto: "Recebimento registrado" });
  if (r.reconciled_at) historico.push({ quando: ddmm(String(r.reconciled_at).slice(0, 10)), texto: "Confirmado no extrato" });
  historico.sort((a, b) => b.quando.localeCompare(a.quando));

  const dados: Ficha = {
    id: String(r.id), direcao: "in", tipo: "Conta a receber",
    pessoa: texto(cliente, r.description, "Cliente"),
    descricao: texto(r.description, "Recebimento"),
    valorCent, valorLabel: `+ ${brlCheio(valorCent)}`,
    selos,
    origem: doAsaas
      ? assinatura ? "Cobrança gerada por assinatura no Asaas" : "Cobrança avulsa criada no Asaas"
      : "Lançado manualmente no painel",
    vencimento: vencimentoIso ? ddmm(vencimentoIso) : "—",
    competencia: competencia(vencimentoIso),
    // O modelo atual não guarda parcela n de N em recebíveis.
    parcela: "Única",
    conta: nomeDaConta.get(String(r.account_id ?? "")) ?? "Não definida",
    contaId: r.account_id ? String(r.account_id) : null,
    itens: [{
      categoria: "Receita de clientes",
      dimensoes: [cliente && `Cliente ${cliente}`, r.billing_type && `Forma ${r.billing_type}`]
        .filter(Boolean).join(", ") || "Sem dimensões cadastradas",
      valor: brlCheio(valorCent),
    }],
    cobranca: r.invoice_url
      ? {
          texto: `${texto(r.billing_type, "Cobrança")} via Asaas.${r.payment_date ? ` Paga em ${ddmm(String(r.payment_date))}.` : ""}`,
          link: String(r.invoice_url),
        }
      : null,
    historico,
    // A API de recebíveis recusa editar cobrança do Asaas — quem manda no
    // status dela é o gateway. A ficha diz isso em vez de oferecer um botão
    // que devolve erro.
    podeBaixar: !liquidada && !doAsaas,
    bloqueioBaixa: liquidada
      ? "Esta parcela já foi recebida."
      : doAsaas
        ? "Cobrança do Asaas: a baixa vem do gateway, pelo webhook."
        : null,
    podeAprovar: false,
    aguardandoAprovacao: false,
    acaoPrincipal: "Registrar recebimento",
    encargos: encargosDe(vencimentoIso, valorCent, hoje, regras, liquidada),
    contas,
  };
  return { dados, vencimentoIso };
}

/* ── Saída (expenses) ──────────────────────────────────────────────────── */

async function fichaDeSaida(
  db: Awaited<ReturnType<typeof createClient>>,
  id: string,
  hoje: string,
  contas: { id: string; nome: string }[],
  nomeDaConta: Map<string, string>,
  regras: Awaited<ReturnType<typeof getRegrasFinanceiras>>,
  usuarioPodeAprovar: boolean,
) {
  const { data } = await db
    .from("expenses")
    .select("id, description, amount, due_date, paid_date, status, category, vendor, client_id, account_id, series_id, installment, installments_total, recurring, approval_status, approved_by, approved_at, approval_note, reconciled_at, invoice_number, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as Linha;

  const [catRes, cliRes] = await Promise.all([
    db.from("expense_categories").select("label").eq("key", String(r.category ?? "")).maybeSingle(),
    r.client_id
      ? db.from("clients").select("name").eq("id", String(r.client_id)).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const paga = r.status === "paid";
  const vencimentoIso = String(r.due_date ?? "");
  const valorCent = Math.round((Number(r.amount) || 0) * 100);
  const aprovacao = String(r.approval_status ?? "approved");
  const aguardando = aprovacao === "pending";

  const selos: Ficha["selos"] = [
    { label: paga ? "Liquidada" : "Aberta", tom: paga ? "ok" : "neutro" },
  ];
  if (!paga && vencimentoIso && vencimentoIso < hoje) selos.push({ label: "Vencida", tom: "atencao" });
  if (aguardando) selos.push({ label: "Aguardando aprovação", tom: "atencao" });
  else if (aprovacao === "rejected") selos.push({ label: "Recusada", tom: "atencao" });
  if (!paga && !aguardando) {
    selos.push(r.account_id
      ? { label: "Programado", tom: "info" }
      : { label: "Sem programação", tom: "neutro" });
  }

  const historico: FichaEvento[] = [];
  if (r.created_at) {
    historico.push({
      quando: ddmm(String(r.created_at).slice(0, 10)),
      texto: r.series_id ? "Gerado pela série de parcelas" : "Lançado manualmente",
    });
  }
  if (r.approved_at) {
    historico.push({
      quando: ddmm(String(r.approved_at).slice(0, 10)),
      texto: `${aprovacao === "rejected" ? "Recusado" : "Aprovado"} por ${texto(r.approved_by, "um gestor")}`,
    });
  }
  if (r.paid_date) historico.push({ quando: ddmm(String(r.paid_date)), texto: "Pagamento registrado" });
  if (r.reconciled_at) historico.push({ quando: ddmm(String(r.reconciled_at).slice(0, 10)), texto: "Confirmado no extrato" });
  historico.sort((a, b) => b.quando.localeCompare(a.quando));

  const bloqueio = paga ? "Esta conta já foi paga." : bloqueioDePagamento(aprovacao);

  const dados: Ficha = {
    id: String(r.id), direcao: "out", tipo: "Conta a pagar",
    pessoa: texto(r.vendor, r.description, "Fornecedor"),
    descricao: texto(r.description, "Pagamento"),
    valorCent, valorLabel: `− ${brlCheio(valorCent)}`,
    selos,
    origem: r.series_id
      ? `Parcela gerada por série${r.recurring ? " recorrente" : ""}`
      : r.recurring ? "Despesa marcada como recorrente" : "Criada manualmente no painel",
    vencimento: vencimentoIso ? ddmm(vencimentoIso) : "—",
    competencia: competencia(vencimentoIso),
    parcela: r.installment && r.installments_total
      ? `${r.installment} de ${r.installments_total}`
      : "Única",
    conta: nomeDaConta.get(String(r.account_id ?? "")) ?? "Não definida",
    contaId: r.account_id ? String(r.account_id) : null,
    itens: [{
      categoria: texto((catRes.data as Linha | null)?.label, r.category, "Sem categoria"),
      dimensoes: [
        texto((cliRes.data as Linha | null)?.name) && `Cliente ${texto((cliRes.data as Linha | null)?.name)}`,
        r.invoice_number && `Nota ${r.invoice_number}`,
      ].filter(Boolean).join(", ") || "Sem dimensões cadastradas",
      valor: brlCheio(valorCent),
    }],
    cobranca: null,
    historico,
    podeBaixar: !bloqueio,
    bloqueioBaixa: bloqueio,
    podeAprovar: aguardando && usuarioPodeAprovar,
    aguardandoAprovacao: aguardando,
    acaoPrincipal: "Registrar pagamento",
    encargos: encargosDe(vencimentoIso, valorCent, hoje, regras, paga),
    contas,
  };
  return { dados, vencimentoIso };
}

/**
 * Juros e multa que as regras configuradas implicam hoje.
 *
 * É informação, não campo: a baixa grava pelo valor da parcela, porque onde o
 * encargo entra na DRE é decisão do documento-mãe e não dá para adivinhar.
 */
function encargosDe(
  vencimentoIso: string,
  valorCent: number,
  hoje: string,
  regras: Awaited<ReturnType<typeof getRegrasFinanceiras>>,
  jaLiquidada: boolean,
): string | null {
  if (jaLiquidada || !vencimentoIso || vencimentoIso >= hoje) return null;
  const e = calcularEncargos(valorCent / 100, vencimentoIso, regras.encargos, new Date(`${hoje}T12:00:00Z`));
  return descreverEncargos(e, regras.encargos);
}
