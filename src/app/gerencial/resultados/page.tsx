import { BarChart3, DollarSign, Target, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SimpleBarChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgencyOverview } from "@/lib/data/queries";
import { formatBRL, formatCompact } from "@/lib/utils";

export default async function GerencialResultados() {
  const o = await getAgencyOverview();

  const reachByClient = o.perClient.map((p) => ({
    name: p.client.name,
    reach: p.reach,
  }));
  const followersByClient = o.perClient
    .map((p) => ({ name: p.client.name, followers: p.followers }))
    .sort((a, b) => b.followers - a.followers);

  return (
    <div>
      <PageHeader
        title="Resultados"
        subtitle="Desempenho consolidado da carteira de clientes."
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Alcance total"
          value={formatCompact(o.totalReach)}
          icon={BarChart3}
        />
        <StatCard
          label="Investimento"
          value={formatBRL(o.totalSpend)}
          icon={DollarSign}
        />
        <StatCard
          label="Conversões"
          value={formatCompact(o.totalConversions)}
          icon={Target}
        />
        <StatCard
          label="Campanhas ativas"
          value={String(o.activeCampaigns)}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alcance por cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={reachByClient}
              dataKey="reach"
              labelKey="name"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Seguidores por cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={followersByClient}
              dataKey="followers"
              labelKey="name"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
