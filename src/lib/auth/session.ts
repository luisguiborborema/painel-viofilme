import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
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
  // getUser() valida o token no servidor do Supabase e garante que a MESMA
  // sessão autenticada seja usada na query de profiles (auth.uid() correto no
  // PostgREST). Evita o perfil vir vazio — que fazia role/clientId caírem nos
  // defaults ('cliente'/null) e jogava o gerencial na área do cliente.
  const { data: userData } = await supabase.auth.getUser();
  const authUser = userData?.user;
  if (!authUser) return null;
  const userId = authUser.id;
  const userEmail = authUser.email ?? "";
  const metaAvatar =
    ((authUser.user_metadata as { avatar_url?: string } | undefined)?.avatar_url) ??
    null;

  // Perfil + cliente vinculado.
  // Lemos o perfil com a service role (bypassa RLS) — a identidade já foi
  // validada pelo getUser() acima. Isso evita o perfil vir vazio quando o
  // contexto de RLS/token do PostgREST não alinha (o que jogava role='cliente'
  // e clientId=null, mandando o gerencial pra área do cliente). Sem service
  // role, cai no cliente autenticado normal.
  const db = hasServiceRole() ? createAdminClient() : supabase;
  // SEM embed clients(name): a migration 0065 adicionou cs_main_id/cs_support_id
  // em clients->profiles, o que tornou o embed profiles->clients AMBÍGUO
  // (PGRST201) e fazia a query inteira falhar → profile null → role='cliente'.
  // Buscamos o nome do cliente numa query separada, sem ambiguidade.
  const { data: profile } = await db
    .from("profiles")
    .select("id, full_name, role, client_id, team_role, commercial_role, allowed_sections, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  // Foto: preferimos o profiles.avatar_url (definido em Configurações) e caímos
  // no avatar do JWT/metadata como fallback.
  const avatarUrl = (profile?.avatar_url ? String(profile.avatar_url) : null) ?? metaAvatar;

  const role = (profile?.role as Role) ?? "cliente";

  let clientName: string | null = null;
  if (profile?.client_id) {
    const { data: c } = await db.from("clients").select("name").eq("id", profile.client_id).maybeSingle();
    clientName = (c as { name: string | null } | null)?.name ?? null;
  }

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
    commercialRole:
      (profile?.commercial_role as string | null | undefined) ?? "gestor",
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
