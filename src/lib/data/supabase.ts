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
import {
  getGerFinance as gerFinanceMock,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type GerFinance,
  type Receivable,
  type CriticalDelinquent,
  type Expense,
  type ExpenseCategory,
} from "./gerfinance";

import type { HourBankView, HourEntry, HourRow } from "./rh";
import type { FluxPost, FluxState, FluxNetwork } from "./flux";
import {
  VIOLAUNCH_WEEKS,
  VIOLAUNCH_ROADMAP,
  buildVioLaunchData,
  type VioLaunchData,
  type VLWeek,
  type VLStep,
  type VLGate,
  type VLBlock,
  type VLResource,
} from "./violaunch";
import {
  servicesForPlan,
  deliverablesForPlan,
  responsiblesFor,
  semaforoFrom,
  leToneFrom,
  LE_DEADLINE_DAY,
  tasksForClientName,
  type DeliveryTask,
  type TaskOrigin,
  type TaskStage,
  type TaskType,
  type HubClientOps,
  type HubPlan,
  type HubStatus,
  type EditorialLine,
  type EditorialPost,
  type EditorialFormat,
  type EditorialStage,
  type EditorialRef,
  type EditorialPillar,
  type ArtDirection,
  type ClientDeliverable,
  type ClientDocument,
  type DeliveryConfig,
  DELIVERY_CONFIG_FALLBACK,
  type MediaDayView,
  type MediaDaySession,
  type MediaDayItemState,
  type CaptureStatus,
  type FootageStatus,
  type TaskComment,
} from "./operacao";
import type { CSClient, CSClientDetail, CSStatus, CSTimelineEvent, CSTone } from "./types";

type HubClientRow = {
  id: string;
  name: string | null;
  segment: string | null;
  status: string | null;
  monthly_fee: number | null;
  created_at: string | null;
  whatsapp?: string | null;
  city?: string | null;
  cs_responsavel?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  brief_objetivo?: string | null;
  brief_tom?: string | null;
  brief_publico?: string | null;
  brief_concorrentes?: string | null;
  brief_restricoes?: string | null;
  contract_model?: string | null;
  drive_folder_url?: string | null;
  squad_id?: string | null;
  squads?: { name: string | null } | { name: string | null }[] | null;
};

const CLIENT_PROFILE_COLS =
  "city, cs_responsavel, contact_name, contact_role, contact_phone, contact_email, brief_objetivo, brief_tom, brief_publico, brief_concorrentes, brief_restricoes, contract_model, drive_folder_url";
const dash = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");

/** Health score do cliente a partir de sinais reais (financeiro + atividade + atraso + NPS). */
function clientHealth(
  overdueDays: number,
  posts30: number,
  lateCount: number,
  nps?: number | null,
) {
  let s = 100;
  if (overdueDays > 0) s -= Math.min(45, 12 + overdueDays * 1.6);
  s -= posts30 === 0 ? 25 : posts30 < 3 ? 10 : 0;
  s -= Math.min(20, lateCount * 7);
  if (typeof nps === "number") s -= nps <= 6 ? 20 : nps <= 8 ? 6 : 0;
  const healthScore = Math.max(0, Math.min(100, Math.round(s)));
  return {
    healthScore,
    atRisk: healthScore < 55 || overdueDays >= 10 || (typeof nps === "number" && nps <= 6),
    healthy: healthScore >= 75 && overdueDays === 0,
  };
}
/** Classificação NPS padrão (0–6 detrator, 7–8 neutro, 9–10 promotor). */
function npsClass(score: number): string {
  return score >= 9 ? "Promotor" : score >= 7 ? "Neutro" : "Detrator";
}
function planFromFee(fee: number): HubPlan {
  return fee >= 4500 ? "Full Service" : fee >= 3000 ? "Tráfego + Social" : "Social Pro";
}
function financialStatus(overdueDays: number): CSStatus {
  if (overdueDays >= 10) return { label: `Vencida ${overdueDays}d`, tone: "danger" };
  if (overdueDays > 0) return { label: `Vencida ${overdueDays}d`, tone: "warn" };
  return { label: "Em dia", tone: "ok" };
}

const EXPENSE_CATS = new Set(EXPENSE_CATEGORIES.map((c) => c.key));
const DELIVERY_TYPES = new Set<string>(["Arte", "Vídeo", "Copy", "Tráfego"]);
const DELIVERY_ORIGINS = new Set<string>(["Linha editorial", "Projeto", "Tarefa avulsa", "Performance"]);
const DELIVERY_STAGES = new Set<string>(["todo", "doing", "review", "approval", "done"]);
const EDITORIAL_STAGE_SET = new Set<string>(["rascunho", "em_producao", "aprovacao_interna", "ativa", "concluida"]);

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
      invoiceUrl: r.invoice_url,
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
        invoiceUrl: nextInv.invoiceUrl,
      }
    : null;

  const paidList = invoices
    .filter((i) => i.status === "paid" && i.paidDate)
    .sort((a, b) => (b.paidDate ?? "").localeCompare(a.paidDate ?? ""));
  const last = paidList[0];
  const lastPayment = last
    ? {
        amount: last.amount,
        paidDate: last.paidDate!,
        method: last.method ?? "—",
        invoiceUrl: last.invoiceUrl,
      }
    : null;

  const totalPaidYear = invoices
    .filter((i) => i.status === "paid" && (i.paidDate ?? "").startsWith(String(year)))
    .reduce((s, i) => s + i.amount, 0);

  // "Ativo desde": a cobrança mais antiga com vencimento conhecido.
  const firstDue = invoices
    .map((i) => i.dueDate)
    .filter(Boolean)
    .sort()[0];

  return {
    year,
    nextDue,
    lastPayment,
    plan: { name: "Plano mensal", activeSince: firstDue ?? "—" },
    invoices,
    totalPaidYear,
    documents: [],
  };
}

// --- financeiro gerencial (agrega payments de todos os clientes) -------------
type GerPaymentRow = {
  asaas_payment_id: string;
  client_id: string | null;
  status: string | null;
  billing_type: string | null;
  value: number | null;
  due_date: string | null;
  payment_date: string | null;
  description: string | null;
  clients:
    | { name: string | null; segment: string | null }
    | { name: string | null; segment: string | null }[]
    | null;
};

function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

/**
 * Visão financeira da agência a partir do `payments` real (a receber,
 * inadimplência, status de recebimento, MRR e previsto). DRE, despesas,
 * margem e fluxo de saída não têm fonte no sistema → herdam o mock.
 */
export async function sbGetGerFinance(): Promise<GerFinance> {
  const base = gerFinanceMock();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "asaas_payment_id, client_id, status, billing_type, value, due_date, payment_date, description, clients(name, segment)",
    )
    .order("due_date", { ascending: false })
    .limit(400);

  const rows = (data ?? []) as unknown as GerPaymentRow[];
  if (!rows.length) return base; // sem cobranças ainda → mantém o mock

  const now = new Date();
  const todayMs = now.getTime();
  const dayMs = 86_400_000;
  const ym = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const ymNow = ym(now);
  const ymPrev = ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

  let received = 0;
  let openTotal = 0;
  let receivedMonth = 0;
  let dueSoon = 0;
  let overdue = 0;
  let forecast30 = 0;
  let mrr = 0;
  let mrrPrev = 0;
  let openCount = 0;
  const overdueByClient = new Map<string, { name: string; value: number; maxDays: number }>();

  const receivables: Receivable[] = rows.map((r, i) => {
    const value = Number(r.value ?? 0);
    const paid = PAID_STATUS.has(r.status ?? "");
    const due = r.due_date ?? "";
    const co = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    const name = co?.name ?? "Cliente";
    const segment = co?.segment ?? "—";
    const method = r.billing_type ? (BILLING_LABEL[r.billing_type] ?? r.billing_type) : null;
    const dueMs = due ? new Date(due).getTime() : NaN;
    const daysDelta = Number.isNaN(dueMs) ? 0 : Math.round((dueMs - todayMs) / dayMs);
    const overdueDays = !paid && daysDelta < 0 ? Math.abs(daysDelta) : 0;

    if (paid) {
      received += value;
      if ((r.payment_date ?? "").startsWith(ymNow)) receivedMonth += value;
    } else {
      openTotal += value;
      openCount += 1;
      if (daysDelta < 0) {
        overdue += value;
        const key = r.client_id ?? name;
        const cur = overdueByClient.get(key) ?? { name, value: 0, maxDays: 0 };
        cur.value += value;
        cur.maxDays = Math.max(cur.maxDays, overdueDays);
        overdueByClient.set(key, cur);
      } else if (daysDelta <= 7) {
        dueSoon += value;
      }
      if (daysDelta >= 0 && daysDelta <= 30) forecast30 += value;
    }
    if (due.startsWith(ymNow)) mrr += value;
    else if (due.startsWith(ymPrev)) mrrPrev += value;

    let status: Receivable["status"];
    let statusKey: Receivable["statusKey"];
    let action: Receivable["action"];
    let ruler: string;
    if (paid) {
      statusKey = "pago";
      status = { label: `Pago${r.payment_date ? ` ${ddmm(r.payment_date)}` : ""}`, tone: "ok" };
      action = "download";
      ruler = method ?? "—";
    } else if (overdueDays > 0) {
      statusKey = "vencida";
      status = { label: `Vencida ${overdueDays}d`, tone: "danger" };
      action = overdueDays >= 10 ? "cs" : "whatsapp";
      ruler =
        overdueDays >= 20 ? "D+20 · CS" : overdueDays >= 10 ? "D+10 enviado" : overdueDays >= 3 ? "D+3 enviado" : "D+0";
    } else {
      statusKey = "avencer";
      status = daysDelta <= 7 ? { label: `Vence em ${daysDelta}d`, tone: "warn" } : { label: "A vencer", tone: "info" };
      action = "pix";
      ruler = "Aguardando";
    }

    const [yy, mm] = due ? due.split("-") : ["", ""];
    const competence = yy && mm ? `${MESES[Number(mm) - 1]?.slice(0, 3) ?? mm}/${yy.slice(2)}` : "";
    const dueLabel = due
      ? statusKey === "avencer" && daysDelta >= 0
        ? `${ddmm(due)} · ${daysDelta}d`
        : ddmm(due)
      : "—";

    return {
      id: r.asaas_payment_id || `rec-${i}`,
      client: name,
      segment,
      description: r.description ?? (competence ? `Fee mensal ${competence}` : "Cobrança"),
      dueLabel,
      value,
      status,
      ruler,
      statusKey,
      action,
    } satisfies Receivable;
  });

  const critical: CriticalDelinquent[] = [...overdueByClient.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((c, i) => ({
      id: `od-${i}`,
      name: c.name,
      value: c.value,
      note: `Vencida há ${c.maxDays} ${c.maxDays === 1 ? "dia" : "dias"}`,
      action: c.maxDays >= 10 ? "cs" : "whatsapp",
    }));

  const overdueClients = overdueByClient.size;
  const mrrDeltaVal = Math.round(mrr - mrrPrev);
  const mrrDelta =
    mrrPrev > 0
      ? `${mrrDeltaVal >= 0 ? "+" : "−"}R$ ${Math.abs(mrrDeltaVal).toLocaleString("pt-BR")} vs. mês anterior`
      : "sem base do mês anterior";

  // --- despesas → DRE real ---------------------------------------------------
  const { data: expData } = await supabase
    .from("expenses")
    .select("id, description, category, amount, due_date, paid_date, status, recurring, vendor")
    .order("due_date", { ascending: false })
    .limit(400);
  const expenses: Expense[] = (expData ?? []).map((e) => {
    const cat = (e.category as string) ?? "outros";
    return {
      id: String(e.id),
      description: String(e.description ?? "Despesa"),
      category: (EXPENSE_CATS.has(cat as ExpenseCategory) ? cat : "outros") as ExpenseCategory,
      amount: Number(e.amount ?? 0),
      dueDate: (e.due_date as string) ?? "",
      paidDate: (e.paid_date as string) ?? null,
      status: e.status === "paid" ? "paid" : "pending",
      recurring: Boolean(e.recurring),
      vendor: (e.vendor as string) ?? null,
    } satisfies Expense;
  });

  const monthExp = expenses.filter((e) => e.dueDate.startsWith(ymNow));
  const sumCat = (c: ExpenseCategory) =>
    monthExp.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0);
  const grossRevenue = Math.round(mrr);
  const taxes = Math.round(sumCat("impostos"));
  const salaries = Math.round(sumCat("salarios"));
  const tools = Math.round(sumCat("ferramentas"));
  const commissions = Math.round(sumCat("comissoes"));
  const variableCosts = Math.round(sumCat("variavel") + sumCat("outros"));
  const netRevenue = grossRevenue - taxes;
  const netProfit = netRevenue - (salaries + tools + commissions + variableCosts);
  const margin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;
  const dreReal = {
    grossRevenue,
    taxes,
    taxPct: grossRevenue > 0 ? Math.round((taxes / grossRevenue) * 100) : 0,
    netRevenue,
    salaries,
    tools,
    commissions,
    variableCosts,
    netProfit,
    margin,
    metaMargin: base.dre.metaMargin,
  };
  const topExpensesReal = (
    ["salarios", "ferramentas", "comissoes", "variavel", "outros"] as ExpenseCategory[]
  )
    .map((c) => ({ label: EXPENSE_CATEGORY_LABEL[c], value: Math.round(sumCat(c)) }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
  const hasExp = expenses.length > 0;

  // --- projeção de caixa (3 meses: corrente + 2) -----------------------------
  const recurringMonthly = expenses
    .filter((e) => e.recurring)
    .reduce((s, e) => s + e.amount, 0);
  const cashflow = Array.from({ length: 3 }, (_, k) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1));
    const key = ym(d);
    const inflow = rows
      .filter((r) => (r.due_date ?? "").startsWith(key))
      .reduce((s, r) => s + Number(r.value ?? 0), 0);
    // Meses futuros sem cobrança gerada → estima pelo faturamento do mês (MRR).
    const entradas = Math.round(k > 0 && inflow === 0 ? mrr : inflow);
    const oneOff = expenses
      .filter((e) => !e.recurring && e.dueDate.startsWith(key))
      .reduce((s, e) => s + e.amount, 0);
    const saidas = Math.round(oneOff + recurringMonthly);
    return { month: MESES[d.getUTCMonth()].slice(0, 3), entradas, saidas, saldo: entradas - saidas };
  });
  const c0 = cashflow[0];
  const cashflowNote = `${c0.month} · entradas R$ ${c0.entradas.toLocaleString("pt-BR")} · saídas R$ ${c0.saidas.toLocaleString("pt-BR")} · saldo previsto R$ ${c0.saldo.toLocaleString("pt-BR")}`;

  return {
    ...base,
    periodLabel: periodLabel(now),
    kpis: {
      ...base.kpis,
      mrr: Math.round(mrr),
      mrrDelta,
      forecast30: Math.round(forecast30),
      forecastNote: `${openCount} cobrança${openCount === 1 ? "" : "s"} em aberto`,
      overdue: Math.round(overdue),
      overdueNote: overdueClients
        ? `${overdueClients} cliente${overdueClients === 1 ? "" : "s"} · acionar cobrança`
        : "sem inadimplência",
      margin: hasExp ? margin : base.kpis.margin,
      marginDelta: hasExp ? `meta ${dreReal.metaMargin}%` : base.kpis.marginDelta,
    },
    receiptStatus: {
      received: Math.round(receivedMonth),
      dueSoon: Math.round(dueSoon),
      overdue: Math.round(overdue),
    },
    critical,
    delinquencyTotal: Math.round(overdue),
    receivables,
    receivablesTotals: {
      count: receivables.length,
      received: Math.round(received),
      open: Math.round(openTotal),
    },
    revenue: hasExp
      ? { mrr: grossRevenue, projetos: 0, outros: 0, mrrPct: grossRevenue > 0 ? 100 : 0 }
      : base.revenue,
    expenses,
    dre: hasExp ? dreReal : base.dre,
    topExpenses: topExpensesReal.length ? topExpensesReal : base.topExpenses,
    cashflow,
    cashflowNote,
  };
}

// --- banco de horas (hour_entries → saldo do mês) ---------------------------
export async function sbGetHourBank(): Promise<HourBankView> {
  const supabase = await createClient();
  const now = new Date();
  const ymNow = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const [{ data: entryRows }, { data: profs }] = await Promise.all([
    supabase
      .from("hour_entries")
      .select("id, employee, work_date, hours, note")
      .order("work_date", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("full_name").eq("role", "gerencial").order("full_name"),
  ]);

  const entries: HourEntry[] = (entryRows ?? []).map((e) => ({
    id: String(e.id),
    employee: String(e.employee ?? "—"),
    workDate: (e.work_date as string) ?? "",
    hours: Number(e.hours ?? 0),
    note: (e.note as string) ?? null,
  }));

  // Saldo do mês corrente por colaborador (soma dos lançamentos).
  const byEmp = new Map<string, number>();
  for (const e of entries) {
    if (!e.workDate.startsWith(ymNow)) continue;
    byEmp.set(e.employee, (byEmp.get(e.employee) ?? 0) + e.hours);
  }

  const LIMIT = 8;
  const rows: HourRow[] = [...byEmp.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, raw]) => {
      const balance = Math.round(raw * 10) / 10;
      const tone: HourRow["tone"] = balance > 12 ? "danger" : balance > LIMIT ? "warn" : "ok";
      const note =
        balance > 12
          ? `Acima do limite (${LIMIT}h/mês)`
          : balance > LIMIT
            ? "Perto do limite"
            : "Dentro do limite";
      return { id: name, name, contractType: "clt" as const, balance, limit: LIMIT, note, tone };
    });

  const total = Math.round([...byEmp.values()].reduce((s, v) => s + v, 0) * 10) / 10;

  const names = new Set<string>();
  for (const p of profs ?? []) if (p.full_name) names.add(String(p.full_name));
  for (const e of entries) names.add(e.employee);

  return {
    periodLabel: periodLabel(now),
    total,
    rows,
    entries,
    employeeNames: [...names].sort(),
  };
}

// --- entregas (delivery_tasks → Painel de Entregas) -------------------------
type DeliveryRow = {
  id: string;
  title: string;
  type: string | null;
  origin: string | null;
  assignee: string | null;
  stage: string | null;
  due_date: string | null;
  estimate_h: number | null;
  logged_h: number | null;
  urgent: boolean | null;
  checklist: unknown;
  comments: unknown;
  priority: string | null;
  assignees: string[] | null;
  requester: string | null;
  moved_at: string | null;
  custom_fields: unknown;
  campaign_goal: string | null;
  content_format: string | null;
  duration_min: number | null;
  clients: { name: string | null } | { name: string | null }[] | null;
};

export async function sbGetDeliveryTasks(): Promise<DeliveryTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_tasks")
    .select(
      "id, title, type, origin, assignee, stage, due_date, estimate_h, logged_h, urgent, checklist, comments, priority, assignees, requester, moved_at, custom_fields, campaign_goal, content_format, duration_min, clients(name)",
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);

  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayMs = 86_400_000;

  return ((data ?? []) as unknown as DeliveryRow[]).map((r) => {
    const co = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    const stage = (DELIVERY_STAGES.has(r.stage ?? "") ? r.stage : "todo") as TaskStage;
    const type = (DELIVERY_TYPES.has(r.type ?? "") ? r.type : "Arte") as TaskType;
    const origin = (DELIVERY_ORIGINS.has(r.origin ?? "") ? r.origin : "Tarefa avulsa") as TaskOrigin;
    const priority = (["baixa", "media", "alta", "urgente"].includes(r.priority ?? "") ? r.priority : "media") as DeliveryTask["priority"];
    const isUrgent = !!r.urgent || priority === "urgente";
    const due = r.due_date ?? "";
    const dueMs = due ? Date.parse(due) : NaN;
    const diffDays = Number.isNaN(dueMs) ? 0 : Math.round((dueMs - todayMs) / dayMs);
    const late = !Number.isNaN(dueMs) && diffDays < 0 && stage !== "done" && stage !== "approval";
    const wd = Number.isNaN(dueMs) ? 1 : new Date(dueMs).getUTCDay(); // 0=Dom..6=Sáb
    const day = Math.min(4, Math.max(0, wd - 1));

    const baseLabel = !due
      ? "Sem prazo"
      : late
        ? `Atrasada ${Math.abs(diffDays)}d`
        : diffDays === 0
          ? "Hoje"
          : diffDays === 1
            ? "Amanhã"
            : new Date(dueMs).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

    return {
      id: r.id,
      title: r.title,
      client: co?.name ?? "—",
      type,
      origin,
      assignee: r.assignee ?? "",
      stage,
      dueLabel: isUrgent ? `${baseLabel} · urgente` : baseLabel,
      late,
      estimateH: Number(r.estimate_h ?? 0),
      loggedH: Number(r.logged_h ?? 0),
      day,
      startDay: day,
      span: 1,
      dueDate: due ? new Date(dueMs).toISOString() : "",
      checklist: Array.isArray(r.checklist)
        ? (r.checklist as { label: string; done: boolean }[])
        : [],
      comments: Array.isArray(r.comments) ? (r.comments as TaskComment[]) : [],
      priority,
      assignees: Array.isArray(r.assignees) && r.assignees.length ? r.assignees : r.assignee ? [r.assignee] : [],
      requester: r.requester ?? undefined,
      movedAt: r.moved_at ?? undefined,
      customFields: (r.custom_fields && typeof r.custom_fields === "object" ? r.custom_fields : {}) as Record<string, unknown>,
      campaignGoal: (r.campaign_goal as DeliveryTask["campaignGoal"]) ?? undefined,
      contentFormat: (r.content_format as DeliveryTask["contentFormat"]) ?? undefined,
      durationMin: r.duration_min != null ? Number(r.duration_min) : undefined,
    } satisfies DeliveryTask;
  });
}

export async function sbGetDeliveryConfig(): Promise<DeliveryConfig> {
  const supabase = await createClient();
  const [typesRes, setRes] = await Promise.all([
    supabase.from("task_types").select("name, default_duration_min").order("sort"),
    supabase.from("delivery_settings").select("capacity_per_day").eq("id", 1).maybeSingle(),
  ]);
  const typeDurations: Record<string, number> = { ...DELIVERY_CONFIG_FALLBACK.typeDurations };
  for (const t of (typesRes.data ?? []) as { name: string; default_duration_min: number | null }[]) {
    typeDurations[t.name] = Number(t.default_duration_min ?? 60);
  }
  const capacityPerDay = Number(
    (setRes.data as { capacity_per_day: number | null } | null)?.capacity_per_day ??
      DELIVERY_CONFIG_FALLBACK.capacityPerDay,
  );
  return { capacityPerDay, typeDurations };
}

// --- Hub de Clientes / health (clients + payments + tasks + atividade) -------
export async function sbGetHubClientsOps(): Promise<HubClientOps[]> {
  const supabase = await createClient();
  const now = new Date();
  const dayMs = 86_400_000;
  const todayStr = now.toISOString().slice(0, 10);
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const d30 = new Date(now.getTime() - 30 * dayMs).toISOString().slice(0, 10);

  const [clientsRes, tasks, paysRes, postsRes, npsRes, leRes] = await Promise.all([
    supabase.from("clients").select(`id, name, segment, status, monthly_fee, created_at, whatsapp, squad_id, squads(name), ${CLIENT_PROFILE_COLS}`).order("name"),
    sbGetDeliveryTasks(),
    supabase
      .from("payments")
      .select("client_id, status, due_date")
      .not("client_id", "is", null)
      .lte("due_date", todayStr),
    supabase.from("content_posts").select("client_id").eq("status", "published").gte("published_at", d30),
    supabase.from("nps_surveys").select("client_id, score, created_at").order("created_at", { ascending: false }),
    supabase.from("editorial_lines").select("client_id, month, stage"),
  ]);

  // HUB06.1 — "LE do próximo mês" montada? Existe editorial_line do mês seguinte
  // fora do estágio de rascunho. Casa o mês por texto ("Julho 2026"/"Julho/2026").
  const nextMonthKey = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  const monthKeyOfLabel = (label: string): number | null => {
    const parts = String(label).replace("/", " ").trim().split(/\s+/);
    if (parts.length < 2) return null;
    const mi = MESES.findIndex((m) => m.toLowerCase() === parts[0].toLowerCase());
    const yr = Number(parts[1]);
    if (mi < 0 || Number.isNaN(yr)) return null;
    return yr * 12 + mi;
  };
  const leMountedByClient = new Set<string>();
  for (const l of (leRes.data ?? []) as { client_id: string; month: string | null; stage: string | null }[]) {
    if (!l.month) continue;
    if (monthKeyOfLabel(l.month) !== nextMonthKey) continue;
    const stage = String(l.stage ?? "");
    if (stage && stage !== "rascunho" && stage !== "ideacao") leMountedByClient.add(l.client_id);
  }

  // NPS mais recente por cliente (linhas já vêm ordenadas desc).
  const npsByClient = new Map<string, number>();
  for (const n of (npsRes.data ?? []) as { client_id: string; score: number }[]) {
    if (!npsByClient.has(n.client_id)) npsByClient.set(n.client_id, Number(n.score));
  }

  const overdueByClient = new Map<string, number>();
  for (const p of (paysRes.data ?? []) as {
    client_id: string;
    status: string | null;
    due_date: string | null;
  }[]) {
    const st = String(p.status ?? "");
    if (PAID_STATUS.has(st) || st === "REFUNDED" || st === "DELETED") continue;
    if (!p.due_date) continue;
    const od = Math.round((todayMs - Date.parse(p.due_date)) / dayMs);
    if (od <= 0) continue;
    overdueByClient.set(p.client_id, Math.max(overdueByClient.get(p.client_id) ?? 0, od));
  }
  const postsByClient = new Map<string, number>();
  for (const p of (postsRes.data ?? []) as { client_id: string }[]) {
    postsByClient.set(p.client_id, (postsByClient.get(p.client_id) ?? 0) + 1);
  }

  return ((clientsRes.data ?? []) as HubClientRow[]).map((c, idx) => {
    const cid = String(c.id);
    const name = c.name ?? "Cliente";
    const fee = Number(c.monthly_fee ?? 0);
    const t = tasksForClientName(name, tasks);
    const overdueDays = overdueByClient.get(cid) ?? 0;
    const posts30 = postsByClient.get(cid) ?? 0;
    const nps = npsByClient.get(cid) ?? null;
    const h = clientHealth(overdueDays, posts30, t.filter((x) => x.late).length, nps);
    const plan = planFromFee(fee);
    const createdMs = c.created_at ? Date.parse(c.created_at) : NaN;
    const isNew = !Number.isNaN(createdMs) && now.getTime() - createdMs < 30 * dayMs;
    const status: HubStatus = isNew ? "onboarding" : "ativo";
    return {
      id: cid,
      name,
      segment: c.segment ?? "—",
      city: dash(c.city),
      plan,
      status,
      atRisk: h.atRisk,
      healthScore: h.healthScore,
      nps: nps ?? 0,
      responsavel: dash(c.cs_responsavel),
      mrr: fee,
      whatsapp: c.whatsapp ?? null,
      onboarding: isNew
        ? { step: 1, total: 5, startDate: new Date(createdMs).toLocaleDateString("pt-BR") }
        : undefined,
      squadId: c.squad_id ?? "sq-1",
      squadName:
        (Array.isArray(c.squads) ? c.squads[0]?.name : c.squads?.name) ?? "Produção",
      responsibles: responsiblesFor(idx),
      services: servicesForPlan(plan),
      deliverables: deliverablesForPlan(plan),
      monthTotal: t.length,
      monthDone: t.filter((x) => x.stage === "done").length,
      monthApproval: t.filter((x) => x.stage === "approval").length,
      leNextMonth: (() => {
        const mounted = leMountedByClient.has(cid);
        const st = mounted ? ("montada" as const) : ("pendente" as const);
        return {
          status: st,
          date: mounted ? `montada · ${LE_DEADLINE_DAY}` : `prazo ${LE_DEADLINE_DAY}`,
          tone: leToneFrom(st, now.getDate()),
        };
      })(),
      nextAgenda: isNew ? "Kickoff · esta semana" : "Alinhamento mensal",
      semaforo: semaforoFrom(t),
    } satisfies HubClientOps;
  });
}

export async function sbGetCSClientDetail(id: string): Promise<CSClientDetail | null> {
  const supabase = await createClient();
  const { data: cRaw } = await supabase
    .from("clients")
    .select(`id, name, segment, status, monthly_fee, created_at, ${CLIENT_PROFILE_COLS}`)
    .eq("id", id)
    .maybeSingle();
  if (!cRaw) return null;
  const c = cRaw as HubClientRow;
  const name = c.name ?? "Cliente";

  const now = new Date();
  const dayMs = 86_400_000;
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const d30 = new Date(now.getTime() - 30 * dayMs).toISOString().slice(0, 10);

  const [tasksAll, paysRes, postsRes, media, meetingsRes, npsRes, reqRes] = await Promise.all([
    sbGetDeliveryTasks(),
    supabase
      .from("payments")
      .select("status, due_date, payment_date, value")
      .eq("client_id", id)
      .order("due_date", { ascending: false })
      .limit(50),
    supabase
      .from("content_posts")
      .select("id")
      .eq("status", "published")
      .eq("client_id", id)
      .gte("published_at", d30),
    sbGetMediaPerformance(id),
    supabase
      .from("meetings")
      .select("id, title, starts_at, join_url, participants, agenda, next_steps, type, agenda_shared, next_steps_shared")
      .eq("client_id", id)
      .gte("starts_at", new Date(now.getTime() - 30 * dayMs).toISOString())
      .order("starts_at")
      .limit(12),
    supabase
      .from("nps_surveys")
      .select("score, comment, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("meeting_requests")
      .select("id, subject, preferred_at, urgency, notes, status")
      .eq("client_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const pays = (paysRes.data ?? []) as {
    status: string | null;
    due_date: string | null;
    payment_date: string | null;
    value: number | null;
  }[];
  let overdueDays = 0;
  for (const p of pays) {
    const st = String(p.status ?? "");
    if (PAID_STATUS.has(st) || st === "REFUNDED" || st === "DELETED") continue;
    if (!p.due_date) continue;
    const od = Math.round((todayMs - Date.parse(p.due_date)) / dayMs);
    if (od > overdueDays) overdueDays = od;
  }
  const tasks = tasksForClientName(name, tasksAll);
  const posts30 = (postsRes.data ?? []).length;

  const npsRows = (npsRes.data ?? []) as {
    score: number;
    comment: string | null;
    created_at: string | null;
  }[];
  const latestNps = npsRows[0] ? Number(npsRows[0].score) : null;

  const h = clientHealth(overdueDays, posts30, tasks.filter((t) => t.late).length, latestNps);

  const fee = Number(c.monthly_fee ?? 0);
  const plan = planFromFee(fee);
  const createdMs = c.created_at ? Date.parse(c.created_at) : NaN;
  const months = Number.isNaN(createdMs)
    ? 1
    : Math.max(1, Math.round((now.getTime() - createdMs) / (30 * dayMs)));
  const clientSince = Number.isNaN(createdMs) ? "—" : new Date(createdMs).toLocaleDateString("pt-BR");

  const client: CSClient = {
    id,
    name,
    segment: c.segment ?? "—",
    city: dash(c.city),
    mrr: fee,
    healthScore: h.healthScore,
    nps: latestNps ?? 0,
    financial: financialStatus(overdueDays),
    contract: {
      label: c.status === "ativo" ? "Ativo" : String(c.status ?? "—"),
      tone: c.status === "ativo" ? "ok" : "warn",
    },
    cs: dash(c.cs_responsavel),
    lastContactDays: 0,
    atRisk: h.atRisk,
    healthy: h.healthy,
    renewingSoon: false,
  };

  const ddmm = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const payEvents: (CSTimelineEvent & { ts: number })[] = pays
    .filter((p) => p.payment_date)
    .map((p, i) => ({
      id: `pay-${i}`,
      ts: Date.parse(String(p.payment_date)),
      date: ddmm(String(p.payment_date)),
      text: `Pagamento confirmado${p.value ? ` — R$ ${Number(p.value).toLocaleString("pt-BR")}` : ""}`,
      kind: "payment" as const,
    }));
  const npsEvents: (CSTimelineEvent & { ts: number })[] = npsRows
    .filter((n) => n.created_at)
    .map((n, i) => ({
      id: `nps-${i}`,
      ts: Date.parse(String(n.created_at)),
      date: ddmm(String(n.created_at)),
      text: `NPS respondido: nota ${n.score}${n.comment ? ` — “${n.comment}”` : ""}`,
      kind: "nps" as const,
    }));
  const timeline: CSTimelineEvent[] = [...npsEvents, ...payEvents]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map(({ ts: _ts, ...ev }) => ev);

  const whenLabelOf = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const agendaMeetings = ((meetingsRes.data ?? []) as {
    id: string;
    title: string | null;
    starts_at: string | null;
    join_url: string | null;
    participants: string[] | null;
    agenda: string | null;
    next_steps: string | null;
    type: string | null;
    agenda_shared: boolean | null;
    next_steps_shared: boolean | null;
  }[])
    .filter((m) => m.starts_at)
    .map((m) => ({
      id: String(m.id),
      title: String(m.title ?? "Reunião"),
      whenLabel: whenLabelOf(String(m.starts_at)),
      startIso: String(m.starts_at),
      joinUrl: m.join_url,
      participants: Array.isArray(m.participants) ? m.participants : [],
      type: m.type,
      agenda: m.agenda,
      agendaShared: !!m.agenda_shared,
      nextSteps: m.next_steps,
      notesShared: !!m.next_steps_shared,
      isPast: Date.parse(String(m.starts_at)) < now.getTime(),
    }));

  const firstFuture = agendaMeetings.find((m) => !m.isPast);
  const nextMeeting = firstFuture
    ? { title: firstFuture.title, whenLabel: firstFuture.whenLabel, joinUrl: firstFuture.joinUrl }
    : null;

  const agendaRequests = ((reqRes.data ?? []) as {
    id: string;
    subject: string | null;
    preferred_at: string | null;
    urgency: string | null;
    notes: string | null;
  }[]).map((r) => ({
    id: String(r.id),
    subject: String(r.subject ?? "Solicitação"),
    whenLabel: r.preferred_at ? whenLabelOf(String(r.preferred_at)) : "Sem horário sugerido",
    preferredIso: r.preferred_at,
    urgency: String(r.urgency ?? "normal"),
    notes: r.notes,
  }));

  const cplTone = (cpl: number): CSTone => (cpl <= 10 ? "ok" : cpl <= 15 ? "warn" : "danger");

  return {
    client,
    contactName: dash(c.contact_name),
    contactRole: dash(c.contact_role),
    phone: dash(c.contact_phone),
    email: dash(c.contact_email),
    clientSince,
    plan,
    contractModel: c.contract_model === "pontual" ? "pontual" : "recorrente",
    driveFolderUrl: c.drive_folder_url ?? null,
    tenure: `${months} ${months === 1 ? "mês" : "meses"}`,
    ltv: fee * months,
    invoicesNote: overdueDays > 0 ? `Fatura vencida ${overdueDays}d` : "Faturas em dia",
    npsClassification: latestNps === null ? "Não medido" : npsClass(latestNps),
    npsLastSurvey:
      latestNps === null || !npsRows[0]?.created_at
        ? "—"
        : new Date(String(npsRows[0].created_at)).toLocaleDateString("pt-BR"),
    npsQuote:
      latestNps === null
        ? "NPS ainda não coletado para este cliente."
        : npsRows[0]?.comment
          ? `“${npsRows[0].comment}”`
          : "Sem comentário registrado na última pesquisa.",
    timeline: timeline.length
      ? timeline
      : [{ id: "t0", date: clientSince, text: "Cliente cadastrado", kind: "onboarding" }],
    nextMeeting,
    agendaMeetings,
    agendaRequests,
    nextContact: nextMeeting ? "Próxima reunião agendada" : "Sem reunião agendada",
    briefing: {
      objetivo: dash(c.brief_objetivo),
      tomDeVoz: dash(c.brief_tom),
      publico: dash(c.brief_publico),
      concorrentes: dash(c.brief_concorrentes),
      restricoes: dash(c.brief_restricoes),
    },
    campaigns: media.campaigns.slice(0, 4).map((cp) => ({ name: cp.name, cpl: cp.cpl, tone: cplTone(cp.cpl) })),
    campaignsInvested: Math.round(media.invested),
  } satisfies CSClientDetail;
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
  "id,name,contact_name,contact_phone,contact_email,segment,stage,monthly_value,media_budget,plan,probability,priority,source,owner,assignees,bant,next_task_title,next_task_due,last_interaction_at,stage_changed_at,won_at,lost_at,lost_reason,converted_client_id,company_id,primary_contact_id,pipeline_id,stage_id,tags,properties,created_at,updated_at";

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
    priority: (["baixa", "media", "alta", "urgente"].includes(String(r.priority ?? "")) ? r.priority : "media") as CrmLead["priority"],
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
    priority: (["baixa", "media", "alta", "urgente"].includes(String(r.priority ?? "")) ? r.priority : "media") as CrmTask["priority"],
    assignee: r.assignee == null ? undefined : String(r.assignee),
    assignees: (r.assignees as string[] | null) ?? undefined,
    properties: (r.properties as Record<string, unknown> | null) ?? {},
    createdAt: String(r.created_at),
  };
}

const CRM_TASK_COLS =
  "id,lead_id,title,due_date,status,done_at,priority,assignee,assignees,properties,created_at";

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
    attachments: Array.isArray(r.attachments) ? (r.attachments as { name: string; url: string }[]) : [],
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
    .select("id,lead_id,parent_id,author,author_id,body,reactions,attachments,edited,created_at,updated_at")
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

// --- Linha Editorial (persistida) -------------------------------------------

type EditorialLineRow = {
  id: string;
  month: string | null;
  stage: string | null;
  objetivo: string | null;
  narrativa_central: string | null;
  tensao_narrativa: string | null;
  datas_comemorativas: string | null;
  pillars: unknown;
  moodboard: unknown;
  built_by: string | null;
  internally_approved_by: string | null;
};
type EditorialPostRow = {
  id: string;
  n: number | null;
  title: string | null;
  format: string | null;
  pillar: string | null;
  description: string | null;
  legenda: string | null;
  art_direction: string | null;
  post_date: string | null;
  weekday: string | null;
  refs: unknown;
  task_id: string | null;
  tema: string | null;
  assignee: string | null;
  assignee_secondary: string | null;
  priority: string | null;
  notes: string | null;
};

const dash2 = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");

/** Linha editorial mais recente do cliente + posts (ou scaffold vazio). */
export async function sbGetEditorialLine(clientId: string): Promise<EditorialLine> {
  const supabase = await createClient();

  const [clientRes, linesRes] = await Promise.all([
    supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
    supabase
      .from("editorial_lines")
      .select("id, month, stage, objetivo, narrativa_central, tensao_narrativa, datas_comemorativas, pillars, moodboard, built_by, internally_approved_by")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  const clientName = (clientRes.data as { name: string | null } | null)?.name ?? "Cliente";
  const lines = (linesRes.data ?? []) as EditorialLineRow[];
  const line = lines[0];

  if (!line) {
    return {
      clientName,
      month: periodLabel(),
      createdBy: "—",
      stage: "rascunho",
      frequency: "Sem posts ainda",
      networks: "Instagram · Facebook",
      responsibles: "—",
      approvalMeeting: "—",
      datasComemorativas: "—",
      narrativaCentral: "—",
      tensaoNarrativa: "—",
      moodboardGeral: [],
      pillars: [],
      posts: [],
      history: [],
    };
  }

  const { data: postsData } = await supabase
    .from("editorial_posts")
    .select("id, n, title, format, pillar, description, legenda, art_direction, post_date, weekday, refs, task_id, tema, assignee, assignee_secondary, priority, notes")
    .eq("line_id", line.id)
    .order("n");

  const postRows = (postsData ?? []) as EditorialPostRow[];

  // Live-sync: estágio real das delivery tasks vinculadas aos posts.
  const taskIds = postRows.map((p) => p.task_id).filter((x): x is string => !!x);
  const stageByTask = new Map<string, TaskStage>();
  if (taskIds.length) {
    const { data: tRows } = await supabase
      .from("delivery_tasks")
      .select("id, stage")
      .in("id", taskIds);
    for (const t of (tRows ?? []) as { id: string; stage: string | null }[]) {
      stageByTask.set(t.id, (t.stage as TaskStage) ?? "todo");
    }
  }

  const posts: EditorialPost[] = postRows.map((p) => ({
    id: p.id,
    n: Number(p.n ?? 0),
    date: p.post_date ?? "—",
    weekday: p.weekday ?? "—",
    title: p.title ?? "",
    format: (p.format as EditorialFormat) ?? "Feed",
    pillar: p.pillar ?? "",
    description: p.description ?? "",
    assetNote: "",
    artDirection: (p.art_direction as ArtDirection) ?? "Banco do cliente",
    references: Array.isArray(p.refs) ? (p.refs as EditorialRef[]) : [],
    taskStage: p.task_id ? stageByTask.get(p.task_id) : undefined,
    taskId: p.task_id ?? undefined,
    tema: p.tema ?? undefined,
    legenda: p.legenda ?? undefined,
    assignee: p.assignee ?? undefined,
    assigneeSecondary: p.assignee_secondary ?? undefined,
    priority: p.priority === "urgente" ? "urgente" : "normal",
    notes: p.notes ?? undefined,
  }));

  return {
    id: line.id,
    clientName,
    month: line.month ?? periodLabel(),
    objetivo: line.objetivo ?? "",
    builtBy: line.built_by ?? undefined,
    internallyApprovedBy: line.internally_approved_by ?? undefined,
    createdBy: line.built_by ?? "Equipe",
    stage: (EDITORIAL_STAGE_SET.has(line.stage ?? "") ? line.stage : "rascunho") as EditorialStage,
    frequency: `${posts.length} posts no mês`,
    networks: "Instagram · Facebook",
    responsibles: "—",
    approvalMeeting: "—",
    datasComemorativas: dash2(line.datas_comemorativas),
    narrativaCentral: dash2(line.narrativa_central),
    tensaoNarrativa: dash2(line.tensao_narrativa),
    moodboardGeral: Array.isArray(line.moodboard) ? (line.moodboard as EditorialRef[]) : [],
    pillars: Array.isArray(line.pillars) ? (line.pillars as EditorialPillar[]) : [],
    posts,
    history: lines.slice(1).map((l) => ({ id: l.id, month: l.month ?? "—" })),
  };
}

// --- Entregáveis do contrato (slots da Criar LE) ----------------------------
export async function sbGetClientDeliverables(clientId: string): Promise<ClientDeliverable[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_deliverables")
    .select("format, monthly_qty")
    .eq("client_id", clientId);
  return ((data ?? []) as { format: string; monthly_qty: number | null }[]).map((d) => ({
    format: d.format as ClientDeliverable["format"],
    monthlyQty: Number(d.monthly_qty ?? 0),
  }));
}

export async function sbGetClientDocuments(clientId: string): Promise<ClientDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_documents")
    .select("id, title, url, file_name, file_type, file_size, kind, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as {
    id: string;
    title: string;
    url: string;
    file_name: string | null;
    file_type: string | null;
    file_size: number | null;
    kind: string | null;
    created_at: string | null;
  }[]).map((d) => ({
    id: d.id,
    title: d.title,
    url: d.url,
    fileName: d.file_name ?? undefined,
    fileType: d.file_type ?? undefined,
    fileSize: d.file_size ?? undefined,
    kind: d.kind ?? "outro",
    createdAt: d.created_at ?? undefined,
  }));
}

export async function sbGetMediaDay(clientId: string): Promise<MediaDayView> {
  const supabase = await createClient();
  const [sessRes, itemsRes] = await Promise.all([
    supabase
      .from("mediaday_sessions")
      .select("scheduled_label, location, team, equipment, notes, status, post_status")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("mediaday_items")
      .select("post_id, task_id, capture_status, footage_status, raw_assets")
      .eq("client_id", clientId),
  ]);

  const s = sessRes.data as {
    scheduled_label: string | null;
    location: string | null;
    team: string | null;
    equipment: string | null;
    notes: string | null;
    status: string | null;
    post_status: string | null;
  } | null;

  const session: MediaDaySession | null = s
    ? {
        scheduledLabel: s.scheduled_label ?? "",
        location: s.location ?? "",
        team: s.team ?? "",
        equipment: s.equipment ?? "",
        notes: s.notes ?? "",
        status: (s.status as MediaDaySession["status"]) ?? "planning",
        postStatus: (s.post_status as MediaDaySession["postStatus"]) ?? "awaiting",
      }
    : null;

  const items: MediaDayItemState[] = ((itemsRes.data ?? []) as {
    post_id: string | null;
    task_id: string | null;
    capture_status: string | null;
    footage_status: string | null;
    raw_assets: unknown;
  }[])
    .filter((i) => !!i.post_id)
    .map((i) => ({
      postId: i.post_id as string,
      taskId: i.task_id ?? undefined,
      captureStatus: (i.capture_status as CaptureStatus) ?? "pending",
      footageStatus: (i.footage_status as FootageStatus) ?? "awaiting",
      rawAssets: Array.isArray(i.raw_assets) ? (i.raw_assets as string[]) : [],
    }));

  return { session, items };
}

// --- VioFlux (FLX01) — visão de publicação sobre vioflux_posts ---------------
export async function sbGetVioFluxPosts(clientId?: string): Promise<FluxPost[]> {
  const supabase = await createClient();
  let q = supabase
    .from("vioflux_posts")
    .select(
      "id, client_id, task_id, editorial_post_id, title, caption, format, networks, state, scheduled_at, media_note, media_url, client_comment, created_at, clients(name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;

  const NETS = new Set(["instagram", "facebook"]);
  const STATES = new Set(["rascunho", "aguardando", "aprovado", "ajuste", "agendado", "publicado", "falha"]);

  return ((data ?? []) as unknown as {
    id: string;
    client_id: string;
    task_id: string | null;
    editorial_post_id: string | null;
    title: string | null;
    caption: string | null;
    format: string | null;
    networks: string[] | null;
    state: string | null;
    scheduled_at: string | null;
    media_note: string | null;
    media_url: string | null;
    client_comment: string | null;
    created_at: string | null;
    clients: { name: string | null } | { name: string | null }[] | null;
  }[]).map((r) => {
    const co = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    const networks = (Array.isArray(r.networks) ? r.networks : []).filter((n) => NETS.has(n)) as FluxNetwork[];
    return {
      id: r.id,
      taskId: r.task_id ?? r.editorial_post_id ?? r.id,
      clientId: r.client_id,
      client: co?.name ?? "—",
      title: r.title ?? "",
      caption: r.caption ?? "",
      format: (r.format as FluxPost["format"]) ?? "Feed",
      networks: networks.length ? networks : ["instagram"],
      state: (STATES.has(r.state ?? "") ? r.state : "rascunho") as FluxState,
      date: r.scheduled_at ?? r.created_at ?? new Date().toISOString(),
      scheduledAt: r.scheduled_at ?? undefined,
      mediaNote: r.media_note ?? "Mídia anexada",
      mediaUrl: r.media_url ?? undefined,
      clientComment: r.client_comment ?? undefined,
    } satisfies FluxPost;
  });
}

// --- VioLaunch (HUB11) — projeto persistido por cliente ----------------------
type VLStepRow = {
  id: string; step_number: number; week_title: string | null; name: string;
  responsible: string | null; due_date: string | null; status: string;
  status_tag: string | null; connection: string | null; placeholder: boolean; sla: string | null;
};
type VLSubRow = { step_id: string; kind: string; content: string; done: boolean; resource_type: string | null; resource_ref: string | null; sort: number };
type VLGateRow = { gate_number: number; name: string; status: string; rule: string | null; items: unknown };
type VLBlockRow = { block_code: string; name: string; progress: number; sort: number; content: unknown };

async function seedVioLaunch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  startDate: string,
): Promise<string | null> {
  const { data: proj, error } = await supabase
    .from("violaunch_projects")
    .insert({ client_id: clientId, scope: "completo", start_date: startDate })
    .select("id")
    .single();
  if (error || !proj) return null;
  const projectId = proj.id as string;

  const stepRows = VIOLAUNCH_WEEKS.flatMap((w) =>
    w.steps.map((s) => ({
      project_id: projectId, step_number: s.n, week_title: w.title, name: s.label,
      responsible: s.owner, due_date: s.date, status: s.status, status_tag: s.statusTag ?? null,
      connection: s.connection ?? null, placeholder: !!s.placeholder, sla: s.sla,
    })),
  );
  const { data: insertedSteps } = await supabase
    .from("violaunch_steps")
    .insert(stepRows)
    .select("id, step_number");
  const idByStep = new Map<number, string>();
  for (const r of (insertedSteps ?? []) as { id: string; step_number: number }[]) idByStep.set(r.step_number, r.id);

  const subRows = VIOLAUNCH_WEEKS.flatMap((w) =>
    w.steps.flatMap((s) => {
      const stepId = idByStep.get(s.n);
      if (!stepId) return [];
      const acoes = s.acoes.map((a, i) => ({ step_id: stepId, kind: "action", content: a.label, done: a.done, resource_type: null, resource_ref: null, sort: i }));
      const recursos = s.recursos.map((r, i) => ({ step_id: stepId, kind: "resource", content: r.label, done: false, resource_type: r.kind, resource_ref: r.ref ?? null, sort: 100 + i }));
      return [...acoes, ...recursos];
    }),
  );
  if (subRows.length) await supabase.from("violaunch_substeps").insert(subRows);

  const gateRows = VIOLAUNCH_WEEKS.map((w) => ({
    project_id: projectId, gate_number: w.n, name: w.gate.label, status: w.gate.state,
    rule: w.gate.rule, items: w.gate.checklist,
  }));
  await supabase.from("violaunch_gates").insert(gateRows);

  const blockRows = VIOLAUNCH_ROADMAP.map((b, i) => ({
    project_id: projectId, block_code: b.id, name: b.label, composition: null, progress: b.pct, sort: i,
  }));
  await supabase.from("roadmap_blocks").insert(blockRows);

  return projectId;
}

export async function sbGetVioLaunch(clientId: string, startDate = "01/07"): Promise<VioLaunchData> {
  const supabase = await createClient();
  let { data: proj } = await supabase
    .from("violaunch_projects")
    .select("id, scope, start_date")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!proj) {
    const projectId = await seedVioLaunch(supabase, clientId, startDate);
    if (!projectId) return buildVioLaunchData(VIOLAUNCH_WEEKS, VIOLAUNCH_ROADMAP, { startDate });
    proj = { id: projectId, scope: "completo", start_date: startDate };
  }
  const projectId = (proj as { id: string }).id;

  const [stepsRes, gatesRes, blocksRes] = await Promise.all([
    supabase.from("violaunch_steps").select("*").eq("project_id", projectId).order("step_number"),
    supabase.from("violaunch_gates").select("gate_number, name, status, rule, items").eq("project_id", projectId).order("gate_number"),
    supabase.from("roadmap_blocks").select("block_code, name, progress, sort, content").eq("project_id", projectId).order("sort"),
  ]);
  const steps = (stepsRes.data ?? []) as VLStepRow[];
  const stepIds = steps.map((s) => s.id);
  const subsByStep = new Map<string, VLSubRow[]>();
  if (stepIds.length) {
    const { data: subs } = await supabase
      .from("violaunch_substeps")
      .select("step_id, kind, content, done, resource_type, resource_ref, sort")
      .in("step_id", stepIds)
      .order("sort");
    for (const s of (subs ?? []) as VLSubRow[]) {
      if (!subsByStep.has(s.step_id)) subsByStep.set(s.step_id, []);
      subsByStep.get(s.step_id)!.push(s);
    }
  }

  const gateByNum = new Map<number, VLGateRow>();
  for (const g of (gatesRes.data ?? []) as VLGateRow[]) gateByNum.set(g.gate_number, g);

  const toStep = (r: VLStepRow): VLStep => {
    const subs = subsByStep.get(r.id) ?? [];
    return {
      n: r.step_number,
      label: r.name,
      owner: r.responsible ?? "—",
      date: r.due_date ?? "a definir",
      status: r.status as VLStep["status"],
      statusTag: r.status_tag ?? undefined,
      acoes: subs.filter((s) => s.kind === "action").map((s) => ({ label: s.content, done: s.done })),
      recursos: subs.filter((s) => s.kind === "resource").map((s) => ({ kind: (s.resource_type as VLResource["kind"]) ?? "abrir", label: s.content, ref: s.resource_ref ?? undefined })),
      sla: r.sla ?? "",
      connection: (r.connection as VLStep["connection"]) ?? undefined,
      placeholder: r.placeholder || undefined,
    };
  };

  const weeks: VLWeek[] = VIOLAUNCH_WEEKS.map((tpl) => {
    const g = gateByNum.get(tpl.n);
    const gate: VLGate = g
      ? { label: g.name, state: g.status as VLGate["state"], rule: g.rule ?? "", checklist: Array.isArray(g.items) ? (g.items as VLGate["checklist"]) : [] }
      : tpl.gate;
    return {
      n: tpl.n,
      title: tpl.title,
      steps: steps.filter((s) => Math.ceil(s.step_number / 3) === tpl.n).map(toStep),
      gate,
    };
  });

  const roadmap: VLBlock[] = ((blocksRes.data ?? []) as VLBlockRow[]).map((b) => ({
    id: b.block_code,
    label: b.name,
    pct: Number(b.progress ?? 0),
    content: (b.content && typeof b.content === "object" && "text" in b.content ? String((b.content as { text?: string }).text ?? "") : "") || undefined,
  }));

  return buildVioLaunchData(weeks, roadmap.length ? roadmap : VIOLAUNCH_ROADMAP, {
    scope: ((proj as { scope?: string }).scope as "completo" | "reduzido") ?? "completo",
    startDate: (proj as { start_date?: string }).start_date ?? startDate,
  });
}
