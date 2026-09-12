import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { REFERENCE_DATE } from "./mock";
import { mesCorrente } from "./hoje";

/**
 * A data de referência das telas do cliente.
 *
 * Com banco configurado é hoje, de verdade. Sem banco (modo demonstração),
 * ancora na data fixa do mock para que o conteúdo de exemplo faça sentido.
 *
 * Existe para que NENHUMA página precise importar o mock: foi assim que a data
 * fixa de 22/06/2026 acabou governando o painel real por meses.
 */
export function refIsoAtual(): string {
  return isSupabaseConfigured() ? new Date().toISOString() : REFERENCE_DATE.toISOString();
}

/** Rótulo do período exibido ao cliente ("Setembro 2026"). */
export function rotuloDoPeriodo(): string {
  return isSupabaseConfigured() ? mesCorrente() : "Junho 2026";
}
