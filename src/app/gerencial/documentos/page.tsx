import { FolderOpen, Upload } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";

export default function GerencialDocumentos() {
  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Contratos, propostas e materiais compartilhados da agência."
      />
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle text-muted">
          <FolderOpen className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            Nenhum documento ainda
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Em breve você poderá centralizar contratos, propostas e arquivos por
            cliente aqui.
          </p>
        </div>
        <button
          disabled
          className="mt-1 inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-muted opacity-60"
          title="Disponível em breve"
        >
          <Upload className="h-4 w-4" />
          Enviar documento
        </button>
      </Card>
    </div>
  );
}
