import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getConciliacao, importarExtrato, casarPendentes, excluirImportacao, SemMigracao } from "@/lib/data/reconciliation-server";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Extrato importado costuma ter alguns milhares de linhas; 5 MB cobre com folga. */
const LIMITE_BYTES = 5 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const q = request.nextUrl.searchParams;
  return NextResponse.json(
    await getConciliacao(q.get("conta"), q.get("from") ?? undefined, q.get("to") ?? undefined),
  );
}

type Body = {
  action?: "importar" | "casar" | "descasar" | "ignorar" | "reconsiderar" | "reprocessar" | "excluirImportacao";
  statementId?: string;
  accountId?: string;
  fileName?: string;
  /** Conteúdo do arquivo em texto (OFX ou CSV). */
  content?: string;
  entryId?: string;
  /** "p-<uuid>" ou "e-<uuid>". */
  movId?: string;
};

/**
 * Conciliação bancária: importa o extrato, casa/descasa linhas e dispensa o que
 * não corresponde a lançamento nenhum (tarifa, rendimento, estorno).
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const autor = user.name || user.email || "—";
  try {
    if (b.action === "importar") {
      if (!b.accountId) return NextResponse.json({ error: "Escolha a conta do extrato." }, { status: 400 });
      const conteudo = String(b.content ?? "");
      if (!conteudo.trim()) return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
      if (conteudo.length > LIMITE_BYTES) return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)." }, { status: 413 });

      await logFromUser(user, { action: "import", area: "Financeiro · conciliação", target: b.fileName ?? null });
      const r = await importarExtrato(b.accountId, String(b.fileName ?? "extrato"), conteudo, autor);
      return NextResponse.json({ ok: true, ...r });
    }

    const db = await createClient();

    if (b.action === "excluirImportacao") {
      if (!b.statementId) return NextResponse.json({ error: "Importação ausente." }, { status: 400 });
      await logFromUser(user, { action: "delete", area: "Financeiro · conciliação", target: b.statementId });
      const removidas = await excluirImportacao(db, b.statementId);
      return NextResponse.json({ ok: true, removidas });
    }

    if (b.action === "reprocessar") {
      if (!b.accountId) return NextResponse.json({ error: "Conta ausente." }, { status: 400 });
      return NextResponse.json({ ok: true, ...(await casarPendentes(db, b.accountId)) });
    }

    if (!b.entryId) return NextResponse.json({ error: "Linha ausente." }, { status: 400 });

    if (b.action === "casar") {
      const mov = String(b.movId ?? "");
      const [pref, ...resto] = mov.split("-");
      if (!resto.length || (pref !== "p" && pref !== "e")) {
        return NextResponse.json({ error: "Lançamento inválido." }, { status: 400 });
      }
      const { error } = await db.from("bank_entries").update({
        matched_kind: pref === "p" ? "payment" : "expense",
        matched_id: resto.join("-"),
        matched_at: new Date().toISOString(),
        ignored: false,
      }).eq("id", b.entryId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (b.action === "descasar") {
      const { error } = await db.from("bank_entries")
        .update({ matched_kind: null, matched_id: null, matched_at: null })
        .eq("id", b.entryId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (b.action === "ignorar" || b.action === "reconsiderar") {
      const { error } = await db.from("bank_entries")
        .update({ ignored: b.action === "ignorar" })
        .eq("id", b.entryId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
  } catch (e) {
    if (e instanceof SemMigracao) return NextResponse.json({ error: e.message }, { status: 409 });
    const msg = e instanceof Error ? e.message : "erro";
    if (/bank_entries|bank_statements|42P01|42703/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0138_conciliacao_nf_encargos_alcada.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
