import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_COOKIE } from "./demo";
import type { Role, SessionUser } from "./types";

/**
 * Retorna o usuário autenticado no servidor (ou null).
 *
 * Em produção (Supabase configurado): lê a sessão do Supabase e o perfil
 * correspondente na tabela `profiles`. Em modo demo: lê o cookie de demo.
 *
 * Envolto em React `cache()`: numa mesma requisição (layout + página +
 * componentes) roda uma única vez, evitando repetir o getUser()/perfil.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) {
    return getDemoSession();
  }

  const supabase = await createClient();
  // getClaims() lê a identidade do JWT já validado (localmente, via WebCrypto,
  // em projetos com chaves assimétricas) — evita o round-trip de rede do
  // getUser() a cada render. O proxy já renovou o token nesta requisição, então
  // aqui não há refresh nem escrita de cookie. A query de profiles abaixo
  // continua sendo a fonte de verdade de role/allowed_sections.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) return null;
  const userId = claims.sub as string;
  const userEmail = (claims.email as string | undefined) ?? "";
  const metaAvatar =
    ((claims.user_metadata as { avatar_url?: string } | undefined)?.avatar_url) ??
    null;

  // Perfil + cliente vinculado
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, client_id, team_role, allowed_sections, avatar_url, clients(name)")
    .eq("id", userId)
    .single();

  // Foto: preferimos o profiles.avatar_url (definido em Configurações) e caímos
  // no avatar do JWT/metadata como fallback.
  const avatarUrl = (profile?.avatar_url ? String(profile.avatar_url) : null) ?? metaAvatar;

  const role = (profile?.role as Role) ?? "cliente";
  // O join pode vir como objeto (to-one) ou array, dependendo da inferência.
  const clientRel = profile?.clients as
    | { name: string }
    | { name: string }[]
    | null
    | undefined;
  const clientName = Array.isArray(clientRel)
    ? (clientRel[0]?.name ?? null)
    : (clientRel?.name ?? null);

  return {
    id: userId,
    email: userEmail,
    name: profile?.full_name ?? userEmail ?? "Usuário",
    role,
    clientId: profile?.client_id ?? null,
    clientName,
    avatarUrl,
    allowedSections:
      (profile?.allowed_sections as string[] | null | undefined) ?? null,
    teamRole: (profile?.team_role as string | null | undefined) ?? null,
  };
});

/** Lê o cookie de sessão demo (usado quando o Supabase não está configurado). */
export async function getDemoSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}
