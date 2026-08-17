/**
 * Resolve a pasta do Drive de um cliente (a partir do drive_folder_url que já é
 * cadastrado em Contatos & briefing) e sobe arquivos nas subpastas dela. Usa a
 * conexão "agency" (getValidAccess) com escopo drive completo.
 */
import { createClient } from "@/lib/supabase/server";
import { getValidAccess } from "@/lib/google/client";
import {
  DRIVE_CATEGORIES,
  driveEnsureChildFolder,
  driveUploadFile,
  parseDriveFolderId,
  type DriveFile,
} from "@/lib/google/drive";

/** Id da pasta raiz do cliente (do drive_folder_url); null se não configurado. */
export async function clientDriveRoot(clientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("drive_folder_url").eq("id", clientId).maybeSingle();
  return parseDriveFolderId((data as { drive_folder_url?: string | null } | null)?.drive_folder_url);
}

/** Sobe um arquivo para a categoria (00–04) dentro da pasta do cliente. */
export async function uploadToClientDrive(
  clientId: string,
  category: string,
  file: { name: string; mimeType: string; bytes: ArrayBuffer },
): Promise<DriveFile> {
  const access = await getValidAccess();
  if (!access?.token) throw new Error("google-desconectado");
  const root = await clientDriveRoot(clientId);
  if (!root) throw new Error("sem-pasta");
  const catName = DRIVE_CATEGORIES.find((c) => c.key === category)?.name ?? DRIVE_CATEGORIES[0].name;
  const parentId = await driveEnsureChildFolder(access.token, root, catName);
  return driveUploadFile(access.token, { name: file.name, mimeType: file.mimeType, bytes: file.bytes, parentId });
}
