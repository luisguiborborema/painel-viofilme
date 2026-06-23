import Link from "next/link";
import {
  CalendarClock,
  DollarSign,
  Heart,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendAreaChart } from "@/components/dashboard/charts";
import { ContentGrid } from "@/components/dashboard/content-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { getClientOverview, getContent } from "@/lib/data/queries";
import { formatBRL, formatCompact, formatPercent } from "@/lib/utils";

export default async function ClienteDashboard() {
  const user = await getSession();
  const clientId = user?.clientId;

  if (!clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sua conta ainda não está vinculada a um cliente. Fale com a Viofilme.
      </Card>
    );
  }

  const o = await getClientOverview(clientId);
  const content = await getContent(clientId);
  const recent = content.filter((c) => c.status === "published").slice(0, 4);
  const scheduled = content.filter((c) => c.status === "scheduled").slice(0, 4);

  return (
    <div>
      <PageHeader
        title={`Olá, ${user?.name?.split(" ")[0] ?? ""} 👋`}
        subtitle="Aqui está o resumo do seu Instagram e Facebook nos últimos 30 dias."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Seguidores"
          value={formatCompact(o.followers)}
          icon={Users}
          change={o.followersChange}
          hint="vs. 30 dias"
        />
        <StatCard
          label="Alcance (30d)"
          value={formatCompact(o.reach30d)}
          icon={TrendingUp}
        />
        <StatCard
          label="Engajamento"
          value={formatPercent(o.engagementRate)}
          icon={Heart}
          hint="média dos posts"
        />
        <StatCard
          label="Investido em mídia"
          value={formatBRL(o.totalSpend)}
          icon={DollarSign}
          hint={`${formatCompact(o.totalConversions)} conversões`}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Alcance ao longo do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendAreaChart data={o.series} dataKey="reach" />
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Conteúdo recente</h2>
        <Link href="/cliente/conteudo">
          <Button variant="ghost" size="sm">
            Ver tudo
          </Button>
        </Link>
      </div>
      <div className="mt-3">
        <ContentGrid posts={recent} />
      </div>

      {scheduled.length > 0 && (
        <>
          <div className="mt-8 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-ink">Próximos agendados</h2>
          </div>
          <div className="mt-3">
            <ContentGrid posts={scheduled} />
          </div>
        </>
      )}
    </div>
  );
}
