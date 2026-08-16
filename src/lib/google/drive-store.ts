/**
 * Provisão e upload de arquivos no Drive por cliente. Garante a estrutura de
 * pastas (root do cliente + 00–04) uma vez, guarda os ids em clients.drive_folders
 * (leitura/gravação tolerantes — coluna 0110) e sobe o arquivo na pasta certa.
 */
import { createClient } from "@/lib/supabase/server";
import { getValidAccess } from "@/lib/google/client";
import { DRIVE_CATEGORIES, driveCreateFolder, driveUploadFile, type DriveFile } from "@/lib/google/drive";

type DriveMap = { rootId: string; folders: Record<string, string> };

/** Garante a estrutura de pastas do cliente no Drive; retorna o mapa de ids. */
export async function ensureClientDrive(clientId: string, token: string): Promise<DriveMap> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name, drive_folders").eq("id", clientId).maybeSingle();
  const row = data as { name?: string | null; drive_folders?: unknown } | null;
  const clientName = row?.name ?? "Cliente";
  const cur = (row?.drive_folders && typeof row.drive_folders === "object" ? row.drive_folders : null) as DriveMap | null;

  const rootId = cur?.rootId || (await driveCreateFolder(token, clientName));
  const folders: Record<string, string> = { ...(cur?.folders ?? {}) };
  let changed = !cur?.rootId;
  for (const c of DRIVE_CATEGORIES) {
    if (!folders[c.key]) {
      folders[c.key] = await driveCreateFolder(token, c.name, rootId);
      changed = true;
    }
  }
  const map: DriveMap = { rootId, folders };
  if (changed) {
    // Tolerante: se a coluna 0110 não existir, apenas ignora a persistência.
    await supabase.from("clients").update({ drive_folders: map }).eq("id", clientId);
  }
  return map;
}

/** Sobe um arquivo para a categoria (00–04) do cliente no Drive. */
export async function uploadToClientDrive(
  clientId: string,
  category: string,
  file: { name: string; mimeType: string; bytes: ArrayBuffer },
): Promise<DriveFile> {
  const access = await getValidAccess();
  if (!access?.token) throw new Error("google-desconectado");
  const map = await ensureClientDrive(clientId, access.token);
  const parentId = map.folders[category] ?? map.rootId;
  return driveUploadFile(access.token, { name: file.name, mimeType: file.mimeType, bytes: file.bytes, parentId });
}
