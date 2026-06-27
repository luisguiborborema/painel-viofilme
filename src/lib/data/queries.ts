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
  audience: AudienceProfile;
  topPosts: TopPost[];
  teamPattern: string;
};

function withFrequency(s: OrganicScope): OrganicScopeView {
  return { ...s, frequency: s.reach > 0 ? r1(s.impressions / s.reach) : 0 };
}

export async function getOrganicResults(
  clientId: string,
): Promise<OrganicResults> {
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
  nextDue: { amount: number; dueDate: string; daysUntil: number } | null;
  lastPayment: { amount: number; paidDate: string; method: string } | null;
  plan: { name: string; activeSince: string };
  invoices: Invoice[];
  totalPaidYear: number;
  documents: FinanceDocument[];
};

export async function getFinance(clientId: string): Promise<FinanceOverview> {
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
// Hub de acessos & ativos de marca (M6)
// ---------------------------------------------------------------------------
export type BrandHub = {
  driveName: string;
  accesses: AccessItem[];
  assets: BrandAsset[];
  team: TeamMember[];
  activity: ActivityItem[];
};

export async function getBrandHub(clientId: string): Promise<BrandHub> {
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
  const client = CLIENTS.find((c) => c.id === clientId);
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
