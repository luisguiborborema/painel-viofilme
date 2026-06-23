import { DollarSign, MousePointerClick, Target, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { CampaignsTable } from "@/components/dashboard/campaigns-table";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getCampaigns } from "@/lib/data/queries";
import { formatBRL, formatCompact } from "@/lib/utils";

export default async function ClienteCampanhas() {
  const user = await getSession();
  if (!user?.clientId) {
    return <Card className="p-10 text-center text-sm text-muted">Sem cliente vinculado.</Card>;
  }

  const campaigns = await getCampaigns(user.clientId);
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const reach = campaigns.reduce((s, c) => s + c.reach, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  return (
    <div>
      <PageHeader
        title="Campanhas"
        subtitle="Investimento e desempenho dos anúncios em Instagram e Facebook."
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Investido" value={formatBRL(spend)} icon={DollarSign} />
        <StatCard label="Alcance" value={formatCompact(reach)} icon={TrendingUp} />
        <StatCard
          label="Cliques"
          value={formatCompact(clicks)}
          icon={MousePointerClick}
        />
        <StatCard
          label="Conversões"
          value={formatCompact(conversions)}
          icon={Target}
        />
      </div>

      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
