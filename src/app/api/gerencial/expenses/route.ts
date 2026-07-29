import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/data/gerfinance";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATS = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.key));
const today = () => new Date().toISOString().slice(0, 10);

type Body = {
  action?: "create" | "delete" | "pay" | "unpay";
  id?: string;
  description?: string;
  category?: string;
  amount?: number;
  dueDate?: string;
  paidDate?: string;
  recurring?: boolean;
  vendor?: string;
  status?: string;
};

/** Contas a pagar / despesas da agência (gerencial). */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const action = b.action ?? "create";
  await logFromUser(user, { action, area: "Financeiro", target: b.description ?? b.id ?? null });

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("expenses").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "pay" || action === "unpay") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch =
      action === "pay"
        ? { status: "paid", paid_date: b.paidDate || today() }
        : { status: "pending", paid_date: null };
    const { error } = await supabase
      .from("expenses")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // create
  const description = (b.description ?? "").trim();
  const amount = Number(b.amount);
  if (!description || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "descrição e valor são obrigatórios" },
      { status: 400 },
    );
  }
  const category = b.category && CATS.has(b.category) ? b.category : "outros";
  const paid = b.status === "paid";
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      description,
      category,
      amount,
      due_date: b.dueDate || null,
      paid_date: paid ? b.paidDate || today() : null,
      status: paid ? "paid" : "pending",
      recurring: Boolean(b.recurring),
      vendor: b.vendor?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
