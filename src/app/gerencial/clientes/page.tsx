import { Plus } from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
} from "@/components/brand/social-icons";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAccountSeries,
  getCampaigns,
  getClients,
} from "@/lib/data/queries";
import { formatBRL, formatCompact } from "@/lib/utils";

export default async function GerencialClientes() {
  const clients = await getClients();
  const rows = await Promise.all(
    clients.map(async (client) => {
      const campaigns = await getCampaigns(client.id);
      const ig = await getAccountSeries(client.id, "instagram");
      const fb = await getAccountSeries(client.id, "facebook");
      return {
        client,
        followers: (ig.at(-1)?.followers ?? 0) + (fb.at(-1)?.followers ?? 0),
        spend: campaigns.reduce((s, c) => s + c.spend, 0),
        campaigns: campaigns.length,
      };
    }),
  );

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Empresas atendidas pela Viofilme."
        action={
          <Button size="sm">
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ client, followers, spend, campaigns }) => (
          <Card key={client.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
                  {client.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-ink">{client.name}</p>
                  <p className="text-xs text-muted">{client.segment}</p>
                </div>
              </div>
              <Badge variant={client.status === "ativo" ? "success" : "warning"}>
                {client.status}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-ink">
                  {formatCompact(followers)}
                </p>
                <p className="text-[11px] text-muted">Seguidores</p>
              </div>
              <div>
                <p className="text-sm font-bold text-ink">{campaigns}</p>
                <p className="text-[11px] text-muted">Campanhas</p>
              </div>
              <div>
                <p className="text-sm font-bold text-ink">{formatBRL(spend)}</p>
                <p className="text-[11px] text-muted">Investido</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                {client.instagramUsername && (
                  <span className="inline-flex items-center gap-1">
                    <InstagramIcon className="h-3.5 w-3.5" />@
                    {client.instagramUsername}
                  </span>
                )}
              </div>
              {client.metaConnected ? (
                <Badge variant="success">Meta conectada</Badge>
              ) : (
                <Badge variant="muted">
                  <FacebookIcon className="h-3 w-3" /> conectar
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
