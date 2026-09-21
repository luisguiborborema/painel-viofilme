import { revalidateTag } from "next/cache";
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
const COLS_0148 = "min_cash_reserve, charge_lead_days, stale_statement_days, unconfirmed_days, reconcile_max_open, reconcile_max_days, budget_tolerance, closing_due_day";
const COLS_0147 = "healthy_margin_pct, attention_margin_pct, concentration_limit_pct, churn_alert_pct";

/** Lê a configuração do Financeiro; cai no padrão se a migração não rodou. */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json(FINANCE_SETTINGS_PADRAO);

  const supabase = await createClient();
  // Tolerante em degraus: 0148 (Dashboard) → 0138 (encargos/imposto/alçada) →
  // 0137 (fechamento) → base. Cada degrau que falta cai no padrão, em vez de
  // derrubar a tela inteira de configurações.
  const v5 = await supabase.from("finance_settings")
    .select(`${COLS}, ${COLS_0137}, ${COLS_0138}, ${COLS_0148}, ${COLS_0147}`).eq("id", 1).maybeSingle();
  const v4 = v5.error
    ? await supabase.from("finance_settings").select(`${COLS}, ${COLS_0137}, ${COLS_0138}, ${COLS_0148}`).eq("id", 1).maybeSingle()
    : v5;
  const v3 = v4.error
    ? await supabase.from("finance_settings").select(`${COLS}, ${COLS_0137}, ${COLS_0138}`).eq("id", 1).maybeSingle()
    : v4;
  const v2 = v3.error
    ? await supabase.from("finance_settings").select(`${COLS}, ${COLS_0137}`).eq("id", 1).maybeSingle()
    : v3;
  const { data, error } = v2.error
    ? await supabase.from("finance_settings").select(COLS).eq("id", 1).maybeSingle()
    : v2;
  if (error || !data) return NextResponse.json(FINANCE_SETTINGS_PADRAO);

  const r = data as Record<string, unknown>;
  const out: FinanceSettings & {
    healthyMarginPct: number; attentionMarginPct: number;
    concentrationLimitPct: number; churnAlertPct: number;
  } = {
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
    minCashReserve: Number(r.min_cash_reserve ?? 0),
    chargeLeadDays: Number(r.charge_lead_days ?? 5),
    staleStatementDays: Number(r.stale_statement_days ?? 7),
    unconfirmedDays: Number(r.unconfirmed_days ?? 7),
    reconcileMaxOpen: Number(r.reconcile_max_open ?? 20),
    reconcileMaxDays: Number(r.reconcile_max_days ?? 7),
    budgetTolerance: Number(r.budget_tolerance ?? 110),
    closingDueDay: Number(r.closing_due_day ?? 10),
    healthyMarginPct: Number(r.healthy_margin_pct ?? 55),
    attentionMarginPct: Number(r.attention_margin_pct ?? 40),
    concentrationLimitPct: Number(r.concentration_limit_pct ?? 15),
    churnAlertPct: Number(r.churn_alert_pct ?? 2),
  };
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: Partial<FinanceSettings> & {
    healthyMarginPct?: number; attentionMarginPct?: number;
    concentrationLimitPct?: number; churnAlertPct?: number;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return (revalidateTag("financeiro", { expire: 0 }), NextResponse.json({ ok: true, persisted: false }));

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

  // Parâmetros do Dashboard (§13). Os de dias têm mínimo 1: "avise a cada 0
  // dias" não é desligar o aviso, é pedir que ele apareça sempre.
  const diasEntre1e = (v: unknown, padrao: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), max) : padrao;
  };
  if (b.minCashReserve !== undefined) patch.min_cash_reserve = naoNegativo(b.minCashReserve);
  if (b.chargeLeadDays !== undefined) patch.charge_lead_days = diasEntre1e(b.chargeLeadDays, 5, 90);
  if (b.staleStatementDays !== undefined) patch.stale_statement_days = diasEntre1e(b.staleStatementDays, 7, 90);
  if (b.unconfirmedDays !== undefined) patch.unconfirmed_days = diasEntre1e(b.unconfirmedDays, 7, 90);
  if (b.reconcileMaxOpen !== undefined) patch.reconcile_max_open = diasEntre1e(b.reconcileMaxOpen, 20, 10_000);
  if (b.reconcileMaxDays !== undefined) patch.reconcile_max_days = diasEntre1e(b.reconcileMaxDays, 7, 365);
  if (b.budgetTolerance !== undefined) patch.budget_tolerance = Math.min(1000, Math.max(100, Number(b.budgetTolerance) || 110));
  if (b.closingDueDay !== undefined) patch.closing_due_day = Math.min(28, Math.max(1, Math.round(Number(b.closingDueDay) || 10)));

  // Limites de Resultados (§14 da spec): saúde do cliente, concentração e
  // churn. Eram lidos pela página e não tinham por onde ser editados.
  const pct = (v: unknown, padrao: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : padrao;
  };
  if (b.healthyMarginPct !== undefined) patch.healthy_margin_pct = pct(b.healthyMarginPct, 55);
  if (b.attentionMarginPct !== undefined) patch.attention_margin_pct = pct(b.attentionMarginPct, 40);
  if (b.concentrationLimitPct !== undefined) patch.concentration_limit_pct = pct(b.concentrationLimitPct, 15);
  if (b.churnAlertPct !== undefined) patch.churn_alert_pct = pct(b.churnAlertPct, 2);

  const supabase = await createClient();
  await logFromUser(user, { action: "update", area: "Financeiro · configurações", target: null });
  const { error } = await supabase.from("finance_settings").upsert(patch, { onConflict: "id" });
  if (error) {
    if (/healthy_margin_pct|attention_margin_pct|concentration_limit_pct|churn_alert_pct/i.test(error.message)) {
      return NextResponse.json({ error: "Rode a migração 0147_resultados.sql." }, { status: 409 });
    }
    if (/min_cash_reserve|charge_lead_days|stale_statement_days|unconfirmed_days|reconcile_max|budget_tolerance|closing_due_day/i.test(error.message)) {
      return NextResponse.json({ error: "Rode a migração 0148_dashboard_financeiro.sql." }, { status: 409 });
    }
    if (/late_fine|tax_rate|approval_threshold|tax_regime|late_grace_days/i.test(error.message)) {
      return NextResponse.json({ error: "Rode a migração 0138_conciliacao_nf_encargos_alcada.sql." }, { status: 409 });
    }
    if (/collection_rules|payment_methods|alert_margin|42703|finance_settings.*does not exist|42P01/i.test(error.message)) {
      return NextResponse.json({ error: "Rode as migrações 0132 e 0134 do Financeiro." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return (revalidateTag("financeiro", { expire: 0 }), NextResponse.json({ ok: true }));
}
