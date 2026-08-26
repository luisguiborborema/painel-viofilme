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
import { TAX_REGIMES } from "@/lib/data/tax";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS = "meta_margin, collection_rules, payment_methods, alert_margin, alert_overdue";
const COLS_0137 = "closed_until";
const COLS_0138 = "late_fine, late_interest_month, late_grace_days, tax_regime, tax_rate, tax_due_day, approval_threshold";

/** Lê a configuração do Financeiro; cai no padrão se a migração não rodou. */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json(FINANCE_SETTINGS_PADRAO);

  const supabase = await createClient();
  // Tolerante em degraus: 0138 (encargos/imposto/alçada) → 0137 (fechamento) → base.
  const v3 = await supabase.from("finance_settings").select(`${COLS}, ${COLS_0137}, ${COLS_0138}`).eq("id", 1).maybeSingle();
  const v2 = v3.error
    ? await supabase.from("finance_settings").select(`${COLS}, ${COLS_0137}`).eq("id", 1).maybeSingle()
    : v3;
  const { data, error } = v2.error
    ? await supabase.from("finance_settings").select(COLS).eq("id", 1).maybeSingle()
    : v2;
  if (error || !data) return NextResponse.json(FINANCE_SETTINGS_PADRAO);

  const r = data as Record<string, unknown>;
  const out: FinanceSettings = {
    metaMargin: Number(r.meta_margin ?? 42),
    collectionRules: parseRegua(r.collection_rules),
    paymentMethods: parseMetodos(r.payment_methods),
    alertMargin: Boolean(r.alert_margin),
    alertOverdue: Number(r.alert_overdue ?? 0),
    closedUntil: (r.closed_until as string) ?? null,
    lateFine: Number(r.late_fine ?? 0),
    lateInterestMonth: Number(r.late_interest_month ?? 0),
    lateGraceDays: Number(r.late_grace_days ?? 0),
    taxRegime: String(r.tax_regime ?? "simples"),
    taxRate: Number(r.tax_rate ?? 0),
    taxDueDay: Number(r.tax_due_day ?? 20),
    approvalThreshold: Number(r.approval_threshold ?? 0),
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

  // Percentuais e limites — 0 sempre significa "desligado".
  const naoNegativo = (v: unknown, max = Number.MAX_SAFE_INTEGER) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
  };
  if (b.lateFine !== undefined) patch.late_fine = naoNegativo(b.lateFine, 100);
  if (b.lateInterestMonth !== undefined) patch.late_interest_month = naoNegativo(b.lateInterestMonth, 100);
  if (b.lateGraceDays !== undefined) patch.late_grace_days = Math.round(naoNegativo(b.lateGraceDays, 365));
  if (b.taxRegime !== undefined) patch.tax_regime = TAX_REGIMES.some((t) => t.key === b.taxRegime) ? b.taxRegime : "simples";
  if (b.taxRate !== undefined) patch.tax_rate = naoNegativo(b.taxRate, 100);
  if (b.taxDueDay !== undefined) patch.tax_due_day = Math.min(28, Math.max(1, Math.round(Number(b.taxDueDay) || 20)));
  if (b.approvalThreshold !== undefined) patch.approval_threshold = naoNegativo(b.approvalThreshold);

  const supabase = await createClient();
  await logFromUser(user, { action: "update", area: "Financeiro · configurações", target: null });
  const { error } = await supabase.from("finance_settings").upsert(patch, { onConflict: "id" });
  if (error) {
    if (/late_fine|tax_rate|approval_threshold|tax_regime|late_grace_days/i.test(error.message)) {
      return NextResponse.json({ error: "Rode a migração 0138_conciliacao_nf_encargos_alcada.sql." }, { status: 409 });
    }
    if (/collection_rules|payment_methods|alert_margin|42703|finance_settings.*does not exist|42P01/i.test(error.message)) {
      return NextResponse.json({ error: "Rode as migrações 0132 e 0134 do Financeiro." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
