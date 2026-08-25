import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { chaveDe } from "@/lib/data/expense-categories";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRUPOS = new Set(["deducao", "custo"]);
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

type Body = {
  action?: "create" | "update" | "delete" | "reorder";
  id?: string;
  label?: string;
  dreGroup?: string;
  color?: string;
  active?: boolean;
  ordem?: string[]; // ids na nova ordem
};

/** Categorias de despesa personalizáveis. */
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
  await logFromUser(user, { action, area: "Financeiro · categorias", target: b.label ?? b.id ?? null });

  try {
    if (action === "reorder") {
      const ids = b.ordem ?? [];
      for (let i = 0; i < ids.length; i++) {
        await supabase.from("expense_categories").update({ position: i }).eq("id", ids[i]);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      // Categoria em uso não é apagada: vira inativa, para não órfãos no histórico.
      const { data: cat } = await supabase.from("expense_categories").select("key").eq("id", b.id).maybeSingle();
      const chave = (cat as { key?: string } | null)?.key;
      if (chave) {
        const { count } = await supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("category", chave);
        if ((count ?? 0) > 0) {
          const { error } = await supabase.from("expense_categories").update({ active: false }).eq("id", b.id);
          if (error) throw error;
          return NextResponse.json({
            ok: true,
            desativada: true,
            mensagem: `Há ${count} lançamento(s) nesta categoria — ela foi desativada em vez de apagada, para o histórico continuar íntegro.`,
          });
        }
      }
      const { error } = await supabase.from("expense_categories").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const label = clean(b.label);
    const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (label) campos.label = label;
    if (b.dreGroup !== undefined) campos.dre_group = GRUPOS.has(String(b.dreGroup)) ? b.dreGroup : "custo";
    if (b.color !== undefined) campos.color = clean(b.color);
    if (b.active !== undefined) campos.active = Boolean(b.active);

    if (action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      // A chave nunca muda: é o que liga os lançamentos já gravados.
      const { error } = await supabase.from("expense_categories").update(campos).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (!label) return NextResponse.json({ error: "Informe o nome da categoria." }, { status: 400 });
    const { count } = await supabase.from("expense_categories").select("id", { count: "exact", head: true });
    const { data, error } = await supabase
      .from("expense_categories")
      .insert({ ...campos, key: chaveDe(label), position: count ?? 0 })
      .select("id, key")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id, key: data.key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/expense_categories.*does not exist|42P01/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0133_expense_categories.sql." }, { status: 409 });
    }
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
