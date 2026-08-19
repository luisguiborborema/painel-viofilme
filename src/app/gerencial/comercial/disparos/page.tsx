import { PageHeader } from "@/components/dashboard/page-header";
import { getClients, getCrmLeads } from "@/lib/data/queries";
import { getBroadcasts } from "@/lib/data/broadcasts-server";
import { cleanNumber } from "@/lib/data/broadcasts";
import { BroadcastsPanel } from "@/components/gerencial/broadcasts-panel";

export default async function DisparosPage() {
  const [broadcasts, clients, leads] = await Promise.all([getBroadcasts(), getClients(), getCrmLeads()]);
  const clientsWithWa = clients.filter((c) => cleanNumber(c.whatsapp ?? "").length >= 12).length;
  const leadsWithPhone = leads.filter((l) => cleanNumber(l.contactPhone ?? "").length >= 12).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Disparos em massa"
        subtitle="Envie mensagens de WhatsApp para clientes, leads, listas e grupos. Intervalo anti-ban entre envios e agendamento."
      />
      <BroadcastsPanel broadcasts={broadcasts} clientsWithWa={clientsWithWa} leadsWithPhone={leadsWithPhone} />
    </div>
  );
}
