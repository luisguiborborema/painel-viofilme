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
