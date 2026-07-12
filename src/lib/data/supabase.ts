/**
 * Implementações das queries lendo do Supabase (modo produção).
 *
 * `queries.ts` delega para cá quando `isSupabaseConfigured()` é verdadeiro.
 * Usa o cliente com escopo de cookie (RLS aplicado): cada cliente vê apenas
 * os próprios dados; o gerencial vê tudo.
 *
 * Os dados vêm das tabelas populadas pela sincronização da Meta
 * (account_metrics, content_posts, campaigns, campaign_metrics) e pelas
 * tabelas geridas pela agência (clients, meetings). Campos sem fonte
 * sincronizada ainda (perfil de audiência, aprovação de peças) usam padrões
 * neutros até ganharem origem própria.
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ClientRequests, RequestStatus } from "./requests";
import type {
  AccountMetricPoint,
  AdCampaign,
  AudienceProfile,
  Campaign,
  Client,
  ContentPost,
  FormatReach,
  Invoice,
  Meeting,
  MediaType,
  Platform,
  PostStatus,
  TopPost,
} from "./types";
import type {
  ClientHome,
  ClientOverview,
  FinanceOverview,
  MediaPerformance,
} from "./queries";
import type { OrganicResults, OrganicScopeView } from "./queries";
import type { PlaybookSector, PlaybookFormat } from "./playbooks";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// --- helpers de período ------------------------------------------------------
function periodLabel(d = new Date()): string {
  return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function monthKeyOf(iso: string): number {
  const d = new Date(iso);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function pctDelta(cur: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((cur - prev) / prev) * 100);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function daysRemainingInMonth(d = new Date()): number {
  const total = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return total - d.getUTCDate();
}

const EMPTY_AUDIENCE: AudienceProfile = {
  ageRanges: [],
  bestHours: { rows: [], grid: [] },
  topLocations: [],
};

// --- clients ----------------------------------------------------------------
type ClientRow = {
  id: string;
  name: string;
  slug: string | null;
  segment: string | null;
  instagram_username: string | null;
  facebook_page_name: string | null;
  status: string;
  has_paid_traffic: boolean;
  client_type: "lead_gen" | "ecommerce" | "local_business";
  active_networks: Platform[];
  asaas_customer_id: string | null;
  whatsapp: string | null;
};

function mapClient(row: ClientRow, connectedIds: Set<string>): Client {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
    segment: row.segment ?? "—",
    instagramUsername: row.instagram_username,
    facebookPageName: row.facebook_page_name,
    status: row.status,
    metaConnected: connectedIds.has(row.id),
    hasPaidTraffic: row.has_paid_traffic,
    clientType: row.client_type,
    activeNetworks: row.active_networks ?? ["instagram", "facebook"],
    asaasCustomerId: row.asaas_customer_id,
    whatsapp: row.whatsapp,
  };
}

const CLIENT_COLS =
  "id, name, slug, segment, instagram_username, facebook_page_name, status, has_paid_traffic, client_type, active_networks, asaas_customer_id, whatsapp";

const connectedClientIds = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("meta_connections").select("client_id");
  return new Set((data ?? []).map((r) => r.client_id as string));
});

export async function sbGetClients(): Promise<Client[]> {
  const supabase = await createClient();
  const [{ data }, connected] = await Promise.all([
    supabase.from("clients").select(CLIENT_COLS).order("name"),
    connectedClientIds(),
  ]);
  return (data ?? []).map((r) => mapClient(r as ClientRow, connected));
}

export async function sbGetClientById(
  id: string | null,
): Promise<Client | undefined> {
  if (!id) return undefined;
  const supabase = await createClient();
  const [{ data }, connected] = await Promise.all([
    supabase.from("clients").select(CLIENT_COLS).eq("id", id).single(),
    connectedClientIds(),
  ]);
  return data ? mapClient(data as ClientRow, connected) : undefined;
}

// --- content_posts ----------------------------------------------------------
type PostRow = {
  id: string;
  client_id: string;
  platform: Platform;
  media_type: MediaType;
  status: PostStatus;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
};

function mapPost(r: PostRow): ContentPost {
  return {
    id: r.id,
    clientId: r.client_id,
    platform: r.platform,
    mediaType: r.media_type,
    status: r.status,
    caption: r.caption ?? "",
    thumbnailUrl: r.thumbnail_url,
    permalink: r.permalink,
    publishedAt: r.published_at,
    scheduledAt: r.scheduled_at,
    approval: null,
    author: null,
    waitingHours: null,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    reach: r.reach,
    impressions: r.impressions,
  };
}

export async function sbGetContent(
  clientId?: string,
  status?: PostStatus,
): Promise<ContentPost[]> {
  const supabase = await createClient();
  let q = supabase.from("content_posts").select("*");
  if (clientId) q = q.eq("client_id", clientId);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const list = (data ?? []).map((r) => mapPost(r as PostRow));
  return list.sort((a, b) => {
    const da = a.publishedAt ?? a.scheduledAt ?? "";
    const db = b.publishedAt ?? b.scheduledAt ?? "";
    return db.localeCompare(da);
  });
}

// --- account_metrics --------------------------------------------------------
type AccountRow = {
  platform: Platform;
  date: string;
  followers: number;
  reach: number;
  impressions: number;
  profile_views: number;
};

async function accountRows(
  clientId: string,
  platform?: Platform,
): Promise<AccountRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("account_metrics")
    .select("platform, date, followers, reach, impressions, profile_views")
    .eq("client_id", clientId)
    .order("date");
  if (platform) q = q.eq("platform", platform);
  const { data } = await q;
  return (data ?? []) as AccountRow[];
}

export async function sbGetAccountSeries(
  clientId: string,
  platform: Platform,
): Promise<AccountMetricPoint[]> {
  const rows = await accountRows(clientId, platform);
  return rows.map((r) => ({
    date: r.date,
    followers: r.followers,
    reach: r.reach,
    impressions: r.impressions,
    profileViews: r.profile_views,
  }));
}

// --- campanhas (tipo legado Campaign, M3) -----------------------------------
type CampaignRow = {
  id: string;
  client_id: string;
  external_id: string | null;
  name: string;
  objective: string | null;
  platform: Platform | null;
  status: Campaign["status"];
  budget: number | null;
  spend: number;
  start_date: string | null;
  end_date: string | null;
};

type CampaignMetricAgg = {
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  spend: number;
};

type CampaignMetricRow = {
  campaign_id: string;
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  spend: number;
};

const emptyAgg = (): CampaignMetricAgg => ({
  impressions: 0, reach: 0, clicks: 0, conversions: 0, spend: 0,
});

/** Busca TODAS as métricas diárias das campanhas em uma única consulta. */
async function campaignMetricRows(
  campaignIds: string[],
): Promise<CampaignMetricRow[]> {
  if (!campaignIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_metrics")
    .select("campaign_id, date, impressions, reach, clicks, conversions, spend")
    .in("campaign_id", campaignIds);
  return (data ?? []) as CampaignMetricRow[];
}

/** Agrega as linhas por campanha (opcionalmente filtrando por mês). */
function aggByCampaign(
  rows: CampaignMetricRow[],
  monthKey?: number,
): Map<string, CampaignMetricAgg> {
  const map = new Map<string, CampaignMetricAgg>();
  for (const r of rows) {
    if (monthKey !== undefined && monthKeyOf(r.date) !== monthKey) continue;
    const cur = map.get(r.campaign_id) ?? emptyAgg();
    cur.impressions += Number(r.impressions || 0);
    cur.reach += Number(r.reach || 0);
    cur.clicks += Number(r.clicks || 0);
    cur.conversions += Number(r.conversions || 0);
    cur.spend += Number(r.spend || 0);
    map.set(r.campaign_id, cur);
  }
  return map;
}

async function campaignMetricsByCampaign(
  campaignIds: string[],
  sinceMonthKey?: number,
): Promise<Map<string, CampaignMetricAgg>> {
  const map = new Map<string, CampaignMetricAgg>();
  if (!campaignIds.length) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_metrics")
    .select("campaign_id, date, impressions, reach, clicks, conversions, spend")
    .in("campaign_id", campaignIds);
  for (const r of data ?? []) {
    if (sinceMonthKey !== undefined && monthKeyOf(r.date) < sinceMonthKey)
      continue;
    const cur = map.get(r.campaign_id) ?? {
      impressions: 0, reach: 0, clicks: 0, conversions: 0, spend: 0,
    };
    cur.impressions += Number(r.impressions || 0);
    cur.reach += Number(r.reach || 0);
    cur.clicks += Number(r.clicks || 0);
    cur.conversions += Number(r.conversions || 0);
    cur.spend += Number(r.spend || 0);
    map.set(r.campaign_id, cur);
  }
  return map;
}

export async function sbGetCampaigns(clientId?: string): Promise<Campaign[]> {
  const supabase = await createClient();
  let q = supabase.from("campaigns").select("*");
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  const rows = (data ?? []) as CampaignRow[];
  const agg = await campaignMetricsByCampaign(rows.map((r) => r.id));
  return rows
    .map((r) => {
      const m = agg.get(r.id) ?? {
        impressions: 0, reach: 0, clicks: 0, conversions: 0, spend: 0,
      };
      return {
        id: r.id,
        clientId: r.client_id,
        name: r.name,
        objective: r.objective ?? "—",
        platform: r.platform ?? "instagram",
        status: r.status,
        budget: Number(r.budget ?? 0),
        spend: Number(r.spend ?? m.spend),
        impressions: m.impressions,
        reach: m.reach,
        clicks: m.clicks,
        conversions: m.conversions,
        startDate: r.start_date ?? "",
        endDate: r.end_date,
      } satisfies Campaign;
    })
    .sort((a, b) => b.spend - a.spend);
}

// --- performance de mídia paga (M3 v2) --------------------------------------
export async function sbGetMediaPerformance(
  clientId: string,
): Promise<MediaPerformance> {
  const now = new Date();
  const curKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const supabase = await createClient();

  const [{ data: client }, { data: campRows }] = await Promise.all([
    supabase.from("clients").select("client_type").eq("id", clientId).single(),
    supabase.from("campaigns").select("*").eq("client_id", clientId),
  ]);
  const campaigns = (campRows ?? []) as CampaignRow[];
  const ids = campaigns.map((c) => c.id);

  // Uma única consulta às métricas; agregações feitas em memória.
  const metricRows = await campaignMetricRows(ids);
  const curAgg = aggByCampaign(metricRows, curKey);
  const prevAgg = aggByCampaign(metricRows, curKey - 1);

  const sum = (m: Map<string, CampaignMetricAgg>, k: keyof CampaignMetricAgg) =>
    [...m.values()].reduce((s, v) => s + v[k], 0);

  // Mês atual
  const invested = sum(curAgg, "spend");
  const clicks = sum(curAgg, "clicks");
  const conversions = sum(curAgg, "conversions");
  const leads = conversions; // sem distinção lead/compra na 1ª versão
  const cpl = leads ? round1(invested / leads) : 0;
  const cpa = conversions ? round1(invested / conversions) : 0;

  // Mês anterior (delta)
  const prevInvested = sum(prevAgg, "spend");
  const prevConversions = sum(prevAgg, "conversions");
  const prevLeads = prevConversions;
  const prevCpl = prevLeads ? prevInvested / prevLeads : 0;

  const budget = campaigns.reduce((s, c) => s + Number(c.budget ?? 0), 0);
  const daysElapsed = now.getUTCDate();

  // Histórico de CPL (meta) dos últimos 4 meses (mesmas linhas, por mês)
  const allAgg = new Map<number, CampaignMetricAgg>();
  for (const r of metricRows) {
    const key = monthKeyOf(r.date);
    const cur = allAgg.get(key) ?? emptyAgg();
    cur.spend += Number(r.spend || 0);
    cur.conversions += Number(r.conversions || 0);
    allAgg.set(key, cur);
  }
  const cplHistory = [3, 2, 1, 0].map((k) => {
    const key = curKey - k;
    const a = allAgg.get(key);
    const meta = a && a.conversions ? round1(a.spend / a.conversions) : 0;
    return { month: MESES[(key % 12 + 12) % 12].slice(0, 3), meta, google: 0 };
  });

  const adCampaigns: AdCampaign[] = campaigns.map((c) => {
    const m = curAgg.get(c.id) ?? {
      impressions: 0, reach: 0, clicks: 0, conversions: 0, spend: 0,
    };
    const cLeads = m.conversions;
    return {
      id: c.id,
      clientId,
      name: c.name,
      objective: c.objective ?? "—",
      audience: "—",
      network: "meta",
      status: c.status === "paused" ? "paused" : "active",
      invested: Math.round(m.spend),
      clicks: m.clicks,
      leads: cLeads,
      cpl: cLeads ? round1(m.spend / cLeads) : 0,
      conversions: m.conversions,
      cpc: m.clicks ? round1(m.spend / m.clicks) : 0,
      cpa: m.conversions ? round1(m.spend / m.conversions) : 0,
    };
  });

  return {
    clientType: (client?.client_type as MediaPerformance["clientType"]) ?? "lead_gen",
    periodLabel: periodLabel(now),
    invested: Math.round(invested),
    budget: Math.round(budget),
    pct: budget ? Math.round((invested / budget) * 100) : 0,
    daysRemaining: daysRemainingInMonth(now),
    balance: Math.round(budget - invested),
    dailyPace: daysElapsed ? Math.round(invested / daysElapsed) : 0,
    metaInvested: Math.round(invested),
    googleInvested: 0,
    leads,
    leadsDelta: pctDelta(leads, prevLeads),
    cpl,
    cplDelta: round1(cpl - prevCpl),
    conversions,
    convDelta: pctDelta(conversions, prevConversions),
    cpa,
    cplHistory,
    campaigns: adCampaigns,
    insight:
      leads > 0
        ? `Você teve ${leads} resultados no mês a um custo médio de R$ ${cpl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por resultado.`
        : "Ainda sem resultados registrados neste período.",
  };
}

// --- resultados orgânicos ---------------------------------------------------
function scopeFromRows(
  rows: AccountRow[],
  posts: ContentPost[],
  platform: Platform,
  curKey: number,
): OrganicScopeView {
  const sorted = rows.filter((r) => r.platform === platform);
  const month = sorted.filter((r) => monthKeyOf(r.date) === curKey);
  const prev = sorted.filter((r) => monthKeyOf(r.date) === curKey - 1);

  const latestFollowers = sorted.at(-1)?.followers ?? 0;
  const prevMonthFollowers = prev.at(-1)?.followers ?? month.at(0)?.followers ?? latestFollowers;
  const followersDelta = latestFollowers - prevMonthFollowers;

  const reach = month.reduce((s, r) => s + r.reach, 0);
  const prevReach = prev.reduce((s, r) => s + r.reach, 0);
  const impressions = month.reduce((s, r) => s + r.impressions, 0);
  const prevImpr = prev.reduce((s, r) => s + r.impressions, 0);

  const platPosts = posts.filter(
    (p) => p.platform === platform && p.publishedAt && monthKeyOf(p.publishedAt) === curKey,
  );
  const interactions = platPosts.reduce(
    (s, p) => s + p.likes + p.comments + p.shares + p.saves,
    0,
  );
  const postReach = platPosts.reduce((s, p) => s + p.reach, 0);
  const engagement = postReach ? round1((interactions / postReach) * 100) : 0;

  return {
    followers: latestFollowers,
    followersDelta,
    followersDeltaPct: prevMonthFollowers
      ? round1((followersDelta / prevMonthFollowers) * 100)
      : 0,
    reach,
    reachDelta: pctDelta(reach, prevReach),
    impressions,
    impressionsDelta: pctDelta(impressions, prevImpr),
    engagement,
    engagementDelta: 0,
    frequency: reach ? round1(impressions / reach) : 0,
  };
}

function formatBreakdown(
  posts: ContentPost[],
  pick: (p: ContentPost) => number,
): FormatReach {
  const acc = { reels: 0, feed: 0, stories: 0, carousel: 0 };
  for (const p of posts) {
    const v = pick(p);
    if (p.mediaType === "reel" || p.mediaType === "video") acc.reels += v;
    else if (p.mediaType === "story") acc.stories += v;
    else if (p.mediaType === "carousel") acc.carousel += v;
    else acc.feed += v;
  }
  const total = acc.reels + acc.feed + acc.stories + acc.carousel || 1;
  const r = (x: number) => Math.round((x / total) * 100);
  return {
    reels: r(acc.reels), feed: r(acc.feed),
    stories: r(acc.stories), carousel: r(acc.carousel),
  };
}

export async function sbGetOrganicResults(
  clientId: string,
): Promise<OrganicResults> {
  const now = new Date();
  const curKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const [rows, posts] = await Promise.all([
    accountRows(clientId),
    sbGetContent(clientId, "published"),
  ]);

  const ig = scopeFromRows(rows, posts, "instagram", curKey);
  const fb = scopeFromRows(rows, posts, "facebook", curKey);
  const wReach = ig.reach + fb.reach || 1;

  const totals: OrganicScopeView & { engagementAboveAvg: boolean } = {
    followers: ig.followers + fb.followers,
    followersDelta: ig.followersDelta + fb.followersDelta,
    followersDeltaPct: round1(
      ((ig.followersDelta + fb.followersDelta) /
        (ig.followers + fb.followers - ig.followersDelta - fb.followersDelta || 1)) *
        100,
    ),
    reach: ig.reach + fb.reach,
    reachDelta: Math.round((ig.reachDelta * ig.reach + fb.reachDelta * fb.reach) / wReach),
    impressions: ig.impressions + fb.impressions,
    impressionsDelta: Math.round(
      (ig.impressionsDelta * ig.impressions + fb.impressionsDelta * fb.impressions) /
        (ig.impressions + fb.impressions || 1),
    ),
    engagement: round1((ig.engagement * ig.reach + fb.engagement * fb.reach) / wReach),
    engagementDelta: 0,
    frequency: round1((ig.impressions + fb.impressions) / wReach),
    engagementAboveAvg: false,
  };

  // Histórico de seguidores (6 meses) por plataforma
  const monthly = new Map<number, { instagram: number; facebook: number }>();
  for (const r of rows) {
    const key = monthKeyOf(r.date);
    const cur = monthly.get(key) ?? { instagram: 0, facebook: 0 };
    cur[r.platform] = r.followers; // último valor do mês prevalece (rows ordenados por data)
    monthly.set(key, cur);
  }
  const followersHistory = [5, 4, 3, 2, 1, 0].map((k) => {
    const key = curKey - k;
    const v = monthly.get(key) ?? { instagram: 0, facebook: 0 };
    return {
      month: MESES[((key % 12) + 12) % 12].slice(0, 3),
      instagram: v.instagram,
      facebook: v.facebook,
    };
  });

  const monthPosts = posts.filter(
    (p) => p.publishedAt && monthKeyOf(p.publishedAt) === curKey,
  );
  const topPosts: TopPost[] = [...monthPosts]
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 3)
    .map((p, i) => ({
      rank: i + 1,
      title: (p.caption ?? "Publicação").slice(0, 60) || "Publicação",
      mediaType: p.mediaType,
      platform: p.platform,
      publishedAt: p.publishedAt ?? "",
      reach: p.reach,
      likes: p.likes,
      comments: p.comments,
    }));

  return {
    periodLabel: periodLabel(now),
    totals,
    instagram: ig,
    facebook: fb,
    followersHistory,
    reachByFormat: formatBreakdown(monthPosts, (p) => p.reach),
    engagementByFormat: formatBreakdown(
      monthPosts,
      (p) => p.likes + p.comments + p.shares + p.saves,
    ),
    volumeByFormat: formatBreakdown(monthPosts, () => 1),
    audience: EMPTY_AUDIENCE,
    topPosts,
    teamPattern:
      topPosts.length > 0
        ? "Seus melhores conteúdos do mês estão destacados acima — a equipe acompanha os padrões de formato e horário."
        : "Assim que houver publicações no período, destacamos aqui os padrões de melhor desempenho.",
  };
}

// --- meetings ---------------------------------------------------------------
type MeetingRow = {
  id: string;
  client_id: string;
  title: string;
  starts_at: string;
  join_url: string | null;
  agenda: string | null;
  participants: string[];
  next_steps: string | null;
};

async function sbMeetings(clientId: string): Promise<Meeting[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("client_id", clientId)
    .order("starts_at");
  return (data ?? []).map((r) => {
    const m = r as MeetingRow;
    return {
      id: m.id,
      clientId: m.client_id,
      title: m.title,
      startsAt: m.starts_at,
      joinUrl: m.join_url ?? "",
      agenda: m.agenda ?? "",
      participants: m.participants ?? [],
      nextSteps: m.next_steps ?? "",
    };
  });
}

// --- home do cliente --------------------------------------------------------
export async function sbGetClientHome(clientId: string): Promise<ClientHome> {
  const now = new Date();
  const [client, organic, media, content, meetings] = await Promise.all([
    sbGetClientById(clientId),
    sbGetOrganicResults(clientId),
    sbGetMediaPerformance(clientId),
    sbGetContent(clientId, "scheduled"),
    sbMeetings(clientId),
  ]);

  const upcomingPosts = content.sort((a, b) =>
    (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""),
  );

  return {
    clientName: client?.name ?? "Cliente",
    periodLabel: periodLabel(now),
    pendingApprovals: 0,
    oldestApprovalDays: 0,
    organicEngagement: {
      value: organic.totals.engagement,
      delta: organic.totals.engagementDelta,
    },
    reach: { value: organic.totals.reach, delta: organic.totals.reachDelta },
    cpl: { value: media.cpl, delta: media.cplDelta },
    media: {
      invested: media.invested,
      total: media.budget,
      pct: media.pct,
      leads: media.leads,
      conversions: media.conversions,
      daysRemaining: media.daysRemaining,
      balance: media.balance,
    },
    engagementSeries: [],
    upcomingPosts,
    meetings,
  };
}

// --- visão geral (gerencial/overview) ---------------------------------------
export async function sbGetClientOverview(
  clientId: string,
): Promise<ClientOverview> {
  const now = new Date();
  const curKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const [igSeries, fbSeries, content, campaigns] = await Promise.all([
    sbGetAccountSeries(clientId, "instagram"),
    sbGetAccountSeries(clientId, "facebook"),
    sbGetContent(clientId),
    sbGetCampaigns(clientId),
  ]);

  const series = igSeries.length >= fbSeries.length ? igSeries : fbSeries;
  const latestFollowers =
    (igSeries.at(-1)?.followers ?? 0) + (fbSeries.at(-1)?.followers ?? 0);
  const monthAgo =
    (igSeries.find((p) => monthKeyOf(p.date) === curKey)?.followers ?? 0) +
    (fbSeries.find((p) => monthKeyOf(p.date) === curKey)?.followers ?? 0);

  const reach30d = series
    .filter((p) => monthKeyOf(p.date) === curKey)
    .reduce((s, p) => s + p.reach, 0);

  const monthPosts = content.filter(
    (p) => p.status === "published" && p.publishedAt && monthKeyOf(p.publishedAt) === curKey,
  );
  const interactions = monthPosts.reduce(
    (s, p) => s + p.likes + p.comments + p.shares + p.saves,
    0,
  );
  const postReach = monthPosts.reduce((s, p) => s + p.reach, 0);

  return {
    followers: latestFollowers,
    followersChange: latestFollowers - monthAgo,
    reach30d,
    engagementRate: postReach ? round1((interactions / postReach) * 100) : 0,
    postsPublished: content.filter((p) => p.status === "published").length,
    postsScheduled: content.filter((p) => p.status === "scheduled").length,
    totalSpend: campaigns.reduce((s, c) => s + c.spend, 0),
    totalConversions: campaigns.reduce((s, c) => s + c.conversions, 0),
    series,
  };
}

// --- financeiro (Asaas → payments) ------------------------------------------
type PaymentRow = {
  asaas_payment_id: string;
  status: string | null;
  billing_type: string | null;
  value: number | null;
  net_value: number | null;
  due_date: string | null;
  payment_date: string | null;
  description: string | null;
  invoice_url: string | null;
};

const PAID_STATUS = new Set([
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
  "DUNNING_RECEIVED",
]);

const BILLING_LABEL: Record<string, string> = {
  BOLETO: "Boleto",
  PIX: "PIX",
  CREDIT_CARD: "Cartão",
  DEBIT_CARD: "Débito",
  TRANSFER: "Transferência",
  UNDEFINED: "—",
};

function daysUntilISO(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export async function sbGetFinance(clientId: string): Promise<FinanceOverview> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "asaas_payment_id, status, billing_type, value, net_value, due_date, payment_date, description, invoice_url",
    )
    .eq("client_id", clientId)
    .order("due_date", { ascending: false });

  const rows = (data ?? []) as PaymentRow[];

  const invoices: Invoice[] = rows.map((r) => {
    const paid = PAID_STATUS.has(r.status ?? "");
    const due = r.due_date ?? "";
    const [y, m] = due ? due.split("-") : ["", ""];
    const method = r.billing_type
      ? (BILLING_LABEL[r.billing_type] ?? r.billing_type)
      : null;
    return {
      id: r.asaas_payment_id,
      competence:
        y && m ? `${MESES[Number(m) - 1]?.slice(0, 3) ?? m} / ${y}` : "—",
      description: r.description ?? method ?? "Cobrança",
      amount: Number(r.value ?? 0),
      dueDate: due,
      status: paid ? "paid" : "open",
      method,
      paidDate: r.payment_date ?? null,
    } satisfies Invoice;
  });

  const open = invoices
    .filter((i) => i.status === "open" && i.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextInv = open[0];
  const nextDue = nextInv
    ? {
        amount: nextInv.amount,
        dueDate: nextInv.dueDate,
        daysUntil: daysUntilISO(nextInv.dueDate),
      }
    : null;

  const paidList = invoices
    .filter((i) => i.status === "paid" && i.paidDate)
    .sort((a, b) => (b.paidDate ?? "").localeCompare(a.paidDate ?? ""));
  const last = paidList[0];
  const lastPayment = last
    ? { amount: last.amount, paidDate: last.paidDate!, method: last.method ?? "—" }
    : null;

  const totalPaidYear = invoices
    .filter((i) => i.status === "paid" && (i.paidDate ?? "").startsWith(String(year)))
    .reduce((s, i) => s + i.amount, 0);

  return {
    year,
    nextDue,
    lastPayment,
    plan: { name: "Plano mensal", activeSince: "—" },
    invoices,
    totalPaidYear,
    documents: [],
  };
}

// ── Módulo 2: CRM & Vendas ───────────────────────────────────────────────────

import type {
  Bant,
  CardFieldSetting,
  CrmComment,
  CrmInteraction,
  CrmLead,
  CrmStage,
  CrmTask,
  CrmChannel,
  Company,
  Contact,
  DealContact,
  Pipeline,
  Stage,
  Tag,
  PropertyDef,
  PropertyOption,
  CrmObjectType,
  PropertyFieldType,
  LostReason,
  TaskFlow,
  CrmGoal,
  CaptureForm,
  StageChange,
} from "./crm";

const CRM_LEAD_COLS =
  "id,name,contact_name,contact_phone,contact_email,segment,stage,monthly_value,media_budget,plan,probability,source,owner,assignees,bant,next_task_title,next_task_due,last_interaction_at,stage_changed_at,won_at,lost_at,lost_reason,converted_client_id,company_id,primary_contact_id,pipeline_id,stage_id,tags,properties,created_at,updated_at";

type CrmLeadRow = Record<string, unknown>;

function mapCrmLead(r: CrmLeadRow): CrmLead {
  const s = (k: string) => (r[k] == null ? undefined : String(r[k]));
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    id: String(r.id),
    name: String(r.name),
    contactName: s("contact_name"),
    contactPhone: s("contact_phone"),
    contactEmail: s("contact_email"),
    segment: s("segment"),
    stage: (r.stage as CrmStage) ?? "prospeccao",
    monthlyValue: n("monthly_value"),
    mediaBudget: n("media_budget"),
    plan: s("plan"),
    probability: n("probability"),
    source: s("source"),
    owner: s("owner"),
    assignees: (r.assignees as string[] | null) ?? undefined,
    bant: (r.bant as Bant) ?? {},
    nextTaskTitle: s("next_task_title"),
    nextTaskDue: s("next_task_due"),
    lastInteractionAt: s("last_interaction_at"),
    stageChangedAt: s("stage_changed_at") ?? String(r.created_at),
    wonAt: s("won_at"),
    lostAt: s("lost_at"),
    lostReason: s("lost_reason"),
    convertedClientId: s("converted_client_id"),
    companyId: s("company_id"),
    primaryContactId: s("primary_contact_id"),
    pipelineId: s("pipeline_id"),
    stageId: s("stage_id"),
    tags: (r.tags as string[] | null) ?? [],
    properties: (r.properties as Record<string, unknown> | null) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapCrmTask(r: CrmLeadRow): CrmTask {
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    title: String(r.title),
    dueDate: r.due_date == null ? undefined : String(r.due_date),
    status: (r.status as "pending" | "done") ?? "pending",
    doneAt: r.done_at == null ? undefined : String(r.done_at),
    assignee: r.assignee == null ? undefined : String(r.assignee),
    assignees: (r.assignees as string[] | null) ?? undefined,
    properties: (r.properties as Record<string, unknown> | null) ?? {},
    createdAt: String(r.created_at),
  };
}

const CRM_TASK_COLS =
  "id,lead_id,title,due_date,status,done_at,assignee,assignees,properties,created_at";

function mapCrmInteraction(r: CrmLeadRow): CrmInteraction {
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    channel: (r.channel as CrmChannel) ?? "note",
    direction: (r.direction as "in" | "out" | null) ?? null,
    body: String(r.body ?? ""),
    author: r.author == null ? undefined : String(r.author),
    meta: (r.meta as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
  };
}

export async function sbGetCrmLeads(): Promise<CrmLead[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_leads")
    .select(CRM_LEAD_COLS)
    .order("stage_changed_at", { ascending: true });
  return (data ?? []).map(mapCrmLead);
}

export async function sbGetCrmTasks(): Promise<CrmTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_tasks")
    .select(CRM_TASK_COLS)
    .order("due_date", { ascending: true });
  return (data ?? []).map(mapCrmTask);
}

export async function sbGetCrmLead(
  id: string,
): Promise<{ lead: CrmLead; interactions: CrmInteraction[]; tasks: CrmTask[] } | null> {
  const supabase = await createClient();
  const { data: leadRow } = await supabase
    .from("crm_leads")
    .select(CRM_LEAD_COLS)
    .eq("id", id)
    .maybeSingle();
  if (!leadRow) return null;

  const [{ data: ints }, { data: tks }] = await Promise.all([
    supabase
      .from("crm_interactions")
      .select("id,lead_id,channel,direction,body,author,meta,created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("crm_tasks")
      .select(CRM_TASK_COLS)
      .eq("lead_id", id)
      .order("due_date", { ascending: true }),
  ]);

  return {
    lead: mapCrmLead(leadRow),
    interactions: (ints ?? []).map(mapCrmInteraction),
    tasks: (tks ?? []).map(mapCrmTask),
  };
}

function mapCrmComment(r: Record<string, unknown>): CrmComment {
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    parentId: r.parent_id ? String(r.parent_id) : null,
    author: r.author == null ? undefined : String(r.author),
    authorId: r.author_id ? String(r.author_id) : null,
    body: String(r.body ?? ""),
    reactions: (r.reactions as Record<string, string[]> | null) ?? {},
    edited: Boolean(r.edited),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function sbGetCardLayout(objectType: string): Promise<CardFieldSetting[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_card_layout")
    .select("fields")
    .eq("object_type", objectType)
    .maybeSingle();
  const arr = (data?.fields as CardFieldSetting[] | null) ?? [];
  return Array.isArray(arr) ? arr : [];
}

export async function sbGetCrmComments(leadId: string): Promise<CrmComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_comments")
    .select("id,lead_id,parent_id,author,author_id,body,reactions,edited,created_at,updated_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapCrmComment);
}

// ── CRM v2: Empresas / Contatos / Pipeline / Tags / Propriedades ─────────────

function mapCompany(r: CrmLeadRow): Company {
  const s = (k: string) => (r[k] == null ? undefined : String(r[k]));
  return {
    id: String(r.id),
    name: String(r.name),
    segment: s("segment"),
    website: s("website"),
    phone: s("phone"),
    email: s("email"),
    city: s("city"),
    size: s("size"),
    owner: s("owner"),
    tags: (r.tags as string[] | null) ?? [],
    properties: (r.properties as Record<string, unknown> | null) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapContact(r: CrmLeadRow): Contact {
  const s = (k: string) => (r[k] == null ? undefined : String(r[k]));
  return {
    id: String(r.id),
    companyId: s("company_id"),
    name: String(r.name),
    title: s("title"),
    phone: s("phone"),
    email: s("email"),
    isPrimary: Boolean(r.is_primary),
    owner: s("owner"),
    tags: (r.tags as string[] | null) ?? [],
    properties: (r.properties as Record<string, unknown> | null) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

const COMPANY_COLS =
  "id,name,segment,website,phone,email,city,size,owner,tags,properties,created_at,updated_at";
const CONTACT_COLS =
  "id,company_id,name,title,phone,email,is_primary,owner,tags,properties,created_at,updated_at";

export async function sbGetCrmCompanies(): Promise<Company[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_companies")
    .select(COMPANY_COLS)
    .order("name", { ascending: true });
  return (data ?? []).map(mapCompany);
}

export async function sbGetCrmContacts(): Promise<Contact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_contacts")
    .select(CONTACT_COLS)
    .order("name", { ascending: true });
  return (data ?? []).map(mapContact);
}

export async function sbGetCrmDealContacts(): Promise<DealContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_deal_contacts")
    .select("deal_id,contact_id,role,is_primary");
  return (data ?? []).map((r) => ({
    dealId: String(r.deal_id),
    contactId: String(r.contact_id),
    role: r.role == null ? undefined : String(r.role),
    isPrimary: Boolean(r.is_primary),
  }));
}

export async function sbGetCrmPipelines(): Promise<Pipeline[]> {
  const supabase = await createClient();
  const [{ data: pipes }, { data: stages }] = await Promise.all([
    supabase
      .from("crm_pipelines")
      .select("id,name,is_default,position")
      .order("position", { ascending: true }),
    supabase
      .from("crm_stages")
      .select("id,pipeline_id,key,label,color,probability,position,kind,requirements,automations")
      .order("position", { ascending: true }),
  ]);
  return (pipes ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    isDefault: Boolean(p.is_default),
    position: Number(p.position ?? 0),
    stages: (stages ?? [])
      .filter((s) => String(s.pipeline_id) === String(p.id))
      .map(
        (s): Stage => ({
          id: String(s.id),
          key: String(s.key),
          label: String(s.label),
          color: String(s.color ?? "#64748b"),
          probability: Number(s.probability ?? 0),
          position: Number(s.position ?? 0),
          kind: (s.kind as Stage["kind"]) ?? "open",
          requirements: (s.requirements as Stage["requirements"] | null) ?? [],
          automations: (s.automations as Stage["automations"] | null) ?? [],
        }),
      ),
  }));
}

export async function sbGetCrmTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_tags")
    .select("id,name,color")
    .order("name", { ascending: true });
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    color: String(r.color ?? "#2a63c9"),
  }));
}

export async function sbGetCrmTaskFlows(): Promise<TaskFlow[]> {
  const supabase = await createClient();
  const [{ data: flows }, { data: steps }] = await Promise.all([
    supabase.from("crm_task_flows").select("id,name,created_at").order("created_at", { ascending: true }),
    supabase
      .from("crm_task_flow_steps")
      .select("id,flow_id,position,title,due_days")
      .order("position", { ascending: true }),
  ]);
  return (flows ?? []).map((f) => ({
    id: String(f.id),
    name: String(f.name),
    steps: (steps ?? [])
      .filter((s) => String(s.flow_id) === String(f.id))
      .map((s) => ({
        id: String(s.id),
        position: Number(s.position ?? 0),
        title: String(s.title),
        dueDays: Number(s.due_days ?? 1),
      })),
  }));
}

function mapStageChange(r: Record<string, unknown>): StageChange {
  return {
    dealId: String(r.deal_id),
    fromStage: r.from_stage == null ? undefined : String(r.from_stage),
    toStage: String(r.to_stage),
    changedBy: r.changed_by == null ? undefined : String(r.changed_by),
    changedAt: String(r.changed_at),
  };
}

export async function sbGetStageHistory(): Promise<StageChange[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_stage_history")
    .select("deal_id,from_stage,to_stage,changed_by,changed_at")
    .order("changed_at", { ascending: true });
  return (data ?? []).map(mapStageChange);
}

export async function sbGetDealHistory(dealId: string): Promise<StageChange[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_stage_history")
    .select("deal_id,from_stage,to_stage,changed_by,changed_at")
    .eq("deal_id", dealId)
    .order("changed_at", { ascending: true });
  return (data ?? []).map(mapStageChange);
}

export async function sbGetPlaybookSectors(): Promise<PlaybookSector[]> {
  const supabase = await createClient();
  const [{ data: sectors }, { data: docs }] = await Promise.all([
    supabase.from("playbook_sectors").select("id,name,position").order("position", { ascending: true }),
    supabase
      .from("playbooks")
      .select("id,sector_id,title,content,format,position,updated_at,attachments")
      .order("position", { ascending: true }),
  ]);
  return (sectors ?? []).map((s) => ({
    id: String(s.id),
    name: String(s.name),
    position: Number(s.position ?? 0),
    playbooks: (docs ?? [])
      .filter((d) => String(d.sector_id) === String(s.id))
      .map((d) => ({
        id: String(d.id),
        sectorId: String(d.sector_id),
        title: String(d.title),
        content: String(d.content ?? ""),
        format: (d.format as PlaybookFormat) === "html" ? "html" : "md",
        position: Number(d.position ?? 0),
        updatedAt: String(d.updated_at ?? ""),
        attachments: Array.isArray(d.attachments)
          ? (d.attachments as unknown[]).map((a) => {
              const o = (a ?? {}) as Record<string, unknown>;
              return {
                id: String(o.id ?? ""),
                name: String(o.name ?? "arquivo"),
                url: String(o.url ?? ""),
                contentType: String(o.contentType ?? ""),
                size: Number(o.size ?? 0),
              };
            })
          : [],
      })),
  }));
}

export async function sbGetCaptureForms(): Promise<CaptureForm[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_capture_forms")
    .select("id,name,slug,owner,source,active")
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    owner: r.owner == null ? undefined : String(r.owner),
    source: String(r.source ?? "Formulário"),
    active: Boolean(r.active),
  }));
}

export async function sbGetCrmGoals(month: string): Promise<CrmGoal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_goals")
    .select("owner,month,target")
    .eq("month", month);
  return (data ?? []).map((r) => ({
    owner: String(r.owner),
    month: String(r.month),
    target: Number(r.target ?? 0),
  }));
}

export async function sbGetCrmLostReasons(): Promise<LostReason[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_lost_reasons")
    .select("id,label,position")
    .order("position", { ascending: true });
  return (data ?? []).map((r) => ({
    id: String(r.id),
    label: String(r.label),
    position: Number(r.position ?? 0),
  }));
}

export async function sbGetCrmProperties(): Promise<PropertyDef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_properties")
    .select("id,object_type,key,label,field_type,options,position,is_default")
    .order("position", { ascending: true });
  return (data ?? []).map((r) => ({
    id: String(r.id),
    objectType: (r.object_type as CrmObjectType) ?? "deal",
    key: String(r.key),
    label: String(r.label),
    fieldType: (r.field_type as PropertyFieldType) ?? "text",
    options: (r.options as PropertyOption[] | null) ?? [],
    position: Number(r.position ?? 0),
    isDefault: Boolean(r.is_default),
  }));
}

// ── Atendimento: inbox WhatsApp ──────────────────────────────────────────────

import type {
  Attendant,
  WaConversation,
  WaMessage,
  WaStatus,
} from "./inbox";

function mapConversation(
  r: Record<string, unknown>,
  names: Map<string, string>,
): WaConversation {
  const assignedTo = r.assigned_to == null ? undefined : String(r.assigned_to);
  return {
    id: String(r.id),
    phone: String(r.phone),
    name: r.name == null ? undefined : String(r.name),
    leadId: r.lead_id == null ? undefined : String(r.lead_id),
    assignedTo,
    assignedName: assignedTo ? names.get(assignedTo) : undefined,
    status: (r.status as WaStatus) ?? "open",
    lastMessageAt: r.last_message_at == null ? undefined : String(r.last_message_at),
    lastMessagePreview:
      r.last_message_preview == null ? undefined : String(r.last_message_preview),
    lastDirection: (r.last_direction as "in" | "out" | null) ?? undefined,
    unreadCount: Number(r.unread_count ?? 0),
    updatedAt: String(r.updated_at ?? r.created_at),
  };
}

async function attendantNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name")
    .eq("role", "gerencial");
  const map = new Map<string, string>();
  for (const p of data ?? []) map.set(String(p.id), String(p.full_name ?? "—"));
  return map;
}

export async function sbGetAttendants(): Promise<Attendant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url")
    .eq("role", "gerencial")
    .order("full_name", { ascending: true });
  return (data ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.full_name ?? "—"),
    avatarUrl: p.avatar_url ? String(p.avatar_url) : undefined,
  }));
}

export async function sbGetConversations(filter?: {
  assignedTo?: string;
  status?: WaStatus;
}): Promise<WaConversation[]> {
  const supabase = await createClient();
  let q = supabase
    .from("wa_conversations")
    .select(
      "id,phone,name,lead_id,assigned_to,status,last_message_at,last_message_preview,last_direction,unread_count,updated_at,created_at",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (filter?.assignedTo) q = q.eq("assigned_to", filter.assignedTo);
  if (filter?.status) q = q.eq("status", filter.status);
  const [{ data }, names] = await Promise.all([q, attendantNames(supabase)]);
  return (data ?? []).map((r) => mapConversation(r, names));
}

export async function sbGetConversation(id: string): Promise<{
  conversation: WaConversation;
  messages: WaMessage[];
} | null> {
  const supabase = await createClient();
  const { data: convRow } = await supabase
    .from("wa_conversations")
    .select(
      "id,phone,name,lead_id,assigned_to,status,last_message_at,last_message_preview,last_direction,unread_count,updated_at,created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!convRow) return null;

  const [{ data: msgs }, names] = await Promise.all([
    supabase
      .from("wa_messages")
      .select("id,conversation_id,direction,type,body,media_url,author,status,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    attendantNames(supabase),
  ]);

  return {
    conversation: mapConversation(convRow, names),
    messages: (msgs ?? []).map((m) => ({
      id: String(m.id),
      conversationId: String(m.conversation_id),
      direction: (m.direction as "in" | "out") ?? "in",
      type: (m.type as WaMessage["type"]) ?? "text",
      body: m.body == null ? undefined : String(m.body),
      mediaUrl: m.media_url == null ? undefined : String(m.media_url),
      author: m.author == null ? undefined : String(m.author),
      status: m.status == null ? undefined : String(m.status),
      createdAt: String(m.created_at),
    })),
  };
}

// ── Metas por cliente (client_goals) ─────────────────────────────────────────

import type { ClientGoal, GoalMetric } from "./gestao-vista";

function mapGoal(r: Record<string, unknown>): ClientGoal {
  return {
    clientId: String(r.client_id),
    metric: r.metric as GoalMetric,
    targetValue: Number(r.target_value ?? 0),
    period: String(r.period),
  };
}

export async function sbGetClientGoals(
  clientId: string,
  period: string,
): Promise<ClientGoal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_goals")
    .select("client_id,metric,target_value,period")
    .eq("client_id", clientId)
    .eq("period", period);
  return (data ?? []).map(mapGoal);
}

export async function sbGetGoalsForPeriod(period: string): Promise<ClientGoal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_goals")
    .select("client_id,metric,target_value,period")
    .eq("period", period);
  return (data ?? []).map(mapGoal);
}

// ── Central de Relatórios: updates recorrentes + envios ──────────────────────

import type { RecurringUpdate, UpdateMetric } from "./recurring";

export async function sbGetRecurringUpdates(clientId?: string): Promise<RecurringUpdate[]> {
  const supabase = await createClient();
  let q = supabase
    .from("recurring_updates")
    .select("id,client_id,metrics,recurrence,channel,recipient,status,last_sent_at,created_by,clients(name)")
    .order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    clientId: String(r.client_id),
    clientName: (r.clients as { name?: string } | null)?.name ?? undefined,
    metrics: (r.metrics as UpdateMetric[]) ?? [],
    recurrence: String(r.recurrence),
    channel: String(r.channel ?? "whatsapp"),
    recipient: String(r.recipient ?? "client"),
    status: (r.status as "active" | "paused") ?? "active",
    lastSentAt: r.last_sent_at == null ? undefined : String(r.last_sent_at),
    createdBy: r.created_by == null ? undefined : String(r.created_by),
  }));
}

export type ReportSend = {
  id: string;
  clientName?: string;
  kind: string;
  channel: string;
  sentBy?: string;
  detail?: string;
  createdAt: string;
};

export async function sbGetReportSends(): Promise<ReportSend[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("report_sends")
    .select("id,kind,channel,sent_by,detail,created_at,clients(name)")
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    clientName: (r.clients as { name?: string } | null)?.name ?? undefined,
    kind: String(r.kind ?? "report"),
    channel: String(r.channel ?? "whatsapp"),
    sentBy: r.sent_by == null ? undefined : String(r.sent_by),
    detail: r.detail == null ? undefined : String(r.detail),
    createdAt: String(r.created_at),
  }));
}

export async function sbGetClientRequests(): Promise<ClientRequests> {
  const supabase = await createClient();
  const [{ data: m }, { data: c }] = await Promise.all([
    supabase
      .from("meeting_requests")
      .select("id,client_id,subject,notes,urgency,status,created_at,clients(name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("content_requests")
      .select(
        "id,client_id,format,networks,desired_date,desired_time,subject,description,guideline,reference_urls,urgency,status,created_at,clients(name)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const name = (r: Record<string, unknown>) =>
    (r.clients as { name?: string } | null)?.name ?? undefined;
  return {
    meetings: (m ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      clientId: String(r.client_id),
      clientName: name(r),
      subject: String(r.subject ?? "Reunião"),
      notes: r.notes == null ? undefined : String(r.notes),
      urgency: (r.urgency as "normal" | "urgent") ?? "normal",
      status: (r.status as RequestStatus) ?? "pending",
      createdAt: String(r.created_at),
    })),
    content: (c ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      clientId: String(r.client_id),
      clientName: name(r),
      format: String(r.format ?? "image"),
      networks: (r.networks as string[] | null) ?? [],
      desiredDate: r.desired_date == null ? undefined : String(r.desired_date),
      desiredTime: r.desired_time == null ? undefined : String(r.desired_time),
      subject: String(r.subject ?? "Conteúdo"),
      description: r.description == null ? undefined : String(r.description),
      guideline: r.guideline == null ? undefined : String(r.guideline),
      referenceUrls: (r.reference_urls as string[] | null) ?? [],
      urgency: (r.urgency as "normal" | "urgent") ?? "normal",
      status: (r.status as RequestStatus) ?? "pending",
      createdAt: String(r.created_at),
    })),
  };
}
