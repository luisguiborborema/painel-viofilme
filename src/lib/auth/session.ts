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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Perfil + cliente vinculado
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, client_id, clients(name)")
    .eq("id", user.id)
    .single();

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
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name ?? user.email ?? "Usuário",
    role,
    clientId: profile?.client_id ?? null,
    clientName,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
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
