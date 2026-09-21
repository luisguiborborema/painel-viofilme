import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";
import { hojeSP } from "@/lib/data/dashboard-financeiro";
import { repartir } from "@/lib/data/pagamentos";
import { dividirParcelas, vencimentoDaParcela } from "@/lib/data/recebimentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Criação de lançamentos: nova despesa (Pagamentos §10) e nova receita
 * (Recebimentos §7).
 *
 * As duas são o MESMO esqueleto, como as specs dizem: título com itens e
 * parcelas. O que muda é a direção e, com ela, quem é a contraparte e como a
 * sobra de centavos é dividida — em Pagamentos a primeira parcela absorve,
 * em Recebimentos a última, porque o cliente recebe o carnê inteiro e compara
 * as parcelas entre si.
 *
 * Nada nasce liquidado aqui: quem cria o compromisso é esta rota, quem dá
 * baixa é Pagamentos, Recebimentos ou a conciliação do Caixa.
 */

type Item = { categoriaKey?: string | null; descricao?: string; valorCent?: number; clienteId?: string | null };

type Corpo = {
  direcao?: "in" | "out";
  tipo?: "unica" | "parcelada" | "recorrente";
  partyId?: string | null;
  clienteId?: string | null;
  descricao?: string;
  itens?: Item[];
  /** Única e parcelada. */
  vencimento?: string;
  parcelas?: number;
  intervalo?: "mensal" | "quinzenal";
  /** Recorrente. */
  diaVencimento?: number;
  inicio?: string;
  fim?: string | null;
  contaId?: string | null;
  formaPagamento?: string | null;
  /** Competência: por padrão o mês do vencimento de cada parcela. */
  competenciaUnica?: boolean;
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

  const direcao = b.direcao === "in" ? "in" : "out";
  const tipo = b.tipo ?? "unica";
  const hoje = hojeSP();

  const itens = (b.itens ?? []).filter((i) => cent(i.valorCent) > 0);
  if (!itens.length) return erro("Informe ao menos um item com valor maior que zero.");
  const totalCent = itens.reduce((s, i) => s + cent(i.valorCent), 0);

  const descricao = String(b.descricao ?? "").trim() ||
    (direcao === "in" ? "Receita" : "Despesa");

  const db = await createClient();
  const fechadoAte = await periodoFechadoAte(db);

  // As datas de vencimento de cada parcela, já resolvidas.
  const vencimentos = calcularVencimentos(b, tipo, hoje);
  if (!vencimentos.length) return erro("Informe o vencimento.");

  const trava = bloqueioPorFechamento(vencimentos[0], fechadoAte);
  if (trava) return erro(trava, 409);

  await logFromUser(user, {
    action: "create",
    area: direcao === "in" ? "Financeiro · recebimentos" : "Financeiro · pagamentos",
    target: descricao,
  });

  // Recorrência: a regra existe antes das parcelas, e é ela que as gera daqui
  // para a frente. As primeiras já entram materializadas.
  let recorrenciaId: string | null = null;
  if (tipo === "recorrente") {
    const { data: rec, error } = await db.from("recurrences").insert({
      direction: direcao,
      party_id: b.partyId ?? null,
      client_id: b.clienteId ?? null,
      description: descricao,
      frequency: "monthly",
      due_day: Math.min(31, Math.max(1, Number(b.diaVencimento ?? 5))),
      start_date: b.inicio ?? hoje,
      end_date: b.fim ?? null,
      amount_cents: totalCent,
      payment_method: b.formaPagamento ?? null,
      financial_account_id: b.contaId ?? null,
      category_key: itens[0]?.categoriaKey ?? null,
      status: "active",
    }).select("id").maybeSingle();
    if (error) return erro(error.message, 500);
    recorrenciaId = rec ? String((rec as Linha).id) : null;

    if (recorrenciaId) {
      await db.from("recurrence_versions").insert({
        recurrence_id: recorrenciaId,
        amount_cents: totalCent,
        valid_from: b.inicio ?? hoje,
        reason: "created",
        created_by: user.name || user.email,
      });
    }
  }

  const { data: doc, error: eDoc } = await db.from("documents").insert({
    direction: direcao,
    party_id: b.partyId ?? null,
    client_id: b.clienteId ?? null,
    description: descricao,
    issue_date: hoje,
    total_cents: totalCent * (tipo === "recorrente" ? vencimentos.length : 1),
    recurrence_id: recorrenciaId,
    origin: "manual",
    created_by: user.name || user.email,
  }).select("id").maybeSingle();
  if (eDoc || !doc) return erro(eDoc?.message ?? "não foi possível criar o título", 500);
  const docId = String((doc as Linha).id);

  const { error: eItens } = await db.from("document_items").insert(
    itens.map((i, n) => ({
      document_id: docId,
      amount_cents: cent(i.valorCent),
      category_key: i.categoriaKey ?? null,
      client_id: i.clienteId ?? b.clienteId ?? null,
      description: i.descricao?.trim() || descricao,
      position: n,
    })),
  );
  if (eItens) return erro(eItens.message, 500);

  // A divisão das parcelas muda com a direção (§7.5 de Recebimentos e §10.6
  // de Pagamentos): a sobra vai para a última quando o cliente vê o carnê
  // inteiro, e para a primeira quando quem paga é a agência.
  const valores = tipo === "recorrente"
    ? vencimentos.map(() => totalCent)
    : direcao === "in"
      ? dividirParcelas(totalCent, vencimentos.length)
      : repartir(totalCent, vencimentos.length);

  const { error: eParcelas } = await db.from("installments").insert(
    vencimentos.map((venc, n) => ({
      document_id: docId,
      number: n + 1,
      total_number: vencimentos.length,
      due_date: venc,
      competence_month: b.competenciaUnica
        ? `${vencimentos[0].slice(0, 7)}-01`
        : `${venc.slice(0, 7)}-01`,
      amount_cents: valores[n],
      open_balance_cents: valores[n],
      status: "open",
      expected_account_id: b.contaId ?? null,
    })),
  );
  if (eParcelas) return erro(eParcelas.message, 500);

  return NextResponse.json({
    ok: true,
    documentId: docId,
    parcelas: vencimentos.length,
    mensagem: tipo === "recorrente"
      ? `Recorrência criada: ${vencimentos.length} parcelas já geradas.`
      : vencimentos.length > 1
        ? `${vencimentos.length} parcelas criadas.`
        : "Lançamento criado.",
  });
}

/**
 * Os vencimentos de cada parcela.
 *
 * Recorrência materializa uma janela de 3 meses (§12 de Pagamentos): o job
 * diário continuaria dali, e gerar o ano inteiro encheria a lista de parcelas
 * que ainda podem mudar de valor.
 */
function calcularVencimentos(
  b: Corpo,
  tipo: "unica" | "parcelada" | "recorrente",
  hoje: string,
): string[] {
  if (tipo === "recorrente") {
    const dia = Math.min(31, Math.max(1, Number(b.diaVencimento ?? 5)));
    const inicio = b.inicio ?? hoje;
    const base = `${inicio.slice(0, 8)}${String(Math.min(dia, 28)).padStart(2, "0")}`;
    const primeiro = base >= inicio ? base : vencimentoDaParcela(base, 1);
    return [0, 1, 2]
      .map((i) => vencimentoDaParcela(primeiro, i))
      .filter((d) => !b.fim || d <= b.fim);
  }

  const primeiro = b.vencimento ?? hoje;
  if (tipo === "unica") return [primeiro];

  const n = Math.min(60, Math.max(1, Number(b.parcelas ?? 1)));
  return Array.from({ length: n }, (_, i) =>
    vencimentoDaParcela(primeiro, i, b.intervalo !== "quinzenal"));
}
