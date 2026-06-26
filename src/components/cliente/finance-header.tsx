import { ShieldCheck, Wallet } from "lucide-react";

export function FinanceHeader() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Financeiro &amp; contratos
          </h1>
          <p className="text-sm text-muted">
            Faturas, pagamentos e documentos da conta
          </p>
        </div>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Área segura
      </span>
    </div>
  );
}
