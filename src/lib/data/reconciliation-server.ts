import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { lerExtrato } from "./ofx";
import { conciliar, resumoConciliacao, type CandidatoMov, type LinhaExtrato } from "./reconciliation";
import { STATUS_IGNORAR } from "./dre";

/**
 * Conciliação bancária — importa o extrato e confronta com os lançamentos.
 *
 * O que o banco registrou é a verdade; o painel é que precisa bater com ele.
 * Por isso a tela mostra as três divergências possíveis: linha do banco sem
 * lançamento (faltou registrar), lançamento liquidado sem linha no banco
 * (marcaram como pago e não caiu) e o que casou.
 */

const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);

/** Erro de tabela ausente — a migração 0138 ainda não rodou. */
export class SemMigracao extends Error {
  constructor() { super("Rode a migração 0138_conciliacao_nf_encargos_alcada.sql."); }
}

const semTabela = (msg: string) =>
  /bank_entries|bank_statements|42P01|42703/i.test(msg);

export type EntradaExtrato = {
  id: string;
  date: string;
  amount: number;
  memo: string;
  matchedKind: string | null;
  matchedId: string | null;
  ignored: boolean;
  /** Descrição do lançamento casado, para a tela. */
  matchedLabel: string | null;
};

export type PainelConciliacao = {
  accountId: string | null;
  entradas: EntradaExtrato[];
  /** Lançamentos liquidados no período que nenhuma linha do banco explica. */
  semExtrato: { id: string; date: string; value: number; description: string; kind: string }[];
  resumo: ReturnType<typeof resumoConciliacao>;
  ultimaImportacao: { fileName: string | null; createdAt: string; from: string | null; to: string | null } | null;
  /** Histórico de importações, para poder desfazer a errada. */
  importacoes: { id: string; fileName: string | null; createdAt: string; from: string | null; to: string | null; total: number }[];
  semTabelas: boolean;
};

const VAZIO: PainelConciliacao = {
  accountId: null, entradas: [], semExtrato: [],
  resumo: resumoConciliacao(0, 0, 0), ultimaImportacao: null, importacoes: [], semTabelas: true,
};

/** Lançamentos liquidados da conta, no período — os candidatos ao casamento. */
async function candidatos(
  db: SupabaseClient, accountId: string, from: string, to: string,
): Promise<CandidatoMov[]> {
  // Inclui também o que está SEM conta definida: lançamento antigo (ou lançado
  // sem escolher a conta) precisa poder casar, senão a conciliação nunca fecha
  // para quem já tinha histórico. O que está preso a OUTRA conta fica de fora.
  const daConta = `account_id.eq.${accountId},account_id.is.null`;
  const [rec, desp] = await Promise.all([
    db.from("payments").select("id, description, value, payment_date, due_date, status, account_id")
      .or(daConta).gte("due_date", from).lte("due_date", to).limit(2000),
    db.from("expenses").select("id, description, amount, paid_date, due_date, status, account_id")
      .or(daConta).gte("due_date", from).lte("due_date", to).limit(2000),
  ]);

  const out: CandidatoMov[] = [];
  for (const r of ((rec.error ? [] : rec.data ?? []) as Record<string, unknown>[])) {
    if (!PAGO.has(String(r.status ?? "")) || STATUS_IGNORAR.has(String(r.status ?? ""))) continue;
    out.push({
      id: `p-${String(r.id)}`,
      kind: "entrada",
      date: String(r.payment_date ?? r.due_date ?? ""),
      value: Number(r.value ?? 0),
      description: String(r.description ?? "Recebimento"),
    });
  }
  for (const r of ((desp.error ? [] : desp.data ?? []) as Record<string, unknown>[])) {
    if (r.status !== "paid") continue;
    out.push({
      id: `e-${String(r.id)}`,
      kind: "saida",
      date: String(r.paid_date ?? r.due_date ?? ""),
      value: Number(r.amount ?? 0),
      description: String(r.description ?? "Despesa"),
    });
  }
  return out.filter((m) => m.date);
}

/**
 * Importa um extrato. Retorna quantas linhas entraram, quantas já existiam
 * (mesmo FITID) e quantas casaram sozinhas.
 */
export async function importarExtrato(
  accountId: string, fileName: string, conteudo: string, autor: string,
): Promise<{ lidas: number; novas: number; repetidas: number; casadas: number; ambiguas: number }> {
  if (!isSupabaseConfigured()) return { lidas: 0, novas: 0, repetidas: 0, casadas: 0, ambiguas: 0 };
  const db = await createClient();
  const lido = lerExtrato(conteudo);
  if (lido.entries.length === 0) throw new Error("Nenhum lançamento reconhecido no arquivo. Exporte o extrato em OFX ou CSV.");

  try {
    const { data: st, error: stErr } = await db.from("bank_statements").insert({
      account_id: accountId,
      file_name: fileName,
      from_date: lido.from,
      to_date: lido.to,
      entries_total: lido.entries.length,
      imported_by: autor,
    }).select("id").single();
    if (stErr) throw stErr;
    const statementId = String((st as { id: unknown }).id);

    // FITIDs que já existem nesta conta — reimportar o mesmo mês não duplica.
    const fitids = lido.entries.map((e) => e.fitid).filter(Boolean) as string[];
    const jaTem = new Set<string>();
    if (fitids.length > 0) {
      const { data } = await db.from("bank_entries").select("fitid").eq("account_id", accountId).in("fitid", fitids);
      for (const r of (data ?? []) as { fitid: string }[]) jaTem.add(r.fitid);
    }

    // Sem FITID (CSV), a chave é data+valor+memo: evita duplicar o mesmo arquivo.
    const semFitid = lido.entries.filter((e) => !e.fitid);
    const assinaturas = new Set<string>();
    if (semFitid.length > 0 && lido.from && lido.to) {
      const { data } = await db.from("bank_entries")
        .select("date, amount, memo").eq("account_id", accountId)
        .gte("date", lido.from).lte("date", lido.to).limit(3000);
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        assinaturas.add(`${String(r.date)}|${Number(r.amount).toFixed(2)}|${String(r.memo ?? "")}`);
      }
    }

    const novas = lido.entries.filter((e) =>
      e.fitid
        ? !jaTem.has(e.fitid)
        : !assinaturas.has(`${e.date}|${e.amount.toFixed(2)}|${e.memo}`));
    const repetidas = lido.entries.length - novas.length;

    if (novas.length > 0) {
      const { error } = await db.from("bank_entries").insert(
        novas.map((e) => ({
          statement_id: statementId, account_id: accountId,
          fitid: e.fitid, date: e.date, amount: e.amount, memo: e.memo,
        })),
      );
      if (error) throw error;
    }

    // Roda sobre TODAS as linhas ainda pendentes da conta, não só as novas —
    // um extrato mais recente costuma resolver pendência de importação anterior.
    const { casadas, ambiguas } = await casarPendentes(db, accountId);
    return { lidas: lido.entries.length, novas: novas.length, repetidas, casadas, ambiguas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (semTabela(msg)) throw new SemMigracao();
    throw e;
  }
}

/**
 * Roda o casamento sobre as linhas ainda pendentes da conta e grava o que
 * ficou sem ambiguidade. O que empatou fica pendente para decisão humana.
 */
export async function casarPendentes(db: SupabaseClient, accountId: string): Promise<{ casadas: number; ambiguas: number }> {
  const { data, error } = await db
    .from("bank_entries")
    .select("id, date, amount, memo")
    .eq("account_id", accountId).is("matched_id", null).eq("ignored", false)
    .limit(3000);
  if (error) throw error;
  const pendentes = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), date: String(r.date), amount: Number(r.amount), memo: String(r.memo ?? ""),
  })) as LinhaExtrato[];
  if (pendentes.length === 0) return { casadas: 0, ambiguas: 0 };

  const datas = pendentes.map((p) => p.date).sort();
  // Folga de 10 dias em cada ponta cobre a janela de casamento.
  const folga = (iso: string, d: number) =>
    new Date(new Date(`${iso}T00:00:00Z`).getTime() + d * 86_400_000).toISOString().slice(0, 10);
  const movs = await candidatos(db, accountId, folga(datas[0], -10), folga(datas.at(-1)!, 10));

  // Lançamentos já usados por outra linha do extrato não entram de novo.
  const { data: jaCasados } = await db
    .from("bank_entries").select("matched_kind, matched_id")
    .eq("account_id", accountId).not("matched_id", "is", null).limit(3000);
  const usados = new Set(
    ((jaCasados ?? []) as Record<string, unknown>[])
      .map((r) => `${r.matched_kind === "payment" ? "p" : "e"}-${String(r.matched_id)}`),
  );

  const { sugestoes } = conciliar(pendentes, movs.map((m) => ({ ...m, jaCasado: usados.has(m.id) })));
  const automaticas = sugestoes.filter((s) => s.automatico);

  const agora = new Date().toISOString();
  for (const s of automaticas) {
    const [pref, ...resto] = s.movId.split("-");
    await db.from("bank_entries").update({
      matched_kind: pref === "p" ? "payment" : "expense",
      matched_id: resto.join("-"),
      matched_at: agora,
    }).eq("id", s.entryId);
  }
  return { casadas: automaticas.length, ambiguas: sugestoes.length - automaticas.length };
}

/**
 * Apaga uma importação inteira e as linhas que vieram nela.
 *
 * Existe porque importar o arquivo errado (conta trocada, período errado) é o
 * engano mais provável aqui, e sem isso a única saída seria mexer no banco.
 */
export async function excluirImportacao(db: SupabaseClient, statementId: string): Promise<number> {
  const { count } = await db
    .from("bank_entries")
    .delete({ count: "exact" })
    .eq("statement_id", statementId);
  const { error } = await db.from("bank_statements").delete().eq("id", statementId);
  if (error) throw error;
  return count ?? 0;
}

/** Importações da conta, da mais recente para a mais antiga. */
export async function listarImportacoes(db: SupabaseClient, accountId: string) {
  const { data, error } = await db
    .from("bank_statements")
    .select("id, file_name, from_date, to_date, entries_total, imported_by, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as Record<string, unknown>[];
}

/** Painel da conta: o que casou, o que sobrou dos dois lados. */
export async function getConciliacao(accountId: string | null, from?: string, to?: string): Promise<PainelConciliacao> {
  if (!isSupabaseConfigured() || !accountId) return VAZIO;
  try {
    const db = await createClient();
    const ate = to ?? new Date().toISOString().slice(0, 10);
    const de = from ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

    const { data, error } = await db
      .from("bank_entries")
      .select("id, date, amount, memo, matched_kind, matched_id, ignored")
      .eq("account_id", accountId).gte("date", de).lte("date", ate)
      .order("date", { ascending: false }).limit(1000);
    if (error) throw error;

    const linhas = (data ?? []) as Record<string, unknown>[];
    const movs = await candidatos(db, accountId, de, ate);
    const porId = new Map(movs.map((m) => [m.id, m]));

    const entradas: EntradaExtrato[] = linhas.map((r) => {
      const kind = (r.matched_kind as string) ?? null;
      const chave = r.matched_id ? `${kind === "payment" ? "p" : "e"}-${String(r.matched_id)}` : null;
      return {
        id: String(r.id),
        date: String(r.date),
        amount: Number(r.amount),
        memo: String(r.memo ?? ""),
        matchedKind: kind,
        matchedId: (r.matched_id as string) ?? null,
        ignored: Boolean(r.ignored),
        matchedLabel: chave ? (porId.get(chave)?.description ?? "lançamento fora do período") : null,
      };
    });

    // O outro lado da divergência: liquidado no painel, ausente no banco.
    const casados = new Set(entradas.filter((e) => e.matchedId).map((e) => `${e.matchedKind === "payment" ? "p" : "e"}-${e.matchedId}`));
    const semExtrato = movs
      .filter((m) => !casados.has(m.id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100)
      .map((m) => ({ id: m.id, date: m.date, value: m.value, description: m.description, kind: m.kind }));

    const sts = await listarImportacoes(db, accountId);
    const s = (sts[0] ?? null) as Record<string, unknown> | null;

    return {
      accountId,
      entradas,
      semExtrato,
      resumo: resumoConciliacao(
        entradas.length,
        entradas.filter((e) => e.matchedId).length,
        entradas.filter((e) => e.ignored && !e.matchedId).length,
      ),
      ultimaImportacao: s
        ? { fileName: (s.file_name as string) ?? null, createdAt: String(s.created_at), from: (s.from_date as string) ?? null, to: (s.to_date as string) ?? null }
        : null,
      importacoes: sts.map((r) => ({
        id: String(r.id),
        fileName: (r.file_name as string) ?? null,
        createdAt: String(r.created_at),
        from: (r.from_date as string) ?? null,
        to: (r.to_date as string) ?? null,
        total: Number(r.entries_total ?? 0),
      })),
      semTabelas: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (semTabela(msg)) return { ...VAZIO, accountId };
    return { ...VAZIO, accountId, semTabelas: false };
  }
}
