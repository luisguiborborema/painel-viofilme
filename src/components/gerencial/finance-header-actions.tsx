"use client";

import Link from "next/link";
import { Download, Plus } from "lucide-react";

/** Ações do cabeçalho do Financeiro (antes eram botões sem ação). */
export function FinanceHeaderActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle"
      >
        <Download className="h-4 w-4" /> Exportar
      </button>
      <Link
        href="/gerencial/clientes"
        title="As cobranças são criadas na ficha de cada cliente"
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
      >
        <Plus className="h-4 w-4" /> Nova cobrança
      </Link>
    </div>
  );
}
