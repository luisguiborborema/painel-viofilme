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
import { createClient } from "@/lib/supabase/server";
import type {
  AccountMetricPoint,
  AdCampaign,
  AudienceProfile,
  Campaign,
  Client,
  ContentPost,
  FormatReach,
  Meeting,
  MediaType,
  Platform,
  PostStatus,
  TopPost,
} from "./types";
import type { ClientHome, ClientOverview, MediaPerformance } from "./queries";
import type { OrganicResults, OrganicScopeView } from "./queries";

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
  };
}

const CLIENT_COLS =
  "id, name, slug, segment, instagram_username, facebook_page_name, status, has_paid_traffic, client_type, active_networks";

async function connectedClientIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("meta_connections").select("client_id");
  return new Set((data ?? []).map((r) => r.client_id as string));
}

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

  const curAgg = await campaignMetricsByCampaign(ids, curKey);
  const prevAgg = await campaignMetricsByCampaign(ids, curKey - 1);

  const sum = (m: Map<string, CampaignMetricAgg>, k: keyof CampaignMetricAgg) =>
    [...m.values()].reduce((s, v) => s + v[k], 0);

  // Mês atual
  const invested = sum(curAgg, "spend");
  const clicks = sum(curAgg, "clicks");
  const conversions = sum(curAgg, "conversions");
  const leads = conversions; // sem distinção lead/compra na 1ª versão
  const cpl = leads ? round1(invested / leads) : 0;
  const cpa = conversions ? round1(invested / conversions) : 0;

  // Mês anterior (delta) — prevAgg inclui mês atual; subtraímos
  const prevInvested = sum(prevAgg, "spend") - invested;
  const prevConversions = sum(prevAgg, "conversions") - conversions;
  const prevLeads = prevConversions;
  const prevCpl = prevLeads ? prevInvested / prevLeads : 0;

  const budget = campaigns.reduce((s, c) => s + Number(c.budget ?? 0), 0);
  const daysElapsed = now.getUTCDate();

  // Histórico de CPL (meta) dos últimos 4 meses
  const allAgg = await monthlyCampaignAgg(ids);
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

async function monthlyCampaignAgg(
  campaignIds: string[],
): Promise<Map<number, CampaignMetricAgg>> {
  const map = new Map<number, CampaignMetricAgg>();
  if (!campaignIds.length) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_metrics")
    .select("date, conversions, spend, clicks, impressions, reach")
    .in("campaign_id", campaignIds);
  for (const r of data ?? []) {
    const key = monthKeyOf(r.date);
    const cur = map.get(key) ?? {
      impressions: 0, reach: 0, clicks: 0, conversions: 0, spend: 0,
    };
    cur.spend += Number(r.spend || 0);
    cur.conversions += Number(r.conversions || 0);
    cur.clicks += Number(r.clicks || 0);
    map.set(key, cur);
  }
  return map;
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
