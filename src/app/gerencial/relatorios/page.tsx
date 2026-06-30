import { FileBarChart } from "lucide-react";
import { RelatoriosCentral } from "@/components/gerencial/relatorios-central";

export default function GerencialRelatorios() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <FileBarChart className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Central de relatórios
          </h1>
          <p className="text-sm text-muted">
            Gere o relatório de resultados (orgânico + pago) para a call mensal.
          </p>
        </div>
      </div>

      <RelatoriosCentral />
    </div>
  );
}
