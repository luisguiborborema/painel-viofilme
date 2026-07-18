"use client";

import { Printer } from "lucide-react";

export function LePrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-brand-700"
    >
      <Printer className="h-4 w-4" /> Imprimir / salvar PDF
    </button>
  );
}
