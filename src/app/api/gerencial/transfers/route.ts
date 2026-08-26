import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

type Body = {
  action?: "create" | "delete";
  id?: string;
  fromAccount?: string;
  toAccount?: string;
  amount?: number;
  date?: string;
  note?: string;
};

/**
 * Transferência entre contas — move saldo sem virar receita nem despesa,
 * para não sujar o DRE.
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
  const supabase = await createClient();
  const action = b.action ?? "create";
  await logFromUser(user, { action, area: "Financeiro · transferências", target: b.id ?? null });

  try {
    if (action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("account_transfers").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const de = clean(b.fromAccount);
    const para = clean(b.toAccount);
    const valor = Number(b.amount);
    if (!de || !para) return NextResponse.json({ error: "Escolha a conta de origem e a de destino." }, { status: 400 });
    if (de === para) return NextResponse.json({ error: "Origem e destino não podem ser a mesma conta." }, { status: 400 });
    if (!Number.isFinite(valor) || valor <= 0) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });

    const { data, error } = await supabase
      .from("account_transfers")
      .insert({
        from_account: de,
        to_account: para,
        amount: valor,
        date: b.date || new Date().toISOString().slice(0, 10),
        note: clean(b.note),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/account_transfers.*does not exist|42P01/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0135_account_transfers.sql." }, { status: 409 });
    }
    if (/contas_distintas/i.test(msg)) {
      return NextResponse.json({ error: "Origem e destino não podem ser a mesma conta." }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
