import {
  ACCOUNT_SERIES,
  CAMPAIGNS,
  CLIENTS,
  CONTENT,
  ENGAGEMENT_SERIES,
  MEDIA,
  MEETINGS,
  REFERENCE_DATE,
} from "./mock";
import type {
  AccountMetricPoint,
  AdCampaign,
  Campaign,
  Client,
  ContentPost,
  CplMonthPoint,
  EngagementPoint,
  Meeting,
  Platform,
  PostStatus,
} from "./types";

/**
 * Camada de acesso a dados.
 *
 * Hoje serve dados de demonstração (mock). Quando o Supabase estiver
 * configurado e populado pela sincronização da Meta Graph API, cada função
 * abaixo passa a consultar o banco — a assinatura permanece a mesma, então
 * as páginas não mudam.
 */

export async function getClients(): Promise<Client[]> {
  return CLIENTS;
}

export async function getClientById(
  id: string | null,
): Promise<Client | undefined> {
  if (!id) return undefined;
  return CLIENTS.find((c) => c.id === id);
}

export async function getCampaigns(clientId?: string): Promise<Campaign[]> {
  const list = clientId
    ? CAMPAIGNS.filter((c) => c.clientId === clientId)
    : CAMPAIGNS;
  return [...list].sort((a, b) => b.spend - a.spend);
}

export async function getContent(
  clientId?: string,
  status?: PostStatus,
): Promise<ContentPost[]> {
  let list = clientId
    ? CONTENT.filter((c) => c.clientId === clientId)
    : CONTENT;
  if (status) list = list.filter((c) => c.status === status);
  return [...list].sort((a, b) => {
    const da = a.publishedAt ?? a.scheduledAt ?? "";
    const db = b.publishedAt ?? b.scheduledAt ?? "";
    return db.localeCompare(da);
  });
}

export async function getAccountSeries(
  clientId: string,
  platform: Platform,
): Promise<AccountMetricPoint[]> {
  return ACCOUNT_SERIES[`${clientId}:${platform}`] ?? [];
}

export type ClientOverview = {
  followers: number;
  followersChange: number;
  reach30d: number;
  engagementRate: number;
  postsPublished: number;
  postsScheduled: number;
  totalSpend: number;
  totalConversions: number;
  series: AccountMetricPoint[];
};

export async function getClientOverview(
  clientId: string,
): Promise<ClientOverview> {
  const ig = await getAccountSeries(clientId, "instagram");
  const fb = await getAccountSeries(clientId, "facebook");
  const content = await getContent(clientId);
  const campaigns = await getCampaigns(clientId);

  // Série combinada (soma das duas plataformas por dia)
  const series: AccountMetricPoint[] = ig.map((p, i) => ({
    date: p.date,
    followers: p.followers + (fb[i]?.followers ?? 0),
    reach: p.reach + (fb[i]?.reach ?? 0),
    impressions: p.impressions + (fb[i]?.impressions ?? 0),
    profileViews: p.profileViews + (fb[i]?.profileViews ?? 0),
  }));

  const followers = series.at(-1)?.followers ?? 0;
  const followersStart = series.at(0)?.followers ?? followers;
  const followersChange =
    followersStart > 0
      ? ((followers - followersStart) / followersStart) * 100
      : 0;
  const reach30d = series.reduce((s, p) => s + p.reach, 0);

  const published = content.filter((c) => c.status === "published");
  const totalEngagement = published.reduce(
    (s, p) => s + p.likes + p.comments + p.shares + p.saves,
    0,
  );
  const totalReach = published.reduce((s, p) => s + p.reach, 0) || 1;
  const engagementRate = (totalEngagement / totalReach) * 100;

  return {
    followers,
    followersChange,
    reach30d,
    engagementRate,
    postsPublished: published.length,
    postsScheduled: content.filter((c) => c.status === "scheduled").length,
    totalSpend: campaigns.reduce((s, c) => s + c.spend, 0),
    totalConversions: campaigns.reduce((s, c) => s + c.conversions, 0),
    series,
  };
}

export type AgencyOverview = {
  totalClients: number;
  activeClients: number;
  connectedAccounts: number;
  activeCampaigns: number;
  totalSpend: number;
  totalReach: number;
  totalConversions: number;
  postsScheduled: number;
  perClient: {
    client: Client;
    spend: number;
    reach: number;
    activeCampaigns: number;
    followers: number;
  }[];
};

export async function getAgencyOverview(): Promise<AgencyOverview> {
  const clients = await getClients();
  const perClient = await Promise.all(
    clients.map(async (client) => {
      const campaigns = await getCampaigns(client.id);
      const ig = await getAccountSeries(client.id, "instagram");
      const fb = await getAccountSeries(client.id, "facebook");
      const followers =
        (ig.at(-1)?.followers ?? 0) + (fb.at(-1)?.followers ?? 0);
      return {
        client,
        spend: campaigns.reduce((s, c) => s + c.spend, 0),
        reach: campaigns.reduce((s, c) => s + c.reach, 0),
        activeCampaigns: campaigns.filter((c) => c.status === "active").length,
        followers,
      };
    }),
  );

  const content = await getContent();

  return {
    totalClients: clients.length,
    activeClients: clients.filter((c) => c.status === "ativo").length,
    connectedAccounts: clients.filter((c) => c.metaConnected).length,
    activeCampaigns: perClient.reduce((s, c) => s + c.activeCampaigns, 0),
    totalSpend: perClient.reduce((s, c) => s + c.spend, 0),
    totalReach: perClient.reduce((s, c) => s + c.reach, 0),
    totalConversions: CAMPAIGNS.reduce((s, c) => s + c.conversions, 0),
    postsScheduled: content.filter((c) => c.status === "scheduled").length,
    perClient: perClient.sort((a, b) => b.spend - a.spend),
  };
}

// ---------------------------------------------------------------------------
// Home do cliente (M1)
// ---------------------------------------------------------------------------

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Dados curados por cliente para uma demo polida (espelham o mockup). */
const HOME_TUNING = [
  { total: 3000, pct: 0.72, cpl: 8.4, cplDelta: 1.2, leads: 257, conversions: 31, eng: 4.2, engDelta: 0.6, reach: 18400, reachDelta: 12 },
  { total: 2500, pct: 0.58, cpl: 11.2, cplDelta: -0.4, leads: 130, conversions: 22, eng: 3.1, engDelta: -0.2, reach: 12100, reachDelta: 7 },
  { total: 2000, pct: 0.41, cpl: 6.7, cplDelta: 0.8, leads: 122, conversions: 40, eng: 2.8, engDelta: 0.4, reach: 9800, reachDelta: 9 },
  { total: 3500, pct: 0.85, cpl: 9.1, cplDelta: 2.1, leads: 327, conversions: 28, eng: 3.9, engDelta: 0.3, reach: 24600, reachDelta: -3 },
];

export type Metric = { value: number; delta: number };

export type ClientHome = {
  clientName: string;
  periodLabel: string;
  pendingApprovals: number;
  oldestApprovalDays: number;
  organicEngagement: Metric; // delta em pontos percentuais
  reach: Metric; // delta em %
  cpl: Metric; // delta em R$ (positivo = piora)
  media: {
    invested: number;
    total: number;
    pct: number;
    leads: number;
    conversions: number;
    daysRemaining: number;
    balance: number;
  };
  engagementSeries: EngagementPoint[];
  upcomingPosts: ContentPost[];
  meetings: Meeting[];
};

export async function getClientHome(clientId: string): Promise<ClientHome> {
  const idx = Math.max(
    0,
    CLIENTS.findIndex((c) => c.id === clientId),
  );
  const tuning = HOME_TUNING[idx % HOME_TUNING.length];
  const client = CLIENTS[idx];

  const content = await getContent(clientId);
  const scheduled = content
    .filter((c) => c.status === "scheduled")
    .sort((a, b) =>
      (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""),
    );
  const pending = scheduled.filter((c) => c.approval === "pending");

  const invested = Math.round(tuning.total * tuning.pct);
  const ref = REFERENCE_DATE;
  const daysInMonth = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const daysRemaining = daysInMonth - ref.getUTCDate();

  return {
    clientName: client?.name ?? "Cliente",
    periodLabel: `${MESES[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`,
    pendingApprovals: pending.length,
    oldestApprovalDays: pending.length > 0 ? 2 : 0,
    organicEngagement: { value: tuning.eng, delta: tuning.engDelta },
    reach: { value: tuning.reach, delta: tuning.reachDelta },
    cpl: { value: tuning.cpl, delta: tuning.cplDelta },
    media: {
      invested,
      total: tuning.total,
      pct: Math.round(tuning.pct * 100),
      leads: tuning.leads,
      conversions: tuning.conversions,
      daysRemaining,
      balance: tuning.total - invested,
    },
    engagementSeries: ENGAGEMENT_SERIES[clientId] ?? [],
    upcomingPosts: scheduled,
    meetings: MEETINGS.filter((m) => m.clientId === clientId).sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    ),
  };
}

// ---------------------------------------------------------------------------
// Campanhas — performance de mídia paga (M3)
// ---------------------------------------------------------------------------

export type MediaPerformance = {
  periodLabel: string;
  invested: number;
  budget: number;
  pct: number;
  daysRemaining: number;
  balance: number;
  dailyPace: number;
  metaInvested: number;
  googleInvested: number;
  leads: number;
  leadsDelta: number;
  cpl: number;
  cplDelta: number;
  conversions: number;
  convDelta: number;
  cpa: number;
  cplHistory: CplMonthPoint[];
  campaigns: AdCampaign[];
  insight: string;
};

export async function getMediaPerformance(
  clientId: string,
): Promise<MediaPerformance> {
  const m = MEDIA[clientId] ?? MEDIA[CLIENTS[0].id];
  const ref = REFERENCE_DATE;
  const daysInMonth = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const daysRemaining = daysInMonth - ref.getUTCDate();
  const invested = m.metaInvested + m.googleInvested;

  const months = [3, 2, 1, 0].map((k) =>
    MESES[(ref.getUTCMonth() - k + 12) % 12].slice(0, 3),
  );
  const cplHistory: CplMonthPoint[] = months.map((month, i) => ({
    month,
    meta: m.cplHistory.meta[i],
    google: m.cplHistory.google[i],
  }));

  const campaigns: AdCampaign[] = m.campaigns.map((c, i) => ({
    id: `ad-${clientId}-${i + 1}`,
    clientId,
    ...c,
  }));

  return {
    periodLabel: `${MESES[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`,
    invested,
    budget: m.budget,
    pct: Math.round((invested / m.budget) * 100),
    daysRemaining,
    balance: m.budget - invested,
    dailyPace: m.dailyPace,
    metaInvested: m.metaInvested,
    googleInvested: m.googleInvested,
    leads: m.leads,
    leadsDelta: m.leadsDelta,
    cpl: m.cpl,
    cplDelta: m.cplDelta,
    conversions: m.conversions,
    convDelta: m.convDelta,
    cpa: m.cpa,
    cplHistory,
    campaigns,
    insight: m.insight,
  };
}
