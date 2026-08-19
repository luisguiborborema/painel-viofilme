import { PageHeader } from "@/components/dashboard/page-header";
import { getAllNpsView } from "@/lib/data/queries";
import { npsSummary } from "@/lib/data/nps";
import { NpsOverview } from "@/components/gerencial/nps-overview";

export const metadata = { title: "NPS" };


export default async function GerencialNps() {
  const entries = await getAllNpsView();
  const summary = npsSummary(entries);

  return (
    <div className="space-y-4">
      <PageHeader
        title="NPS — todos os clientes"
        subtitle="Respostas de satisfação de toda a carteira. Cada resposta também aparece no histórico de NPS do cliente."
      />
      <NpsOverview entries={entries} summary={summary} />
    </div>
  );
}
