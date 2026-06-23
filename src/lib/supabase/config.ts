/**
 * Configuração do Supabase.
 *
 * O painel funciona em dois modos:
 *  - DEMO: quando as variáveis abaixo não estão definidas, usamos um login
 *    de demonstração (ver src/lib/auth/demo.ts). Útil para rodar na hora.
 *  - PRODUÇÃO: quando NEXT_PUBLIC_SUPABASE_URL e a chave estão definidas,
 *    usamos autenticação e banco reais do Supabase.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/** Indica se há credenciais válidas do Supabase configuradas. */
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.startsWith("http") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_URL.includes("your-project")
  );
}
