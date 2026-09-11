import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PREFIXO, normalizarEscopos, prefixoDe, type ApiKey, type Dominio } from "./api-keys";

/**
 * Chaves de API — acesso ao banco.
 *
 * Usa o cliente admin porque a validação acontece no endpoint do MCP, que não
 * tem sessão de usuário: a chave É a credencial.
 */

const hash = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** Gera um token novo. 32 bytes = 64 hex — inviável de adivinhar. */
export function gerarToken(): string {
  return PREFIXO + randomBytes(32).toString("hex");
}

function mapear(r: Record<string, unknown>): ApiKey {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    prefix: String(r.prefix ?? ""),
    scope: String(r.scope ?? "mcp"),
    scopes: Array.isArray(r.scopes) ? (r.scopes as string[]) : [],
    createdBy: (r.created_by as string) ?? null,
    createdAt: String(r.created_at),
    lastUsedAt: (r.last_used_at as string) ?? null,
    revokedAt: (r.revoked_at as string) ?? null,
    revokedBy: (r.revoked_by as string) ?? null,
  };
}

/** Tabela ainda não criada — a migração 0139 não rodou. */
const semTabela = (msg: string) => /api_keys|42P01|42703/i.test(msg);

const COLS = "id, name, prefix, scope, scopes, created_by, created_at, last_used_at, revoked_at, revoked_by";
/** Sem a migração 0140 a coluna `scopes` não existe — cai para o conjunto base. */
const COLS_SEM_ESCOPO = "id, name, prefix, scope, created_by, created_at, last_used_at, revoked_at, revoked_by";

export async function listarChaves(): Promise<{ chaves: ApiKey[]; semMigracao: boolean }> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return { chaves: [], semMigracao: false };
  try {
    const db = createAdminClient();
    const lista = (cols: string) =>
      db.from("api_keys").select(cols).order("created_at", { ascending: false }).limit(100);
    const v2 = await lista(COLS);
    const { data, error } = v2.error ? await lista(COLS_SEM_ESCOPO) : v2;
    if (error) return { chaves: [], semMigracao: semTabela(error.message) };
    return { chaves: ((data ?? []) as unknown as Record<string, unknown>[]).map(mapear), semMigracao: false };
  } catch {
    return { chaves: [], semMigracao: false };
  }
}

/** Cria a chave e devolve o token em claro — a ÚNICA vez que ele existe. */
export async function criarChave(
  nome: string,
  autor: string,
  escopos: Dominio[] = [],
): Promise<{ token: string; chave: ApiKey }> {
  const token = gerarToken();
  const db = createAdminClient();
  const base = { name: nome, token_hash: hash(token), prefix: prefixoDe(token), created_by: autor };

  let r = await db.from("api_keys").insert({ ...base, scopes: normalizarEscopos(escopos) }).select(COLS).single();
  if (r.error && /scopes|42703/i.test(r.error.message)) {
    // Migração 0140 ainda não rodou: grava sem escopo (a chave lê tudo).
    r = await db.from("api_keys").insert(base).select(COLS_SEM_ESCOPO).single();
  }
  if (r.error) throw new Error(semTabela(r.error.message) ? "Rode a migração 0139_api_keys.sql." : r.error.message);
  return { token, chave: mapear(r.data as Record<string, unknown>) };
}

export async function revogarChave(id: string, autor: string): Promise<void> {
  const { error, count } = await createAdminClient()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_by: autor }, { count: "exact" })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
  if (!count) throw new Error("Chave não encontrada ou já revogada.");
}

/** Remove de vez uma chave já revogada (limpeza da lista). */
export async function apagarChave(id: string): Promise<void> {
  const { error } = await createAdminClient().from("api_keys").delete().eq("id", id).not("revoked_at", "is", null);
  if (error) throw new Error(error.message);
}

export type ChaveValida = { id: string; name: string; scope: string; scopes: string[] };

/**
 * Valida um token apresentado. Devolve a chave quando confere, null quando não.
 *
 * A busca é pelo hash — não há como percorrer a tabela comparando em claro,
 * porque o valor em claro não existe em lugar nenhum. Isso também torna a
 * consulta O(1) por índice, sem varredura.
 */
export async function validarToken(token: string): Promise<ChaveValida | null> {
  if (!token || !isSupabaseConfigured() || !hasServiceRole()) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("api_keys")
      .select("id, name, scope, scopes, token_hash, last_used_at")
      .eq("token_hash", hash(token))
      .is("revoked_at", null)
      .maybeSingle();
    if (error || !data) return null;

    // Comparação em tempo constante por precaução: o índice já garante a
    // igualdade, mas isto fecha qualquer diferença de tempo observável.
    const a = Buffer.from(String((data as { token_hash: string }).token_hash), "utf8");
    const b = Buffer.from(hash(token), "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    // Marca o uso com folga de 5 minutos: sem a folga, cada chamada do MCP
    // viraria uma escrita, e uma conversa dispara várias chamadas.
    const ultimo = (data as { last_used_at: string | null }).last_used_at;
    const agora = Date.now();
    if (!ultimo || agora - new Date(ultimo).getTime() > 5 * 60_000) {
      void admin
        .from("api_keys")
        .update({ last_used_at: new Date(agora).toISOString() })
        .eq("id", String((data as { id: unknown }).id))
        .then(() => {}, () => {});
    }

    const d = data as Record<string, unknown>;
    return {
      id: String(d.id),
      name: String(d.name ?? ""),
      scope: String(d.scope ?? "mcp"),
      scopes: Array.isArray(d.scopes) ? (d.scopes as string[]) : [],
    };
  } catch {
    return null;
  }
}
