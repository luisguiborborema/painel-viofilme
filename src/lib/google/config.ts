/**
 * Configuração da integração com o Google Calendar (conta única da agência).
 *
 * Crie credenciais OAuth em https://console.cloud.google.com/ (APIs & Services
 * → Credentials → OAuth client ID, tipo "Web application"), habilite a
 * "Google Calendar API" e registre a redirect URI abaixo.
 */
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
export const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "primary";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const GOOGLE_REDIRECT_URI = `${APP_URL}/api/google/callback`;

/**
 * Escopos: e-mail (identificação) + Calendar (eventos) + Drive COMPLETO (navegar
 * e editar/criar/excluir arquivos nas pastas do cliente que a conta possui ou que
 * foram compartilhadas com ela). ATENÇÃO: `drive` é escopo RESTRITO — em produção
 * exige verificação do Google; em modo "Testing" funciona com usuários de teste.
 * Após alterar, é preciso RECONECTAR o Google.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
] as const;

export function isGoogleConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0 && GOOGLE_CLIENT_SECRET.length > 0;
}

/** Monta a URL de autorização OAuth do Google (com refresh_token). */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
