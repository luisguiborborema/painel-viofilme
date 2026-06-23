/**
 * Configuração da integração com a Meta Graph API (Instagram + Facebook).
 *
 * Para funcionar em produção você precisa de um app em
 * https://developers.facebook.com/ (tipo "Business") com os produtos
 * "Facebook Login" e "Instagram Graph API" e as permissões abaixo aprovadas
 * em App Review.
 */

export const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
export const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const OAUTH_DIALOG = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

/** Permissões necessárias para ler conteúdo e métricas de IG e FB. */
export const META_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
  "read_insights",
  "ads_read",
] as const;

export const META_REDIRECT_URI = `${APP_URL}/api/meta/callback`;

export function isMetaConfigured(): boolean {
  return META_APP_ID.length > 0 && META_APP_SECRET.length > 0;
}

/** Monta a URL de autorização OAuth da Meta. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    scope: META_SCOPES.join(","),
    response_type: "code",
    state,
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}
