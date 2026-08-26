import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fechamento de período.
 *
 * Depois de fechar o mês, lançamento com vencimento até a data travada não pode
 * mais ser criado, editado ou apagado. É o que dá confiabilidade ao histórico:
 * um relatório fechado em março não muda em maio porque alguém editou uma
 * despesa antiga.
 *
 * Tolerante: sem a migração 0137, nada está travado.
 */
export async function periodoFechadoAte(db: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await db.from("finance_settings").select("closed_until").eq("id", 1).maybeSingle();
    if (error) return null;
    const v = (data as { closed_until?: string | null } | null)?.closed_until;
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

/** Mensagem de bloqueio se a data cai em período fechado; null se liberado. */
export function bloqueioPorFechamento(dataAlvo: string | null | undefined, fechadoAte: string | null): string | null {
  if (!fechadoAte || !dataAlvo) return null;
  if (String(dataAlvo) > fechadoAte) return null;
  const [a, m, d] = fechadoAte.split("-");
  return `Período fechado até ${d}/${m}/${a}. Reabra em Financeiro → Configurações para alterar lançamentos anteriores.`;
}
