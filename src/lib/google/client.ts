/**
 * Cliente OAuth do Google (server-only). Troca de code, refresh de token e
 * acesso à conexão única da agência (tabela google_connections).
 */
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_CALENDAR_ID,
  isGoogleConfigured,
} from "./config";
import type { GoogleStatus } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

/** Troca o code do OAuth por tokens (inclui refresh_token na 1ª vez). */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? "token error");
  return json as TokenResponse;
}

export async function getUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const json = await res.json();
    return json.email as string | undefined;
  } catch {
    return undefined;
  }
}

type ConnectionRow = {
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  calendar_id: string | null;
  google_email: string | null;
};

async function readConnection(): Promise<ConnectionRow | null> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_connections")
    .select("access_token,refresh_token,token_expiry,calendar_id,google_email")
    .eq("scope", "agency")
    .maybeSingle();
  return (data as ConnectionRow) ?? null;
}

/** Salva/atualiza a conexão única da agência. */
export async function saveConnection(input: {
  email?: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string;
}): Promise<void> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return;
  const admin = createAdminClient();
  const expiry = new Date(Date.now() + input.expiresIn * 1000).toISOString();
  const patch: Record<string, unknown> = {
    scope: "agency",
    google_email: input.email ?? null,
    access_token: input.accessToken,
    token_expiry: expiry,
    calendar_id: GOOGLE_CALENDAR_ID,
    scopes: input.scopes,
    updated_at: new Date().toISOString(),
  };
  // Só sobrescreve o refresh_token quando o Google devolve um novo.
  if (input.refreshToken) patch.refresh_token = input.refreshToken;
  await admin.from("google_connections").upsert(patch, { onConflict: "scope" });
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as TokenResponse & { error?: string };
    if (!res.ok || !json.access_token) return null;
    // Persiste o novo access_token/expiry (mantém o refresh_token atual).
    if (isSupabaseConfigured() && hasServiceRole()) {
      const admin = createAdminClient();
      await admin
        .from("google_connections")
        .update({
          access_token: json.access_token,
          token_expiry: new Date(Date.now() + json.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("scope", "agency");
    }
    return json.access_token;
  } catch {
    return null;
  }
}

/** Access token válido (renova se necessário) + o calendarId a usar. */
export async function getValidAccess(): Promise<{ token: string; calendarId: string } | null> {
  if (!isGoogleConfigured()) return null;
  const conn = await readConnection();
  if (!conn?.access_token) return null;
  const calendarId = conn.calendar_id || GOOGLE_CALENDAR_ID;

  const expiry = conn.token_expiry ? Date.parse(conn.token_expiry) : 0;
  const soon = Date.now() + 60_000;
  if (expiry > soon) return { token: conn.access_token, calendarId };

  if (conn.refresh_token) {
    const fresh = await refreshAccessToken(conn.refresh_token);
    if (fresh) return { token: fresh, calendarId };
  }
  // Sem refresh válido: devolve o que tem (pode falhar → reconctar).
  return { token: conn.access_token, calendarId };
}

/** Status da conexão para as telas de Integrações/Agenda. */
export async function getGoogleStatus(): Promise<GoogleStatus> {
  if (!isGoogleConfigured()) return { connected: false };
  const conn = await readConnection();
  return {
    connected: !!conn?.access_token,
    email: conn?.google_email ?? undefined,
    calendarId: conn?.calendar_id ?? undefined,
  };
}
