import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";
import { hojeSP } from "@/lib/data/dashboard-financeiro";
import { conferirSaldo, impressaoDigital, interpretarDescricao } from "@/lib/data/caixa";
import {
  analisarImportacao, lerCsv, lerOfx, type LinhaAnalisada, type MapaCsv,
} from "@/lib/data/extrato-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Importar extrato (spec §7).
 *
 * Dois passos e uma regra: **nada é gravado sem a pessoa ver antes o que vai
 * acontecer**. A prévia diz quantas linhas são novas, quantas já existem e
 * quantas apenas confirmam uma baixa manual — e só então o segundo passo
 * grava.
 *
 * A dedupe é do documento-mãe (§13.2): `external_id` quando o banco fornece,
 * impressão digital quando não. Reimportar a mesma semana nunca duplica.
 */

type Corpo = {
  etapa?: "previa" | "confirmar";
  contaId?: string;
  nomeArquivo?: string;
  conteudo?: string;
  formato?: "ofx" | "csv";
  mapa?: MapaCsv;
};

type Linha = Record<string, unknown>;
const cent = (v: unknown) => Math.round(Number(v) || 0);
const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
const reaisParaCent = (v: unknown) => Math.round((Number(v) || 0) * 100);

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

  const contaId = String(b.contaId ?? "").trim();
  if (!contaId) return erro("Escolha a conta.");
  const conteudo = String(b.conteudo ?? "");
  if (!conteudo.trim()) return erro("Arquivo vazio.");

  const db = await createClient();

  const lido = b.formato === "csv"
    ? lerCsv(conteudo, b.mapa ?? { data: 0, descricao: 1, valor: 2 })
    : lerOfx(conteudo);
  if (lido.erro) return erro(lido.erro);

  // O arquivo da conta errada é o engano mais caro da importação: ele entra
  // limpo, o saldo some do lugar e ninguém liga uma coisa à outra (§18).
  const { data: contaRaw } = await db.from("financial_accounts")
    .select("id, name, opening_balance, account_number, branch, requires_statement_confirmation")
    .eq("id", contaId).maybeSingle();
  const conta = (contaRaw ?? {}) as Linha;
  const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
  if (lido.conta && conta.account_number && digitos(lido.conta) !== digitos(conta.account_number)) {
    return erro(
      `O arquivo é da conta ${lido.conta}, e a conta escolhida é ${String(conta.account_number)}.`,
      409,
    );
  }

  /* ── O que já existe e o que espera confirmação ─────────────────────── */

  const { data: existentesRaw } = await db.from("transactions")
    .select("external_id, fingerprint").eq("financial_account_id", contaId);
  const jaExistentes = ((existentesRaw ?? []) as Linha[]).map((t) => ({
    externalId: t.external_id ? String(t.external_id) : null,
    fingerprint: t.fingerprint ? String(t.fingerprint) : null,
  }));

  const { data: pendentesRaw } = await db.from("transactions")
    .select("id, date, amount_cents")
    .eq("financial_account_id", contaId)
    .eq("confirmation_status", "pending_confirmation");
  const baixasPendentes = ((pendentesRaw ?? []) as Linha[]).map((t) => ({
    id: String(t.id), dataIso: String(t.date), valorCent: cent(t.amount_cents),
  }));

  const analise = analisarImportacao({
    lidas: lido.linhas, contaId, jaExistentes, baixasPendentes,
  });

  /* ── Conferência de saldo (§2.1) ────────────────────────────────────── */

  const saldoAposImportar = async () => {
    const { data } = await db.from("transactions")
      .select("amount_cents, ignored_reason, date").eq("financial_account_id", contaId);
    const ate = lido.saldoDataIso ?? hojeSP();
    return reaisParaCent(conta.opening_balance) +
      ((data ?? []) as Linha[])
        .filter((t) => !t.ignored_reason && String(t.date) <= ate)
        .reduce((s, t) => s + cent(t.amount_cents), 0);
  };

  if (b.etapa !== "confirmar") {
    const saldoAtual = await saldoAposImportar();
    const novasSomadas = analise.linhas
      .filter((l) => l.situacao === "nova")
      .reduce((s, l) => s + l.valorCent, 0);
    const conferencia = lido.saldoFinalCent !== null && lido.saldoDataIso
      ? conferirSaldo(lido.saldoFinalCent, saldoAtual + novasSomadas, lido.saldoDataIso)
      : null;

    return NextResponse.json({
      ok: true,
      previa: {
        arquivo: b.nomeArquivo ?? "extrato",
        periodoInicio: analise.periodoInicio,
        periodoFim: analise.periodoFim,
        total: analise.total,
        novas: analise.novas,
        existentes: analise.existentes,
        confirmam: analise.confirmam,
        conta: String(conta.name ?? "conta"),
        conferencia: conferencia && {
          confere: conferencia.confere,
          texto: conferencia.confere
            ? `Saldo do arquivo em ${br(lido.saldoDataIso!)}: ${brl(lido.saldoFinalCent!)}. ` +
              "O saldo calculado depois da importação bate."
            : `Saldo do arquivo em ${br(lido.saldoDataIso!)}: ${brl(lido.saldoFinalCent!)}. ` +
              `Calculado depois da importação: ${brl(saldoAtual + novasSomadas)}. ` +
              `Diferença de ${brl(Math.abs(conferencia.diferencaCent))}.`,
        },
        linhas: analise.linhas.slice(0, 40).map((l) => ({
          dataIso: l.dataIso, valorCent: l.valorCent,
          descricaoRaw: l.descricaoRaw, situacao: l.situacao,
        })),
      },
    });
  }

  /* ── Gravação ───────────────────────────────────────────────────────── */

  await logFromUser(user, {
    action: "import", area: "Financeiro · caixa",
    target: `${b.nomeArquivo ?? "extrato"} · ${String(conta.name ?? "")}`,
  });

  const { data: importacao } = await db.from("statement_imports").insert({
    account_id: contaId,
    file_name: b.nomeArquivo ?? "extrato",
    period_start: analise.periodoInicio,
    period_end: analise.periodoFim,
    rows_total: analise.total,
    rows_new: analise.novas,
    rows_duplicated: analise.existentes,
    rows_confirming: analise.confirmam,
    imported_by: user.name || user.email,
  }).select("id").maybeSingle();
  const importId = importacao ? String((importacao as Linha).id) : null;

  const novas = analise.linhas.filter((l) => l.situacao === "nova");
  if (novas.length) {
    const { error } = await db.from("transactions").insert(
      novas.map((l: LinhaAnalisada) => ({
        financial_account_id: contaId,
        date: l.dataIso,
        amount_cents: l.valorCent,
        description_raw: l.descricaoRaw,
        description_clean: interpretarDescricao(l.descricaoRaw, l.valorCent).texto,
        counterparty_document: l.documento,
        origin: "import",
        external_id: l.idExterno,
        bank_reference: l.idExterno,
        import_id: importId,
        // Linha do extrato é o dinheiro já confirmado pelo banco: ela não
        // espera confirmação de ninguém.
        confirmation_status: "confirmed",
        reconciliation_status: "unreconciled",
        fingerprint: impressaoDigital({
          contaId, dataIso: l.dataIso, valorCent: l.valorCent, descricaoRaw: l.descricaoRaw,
        }),
      })),
    );
    if (error) return erro(error.message, 500);
  }

  // Fusão, não duplicação (§13.3): a baixa manual que esperava vira
  // confirmada e herda o identificador do banco.
  for (const l of analise.linhas.filter((x) => x.situacao === "confirma")) {
    if (!l.baixaId) continue;
    await db.from("transactions").update({
      confirmation_status: "confirmed",
      external_id: l.idExterno,
      bank_reference: l.idExterno,
      import_id: importId,
    }).eq("id", l.baixaId);
  }

  // A conferência fica gravada com o saldo da ÉPOCA: é isso que permite dizer
  // depois "a diferença era das movimentações que faltavam".
  let conferenciaTexto: string | null = null;
  if (lido.saldoFinalCent !== null && lido.saldoDataIso) {
    const saldoFinal = await saldoAposImportar();
    const r = conferirSaldo(lido.saldoFinalCent, saldoFinal, lido.saldoDataIso);
    await db.from("balance_checkpoints").insert({
      account_id: contaId,
      date: lido.saldoDataIso,
      bank_balance_cents: lido.saldoFinalCent,
      system_balance_cents: saldoFinal,
      difference_cents: r.diferencaCent,
      source: "ofx",
      status: r.confere ? "matched" : "open",
      created_by: user.name || user.email,
    });
    conferenciaTexto = r.confere
      ? `O saldo de ${String(conta.name ?? "conta")} agora confere com o banco.`
      : `Ainda há ${brl(Math.abs(r.diferencaCent))} de diferença com o banco.`;
  }

  return NextResponse.json({
    ok: true,
    importadas: novas.length,
    confirmadas: analise.confirmam,
    mensagem: `${novas.length} ${novas.length === 1 ? "movimentação importada" : "movimentações importadas"} ` +
      `em ${String(conta.name ?? "conta")}.` +
      (analise.confirmam ? ` ${analise.confirmam} confirmaram baixas já registradas.` : "") +
      (analise.existentes ? ` ${analise.existentes} já existiam e foram ignoradas.` : "") +
      (conferenciaTexto ? ` ${conferenciaTexto}` : ""),
  });
}

const brl = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const br = (iso: string) => iso.split("-").reverse().join("/");
