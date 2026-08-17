import {
  ACCOUNT_SERIES,
  CAMPAIGNS,
  CLIENTS,
  CONTENT,
  ENGAGEMENT_SERIES,
  FINANCE_TUNING,
  MEDIA,
  MEETINGS,
  ORGANIC,
  REFERENCE_DATE,
} from "./mock";
import { daysUntil, fullDate } from "@/lib/datetime";
import { formatBRL, formatCompact, formatNumber } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as sb from "./supabase";
import type { MetricDef } from "@/components/dashboard/metric-chart-panel";
import type {
  AccessItem,
  AccountMetricPoint,
  ActivityItem,
  AdCampaign,
  AudienceProfile,
  BrandAsset,
  Campaign,
  Client,
  ContentPost,
  CplMonthPoint,
  EngagementPoint,
  FinanceDocument,
  FollowersMonthPoint,
  FormatReach,
  Invoice,
  Meeting,
  OrganicScope,
  Platform,
  PostStatus,
  TeamMember,
  TopPost,
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
  if (isSupabaseConfigured()) return sb.sbGetClients();
  return CLIENTS;
}

export async function getClientById(
  id: string | null,
): Promise<Client | undefined> {
  if (isSupabaseConfigured()) return sb.sbGetClientById(id);
  if (!id) return undefined;
  return CLIENTS.find((c) => c.id === id);
}

export async function getCampaigns(clientId?: string): Promise<Campaign[]> {
  if (isSupabaseConfigured()) return sb.sbGetCampaigns(clientId);
  const list = clientId
    ? CAMPAIGNS.filter((c) => c.clientId === clientId)
    : CAMPAIGNS;
  return [...list].sort((a, b) => b.spend - a.spend);
}

export async function getContent(
  clientId?: string,
  status?: PostStatus,
): Promise<ContentPost[]> {
  if (isSupabaseConfigured()) return sb.sbGetContent(clientId, status);
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
  if (isSupabaseConfigured()) return sb.sbGetAccountSeries(clientId, platform);
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
  if (isSupabaseConfigured()) return sb.sbGetClientOverview(clientId);
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
  if (isSupabaseConfigured()) return sb.sbGetClientHome(clientId);
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
  clientType: "lead_gen" | "ecommerce" | "local_business";
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
  if (isSupabaseConfigured()) return sb.sbGetMediaPerformance(clientId);
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
    cpc: Math.round((c.invested / Math.max(1, c.clicks)) * 100) / 100,
    cpa: Math.round((c.invested / Math.max(1, c.conversions)) * 100) / 100,
  }));

  const clientType =
    CLIENTS.find((c) => c.id === clientId)?.clientType ?? "lead_gen";

  return {
    clientType,
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

// ---------------------------------------------------------------------------
// Resultados orgânicos (M4)
// ---------------------------------------------------------------------------
const r1 = (n: number) => Math.round(n * 10) / 10;

export type OrganicScopeView = OrganicScope & { frequency: number };

export type OrganicResults = {
  periodLabel: string;
  totals: OrganicScopeView & { engagementAboveAvg: boolean };
  instagram: OrganicScopeView;
  facebook: OrganicScopeView;
  followersHistory: FollowersMonthPoint[];
  reachByFormat: FormatReach;
  engagementByFormat: FormatReach;
  volumeByFormat: FormatReach;
  audience: AudienceProfile;
  topPosts: TopPost[];
  teamPattern: string;
};

function normalizeFormat(f: FormatReach): FormatReach {
  const total = f.reels + f.feed + f.stories + f.carousel || 1;
  const r = (v: number) => Math.round((v / total) * 100);
  return {
    reels: r(f.reels),
    feed: r(f.feed),
    stories: r(f.stories),
    carousel: r(f.carousel),
  };
}

function withFrequency(s: OrganicScope): OrganicScopeView {
  return { ...s, frequency: s.reach > 0 ? r1(s.impressions / s.reach) : 0 };
}

export async function getOrganicResults(
  clientId: string,
): Promise<OrganicResults> {
  if (isSupabaseConfigured()) return sb.sbGetOrganicResults(clientId);
  const raw = ORGANIC[clientId] ?? ORGANIC[CLIENTS[0].id];
  const ig = raw.instagram;
  const fb = raw.facebook;
  const ref = REFERENCE_DATE;

  const reach = ig.reach + fb.reach;
  const impressions = ig.impressions + fb.impressions;
  const followers = ig.followers + fb.followers;
  const followersDelta = ig.followersDelta + fb.followersDelta;
  const wReach = reach || 1;
  const wImpr = impressions || 1;

  const totals: OrganicScopeView & { engagementAboveAvg: boolean } = {
    followers,
    followersDelta,
    followersDeltaPct: r1((followersDelta / (followers - followersDelta)) * 100),
    reach,
    reachDelta: Math.round(
      (ig.reachDelta * ig.reach + fb.reachDelta * fb.reach) / wReach,
    ),
    impressions,
    impressionsDelta: Math.round(
      (ig.impressionsDelta * ig.impressions +
        fb.impressionsDelta * fb.impressions) /
        wImpr,
    ),
    engagement: r1(
      (ig.engagement * ig.reach + fb.engagement * fb.reach) / wReach,
    ),
    engagementDelta: r1(
      (ig.engagementDelta * ig.reach + fb.engagementDelta * fb.reach) / wReach,
    ),
    frequency: r1(impressions / wReach),
    engagementAboveAvg: raw.engagementAboveAvg,
  };

  const months = [5, 4, 3, 2, 1, 0].map((k) =>
    MESES[(ref.getUTCMonth() - k + 12) % 12].slice(0, 3),
  );
  const followersHistory: FollowersMonthPoint[] = months.map((month, i) => ({
    month,
    instagram: raw.followersHistory6.instagram[i],
    facebook: raw.followersHistory6.facebook[i],
  }));

  return {
    periodLabel: `${MESES[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`,
    totals,
    instagram: withFrequency(ig),
    facebook: withFrequency(fb),
    followersHistory,
    reachByFormat: raw.reachByFormat,
    engagementByFormat: normalizeFormat({
      reels: raw.reachByFormat.reels * 1.6,
      feed: raw.reachByFormat.feed * 0.8,
      stories: raw.reachByFormat.stories * 0.7,
      carousel: raw.reachByFormat.carousel * 1.15,
    }),
    volumeByFormat: normalizeFormat({
      reels: raw.reachByFormat.reels * 0.5,
      feed: raw.reachByFormat.feed * 1.5,
      stories: raw.reachByFormat.stories * 1.3,
      carousel: raw.reachByFormat.carousel * 0.9,
    }),
    audience: raw.audience,
    topPosts: raw.topPosts.map((p, i) => ({ rank: i + 1, ...p })),
    teamPattern: raw.teamPattern,
  };
}

// ---------------------------------------------------------------------------
// Financeiro & contratos (M5)
// ---------------------------------------------------------------------------
export type FinanceOverview = {
  year: number;
  nextDue: {
    amount: number;
    dueDate: string;
    daysUntil: number;
    invoiceUrl?: string | null;
  } | null;
  lastPayment: {
    amount: number;
    paidDate: string;
    method: string;
    invoiceUrl?: string | null;
  } | null;
  plan: { name: string; activeSince: string };
  invoices: Invoice[];
  totalPaidYear: number;
  documents: FinanceDocument[];
};

export async function getFinance(clientId: string): Promise<FinanceOverview> {
  if (isSupabaseConfigured()) return sb.sbGetFinance(clientId);
  const idx = Math.max(
    0,
    CLIENTS.findIndex((c) => c.id === clientId),
  );
  const t = FINANCE_TUNING[idx % FINANCE_TUNING.length];
  const ref = REFERENCE_DATE;
  const year = ref.getUTCFullYear();
  const refMonth = ref.getUTCMonth();
  const refIso = ref.toISOString().slice(0, 10);

  const abbr = (m: number) => MESES[m].slice(0, 3);
  const dateISO = (m: number, d: number) =>
    new Date(Date.UTC(year, m, d)).toISOString().slice(0, 10);

  const invoices: Invoice[] = [];

  // Fatura em aberto (competência do próximo mês)
  const openMonth = refMonth + 1;
  invoices.push({
    id: `inv-${clientId}-${openMonth}`,
    competence: `${abbr(openMonth)} / ${year}`,
    description: t.description,
    amount: t.amount,
    dueDate: dateISO(openMonth, 3),
    status: "open",
    method: null,
    paidDate: null,
  });

  // Faturas pagas (mês atual para trás)
  for (let m = refMonth; m >= 0; m--) {
    invoices.push({
      id: `inv-${clientId}-${m}`,
      competence: `${abbr(m)} / ${year}`,
      description: t.description,
      amount: t.amount,
      dueDate: dateISO(m, 3),
      status: "paid",
      method: "PIX",
      paidDate: dateISO(m, 3),
    });
  }

  const open = invoices.find((i) => i.status === "open") ?? null;
  const lastPaid = invoices.find((i) => i.status === "paid") ?? null;
  const totalPaidYear = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);

  const documents: FinanceDocument[] = [
    {
      id: "doc-contrato",
      title: "Contrato de prestação de serviços",
      meta: `Versão atual · Assinado em ${fullDate(t.activeSince)}`,
      sizeLabel: "340 KB",
    },
    {
      id: "doc-aditivo",
      title: "Aditivo — inclusão de tráfego pago",
      meta: `Assinado em ${fullDate(dateISO(2, 5))}`,
      sizeLabel: "98 KB",
    },
    {
      id: "doc-proposta",
      title: "Proposta comercial original",
      meta: `Enviado em 20/12/${year - 1}`,
      sizeLabel: "1,2 MB",
    },
  ];

  return {
    year,
    nextDue: open
      ? {
          amount: open.amount,
          dueDate: open.dueDate,
          daysUntil: daysUntil(refIso, open.dueDate),
        }
      : null,
    lastPayment: lastPaid
      ? {
          amount: lastPaid.amount,
          paidDate: lastPaid.paidDate as string,
          method: lastPaid.method as string,
        }
      : null,
    plan: { name: t.plan, activeSince: t.activeSince },
    invoices,
    totalPaidYear,
    documents,
  };
}

// ---------------------------------------------------------------------------
// Financeiro gerencial (a receber / inadimplência do payments real; DRE mock)
// ---------------------------------------------------------------------------
import { getGerFinance as gerFinanceMock, type GerFinance } from "./gerfinance";

export async function getGerFinance(): Promise<GerFinance> {
  if (isSupabaseConfigured()) return sb.sbGetGerFinance();
  return gerFinanceMock();
}

import {
  getHourBank as hourBankMock,
  getEmployees as employeesMock,
  getEmployeeProfile as employeeProfileMock,
  getAnnouncements as announcementsMock,
  getPdisMock,
  getReviewsMock,
  type Announcement,
  type Employee,
  type EmployeeProfile,
  type HourBankView,
  type PdiItem,
  type ReviewItem,
} from "./rh";

/** Banco de horas: saldo do mês por colaborador (real via hour_entries). */
export async function getHourBankView(): Promise<HourBankView> {
  if (isSupabaseConfigured()) return sb.sbGetHourBank();
  return hourBankMock();
}

/**
 * Colaboradores do RH. Real (tabela collaborators) quando Supabase configurado
 * e a tabela existe; senão, mock. Tabela vazia = lista vazia (demo some).
 */
export async function getEmployeesView(): Promise<Employee[]> {
  if (isSupabaseConfigured()) {
    const rows = await sb.sbGetEmployees();
    if (rows) return rows;
  }
  return employeesMock();
}

/** Mural de comunicados (real via rh_announcements; senão mock). */
export async function getAnnouncementsView(): Promise<Announcement[]> {
  if (isSupabaseConfigured()) {
    const rows = await sb.sbGetAnnouncements();
    if (rows) return rows;
  }
  return announcementsMock();
}

/** PDIs (objetivos) — real via rh_pdis; senão mock. */
export async function getPdisView(): Promise<PdiItem[]> {
  if (isSupabaseConfigured()) {
    const rows = await sb.sbGetPdis();
    if (rows) return rows;
  }
  return getPdisMock();
}

/** Avaliações — real via rh_reviews; senão mock. */
export async function getReviewsView(): Promise<ReviewItem[]> {
  if (isSupabaseConfigured()) {
    const rows = await sb.sbGetReviews();
    if (rows) return rows;
  }
  return getReviewsMock();
}

/** Um colaborador por id (para o perfil individual). */
export async function getEmployeeView(id: string): Promise<Employee | null> {
  const all = await getEmployeesView();
  return all.find((e) => e.id === id) ?? null;
}

/**
 * Perfil individual do colaborador. Para os ids de demonstração usa o mock rico;
 * para colaboradores reais (banco) monta o perfil com as seções auxiliares
 * vazias (banco de horas/PDI/avaliação ainda não têm dados por colaborador).
 */
export async function getEmployeeProfileView(id: string): Promise<EmployeeProfile | null> {
  const emp = await getEmployeeView(id);
  // Colaborador real: monta o perfil com PDIs, avaliações e banco de horas reais.
  if (emp) {
    const [pdis, reviews, bank] = await Promise.all([getPdisView(), getReviewsView(), getHourBankView()]);
    const myPdis = pdis.filter((p) => p.collaboratorId === id);
    const myReviews = reviews.filter((r) => r.collaboratorId === id);
    const latest = myReviews[0];
    const myEntries = bank.entries.filter((e) => e.employee === emp.name).slice(0, 6);
    return {
      employee: emp,
      weeks: myEntries.map((e) => ({ label: e.workDate, hours: e.hours, extra: e.hours > 0 })),
      documents: [],
      pdiObjectives: myPdis.map((p) => ({ title: p.title, indicator: p.indicator, status: p.status, deadline: p.deadline })),
      review: latest
        ? { self: latest.selfScore, leader: latest.leaderScore, criteria: [], note: latest.note }
        : { self: 0, leader: 0, criteria: [], note: "" },
      activity: [],
    };
  }
  // Sem Supabase / ids de demonstração: usa o mock rico.
  return employeeProfileMock(id);
}

import { resolveReportSummary } from "./reports";
import { FLUX_POSTS, type FluxPost } from "./flux";
import { getVioLaunchData, type VioLaunchData } from "./violaunch";
import {
  getDeliveryTasks as deliveryTasksMock,
  DELIVERY_CONFIG_FALLBACK,
  type DeliveryConfig,
  type DeliveryTask,
  type ReportSummary,
} from "./operacao";

/** Tarefas do Painel de Entregas — real (delivery_tasks) ou mock. */
export async function getDeliveryTasks(): Promise<DeliveryTask[]> {
  if (isSupabaseConfigured()) return sb.sbGetDeliveryTasks();
  return deliveryTasksMock();
}

/** Entregas de um cliente (por nome), real ou mock. */
export async function getClientTasks(clientName: string): Promise<DeliveryTask[]> {
  const all = await getDeliveryTasks();
  return all.filter((t) => t.client === clientName);
}

/** Config do Painel de Entregas (ENT10/ENT12) — real ou constantes fallback. */
export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  if (isSupabaseConfigured()) return sb.sbGetDeliveryConfig();
  return DELIVERY_CONFIG_FALLBACK;
}

/** VioFlux (FLX01) — posts de publicação, reais (vioflux_posts) ou mock. */
export async function getVioFluxPosts(): Promise<FluxPost[]> {
  if (isSupabaseConfigured()) return sb.sbGetVioFluxPosts();
  return FLUX_POSTS;
}

/** VioFlux por cliente (Portal FLX05) — posts do cliente para aprovação. */
export async function getVioFluxForClient(clientId: string): Promise<FluxPost[]> {
  if (isSupabaseConfigured()) return sb.sbGetVioFluxPosts(clientId);
  return FLUX_POSTS.filter((p) => p.clientId === clientId);
}

/** VioLaunch (HUB11) — projeto por cliente, real (persistido) ou mock. */
export async function getVioLaunchView(clientId: string, startDate = "01/07"): Promise<VioLaunchData> {
  if (isSupabaseConfigured()) return sb.sbGetVioLaunch(clientId, startDate);
  return getVioLaunchData(startDate);
}

import {
  getHubClientsOps as hubOpsMock,
  getEditorialLine as editorialLineMock,
  type HubClientOps,
  type EditorialLine,
  type EditorialLineCard,
  type EditorialDraft,
  type MediaDayView,
} from "./operacao";
import { getCSClientDetail as csDetailMock } from "./cs";
import type { CSClientDetail } from "./types";

/** Linha editorial do cliente — persistida (editorial_lines) ou mock demo. */
export async function getEditorialLineView(clientId: string, lineId?: string): Promise<EditorialLine> {
  if (isSupabaseConfigured()) return sb.sbGetEditorialLine(clientId, lineId);
  return editorialLineMock(clientId);
}

/** Todas as linhas editoriais do cliente (cards do quadro/kanban). */
export async function getEditorialLines(clientId: string): Promise<EditorialLineCard[]> {
  if (isSupabaseConfigured()) return sb.sbGetEditorialLines(clientId);
  return [];
}

/** Menções (@) do usuário — para a aba do Meu dia. */
export async function getUserMentions(userId: string) {
  if (isSupabaseConfigured() && userId) return sb.sbGetUserMentions(userId);
  return [];
}

/** Textos personalizados da apresentação (Método/Guia) do cliente. */
export async function getClientDeckConfig(clientId: string): Promise<unknown> {
  if (isSupabaseConfigured()) return sb.sbGetClientDeckConfig(clientId);
  return null;
}

/** Rascunhos de LE em aberto (A3) — reais ou vazio no demo. */
export async function getEditorialDrafts(clientId: string): Promise<EditorialDraft[]> {
  if (isSupabaseConfigured()) return sb.sbGetEditorialDrafts(clientId);
  return [];
}

/** Sugestões de ajustes do time (feedback board). */
export async function getSuggestions(): Promise<import("./suggestions").Suggestion[]> {
  if (isSupabaseConfigured()) return sb.sbGetSuggestions();
  return [];
}

/** Respostas de formulário atribuídas a um cliente (Resumo do Hub). */
export async function getClientFormSubmissions(
  clientId: string,
): Promise<import("./forms-types").ClientFormSubmission[]> {
  if (isSupabaseConfigured()) return sb.sbGetClientFormSubmissions(clientId);
  return [];
}

/** Entregáveis do contrato por formato (slots da Criar LE). */
export async function getClientDeliverables(clientId: string) {
  if (isSupabaseConfigured()) return sb.sbGetClientDeliverables(clientId);
  return [];
}

/** Documentos do cliente (arquivos) — reais quando Supabase ligado; [] no demo. */
export async function getClientDocumentsView(clientId: string) {
  if (isSupabaseConfigured()) return sb.sbGetClientDocuments(clientId);
  return [];
}

/** VioDay / Media Day (HUB12) — sessão + estado dos itens de captura por cliente. */
export async function getMediaDayView(clientId: string): Promise<MediaDayView> {
  if (isSupabaseConfigured()) return sb.sbGetMediaDay(clientId);
  return { session: null, items: [] };
}

/** Hub de Clientes com health real (clientes + payments + tarefas + atividade). */
export async function getHubClientsOps(): Promise<HubClientOps[]> {
  if (isSupabaseConfigured()) return sb.sbGetHubClientsOps();
  return hubOpsMock();
}

/** Detalhe do cliente (CS) — real quando Supabase ligado; mock no demo. */
export async function getCSClientDetail(id: string): Promise<CSClientDetail | null> {
  if (isSupabaseConfigured()) return sb.sbGetCSClientDetail(id);
  return csDetailMock(id);
}

/**
 * Resumo do relatório do cliente para a Central de Relatórios. Real quando o
 * Supabase está ligado (métricas da sincronização Meta); mock no modo demo.
 * Comentários/salvamentos são estimados (o Meta não sincroniza esses campos).
 */
export async function getReportSummaryView(clientId: string): Promise<ReportSummary> {
  if (!isSupabaseConfigured()) return resolveReportSummary(clientId || "seed");
  const [media, organic] = await Promise.all([
    getMediaPerformance(clientId),
    getOrganicResults(clientId),
  ]);
  const t = organic.totals;
  const cliques = media.campaigns.reduce((s, c) => s + c.clicks, 0);
  return {
    organic: {
      seguidores: Math.round(t.followersDelta),
      alcance: Math.round(t.reach),
      engajamento: Math.round(t.engagement * 10) / 10,
      impressoes: Math.round(t.impressions),
      comentarios: Math.round(t.reach * 0.008),
      salvamentos: Math.round(t.reach * 0.02),
    },
    paid: {
      investimento: Math.round(media.invested),
      leads: Math.round(media.leads),
      cpl: media.cpl,
      conversoes: Math.round(media.conversions),
      cliques: Math.round(cliques),
      cpa: media.cpa,
    },
  };
}

// ---------------------------------------------------------------------------
// Hub de acessos & ativos de marca (M6)
// ---------------------------------------------------------------------------
export type BrandHub = {
  driveName: string;
  /** Link da pasta do Google Drive do cliente (ativos de marca), se cadastrado. */
  driveUrl?: string;
  accesses: AccessItem[];
  assets: BrandAsset[];
  team: TeamMember[];
  activity: ActivityItem[];
};

export async function getBrandHub(clientId: string): Promise<BrandHub> {
  if (isSupabaseConfigured()) return sb.sbGetBrandHub(clientId);
  const client = CLIENTS.find((c) => c.id === clientId);

  const accesses: AccessItem[] = [
    { id: "meta", name: "Meta Business", description: "Gerenciador de Anúncios · Facebook · Instagram", icon: "meta", status: "connected", note: "Acesso revisado 01/06", actionLabel: "Acessar" },
    { id: "google", name: "Google Workspace", description: "Google Ads · Analytics 4 · Search Console", icon: "google", status: "connected", note: "Acesso revisado 01/06", actionLabel: "Acessar" },
    { id: "rd", name: "RD Station", description: "CRM · Automação de marketing · Leads", icon: "rd", status: "connected", note: "Acesso revisado 16/05", actionLabel: "Acessar" },
    { id: "wordpress", name: "WordPress", description: "Painel admin · Editor de conteúdo · Plugins", icon: "wordpress", status: "review", note: "Senha pode ter expirado", actionLabel: "Acessar" },
    { id: "ecommerce", name: "E-commerce / loja", description: "Shopify · VTEX · Loja integrada", icon: "ecommerce", status: "setup", note: "Nenhuma loja conectada ainda", actionLabel: "Solicitar" },
    { id: "other", name: "Outras integrações", description: "TikTok Ads · LinkedIn · WhatsApp Business", icon: "other", status: "soon", note: "Solicite à equipe", actionLabel: "Solicitar" },
  ];

  const assets: BrandAsset[] = [
    { id: "logo-principal", name: "Logo principal", category: "logos", meta: "PNG · Fundo escuro · 2.400×2.400", preview: "logo-dark", downloads: ["PNG", "SVG"] },
    { id: "logo-claro", name: "Logo fundo claro", category: "logos", meta: "PNG · Fundo branco · 2.400×2.400", preview: "logo-light", downloads: ["PNG", "SVG"] },
    { id: "manual", name: "Manual de identidade visual", category: "manual", meta: "PDF · 28 páginas · atualizado jun/26", preview: "pdf", downloads: ["Baixar PDF"] },
    { id: "paleta", name: "Paleta de cores", category: "manual", meta: "PDF · ASE · Cores Pantone e HEX", preview: "palette", downloads: ["PDF", "ASE"] },
    { id: "fotos-inst", name: "Fotos institucionais — vol. 1", category: "fotos", meta: "ZIP · 18 fotos · 94 MB · jan/26", preview: "photos", downloads: ["Baixar ZIP"] },
    { id: "fotos-pratos", name: "Fotos de pratos — cardápio", category: "fotos", meta: "ZIP · 32 fotos · 210 MB · mai/26", preview: "photos", downloads: ["Baixar ZIP"] },
    { id: "tipografia", name: "Tipografia oficial", category: "manual", meta: "ZIP · 2 famílias · Cormorant + Lato", preview: "type", downloads: ["Baixar fontes"] },
  ];

  const team: TeamMember[] = [
    { id: "ana", name: "Ana Lima", role: "Social Media", area: "Responsável pela conta", initials: "AN", whatsapp: "https://wa.me/5527999990001" },
    { id: "carlos", name: "Carlos Andrade", role: "Design", area: "Criativos e identidade visual", initials: "CA", whatsapp: "https://wa.me/5527999990002" },
    { id: "mariana", name: "Mariana Azevedo", role: "Tráfego Pago", area: "Campanhas Meta e Google", initials: "MA", whatsapp: "https://wa.me/5527999990003" },
    { id: "atendimento", name: "Viofilme · Atendimento", role: "Atendimento", area: "Dúvidas gerais · Financeiro · Contratos", initials: "VF", whatsapp: "https://wa.me/5527999990000" },
  ];

  const activity: ActivityItem[] = [
    { id: "a1", text: "Você aprovou o post “Menu degustação com harmonização de vinhos”", when: "Hoje, 14h22", kind: "approve" },
    { id: "a2", text: "Ana (Social Media) enviou 3 posts para aprovação", when: "Hoje, 11h05", kind: "send" },
    { id: "a3", text: "Você pediu ajuste em “Promoção aniversário” — categoria: arte", when: "Ontem, 09h31", kind: "adjust" },
    { id: "a4", text: "Carlos (Design) atualizou o ativo “Fotos de pratos — cardápio”", when: "23/06, 09h31", kind: "update" },
    { id: "a5", text: "Pagamento da fatura Jun/2026 confirmado via PIX", when: "05/06, 10h14", kind: "payment" },
    { id: "a6", text: "Você acessou o painel pela primeira vez em junho", when: "01/06, 08h52", kind: "login" },
  ];

  return {
    driveName: client?.name ?? "Drive de marca",
    accesses,
    assets,
    team,
    activity,
  };
}

// ---------------------------------------------------------------------------
// Hub de gestão — visão C-Level (gerencial)
// ---------------------------------------------------------------------------
export type CLevelKpi = {
  iconKey: "mrr" | "clients" | "margin" | "cac";
  label: string;
  value: string;
  delta: string;
  deltaTone: "good" | "bad" | "neutral";
  note: string;
  noteTone: "muted" | "danger";
};

export type CLevelAlert = {
  id: string;
  kind: "churn" | "production" | "contracts" | "pipeline";
  title: string;
  detail: string;
  actionLabel: string;
};

export type CLevel = {
  periodLabel: string;
  kpis: CLevelKpi[];
  alerts: CLevelAlert[];
  mrrHistory: { month: string; mrr: number; novos: number }[];
  scaleGoal: {
    active: number;
    target: number;
    metaDate: string;
    pct: number;
    currentPace: number;
    neededPace: number;
    projection: number;
    gap: string;
  };
  accountsHealth: { name: string; score: number }[];
  teamLoad: {
    name: string;
    area: string;
    initials: string;
    sub: string;
    allocated: number;
    capacity: number;
  }[];
  dre: {
    grossMRR: number;
    deductions: number;
    netRevenue: number;
    salaries: number;
    tools: number;
    commissions: number;
    netProfit: number;
    margin: number;
    metaMargin: number;
  };
  pipeline: {
    stages: { name: string; count: number; value: number }[];
    total: number;
    weighted: number;
    conversionRate: number;
  };
};

export async function getCLevel(): Promise<CLevel> {
  if (isSupabaseConfigured()) return sb.sbGetCLevel();
  return {
    periodLabel: "junho 2026 · Iago & Flávio",
    kpis: [
      { iconKey: "mrr", label: "MRR atual", value: "R$ 31k", delta: "+R$ 6,4k vs. maio (+26%)", deltaTone: "good", note: "2 novos contratos em junho", noteTone: "muted" },
      { iconKey: "clients", label: "Clientes ativos", value: "8 / 50", delta: "+2 este mês · meta: dez/26", deltaTone: "good", note: "2 em risco de churn", noteTone: "danger" },
      { iconKey: "margin", label: "Margem operacional", value: "38%", delta: "+4pp vs. maio", deltaTone: "good", note: "Meta: 42% até dez/26", noteTone: "muted" },
      { iconKey: "cac", label: "CAC médio", value: "R$ 480", delta: "+R$ 80 vs. maio", deltaTone: "neutral", note: "LTV médio: R$ 28.800", noteTone: "muted" },
    ],
    alerts: [
      { id: "al-churn", kind: "churn", title: "2 clientes em risco crítico de churn — intervenção urgente", detail: "Academia FitBody (score 32, fatura vencida 12d) · Loja ModaVerde (score 28, NPS 5, 3 ajustes consecutivos)", actionLabel: "Ver contas" },
      { id: "al-prod", kind: "production", title: "9 tarefas do time com prazo vencido hoje", detail: "Robert (Design) com 48h alocadas nesta semana — sobrecarga detectada. 3 posts aguardam aprovação há mais de 2 dias.", actionLabel: "Ver produção" },
      { id: "al-contracts", kind: "contracts", title: "3 contratos vencem nos próximos 30 dias — R$ 10.200/mês em risco", detail: "Rede Farmácia BH (18d) · Advocacia Menezes & Assis (32d) · Studio Bela Forma (45d)", actionLabel: "Planejar renovação" },
      { id: "al-pipeline", kind: "pipeline", title: "Pipeline comercial aquecido — R$ 94k em negociação", detail: "Imobiliária Costa Mar (R$ 5.200, 80%) · Rede de Farmácias BH (R$ 8.500, 70%) — 2 fechamentos prováveis em junho", actionLabel: "Ver funil" },
    ],
    mrrHistory: [
      { month: "Jan", mrr: 18000, novos: 1 },
      { month: "Fev", mrr: 21000, novos: 2 },
      { month: "Mar", mrr: 23000, novos: 1 },
      { month: "Abr", mrr: 25000, novos: 2 },
      { month: "Mai", mrr: 24600, novos: 1 },
      { month: "Jun", mrr: 31000, novos: 2 },
    ],
    scaleGoal: {
      active: 8,
      target: 50,
      metaDate: "dez/26",
      pct: 16,
      currentPace: 1.8,
      neededPace: 6,
      projection: 21,
      gap: "Gap crítico — meta exige triplicar ritmo comercial ou revisar prazo",
    },
    accountsHealth: [
      { name: "Rede Farmácia BH", score: 88 },
      { name: "Restaurante Sabor do Mar", score: 84 },
      { name: "Advocacia Menezes & Assis", score: 78 },
      { name: "Studio Bela Forma", score: 71 },
      { name: "Clínica Vida", score: 66 },
      { name: "Imobiliária Costa Mar", score: 62 },
      { name: "Academia FitBody", score: 32 },
      { name: "Loja ModaVerde", score: 28 },
    ],
    teamLoad: [
      { name: "Robert", area: "Design", initials: "RO", sub: "9 tarefas · 3 atrasadas", allocated: 48, capacity: 40 },
      { name: "Gustavo", area: "Social", initials: "GU", sub: "12 tarefas · em dia", allocated: 36, capacity: 40 },
      { name: "Ana Lima", area: "Social", initials: "AN", sub: "8 tarefas · 1 atrasada", allocated: 38, capacity: 40 },
      { name: "Mariana", area: "Tráfego", initials: "MA", sub: "15 contas monitoradas", allocated: 32, capacity: 40 },
      { name: "Marcos", area: "Comercial", initials: "MC", sub: "6 leads em andamento", allocated: 28, capacity: 40 },
    ],
    dre: {
      grossMRR: 31000,
      deductions: 4030,
      netRevenue: 26970,
      salaries: 12800,
      tools: 1420,
      commissions: 960,
      netProfit: 11790,
      margin: 38.0,
      metaMargin: 42,
    },
    pipeline: {
      stages: [
        { name: "Prospecção", count: 4, value: 25200 },
        { name: "Reunião marcada", count: 2, value: 13900 },
        { name: "Proposta enviada", count: 3, value: 44400 },
        { name: "Em negociação", count: 1, value: 8500 },
      ],
      total: 94000,
      weighted: 51200,
      conversionRate: 34,
    },
  };
}

// ---------------------------------------------------------------------------
// Home v2 — pool de métricas para o seletor métrica→gráfico (R01/R02)
// ---------------------------------------------------------------------------
export type ClientHomeMetrics = {
  hasPaidTraffic: boolean;
  defaultKeys: string[];
  pool: MetricDef[];
};

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 100;
}

function synthSeries(
  dates: string[],
  base: number,
  ampPct: number,
  slopePct: number,
  seed: number,
  decimals = 0,
): { date: string; value: number }[] {
  const n = Math.max(1, dates.length);
  return dates.map((date, i) => {
    const wobble = 1 + ampPct * Math.sin(i / 4 + seed);
    const trend = (base * slopePct * i) / n;
    const raw = Math.max(0, base * wobble + trend);
    const value = decimals
      ? Math.round(raw * 10 ** decimals) / 10 ** decimals
      : Math.round(raw);
    return { date, value };
  });
}

const fmt1 = (n: number) =>
  Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
const fmt2 = (n: number) =>
  Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sign = (n: number) => (n >= 0 ? "+" : "-");

export async function getClientHomeMetrics(
  clientId: string,
): Promise<ClientHomeMetrics> {
  const client = await getClientById(clientId);
  const home = await getClientHome(clientId);
  const ig = await getAccountSeries(clientId, "instagram");
  const fb = await getAccountSeries(clientId, "facebook");
  const eng = ENGAGEMENT_SERIES[clientId] ?? [];
  const dates = eng.map((p) => p.date);
  const seed = seedFrom(clientId);

  const reachSeries = ig.map((p, i) => ({
    date: p.date,
    value: p.reach + (fb[i]?.reach ?? 0),
  }));
  const imprSeries = ig.map((p, i) => ({
    date: p.date,
    value: p.impressions + (fb[i]?.impressions ?? 0),
  }));
  const followersSeries = ig.map((p, i) => {
    const today = p.followers + (fb[i]?.followers ?? 0);
    const prevIg = ig[i - 1]?.followers ?? p.followers;
    const prevFb = fb[i - 1]?.followers ?? fb[i]?.followers ?? 0;
    return { date: p.date, value: Math.max(0, today - (prevIg + prevFb)) };
  });

  const m = home.media;
  const cpaVal = Math.round((m.invested / Math.max(1, m.conversions)) * 100) / 100;

  const pool: MetricDef[] = [
    {
      key: "engajamento", label: "Engajamento orgânico", group: "Orgânico",
      color: "#34d399", chartType: "area", unit: "percent", iconKey: "heart",
      glossaryKey: "engajamento",
      displayValue: `${fmt1(home.organicEngagement.value)}%`,
      deltaText: `${sign(home.organicEngagement.delta)}${fmt1(home.organicEngagement.delta)}pp vs. maio`,
      delta: home.organicEngagement.delta,
      data: eng, dataKey: "value", chartTitle: "Engajamento — últimos 30 dias",
    },
    {
      key: "alcance", label: "Alcance no mês", group: "Orgânico",
      color: "#38bdf8", chartType: "area", unit: "number", iconKey: "eye",
      glossaryKey: "alcance",
      displayValue: formatCompact(home.reach.value),
      deltaText: `${sign(home.reach.delta)}${Math.abs(home.reach.delta)}% vs. maio`,
      delta: home.reach.delta,
      data: reachSeries, dataKey: "value", chartTitle: "Alcance — últimos 30 dias",
    },
    {
      key: "cpl", label: "Custo por lead (CPL)", group: "Pago",
      color: "#f59e0b", chartType: "area", unit: "currency", iconKey: "tag",
      glossaryKey: "cpl", invertDelta: true,
      displayValue: formatBRL(home.cpl.value),
      deltaText: `${sign(home.cpl.delta)}R$ ${fmt2(home.cpl.delta)} vs. maio`,
      delta: home.cpl.delta,
      data: synthSeries(dates, home.cpl.value, 0.12, -0.05, seed, 2),
      dataKey: "value", chartTitle: "CPL — últimos 30 dias",
    },
    {
      key: "investimento", label: "Investimento ativo", group: "Pago",
      color: "#8b5cf6", chartType: "area", unit: "currency", iconKey: "wallet",
      glossaryKey: "investimento",
      displayValue: `R$ ${formatNumber(m.invested)}`,
      hint: `de R$ ${formatNumber(m.total)} / mês`,
      data: synthSeries(dates, m.invested / 30, 0.2, 0.3, seed + 1),
      dataKey: "value", chartTitle: "Investimento diário — últimos 30 dias",
    },
    {
      key: "impressoes", label: "Impressões", group: "Orgânico",
      color: "#0ea5e9", chartType: "area", unit: "number", iconKey: "eye",
      glossaryKey: "impressoes",
      displayValue: formatCompact(imprSeries.reduce((s, p) => s + p.value, 0)),
      hint: "últimos 30 dias",
      data: imprSeries, dataKey: "value", chartTitle: "Impressões — últimos 30 dias",
    },
    {
      key: "seguidores", label: "Novos seguidores", group: "Orgânico",
      color: "#14b8a6", chartType: "area", unit: "number", iconKey: "users",
      glossaryKey: "seguidores",
      displayValue: formatCompact(followersSeries.reduce((s, p) => s + p.value, 0)),
      hint: "últimos 30 dias",
      data: followersSeries, dataKey: "value", chartTitle: "Novos seguidores — 30 dias",
    },
    {
      key: "salvamentos", label: "Taxa de salvamentos", group: "Orgânico",
      color: "#ec4899", chartType: "area", unit: "percent", iconKey: "bookmark",
      glossaryKey: "salvamentos",
      displayValue: `${fmt1(2 + seed / 3)}%`, hint: "média dos posts",
      data: synthSeries(dates, 2 + seed / 3, 0.25, 0.1, seed + 2, 1),
      dataKey: "value", chartTitle: "Salvamentos — últimos 30 dias",
    },
    {
      key: "cpa", label: "Custo por aquisição (CPA)", group: "Pago",
      color: "#f97316", chartType: "area", unit: "currency", iconKey: "target",
      glossaryKey: "cpa", invertDelta: true,
      displayValue: formatBRL(cpaVal), hint: "no mês",
      data: synthSeries(dates, cpaVal, 0.12, -0.04, seed + 3, 2),
      dataKey: "value", chartTitle: "CPA — últimos 30 dias",
    },
    {
      key: "leads", label: "Leads gerados", group: "Pago",
      color: "#22c55e", chartType: "area", unit: "number", iconKey: "trending",
      glossaryKey: "leads",
      displayValue: formatNumber(m.leads), hint: "no mês",
      data: synthSeries(dates, m.leads / 30, 0.3, 0.4, seed + 4),
      dataKey: "value", chartTitle: "Leads — últimos 30 dias",
    },
    {
      key: "conversoes", label: "Conversões", group: "Pago",
      color: "#06b6d4", chartType: "area", unit: "number", iconKey: "target",
      glossaryKey: "conversoes",
      displayValue: formatNumber(m.conversions), hint: "no mês",
      data: synthSeries(dates, m.conversions / 30, 0.35, 0.3, seed + 5, 1),
      dataKey: "value", chartTitle: "Conversões — últimos 30 dias",
    },
    {
      key: "roas", label: "ROAS", group: "Pago",
      color: "#a855f7", chartType: "area", unit: "number", iconKey: "dollar",
      glossaryKey: "roas",
      displayValue: `${fmt1(3 + seed / 4)}x`, hint: "retorno sobre investimento",
      data: synthSeries(dates, 3 + seed / 4, 0.18, 0.15, seed + 6, 1),
      dataKey: "value", chartTitle: "ROAS — últimos 30 dias",
    },
    {
      key: "proximo-vencimento", label: "Próximo vencimento", group: "Financeiro",
      color: "#eab308", chartType: "area", unit: "currency", iconKey: "wallet",
      displayValue: `R$ ${formatNumber(m.total)}`, hint: "todo dia 03",
      data: synthSeries(dates, m.total / 30, 0.05, 0, seed + 7),
      dataKey: "value", chartTitle: "Mensalidade",
    },
    {
      key: "status-plano", label: "Status do plano", group: "Financeiro",
      color: "#64748b", chartType: "area", unit: "number", iconKey: "wallet",
      displayValue: "Ativo", hint: "Social Pro",
      data: synthSeries(dates, 1, 0, 0, seed + 8),
      dataKey: "value", chartTitle: "Plano ativo",
    },
  ];

  return {
    hasPaidTraffic: client?.hasPaidTraffic ?? true,
    defaultKeys: ["engajamento", "alcance", "cpl", "investimento"],
    pool,
  };
}

// ---------------------------------------------------------------------------
// Campanhas v2 — pool de métricas para o carrossel (CAM01/02/03)
// ---------------------------------------------------------------------------
function monthsPair(labels: string[], baseMeta: number, baseGoogle: number, seed: number) {
  return labels.map((month, i) => ({
    month,
    meta: Math.round(baseMeta * (1 + 0.12 * Math.sin(i + seed)) + baseMeta * 0.05 * i),
    google: Math.round(baseGoogle * (1 + 0.12 * Math.sin(i + seed + 1)) + baseGoogle * 0.04 * i),
  }));
}

export async function getMediaMetrics(clientId: string): Promise<MetricDef[]> {
  const p = await getMediaPerformance(clientId);
  const seed = seedFrom(clientId);
  const ref = REFERENCE_DATE;
  const months = [3, 2, 1, 0].map((k) =>
    MESES[(ref.getUTCMonth() - k + 12) % 12].slice(0, 3),
  );
  const days = (ENGAGEMENT_SERIES[clientId] ?? []).map((x) => x.date);
  const clicks = p.campaigns.reduce((s, c) => s + c.clicks, 0);
  const cpcAvg =
    Math.round((p.invested / Math.max(1, clicks)) * 100) / 100;
  const metaSeries = { key: "meta", color: "#2a63c9", name: "Meta Ads" };
  const googleSeries = { key: "google", color: "#34d399", name: "Google Ads" };

  return [
    {
      key: "investimento", label: "Investimento total", color: "#8b5cf6",
      chartType: "bar-grouped", unit: "currency", glossaryKey: "investimento",
      displayValue: `R$ ${formatNumber(p.invested)}`, hint: `de R$ ${formatNumber(p.budget)}`,
      data: monthsPair(months, p.metaInvested / 4, p.googleInvested / 4, seed),
      categoryKey: "month", series: [metaSeries, googleSeries],
      chartTitle: "Investimento por plataforma — 4 meses",
    },
    {
      key: "leads", label: "Leads gerados", color: "#22c55e",
      chartType: "bar-grouped", unit: "number", glossaryKey: "leads",
      displayValue: formatNumber(p.leads),
      deltaText: `${sign(p.leadsDelta)}${Math.abs(p.leadsDelta)}% vs. maio`, delta: p.leadsDelta,
      data: monthsPair(months, p.leads * 0.6, p.leads * 0.4, seed + 2),
      categoryKey: "month", series: [metaSeries, googleSeries],
      chartTitle: "Leads por plataforma — 4 meses",
    },
    {
      key: "cpl", label: "Custo por lead (CPL)", color: "#f59e0b",
      chartType: "bar-grouped", unit: "currency", glossaryKey: "cpl", invertDelta: true,
      displayValue: formatBRL(p.cpl),
      deltaText: `${sign(p.cplDelta)}R$ ${fmt2(p.cplDelta)} vs. maio`, delta: p.cplDelta,
      data: p.cplHistory, categoryKey: "month", series: [metaSeries, googleSeries],
      chartTitle: "CPL por plataforma — 4 meses",
    },
    {
      key: "conversoes", label: "Conversões reais", color: "#06b6d4",
      chartType: "area", unit: "number", glossaryKey: "conversoes",
      displayValue: formatNumber(p.conversions),
      deltaText: `${sign(p.convDelta)}${Math.abs(p.convDelta)} vs. maio`, delta: p.convDelta,
      data: synthSeries(days, p.conversions / 30, 0.3, 0.3, seed + 3, 1), dataKey: "value",
      chartTitle: "Conversões — últimos 30 dias",
    },
    {
      key: "cliques", label: "Total de cliques", color: "#38bdf8",
      chartType: "line-multi", unit: "number", glossaryKey: "cliques",
      displayValue: formatCompact(clicks),
      data: monthsPair(months, clicks * 0.6 / 4, clicks * 0.4 / 4, seed + 4),
      categoryKey: "month", series: [metaSeries, googleSeries],
      chartTitle: "Cliques por plataforma — 4 meses",
    },
    {
      key: "cpc", label: "Custo por clique (CPC)", color: "#f97316",
      chartType: "area", unit: "currency", glossaryKey: "cpc", invertDelta: true,
      displayValue: formatBRL(cpcAvg),
      data: synthSeries(days, cpcAvg, 0.15, -0.05, seed + 5, 2), dataKey: "value",
      chartTitle: "CPC — últimos 30 dias",
    },
    {
      key: "cpa", label: "Custo por aquisição (CPA)", color: "#fb7185",
      chartType: "area", unit: "currency", glossaryKey: "cpa", invertDelta: true,
      displayValue: formatBRL(p.cpa),
      data: synthSeries(days, p.cpa, 0.12, -0.04, seed + 6, 2), dataKey: "value",
      chartTitle: "CPA — últimos 30 dias",
    },
    {
      key: "roas", label: "ROAS", color: "#a855f7",
      chartType: "area", unit: "number", glossaryKey: "roas",
      displayValue: `${fmt1(3 + seed / 4)}x`,
      data: synthSeries(days, 3 + seed / 4, 0.18, 0.15, seed + 7, 1), dataKey: "value",
      chartTitle: "ROAS — últimos 30 dias",
    },
  ];
}

// ---------------------------------------------------------------------------
// Resultados v3 — pool de métricas orgânicas para o carrossel (ORG01/02/03)
// ---------------------------------------------------------------------------
function monthlyPair(
  labels: string[],
  baseIg: number,
  baseFb: number,
  seed: number,
) {
  return labels.map((month, i) => ({
    month,
    instagram: Math.round(baseIg * (1 + 0.1 * Math.sin(i + seed)) + baseIg * 0.04 * i),
    facebook: Math.round(baseFb * (1 + 0.1 * Math.sin(i + seed + 1)) + baseFb * 0.03 * i),
  }));
}

export async function getOrganicMetrics(clientId: string): Promise<MetricDef[]> {
  const o = await getOrganicResults(clientId);
  const seed = seedFrom(clientId);
  const days = (ENGAGEMENT_SERIES[clientId] ?? []).map((x) => x.date);
  const months = o.followersHistory.map((p) => p.month);
  const t = o.totals;
  const ig = { key: "instagram", color: "#D4537E", name: "Instagram" };
  const fb = { key: "facebook", color: "#38bdf8", name: "Facebook" };
  const pct1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  const saves = Math.round(t.reach * 0.02);
  const comments = Math.round(t.reach * 0.008);
  const shares = Math.round(t.reach * 0.006);
  const views = Math.round(t.reach * 1.4);

  return [
    {
      key: "seguidores", label: "Seguidores totais", color: "#14b8a6",
      chartType: "line-multi", unit: "number", glossaryKey: "seguidores",
      displayValue: formatNumber(t.followers),
      deltaText: `+${formatNumber(t.followersDelta)} este mês`, delta: t.followersDelta,
      data: o.followersHistory, categoryKey: "month", series: [ig, fb],
      chartTitle: "Seguidores — Instagram + Facebook",
    },
    {
      key: "alcance", label: "Alcance no mês", color: "#38bdf8",
      chartType: "line-multi", unit: "number", glossaryKey: "alcance",
      displayValue: formatCompact(t.reach),
      deltaText: `+${t.reachDelta}% vs. maio`, delta: t.reachDelta,
      data: monthlyPair(months, o.instagram.reach / 4, o.facebook.reach / 4, seed + 1),
      categoryKey: "month", series: [ig, fb],
      chartTitle: "Alcance — Instagram + Facebook",
    },
    {
      key: "impressoes", label: "Impressões", color: "#0ea5e9",
      chartType: "bar-grouped", unit: "number", glossaryKey: "impressoes",
      displayValue: formatCompact(t.impressions),
      deltaText: `+${t.impressionsDelta}% vs. maio`, delta: t.impressionsDelta,
      data: monthlyPair(months, o.instagram.impressions / 4, o.facebook.impressions / 4, seed + 2),
      categoryKey: "month", series: [ig, fb],
      chartTitle: "Impressões por plataforma",
    },
    {
      key: "engajamento", label: "Taxa de engajamento", color: "#34d399",
      chartType: "area", unit: "percent", glossaryKey: "engajamento",
      displayValue: `${pct1(t.engagement)}%`,
      deltaText: `+${pct1(t.engagementDelta)}pp vs. maio`, delta: t.engagementDelta,
      data: synthSeries(days, t.engagement, 0.18, 0.1, seed + 3, 1), dataKey: "value",
      chartTitle: "Engajamento — últimos 30 dias",
    },
    {
      key: "salvamentos", label: "Salvamentos", color: "#ec4899",
      chartType: "area", unit: "number", glossaryKey: "salvamentos",
      displayValue: formatCompact(saves),
      data: synthSeries(days, saves / 30, 0.3, 0.2, seed + 4), dataKey: "value",
      chartTitle: "Salvamentos — últimos 30 dias",
    },
    {
      key: "comentarios", label: "Comentários", color: "#a855f7",
      chartType: "bar-simple", unit: "number", glossaryKey: "comentarios",
      displayValue: formatCompact(comments),
      data: monthlyPair(months, comments / 4, 0, seed + 5).map((d) => ({
        month: d.month, value: d.instagram,
      })),
      categoryKey: "month",
      series: [{ key: "value", color: "#a855f7", name: "Comentários" }],
      chartTitle: "Comentários por mês",
    },
    {
      key: "compartilhamentos", label: "Compartilhamentos", color: "#f59e0b",
      chartType: "area", unit: "number", glossaryKey: "compartilhamentos",
      displayValue: formatCompact(shares),
      data: synthSeries(days, shares / 30, 0.32, 0.25, seed + 6), dataKey: "value",
      chartTitle: "Compartilhamentos — últimos 30 dias",
    },
    {
      key: "views", label: "Views de vídeo", color: "#22d3ee",
      chartType: "area", unit: "number", glossaryKey: "views",
      displayValue: formatCompact(views),
      data: synthSeries(days, views / 30, 0.25, 0.2, seed + 7), dataKey: "value",
      chartTitle: "Views de vídeo — últimos 30 dias",
    },
  ];
}

// ---------------------------------------------------------------------------
// Contexto consolidado para o assistente de IA (chat)
// Reúne, de forma compacta, tudo que o cliente vê no portal: visão geral,
// campanhas, orgânico, financeiro e conteúdo. Ponto único de troca mock→Supabase.
// ---------------------------------------------------------------------------
export async function getClientAiContext(clientId: string) {
  const [client, home, media, organic, finance, content] = await Promise.all([
    getClientById(clientId),
    getClientHome(clientId),
    getMediaPerformance(clientId),
    getOrganicResults(clientId),
    getFinance(clientId),
    getContent(clientId),
  ]);

  const pending = content.filter(
    (c) => c.status === "scheduled" && c.approval === "pending",
  );
  const published = content
    .filter((c) => c.status === "published")
    .slice(0, 6);

  return {
    cliente: {
      nome: client?.name ?? home.clientName,
      segmento: client?.segment ?? "—",
      tipoNegocio: client?.clientType ?? "local_business",
      redesAtivas: client?.activeNetworks ?? ["instagram"],
      temTrafegoPago: client?.hasPaidTraffic ?? media.invested > 0,
      instagram: client?.instagramUsername ?? null,
      facebook: client?.facebookPageName ?? null,
    },
    periodo: home.periodLabel,
    visaoGeral: {
      engajamentoOrganicoPct: home.organicEngagement.value,
      engajamentoDeltaPp: home.organicEngagement.delta,
      alcanceMes: home.reach.value,
      alcanceDeltaPct: home.reach.delta,
      cpl: home.cpl.value,
      cplDeltaReais: home.cpl.delta,
      aprovacoesPendentes: home.pendingApprovals,
      orcamentoMidia: home.media,
      proximasReunioes: home.meetings.map((m) => ({
        titulo: m.title,
        quando: m.startsAt,
        pauta: m.agenda,
      })),
    },
    campanhas: {
      investido: media.invested,
      orcamento: media.budget,
      percentUsado: media.pct,
      saldo: media.balance,
      diasRestantes: media.daysRemaining,
      ritmoDiario: media.dailyPace,
      leads: media.leads,
      cpl: media.cpl,
      conversoes: media.conversions,
      cpa: media.cpa,
      investidoMeta: media.metaInvested,
      investidoGoogle: media.googleInvested,
      insightEquipe: media.insight,
      lista: media.campaigns.map((c) => ({
        nome: c.name,
        rede: c.network,
        status: c.status,
        investido: c.invested,
        leads: c.leads,
        cpl: c.cpl,
        cpc: c.cpc,
        cpa: c.cpa,
        conversoes: c.conversions,
      })),
    },
    organico: {
      seguidores: organic.totals.followers,
      ganhoSeguidoresMes: organic.totals.followersDelta,
      alcance: organic.totals.reach,
      engajamentoPct: organic.totals.engagement,
      alcancePorFormato: organic.reachByFormat,
      engajamentoPorFormato: organic.engagementByFormat,
      topPosts: organic.topPosts.map((p) => ({
        titulo: p.title,
        formato: p.mediaType,
        rede: p.platform,
        alcance: p.reach,
        curtidas: p.likes,
        comentarios: p.comments,
      })),
      audiencia: {
        faixasEtarias: organic.audience.ageRanges,
        principaisLocais: organic.audience.topLocations,
      },
      padraoEquipe: organic.teamPattern,
    },
    financeiro: {
      plano: finance.plan,
      proximaFatura: finance.nextDue,
      ultimoPagamento: finance.lastPayment,
      totalPagoNoAno: finance.totalPaidYear,
      faturasEmAberto: finance.invoices
        .filter((i) => i.status === "open")
        .map((i) => ({
          competencia: i.competence,
          valor: i.amount,
          vencimento: i.dueDate,
        })),
    },
    conteudo: {
      aguardandoAprovacao: pending.map((c) => ({
        formato: c.mediaType,
        rede: c.platform,
        legenda: c.caption?.slice(0, 140),
        agendadoPara: c.scheduledAt,
        autor: c.author,
      })),
      publicadosRecentes: published.map((c) => ({
        formato: c.mediaType,
        rede: c.platform,
        legenda: c.caption?.slice(0, 100),
        alcance: c.reach,
        curtidas: c.likes,
        publicadoEm: c.publishedAt,
      })),
    },
  };
}

export type ClientAiContext = Awaited<ReturnType<typeof getClientAiContext>>;

// ---------------------------------------------------------------------------
// Contexto consolidado da AGÊNCIA para a Bruna no painel gerencial.
// Visão de todos os clientes (dados reais: clientes + overview de cada um).
// ---------------------------------------------------------------------------
export async function getAgencyAiContext() {
  const clients = await getClients();

  const perClient = await Promise.all(
    clients.map(async (c) => {
      const ov = await getClientOverview(c.id);
      return {
        nome: c.name,
        segmento: c.segment,
        status: c.status,
        tipoNegocio: c.clientType,
        metaConectada: c.metaConnected,
        temTrafegoPago: c.hasPaidTraffic,
        seguidores: ov.followers,
        alcance30d: ov.reach30d,
        engajamentoPct: ov.engagementRate,
        investimentoMidia: ov.totalSpend,
        conversoes: ov.totalConversions,
        postsPublicados: ov.postsPublished,
        postsAgendados: ov.postsScheduled,
      };
    }),
  );

  return {
    totais: {
      clientes: clients.length,
      clientesComMetaConectada: clients.filter((c) => c.metaConnected).length,
      investimentoMidiaTotal: perClient.reduce((s, c) => s + c.investimentoMidia, 0),
      conversoesTotais: perClient.reduce((s, c) => s + c.conversoes, 0),
    },
    clientes: perClient,
  };
}

export type AgencyAiContext = Awaited<ReturnType<typeof getAgencyAiContext>>;

// ── Módulo 2: CRM & Vendas ───────────────────────────────────────────────────

import {
  MOCK_LEADS,
  MOCK_TASKS,
  MOCK_INTERACTIONS,
  MOCK_COMPANIES,
  MOCK_CONTACTS,
  MOCK_DEAL_CONTACTS,
  MOCK_TAGS,
  MOCK_PROPERTIES,
  DEFAULT_PIPELINE,
  CRM_REFERENCE_ISO,
  computeDashboard,
  buildCommercialDash,
  buildTaskItems,
  monthKey,
  buildCompanyDetail,
  buildContactDetail,
  buildFunnelAnalytics,
  MOCK_LOST_REASONS,
  MOCK_TASK_FLOWS,
  MOCK_GOALS,
  MOCK_CAPTURE_FORMS,
  DEAL_SCRIPTS,
  DEFAULT_ASSIGNMENT,
  type CrmLead,
  type LostReason,
  type FreezeReason,
  type TaskFlow,
  type DealScript,
  type CrmDocument,
  type DocTemplate,
  type SalesMaterial,
  type AssignmentConfig,
  type CommercialDash,
  type CommercialBoard,
  type InspirationQuote,
  type CrmGoal,
  type CaptureForm,
  type StageChange,
  type FunnelAnalytics,
  type Stage,
  type CrmTask,
  type CrmInteraction,
  type CrmComment,
  type CardFieldSetting,
  type BdrDashboard,
  type Company,
  type Contact,
  type DealContact,
  type Pipeline,
  type Tag,
  type PropertyDef,
  type PropertyGroup,
  type Workflow,
  type LeadScoreRule,
  type ReportDef,
  type DashboardDef,
  type CompanyDetail,
  type ContactDetail,
} from "./crm";

/** "Agora" do CRM: tempo real com Supabase; data de referência no modo demo. */
export function crmNowIso(): string {
  return isSupabaseConfigured() ? new Date().toISOString() : CRM_REFERENCE_ISO;
}

export async function getCrmLeads(): Promise<CrmLead[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmLeads();
  return MOCK_LEADS;
}

export async function getCrmTasks(): Promise<CrmTask[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmTasks();
  return MOCK_TASKS;
}

export async function getCrmDashboard(): Promise<BdrDashboard> {
  const [leads, tasks, pipelines] = await Promise.all([
    getCrmLeads(),
    getCrmTasks(),
    getCrmPipelines(),
  ]);
  // Cadeia de funis: o dashboard consolida TODOS os funis (SDR + Vendas).
  const allStages = pipelines.flatMap((p) => p.stages);
  return computeDashboard(leads, tasks, crmNowIso(), allStages);
}

/** Dashboard Comercial completo (lentes, Ontem/Hoje/Mês, ritmo/projeção). */
export async function getCommercialDashboard(currentUser: string): Promise<CommercialDash> {
  const nowIso = crmNowIso();
  const now = new Date(nowIso);
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [leads, tasks, pipelines, goals, interactions] = await Promise.all([
    getCrmLeads(),
    getCrmTasks(),
    getCrmPipelines(),
    getCrmGoals(monthKey(nowIso)),
    isSupabaseConfigured() ? sb.sbGetCrmInteractionsSince(monthStartIso) : Promise.resolve([]),
  ]);
  const base = computeDashboard(leads, tasks, nowIso, pipelines.flatMap((p) => p.stages));
  const taskItems = buildTaskItems(tasks, leads);
  return buildCommercialDash({ base, leads, tasks: taskItems, interactions, goals, nowIso, currentUser });
}

/** Mural do time (recado da liderança). */
export async function getCommercialBoard(): Promise<CommercialBoard> {
  if (isSupabaseConfigured()) return sb.sbGetCommercialBoard();
  return { message: "Bem-vindos! Bora fazer um mês histórico. 🚀" };
}

const DEMO_QUOTES: InspirationQuote[] = [
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", source: "Robert Collier" },
  { text: "Cada não te aproxima do próximo sim.", source: "Anônimo" },
  { text: "Feito é melhor que perfeito.", source: "Sheryl Sandberg" },
];

/** Frase inspiracional do dia (rotação diária). */
export async function getDailyQuote(): Promise<InspirationQuote | null> {
  const quotes = isSupabaseConfigured() ? await sb.sbGetInspirationQuotes() : DEMO_QUOTES;
  if (!quotes.length) return null;
  const d = new Date(crmNowIso());
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return quotes[dayOfYear % quotes.length];
}

export async function getCrmLead(id: string): Promise<{
  lead: CrmLead;
  interactions: CrmInteraction[];
  tasks: CrmTask[];
} | null> {
  if (isSupabaseConfigured()) return sb.sbGetCrmLead(id);
  const lead = MOCK_LEADS.find((l) => l.id === id);
  if (!lead) return null;
  return {
    lead,
    interactions: MOCK_INTERACTIONS.filter((i) => i.leadId === id),
    tasks: MOCK_TASKS.filter((t) => t.leadId === id),
  };
}

/** Comentários internos da equipe num negócio (histórico separado da timeline). */
export async function getCrmComments(leadId: string): Promise<CrmComment[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmComments(leadId);
  return [];
}

/** Config de layout do card (quais itens aparecem e em que ordem). */
export async function getCardLayout(objectType = "deal"): Promise<CardFieldSetting[]> {
  if (isSupabaseConfigured()) return sb.sbGetCardLayout(objectType);
  return [];
}

// ── CRM v2: Empresas / Contatos / Pipeline / Tags / Propriedades ─────────────

export async function getCrmCompanies(): Promise<Company[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmCompanies();
  return MOCK_COMPANIES;
}

export async function getCrmContacts(): Promise<Contact[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmContacts();
  return MOCK_CONTACTS;
}

export async function getCrmDealContacts(): Promise<DealContact[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmDealContacts();
  return MOCK_DEAL_CONTACTS;
}

export async function getCrmPipelines(): Promise<Pipeline[]> {
  if (isSupabaseConfigured()) {
    const pipes = await sb.sbGetCrmPipelines();
    return pipes.length ? pipes : [DEFAULT_PIPELINE];
  }
  return [DEFAULT_PIPELINE];
}

/** Pipeline default (o primeiro marcado como default, ou o primeiro da lista). */
export async function getDefaultPipeline(): Promise<Pipeline> {
  const pipes = await getCrmPipelines();
  return pipes.find((p) => p.isDefault) ?? pipes[0] ?? DEFAULT_PIPELINE;
}

export async function getCrmTags(): Promise<Tag[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmTags();
  return MOCK_TAGS;
}

export async function getCrmProperties(): Promise<PropertyDef[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmProperties();
  return MOCK_PROPERTIES;
}

export async function getCrmPropertyGroups(): Promise<PropertyGroup[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmPropertyGroups();
  return [];
}

export async function getCrmWorkflows(): Promise<Workflow[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmWorkflows();
  return [];
}

export async function getWorkflowStats(): Promise<
  Record<string, { active: number; done: number; canceled: number }>
> {
  if (isSupabaseConfigured()) return sb.sbGetWorkflowStats();
  return {};
}

export async function getLeadScoreRules(): Promise<LeadScoreRule[]> {
  if (isSupabaseConfigured()) return sb.sbGetLeadScoreRules();
  return [];
}

export async function getCrmReports(): Promise<ReportDef[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmReports();
  return [];
}

export async function getCrmDashboards(): Promise<DashboardDef[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmDashboards();
  return [];
}

export async function getCrmCompany(id: string): Promise<CompanyDetail | null> {
  const [companies, contacts, deals] = await Promise.all([
    getCrmCompanies(),
    getCrmContacts(),
    getCrmLeads(),
  ]);
  return buildCompanyDetail(id, companies, contacts, deals);
}

export async function getCrmLostReasons(): Promise<LostReason[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmLostReasons();
  return MOCK_LOST_REASONS;
}

export async function getCrmFreezeReasons(): Promise<FreezeReason[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmFreezeReasons();
  return [];
}

export async function getCrmTaskFlows(): Promise<TaskFlow[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmTaskFlows();
  return MOCK_TASK_FLOWS;
}

/** Biblioteca de scripts/roteiros. Cai nos defaults (DEAL_SCRIPTS) se vazia. */
export async function getCrmScripts(): Promise<DealScript[]> {
  if (isSupabaseConfigured()) {
    const rows = await sb.sbGetCrmScripts();
    return rows.length ? rows : DEAL_SCRIPTS;
  }
  return DEAL_SCRIPTS;
}

/** Documentos do Comercial (por negócio/empresa, ou todos). */
export async function getCrmDocuments(opts?: {
  dealId?: string;
  companyId?: string;
}): Promise<CrmDocument[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmDocuments(opts);
  return [];
}

export async function getDocTemplates(): Promise<DocTemplate[]> {
  if (isSupabaseConfigured()) return sb.sbGetDocTemplates();
  return [];
}

export async function getSalesMaterials(): Promise<SalesMaterial[]> {
  if (isSupabaseConfigured()) return sb.sbGetSalesMaterials();
  return [];
}

/** Config de atribuição automática de novos negócios. */
export async function getAssignmentConfig(): Promise<AssignmentConfig> {
  if (isSupabaseConfigured()) return sb.sbGetAssignmentConfig();
  return DEFAULT_ASSIGNMENT;
}

export async function getCrmGoals(month: string): Promise<CrmGoal[]> {
  if (isSupabaseConfigured()) return sb.sbGetCrmGoals(month);
  return MOCK_GOALS.filter((g) => g.month === month);
}

export async function getCaptureForms(): Promise<CaptureForm[]> {
  if (isSupabaseConfigured()) return sb.sbGetCaptureForms();
  return MOCK_CAPTURE_FORMS;
}

export async function getStageHistory(): Promise<StageChange[]> {
  if (isSupabaseConfigured()) return sb.sbGetStageHistory();
  return [];
}

export async function getDealHistory(dealId: string): Promise<StageChange[]> {
  if (isSupabaseConfigured()) return sb.sbGetDealHistory(dealId);
  return [];
}

export async function getCrmFunnel(): Promise<FunnelAnalytics> {
  const [leads, pipeline] = await Promise.all([getCrmLeads(), getDefaultPipeline()]);
  return buildFunnelAnalytics(leads, pipeline.stages as Stage[], crmNowIso());
}

export async function getCrmContact(id: string): Promise<ContactDetail | null> {
  const [contacts, companies, deals, dealContacts] = await Promise.all([
    getCrmContacts(),
    getCrmCompanies(),
    getCrmLeads(),
    getCrmDealContacts(),
  ]);
  return buildContactDetail(id, contacts, companies, deals, dealContacts);
}

// ── Atendimento: inbox WhatsApp ──────────────────────────────────────────────

import {
  MOCK_ATTENDANTS,
  MOCK_CONVERSATIONS,
  MOCK_MESSAGES,
  type Attendant,
  type WaConversation,
  type WaMessage,
  type WaStatus,
} from "./inbox";

export async function getAttendants(): Promise<Attendant[]> {
  if (isSupabaseConfigured()) return sb.sbGetAttendants();
  return MOCK_ATTENDANTS;
}

export async function getConversations(filter?: {
  assignedTo?: string;
  status?: WaStatus;
}): Promise<WaConversation[]> {
  if (isSupabaseConfigured()) return sb.sbGetConversations(filter);
  let list = MOCK_CONVERSATIONS;
  if (filter?.status) list = list.filter((c) => c.status === filter.status);
  return list;
}

export async function getConversation(id: string): Promise<{
  conversation: WaConversation;
  messages: WaMessage[];
} | null> {
  if (isSupabaseConfigured()) return sb.sbGetConversation(id);
  const conversation = MOCK_CONVERSATIONS.find((c) => c.id === id);
  if (!conversation) return null;
  return { conversation, messages: MOCK_MESSAGES[id] ?? [] };
}

// ── Metas por cliente (Gestão à Vista) ───────────────────────────────────────

import type { ClientGoal } from "./gestao-vista";

export async function getClientGoals(
  clientId: string,
  period: string,
): Promise<ClientGoal[]> {
  if (isSupabaseConfigured()) return sb.sbGetClientGoals(clientId, period);
  return [];
}

export async function getGoalsForPeriod(period: string): Promise<ClientGoal[]> {
  if (isSupabaseConfigured()) return sb.sbGetGoalsForPeriod(period);
  return [];
}

// ── Central de Relatórios: updates recorrentes + envios ──────────────────────

import type { RecurringUpdate } from "./recurring";
import type { ReportSend } from "./supabase";

export async function getRecurringUpdates(clientId?: string): Promise<RecurringUpdate[]> {
  if (isSupabaseConfigured()) return sb.sbGetRecurringUpdates(clientId);
  return [];
}

export async function getReportSends(): Promise<ReportSend[]> {
  if (isSupabaseConfigured()) return sb.sbGetReportSends();
  return [];
}

/** Solicitações do portal (reunião/conteúdo) — visão da equipe. */
export async function getClientRequests(): Promise<
  import("./requests").ClientRequests
> {
  if (isSupabaseConfigured()) return sb.sbGetClientRequests();
  return { meetings: [], content: [] };
}

// ── Playbooks (central de documentos) ────────────────────────────────────────

import {
  MOCK_PLAYBOOK_SECTORS,
  type PlaybookSector,
} from "./playbooks";

export async function getPlaybookSectors(): Promise<PlaybookSector[]> {
  if (isSupabaseConfigured()) return sb.sbGetPlaybookSectors();
  return MOCK_PLAYBOOK_SECTORS;
}
