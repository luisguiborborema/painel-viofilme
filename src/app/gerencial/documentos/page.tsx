import { PageHeader } from "@/components/dashboard/page-header";
import { PlaybooksApp } from "@/components/gerencial/playbooks-app";
import { getPlaybookSectors } from "@/lib/data/queries";

export const metadata = { title: "Playbooks" };


export default async function GerencialDocumentos() {
  const sectors = await getPlaybookSectors();
  return (
    <div>
      <PageHeader
        title="Playbooks"
        subtitle="Documentos e processos da agência por setor — em Markdown ou HTML."
      />
      <PlaybooksApp sectors={sectors} />
    </div>
  );
}
