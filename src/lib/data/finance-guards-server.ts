import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ENCARGOS_PADRAO, type EncargosConfig } from "./late-fees";
import { TAX_PADRAO, type TaxConfig, type TaxRegime } from "./tax";

/**
 * Parâmetros do financeiro que valem como REGRA e não como preferência de tela:
 * alçada de aprovação, encargos por atraso e provisão de imposto.
 *
 * Ficam num módulo próprio porque são lidos por várias rotas e precisam ser
 * tolerantes: sem a migração 0138, tudo volta desligado — nunca bloqueando.
 */
export type RegrasFinanceiras = {
  approvalThreshold: number;
  encargos: EncargosConfig;
  imposto: TaxConfig;
};

export const REGRAS_PADRAO: RegrasFinanceiras = {
  approvalThreshold: 0,
  encargos: ENCARGOS_PADRAO,
  imposto: TAX_PADRAO,
};

export async function getRegrasFinanceiras(db: SupabaseClient): Promise<RegrasFinanceiras> {
  try {
    const { data, error } = await db
      .from("finance_settings")
      .select("approval_threshold, late_fine, late_interest_month, late_grace_days, tax_regime, tax_rate, tax_due_day")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return REGRAS_PADRAO;
    const r = data as Record<string, unknown>;
    return {
      approvalThreshold: Number(r.approval_threshold ?? 0),
      encargos: {
        fine: Number(r.late_fine ?? 0),
        interestMonth: Number(r.late_interest_month ?? 0),
        graceDays: Number(r.late_grace_days ?? 0),
      },
      imposto: {
        regime: (String(r.tax_regime ?? "simples") as TaxRegime),
        rate: Number(r.tax_rate ?? 0),
        dueDay: Number(r.tax_due_day ?? 20),
      },
    };
  } catch {
    return REGRAS_PADRAO;
  }
}
