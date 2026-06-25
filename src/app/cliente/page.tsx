import { Eye, Heart, Tag, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getClientHome } from "@/lib/data/queries";
import { REFERENCE_DATE } from "@/lib/data/mock";
import { meetingLabel, relativePostLabel } from "@/lib/datetime";
import { formatBRL, formatCompact, formatNumber } from "@/lib/utils";
import { HomeHeader } from "@/components/cliente/home-header";
import { MetricCard } from "@/components/cliente/metric-card";
import { ApprovalAlert } from "@/components/cliente/approval-alert";
import { EngagementCard } from "@/components/cliente/engagement-card";
import { MediaBudgetCard } from "@/components/cliente/media-budget-card";
import {
  UpcomingPostsCard,
  type UpcomingPostItem,
} from "@/components/cliente/upcoming-posts-card";
import {
  MeetingsCard,
  type MeetingItem,
} from "@/components/cliente/meetings-card";
import { MessageBar } from "@/components/cliente/message-bar";

const fmt1 = (n: number) =>
  Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
const fmt2 = (n: number) =>
  Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default async function ClienteHome() {
  const user = await getSession();
  if (!user?.clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sua conta ainda não está vinculada a um cliente. Fale com a Viofilme.
      </Card>
    );
  }

  const home = await getClientHome(user.clientId);
  const refIso = REFERENCE_DATE.toISOString();

  const upcoming: UpcomingPostItem[] = home.upcomingPosts
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      title: p.caption,
      platform: p.platform,
      whenLabel: relativePostLabel(p.scheduledAt as string, refIso),
      status: p.approval === "pending" ? "pending" : "approved",
    }));

  const meetings: MeetingItem[] = home.meetings.map((m) => ({
    id: m.id,
    title: m.title,
    whenLabel: meetingLabel(m.startsAt),
    joinUrl: m.joinUrl,
  }));

  const eng = home.organicEngagement;
  const reach = home.reach;
  const cpl = home.cpl;

  return (
    <div className="space-y-4">
      <HomeHeader
        clientName={home.clientName}
        periodLabel={home.periodLabel}
        pendingApprovals={home.pendingApprovals}
      />

      {/* Métricas de cabeçalho */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Heart}
          label="Engajamento orgânico"
          value={`${fmt1(eng.value)}%`}
          deltaText={`${eng.delta >= 0 ? "+" : "-"}${fmt1(eng.delta)}pp vs. maio`}
          tone={eng.delta >= 0 ? "good" : "bad"}
          deltaDirection={eng.delta >= 0 ? "up" : "down"}
        />
        <MetricCard
          icon={Eye}
          label="Alcance no mês"
          value={formatCompact(reach.value)}
          deltaText={`${reach.delta >= 0 ? "+" : "-"}${Math.abs(reach.delta)}% vs. maio`}
          tone={reach.delta >= 0 ? "good" : "bad"}
          deltaDirection={reach.delta >= 0 ? "up" : "down"}
        />
        <MetricCard
          icon={Tag}
          label="Custo por lead (CPL)"
          value={formatBRL(cpl.value)}
          deltaText={`${cpl.delta >= 0 ? "+" : "-"}R$ ${fmt2(cpl.delta)} vs. maio`}
          tone={cpl.delta > 0 ? "bad" : "good"}
          deltaDirection={cpl.delta > 0 ? "up" : "down"}
        />
        <MetricCard
          icon={Wallet}
          label="Investimento ativo"
          value={`R$ ${formatNumber(home.media.invested)}`}
          hint={`de R$ ${formatNumber(home.media.total)} / mês`}
        />
      </div>

      {/* Alerta de gargalo */}
      <ApprovalAlert
        count={home.pendingApprovals}
        oldestDays={home.oldestApprovalDays}
      />

      {/* Engajamento + Orçamento de mídia */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EngagementCard series={home.engagementSeries} />
        </div>
        <MediaBudgetCard {...home.media} />
      </div>

      {/* Agenda: publicações + reuniões */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingPostsCard items={upcoming} />
        </div>
        <MeetingsCard items={meetings} />
      </div>

      <MessageBar />
    </div>
  );
}
