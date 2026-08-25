import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(["banco", "gateway", "caixa"]);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  name?: string;
  kind?: string;
  institution?: string;
  openingBalance?: number;
  active?: boolean;
  isDefault?: boolean;
};

/** Contas financeiras: Asaas, BTG, Inter, caixa… */
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
  await logFromUser(user, { action, area: "Financeiro · contas", target: b.name ?? b.id ?? null });

  try {
    if (action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      // Lançamentos ligados perdem o vínculo (FK on delete set null), não somem.
      const { error } = await supabase.from("financial_accounts").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const nome = clean(b.name);
    if (action === "create" && !nome) return NextResponse.json({ error: "Informe o nome da conta." }, { status: 400 });

    const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (nome !== null) campos.name = nome;
    if (b.kind !== undefined) campos.kind = KINDS.has(String(b.kind)) ? b.kind : "banco";
    if (b.institution !== undefined) campos.institution = clean(b.institution);
    if (b.openingBalance !== undefined) campos.opening_balance = num(b.openingBalance);
    if (b.active !== undefined) campos.active = Boolean(b.active);

    // Só uma conta padrão por vez.
    if (b.isDefault === true) {
      await supabase.from("financial_accounts").update({ is_default: false }).neq("id", b.id ?? "00000000-0000-0000-0000-000000000000");
      campos.is_default = true;
    } else if (b.isDefault === false) {
      campos.is_default = false;
    }

    if (action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("financial_accounts").update(campos).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const { data, error } = await supabase.from("financial_accounts").insert(campos).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/financial_accounts.*does not exist|42P01/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0131_financial_accounts.sql." }, { status: 409 });
    }
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json({ error: "Já existe uma conta com esse nome." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
