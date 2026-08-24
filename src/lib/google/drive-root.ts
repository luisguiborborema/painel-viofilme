/**
 * Pasta-mãe do Drive onde as pastas dos clientes são criadas.
 *
 * Ordem de resolução:
 *  1. `google_connections.drive_root_folder_id` (configurado em Integrações)
 *  2. env `GOOGLE_DRIVE_CLIENTS_ROOT` (legado)
 *  3. nada → cria na raiz do "Meu Drive" da conta conectada
 *
 * Server-only. Tolerante: se a coluna ainda não existir (migração 0128 não
 * rodada), cai no env sem quebrar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { GOOGLE_DRIVE_CLIENTS_ROOT } from "./config";
import { parseDriveFolderId } from "./drive";

export type DriveRoot = { id: string | null; name: string; source: "config" | "env" | "none" };

export async function getDriveRoot(db: SupabaseClient): Promise<DriveRoot> {
  try {
    const { data, error } = await db
      .from("google_connections")
      .select("drive_root_folder_id, drive_root_folder_name")
      .eq("scope", "agency")
      .maybeSingle();
    if (!error) {
      const row = data as { drive_root_folder_id?: string | null; drive_root_folder_name?: string | null } | null;
      const id = parseDriveFolderId(row?.drive_root_folder_id);
      if (id) return { id, name: String(row?.drive_root_folder_name ?? "").trim() || "Pasta configurada", source: "config" };
    }
  } catch {
    // coluna ausente → segue para o env
  }
  const envId = parseDriveFolderId(GOOGLE_DRIVE_CLIENTS_ROOT);
  if (envId) return { id: envId, name: "Definida por variável de ambiente", source: "env" };
  return { id: null, name: "Meu Drive (raiz)", source: "none" };
}
