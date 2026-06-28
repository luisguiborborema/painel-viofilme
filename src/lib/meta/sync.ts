/**
 * Sincronização Meta → Supabase.
 *
 * Para cada cliente com conexão Meta ativa, puxa da Graph API e grava no banco:
 *  - conta do Instagram (seguidores, alcance, impressões) → account_metrics
 *  - mídias recentes → content_posts
 *  - campanhas + métricas diárias (se houver ad_account_id) → campaigns / campaign_metrics
 *
 * Roda no servidor com a chave de serviço (bypassa RLS). Idempotente: re-rodar
 * apenas atualiza as linhas existentes (upsert por chave natural).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAdCampaigns,
  getCampaignInsights,
  getInstagramAccount,
  getInstagramInsights,
  getInstagramMedia,
} from "./client";

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/** IG media_type + media_product_type → enum media_type do banco. */
function mapMediaType(mediaType: string, productType?: string): string {
  if (productType === "REELS") return "reel";
  if (productType === "STORY") return "story";
  if (mediaType === "CAROUSEL_ALBUM") return "carousel";
  if (mediaType === "VIDEO") return "video";
  return "image";
}

/** effective_status da Meta Ads → enum campaign_status do banco. */
function mapCampaignStatus(status: string): "active" | "paused" | "ended" | "draft" {
  switch (status) {
    case "ACTIVE":
    case "IN_PROCESS":
    case "WITH_ISSUES":
      return "active";
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      return "paused";
    case "ARCHIVED":
    case "DELETED":
    case "COMPLETED":
      return "ended";
    default:
      return "draft";
  }
}

const CONVERSION_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
]);

function countConversions(
  actions?: { action_type: string; value: string }[],
): number {
  if (!actions) return 0;
  return actions
    .filter((a) => CONVERSION_ACTIONS.has(a.action_type))
    .reduce((s, a) => s + Number(a.value || 0), 0);
}

export type MetaConnectionRow = {
  client_id: string;
  ig_user_id: string | null;
  fb_page_id: string | null;
  page_name: string | null;
  access_token: string | null;
  ad_account_id: string | null;
  token_expires_at: string | null;
};

export type SyncResult = {
  clientId: string;
  followers: number;
  posts: number;
  campaigns: number;
  errors: string[];
};

/** Sincroniza um cliente a partir de sua conexão Meta. */
export async function syncClientFromMeta(clientId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: conn, error } = await admin
    .from("meta_connections")
    .select(
      "client_id, ig_user_id, fb_page_id, page_name, access_token, ad_account_id, token_expires_at",
    )
    .eq("client_id", clientId)
    .single();

  if (error || !conn) throw new Error("conexão Meta não encontrada para o cliente");
  const c = conn as MetaConnectionRow;
  if (!c.access_token) throw new Error("conexão sem access_token");

  const result: SyncResult = {
    clientId,
    followers: 0,
    posts: 0,
    campaigns: 0,
    errors: [],
  };
  const token = c.access_token;

  // 1. Conta do Instagram --------------------------------------------------
  if (c.ig_user_id) {
    try {
      const acct = await getInstagramAccount(c.ig_user_id, token);
      result.followers = acct.followers_count ?? 0;
      if (acct.username) {
        await admin
          .from("clients")
          .update({ instagram_username: acct.username })
          .eq("id", clientId);
      }
    } catch (e) {
      result.errors.push(`conta: ${msg(e)}`);
    }

    // 2. Insights da conta (resiliente a métricas indisponíveis) ----------
    let reach = 0;
    let impressions = 0;
    let profileViews = 0;
    try {
      const ins = await getInstagramInsights(
        c.ig_user_id,
        token,
        ["reach", "impressions", "profile_views"],
        "day",
      );
      for (const m of ins) {
        const last = m.values?.at(-1)?.value ?? 0;
        if (m.name === "reach") reach = last;
        else if (m.name === "impressions") impressions = last;
        else if (m.name === "profile_views") profileViews = last;
      }
    } catch (e) {
      result.errors.push(`insights: ${msg(e)}`);
    }

    try {
      await admin.from("account_metrics").upsert(
        {
          client_id: clientId,
          platform: "instagram",
          date: today(),
          followers: result.followers,
          reach,
          impressions,
          profile_views: profileViews,
        },
        { onConflict: "client_id,platform,date" },
      );
    } catch (e) {
      result.errors.push(`account_metrics: ${msg(e)}`);
    }

    // 3. Mídias → content_posts -------------------------------------------
    try {
      const media = await getInstagramMedia(c.ig_user_id, token, 50);
      if (media.length) {
        const rows = media.map((m) => ({
          client_id: clientId,
          external_id: m.id,
          platform: "instagram" as const,
          media_type: mapMediaType(m.media_type, m.media_product_type),
          status: "published" as const,
          caption: m.caption ?? null,
          permalink: m.permalink,
          media_url: m.media_url ?? null,
          thumbnail_url: m.thumbnail_url ?? null,
          published_at: m.timestamp,
          likes: m.like_count ?? 0,
          comments: m.comments_count ?? 0,
        }));
        await admin
          .from("content_posts")
          .upsert(rows, { onConflict: "client_id,external_id" });
        result.posts = rows.length;
      }
    } catch (e) {
      result.errors.push(`mídias: ${msg(e)}`);
    }
  }

  // 4. Meta Ads (somente se houver conta de anúncio configurada) ----------
  if (c.ad_account_id) {
    try {
      result.campaigns = await syncAdsForClient(
        clientId,
        c.ad_account_id,
        token,
      );
    } catch (e) {
      result.errors.push(`ads: ${msg(e)}`);
    }
  }

  // Carimbo da última sincronização
  await admin
    .from("meta_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("client_id", clientId);

  return result;
}

/** Sincroniza campanhas + métricas diárias dos últimos 30 dias. */
async function syncAdsForClient(
  clientId: string,
  adAccountId: string,
  token: string,
): Promise<number> {
  const admin = createAdminClient();
  const campaigns = await getAdCampaigns(adAccountId, token);
  if (!campaigns.length) return 0;

  const campaignRows = campaigns.map((c) => ({
    client_id: clientId,
    external_id: c.id,
    name: c.name,
    objective: c.objective ?? null,
    status: mapCampaignStatus(c.effective_status ?? c.status),
    budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
    start_date: c.start_time ? c.start_time.slice(0, 10) : null,
    end_date: c.stop_time ? c.stop_time.slice(0, 10) : null,
  }));

  await admin
    .from("campaigns")
    .upsert(campaignRows, { onConflict: "client_id,external_id" });

  // Mapa external_id → id (uuid) para gravar as métricas diárias
  const { data: saved } = await admin
    .from("campaigns")
    .select("id, external_id")
    .eq("client_id", clientId);
  const idByExternal = new Map(
    (saved ?? []).map((r) => [r.external_id as string, r.id as string]),
  );

  const insights = await getCampaignInsights(
    adAccountId,
    token,
    daysAgo(30),
    today(),
  );

  const metricRows = insights
    .map((i) => {
      const campaignUuid = idByExternal.get(i.campaign_id);
      if (!campaignUuid) return null;
      return {
        campaign_id: campaignUuid,
        date: i.date_start,
        impressions: Number(i.impressions || 0),
        reach: Number(i.reach || 0),
        clicks: Number(i.clicks || 0),
        spend: Number(i.spend || 0),
        conversions: countConversions(i.actions),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (metricRows.length) {
    await admin
      .from("campaign_metrics")
      .upsert(metricRows, { onConflict: "campaign_id,date" });
  }

  // Atualiza o gasto acumulado de cada campanha (soma das métricas)
  const spendByCampaign = new Map<string, number>();
  for (const r of metricRows) {
    spendByCampaign.set(
      r.campaign_id,
      (spendByCampaign.get(r.campaign_id) ?? 0) + r.spend,
    );
  }
  for (const [campaignUuid, spend] of spendByCampaign) {
    await admin
      .from("campaigns")
      .update({ spend })
      .eq("id", campaignUuid);
  }

  return campaignRows.length;
}

/** Sincroniza todos os clientes com conexão Meta. */
export async function syncAllClients(): Promise<SyncResult[]> {
  const admin = createAdminClient();
  const { data: conns } = await admin
    .from("meta_connections")
    .select("client_id");

  const results: SyncResult[] = [];
  for (const conn of conns ?? []) {
    const clientId = conn.client_id as string;
    try {
      results.push(await syncClientFromMeta(clientId));
    } catch (e) {
      results.push({
        clientId,
        followers: 0,
        posts: 0,
        campaigns: 0,
        errors: [msg(e)],
      });
    }
  }
  return results;
}
