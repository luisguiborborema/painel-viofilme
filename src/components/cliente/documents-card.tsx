import { Download, FileText, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FinanceDocument } from "@/lib/data/types";

export function DocumentsCard({ documents }: { documents: FinanceDocument[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">
        Contratos &amp; documentos
      </h2>

      <ul className="space-y-2">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-3 rounded-xl bg-white/5 p-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {doc.title}
              </p>
              <p className="truncate text-xs text-muted">
                {doc.meta} · PDF · {doc.sizeLabel}
              </p>
            </div>
            <button
              className="inline-flex items-center justify-center rounded-lg border border-line bg-white/5 p-2 text-muted transition-colors hover:text-ink"
              aria-label={`Baixar ${doc.title}`}
            >
              <Download className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white/5 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-white/10">
        <RefreshCw className="h-4 w-4" /> Solicitar renovação ou revisão
      </button>
    </Card>
  );
}
