import { ChevronDown, Download, Plus, Wallet } from "lucide-react";
import { getGerFinance } from "@/lib/data/gerfinance";
import { FinanceTabs } from "@/components/gerencial/finance-tabs";

export default async function GerencialFinanceiro() {
  const data = getGerFinance();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-brand-300">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Financeiro
            </h1>
            <p className="text-sm text-muted">
              Fluxo de caixa, cobrança e DRE da agência
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink">
            {data.periodLabel}
            <ChevronDown className="h-4 w-4 text-muted" />
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Nova cobrança
          </button>
        </div>
      </div>

      <FinanceTabs data={data} />
    </div>
  );
}
