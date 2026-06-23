import Link from "next/link";
import {
  BarChart3,
  CalendarClock,
  DollarSign,
  Megaphone,
  Plug,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SimpleBarChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAgencyOverview } from "@/lib/data/queries";
import { formatBRL, formatCompact, formatNumber } from "@/lib/utils";

export default async function GerencialDashboard() {
  const o = await getAgencyOverview();

  const spendByClient = o.perClient.map((p) => ({
    name: p.client.name,
    spend: p.spend,
  }));

  return (
    <div>
      <PageHeader
        title="Visão geral"
        subtitle="Desempenho consolidado de todos os clientes da agência."
        action={
          <Link href="/gerencial/clientes">
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4" /> Gerenciar clientes
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Clientes ativos"
          value={`${o.activeClients}/${o.totalClients}`}
          icon={Users}
          hint={`${o.connectedAccounts} com Meta conectada`}
        />
        <StatCard
          label="Campanhas ativas"
          value={formatNumber(o.activeCampaigns)}
          icon={Megaphone}
        />
        <StatCard
          label="Investimento total"
          value={formatBRL(o.totalSpend)}
          icon={DollarSign}
        />
        <StatCard
          label="Alcance total"
          value={formatCompact(o.totalReach)}
          icon={BarChart3}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Investimento por cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={spendByClient}
              dataKey="spend"
              labelKey="name"
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          <StatCard
            label="Conversões"
            value={formatCompact(o.totalConversions)}
            icon={BarChart3}
          />
          <StatCard
            label="Posts agendados"
            value={formatNumber(o.postsScheduled)}
            icon={CalendarClock}
          />
          <Link href="/gerencial/integracoes">
            <Card className="flex items-center gap-3 p-5 transition-shadow hover:shadow-md">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Plug className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-sm font-medium text-ink">Integrações Meta</p>
                <p className="text-xs text-muted">
                  Conectar Instagram e Facebook
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-3 font-medium">Cliente</th>
                  <th className="px-2 py-3 font-medium">Segmento</th>
                  <th className="px-2 py-3 font-medium">Meta</th>
                  <th className="px-2 py-3 text-right font-medium">Seguidores</th>
                  <th className="px-2 py-3 text-right font-medium">Campanhas</th>
                  <th className="px-2 py-3 text-right font-medium">Investido</th>
                </tr>
              </thead>
              <tbody>
                {o.perClient.map(({ client, followers, activeCampaigns, spend }) => (
                  <tr
                    key={client.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-2 py-3 font-medium text-ink">
                      {client.name}
                    </td>
                    <td className="px-2 py-3 text-muted">{client.segment}</td>
                    <td className="px-2 py-3">
                      {client.metaConnected ? (
                        <Badge variant="success">Conectada</Badge>
                      ) : (
                        <Badge variant="muted">Pendente</Badge>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {formatCompact(followers)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {activeCampaigns}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {formatBRL(spend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
