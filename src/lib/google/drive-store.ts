/**
 * Resolve a pasta do Drive de um cliente (a partir do drive_folder_url que já é
 * cadastrado em Contatos & briefing) e sobe arquivos nas subpastas dela. Usa a
 * conexão "agency" (getValidAccess) com escopo drive completo.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getValidAccess } from "@/lib/google/client";
import { GOOGLE_DRIVE_CLIENTS_ROOT } from "@/lib/google/config";
import {
  DRIVE_CATEGORIES,
  driveEnsureChildFolder,
  driveProvisionClientFolder,
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

/**
 * Garante a pasta do cliente no Drive quando ele entra em operações. Se já houver
 * drive_folder_url, não faz nada. Senão cria `<nome>` + subpastas 00–04 sob a
 * pasta-mãe configurada (GOOGLE_DRIVE_CLIENTS_ROOT) e grava o link em clients.
 * Best-effort: nunca lança — devolve null se o Google não estiver conectado ou
 * faltar service_role. Retorna a URL da pasta quando cria/já existe.
 */
export async function provisionClientDrive(clientId: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("clients")
      .select("name,drive_folder_url")
      .eq("id", clientId)
      .maybeSingle();
    const row = data as { name?: string | null; drive_folder_url?: string | null } | null;
    if (!row) return null;
    // Já vinculada (link manual ou provisionamento anterior): não recria.
    const existing = parseDriveFolderId(row.drive_folder_url);
    if (existing) return row.drive_folder_url ?? null;

    const access = await getValidAccess();
    if (!access?.token) return null;

    const parent = parseDriveFolderId(GOOGLE_DRIVE_CLIENTS_ROOT) ?? undefined;
    const now = new Date();
    const folder = await driveProvisionClientFolder(access.token, row.name ?? "Cliente", parent, {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
    await admin.from("clients").update({ drive_folder_url: folder.url }).eq("id", clientId);
    return folder.url;
  } catch {
    return null;
  }
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
