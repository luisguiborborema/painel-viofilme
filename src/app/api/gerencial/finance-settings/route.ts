import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  FINANCE_SETTINGS_PADRAO,
  parseMetodos,
  parseRegua,
  type FinanceSettings,
} from "@/lib/data/finance-settings";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS = "meta_margin, collection_rules, payment_methods, alert_margin, alert_overdue";

/** Lê a configuração do Financeiro; cai no padrão se a migração não rodou. */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json(FINANCE_SETTINGS_PADRAO);

  const supabase = await createClient();
  const { data, error } = await supabase.from("finance_settings").select(COLS).eq("id", 1).maybeSingle();
  if (error || !data) return NextResponse.json(FINANCE_SETTINGS_PADRAO);

  const r = data as Record<string, unknown>;
  const out: FinanceSettings = {
    metaMargin: Number(r.meta_margin ?? 42),
    collectionRules: parseRegua(r.collection_rules),
    paymentMethods: parseMetodos(r.payment_methods),
    alertMargin: Boolean(r.alert_margin),
    alertOverdue: Number(r.alert_overdue ?? 0),
  };
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: Partial<FinanceSettings>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const patch: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
  if (b.metaMargin !== undefined) {
    const v = Number(b.metaMargin);
    if (!Number.isFinite(v) || v < 0 || v > 100) return NextResponse.json({ error: "Meta deve ser entre 0 e 100." }, { status: 400 });
    patch.meta_margin = v;
  }
  if (b.collectionRules !== undefined) patch.collection_rules = parseRegua(b.collectionRules);
  if (b.paymentMethods !== undefined) patch.payment_methods = parseMetodos(b.paymentMethods);
  if (b.alertMargin !== undefined) patch.alert_margin = Boolean(b.alertMargin);
  if (b.alertOverdue !== undefined) {
    const v = Number(b.alertOverdue);
    patch.alert_overdue = Number.isFinite(v) && v > 0 ? v : 0;
  }

  const supabase = await createClient();
  await logFromUser(user, { action: "update", area: "Financeiro · configurações", target: null });
  const { error } = await supabase.from("finance_settings").upsert(patch, { onConflict: "id" });
  if (error) {
    if (/collection_rules|payment_methods|alert_margin|42703|finance_settings.*does not exist|42P01/i.test(error.message)) {
      return NextResponse.json({ error: "Rode as migrações 0132 e 0134 do Financeiro." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
