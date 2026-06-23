import { PageHeader } from "@/components/dashboard/page-header";
import { CampaignsTable } from "@/components/dashboard/campaigns-table";
import { getCampaigns, getClients } from "@/lib/data/queries";

export default async function GerencialCampanhas() {
  const campaigns = await getCampaigns();
  const clients = await getClients();
  const clientNameById = Object.fromEntries(
    clients.map((c) => [c.id, c.name]),
  );

  return (
    <div>
      <PageHeader
        title="Campanhas"
        subtitle="Todas as campanhas ativas e encerradas dos clientes."
      />
      <CampaignsTable campaigns={campaigns} clientNameById={clientNameById} />
    </div>
  );
}
