import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Cliente Supabase com a chave de serviço (service_role).
 *
 * Usado SOMENTE no servidor, em tarefas que rodam sem uma sessão de usuário —
 * por exemplo a sincronização da Meta Graph API (cron / rota de sync). A chave
 * de serviço bypassa o RLS, então NUNCA exponha este cliente no navegador.
 */
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Há chave de serviço configurada? (necessária para o sync gravar dados.) */
export function hasServiceRole(): boolean {
  return SUPABASE_URL.startsWith("http") && SERVICE_ROLE_KEY.length > 20;
}

export function createAdminClient() {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente — necessária para gravar dados do sync.",
    );
  }
  return createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
