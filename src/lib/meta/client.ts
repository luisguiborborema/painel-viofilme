/**
 * Cliente da Meta Graph API.
 *
 * Funções prontas para: trocar o code por token, obter token de longa duração,
 * listar páginas do Facebook, descobrir a conta do Instagram vinculada, e ler
 * mídias e métricas. Use após o cliente conectar a conta via OAuth.
 */
import {
  GRAPH_BASE,
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
} from "./config";

async function graphGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      json?.error?.message ?? `Graph API error (${res.status}) em ${path}`,
    );
  }
  return json as T;
}

/** Troca o `code` do OAuth por um access token de curta duração. */
export async function exchangeCodeForToken(code: string) {
  return graphGet<{ access_token: string; token_type: string; expires_in: number }>(
    "oauth/access_token",
    {
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code,
    },
  );
}

/** Converte um token de curta duração em token de longa duração (~60 dias). */
export async function getLongLivedToken(shortToken: string) {
  return graphGet<{ access_token: string; expires_in: number }>(
    "oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  );
}

export type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

/** Lista as páginas do Facebook que o usuário administra (com IG vinculado). */
export async function listPages(userAccessToken: string) {
  const data = await graphGet<{ data: FacebookPage[] }>("me/accounts", {
    fields: "id,name,access_token,instagram_business_account",
    access_token: userAccessToken,
  });
  return data.data;
}

export type InstagramAccount = {
  id: string;
  username: string;
  followers_count: number;
  media_count: number;
  profile_picture_url?: string;
};

/** Dados básicos da conta business do Instagram. */
export async function getInstagramAccount(
  igUserId: string,
  pageAccessToken: string,
) {
  return graphGet<InstagramAccount>(igUserId, {
    fields: "id,username,followers_count,media_count,profile_picture_url",
    access_token: pageAccessToken,
  });
}

export type InstagramMedia = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

/** Mídias recentes do Instagram. */
export async function getInstagramMedia(
  igUserId: string,
  pageAccessToken: string,
  limit = 25,
) {
  const data = await graphGet<{ data: InstagramMedia[] }>(`${igUserId}/media`, {
    fields:
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
    access_token: pageAccessToken,
  });
  return data.data;
}

/** Insights da conta (alcance, impressões, novos seguidores) por período. */
export async function getInstagramInsights(
  igUserId: string,
  pageAccessToken: string,
  metrics = ["reach", "impressions", "profile_views"],
  period = "day",
) {
  const data = await graphGet<{
    data: { name: string; values: { value: number; end_time: string }[] }[];
  }>(`${igUserId}/insights`, {
    metric: metrics.join(","),
    period,
    access_token: pageAccessToken,
  });
  return data.data;
}
