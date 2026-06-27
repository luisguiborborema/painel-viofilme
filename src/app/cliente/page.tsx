import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import {
  getClientHome,
  getClientHomeMetrics,
  getOrganicResults,
} from "@/lib/data/queries";
import { REFERENCE_DATE } from "@/lib/data/mock";
import { meetingLabel, relativePostLabel } from "@/lib/datetime";
import { HomeHeader } from "@/components/cliente/home-header";
import { HomeMetrics } from "@/components/cliente/home-metrics";
import { ApprovalAlert } from "@/components/cliente/approval-alert";
import { MediaBudgetCard } from "@/components/cliente/media-budget-card";
import { OrganicSideBlock } from "@/components/cliente/organic-side-block";
import {
  UpcomingPostsCard,
  type UpcomingPostItem,
} from "@/components/cliente/upcoming-posts-card";
import {
  MeetingsCard,
  type MeetingItem,
} from "@/components/cliente/meetings-card";

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
  const { pool, defaultKeys, hasPaidTraffic } = await getClientHomeMetrics(
    user.clientId,
  );
  const refIso = REFERENCE_DATE.toISOString();

  const upcoming: UpcomingPostItem[] = home.upcomingPosts.slice(0, 4).map((p) => ({
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
    agenda: m.agenda,
    participants: m.participants,
    nextSteps: m.nextSteps,
  }));

  // Coluna direita condicional ao tipo de cliente (R05).
  let rightColumn: React.ReactNode;
  if (hasPaidTraffic) {
    rightColumn = <MediaBudgetCard {...home.media} />;
  } else {
    const org = await getOrganicResults(user.clientId);
    const f = org.reachByFormat;
    rightColumn = (
      <OrganicSideBlock
        items={[
          { name: "Reels", value: f.reels, color: "#ec4899" },
          { name: "Feed", value: f.feed, color: "#2a63c9" },
          { name: "Stories", value: f.stories, color: "#8b5cf6" },
          { name: "Carrossel", value: f.carousel, color: "#34d399" },
        ]}
      />
    );
  }

  return (
    <div className="space-y-4">
      <HomeHeader
        clientName={home.clientName}
        periodLabel={home.periodLabel}
        pendingApprovals={home.pendingApprovals}
      />

      {/* KPIs como seletor de métrica + gráfico + coluna direita (R01/R02/R05) */}
      <HomeMetrics pool={pool} defaultKeys={defaultKeys} rightColumn={rightColumn} />

      <ApprovalAlert
        count={home.pendingApprovals}
        oldestDays={home.oldestApprovalDays}
      />

      {/* Agenda: publicações + reuniões */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingPostsCard items={upcoming} />
        </div>
        <MeetingsCard items={meetings} />
      </div>
    </div>
  );
}
