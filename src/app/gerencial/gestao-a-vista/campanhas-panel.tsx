import { CampaignsTable } from "@/components/dashboard/campaigns-table";
import { getCampaigns, getClients } from "@/lib/data/queries";

/** Aba "Campanhas" da Gestão à Vista (todas as campanhas da carteira). */
export async function CampanhasPanel() {
  const campaigns = await getCampaigns();
  const clients = await getClients();
  const clientNameById = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  return (
    <CampaignsTable campaigns={campaigns} clientNameById={clientNameById} />
  );
}
