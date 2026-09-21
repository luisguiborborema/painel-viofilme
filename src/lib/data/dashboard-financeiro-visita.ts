import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Marca que o usuário viu o Dashboard agora — é isso que faz a faixa "Desde
 * ontem" virar "desde a sua última visita" para quem ficou dias fora (§4).
 *
 * Falha em silêncio de propósito: é preferência de tela, não dado financeiro.
 * Derrubar o Dashboard porque a migração 0148 não rodou seria trocar um
 * detalhe de conforto por a página inteira.
 */
export async function registrarVisitaDashboard(userId: string | null): Promise<void> {
  if (!userId || !isSupabaseConfigured()) return;
  try {
    const db = await createClient();
    await db
      .from("dashboard_visits")
      .upsert({ user_id: userId, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
  } catch {
    /* sem tabela, sem visita: a faixa cai para "Desde ontem". */
  }
}
