import { PageHeader } from "@/components/dashboard/page-header";
import { getClients, getCrmLeads } from "@/lib/data/queries";
import { getBroadcasts } from "@/lib/data/broadcasts-server";
import { cleanNumber } from "@/lib/data/broadcasts";
import { BroadcastsWorkspace } from "@/components/gerencial/broadcasts-workspace";

export default async function DisparosPage() {
  const [broadcasts, clients, leads] = await Promise.all([getBroadcasts(), getClients(), getCrmLeads()]);
  const clientsWithWa = clients.filter((c) => cleanNumber(c.whatsapp ?? "").length >= 12).length;
  const leadsWithPhone = leads.filter((l) => cleanNumber(l.contactPhone ?? "").length >= 12).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Disparos em massa"
        subtitle="Envie mensagens de WhatsApp para clientes, leads, listas e grupos. Intervalo anti-ban, variáveis de planilha e agendamento."
      />
      <BroadcastsWorkspace broadcasts={broadcasts} clientsWithWa={clientsWithWa} leadsWithPhone={leadsWithPhone} />
    </div>
  );
}
