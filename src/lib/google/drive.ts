/**
 * Cliente do Google Drive (server-only). Usa a conexão "agency" (getValidAccess)
 * com escopo drive COMPLETO — navega e edita as pastas/arquivos que a conta
 * conectada possui ou que foram compartilhados com ela (as pastas do cliente).
 */
const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Estrutura padrão de pastas por cliente (prefixo → nome). Ordem preservada. */
export const DRIVE_CATEGORIES: { key: string; name: string }[] = [
  { key: "00", name: "00. Material de Apoio" },
  { key: "01", name: "01. Redes Sociais" },
  { key: "02", name: "02. Performance" },
  { key: "03", name: "03. Relatórios" },
  { key: "04", name: "04. Materiais Pontuais" },
];

export type DriveEntry = {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string;
  url?: string;
  iconUrl?: string;
  size?: number;
  modifiedAt?: string;
};

/** Extrai o id da pasta de um link do Drive (…/folders/<id>, ?id=<id> ou id cru). */
export function parseDriveFolderId(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/\/folders\/([\w-]+)/) || s.match(/[?&]id=([\w-]+)/);
  if (m) return m[1];
  if (/^[\w-]{16,}$/.test(s)) return s; // id cru
  return null;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Nome de uma pasta/arquivo (para breadcrumb e validação). */
export async function driveGetName(token: string, fileId: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch(`${DRIVE}/files/${fileId}?fields=id,name&supportsAllDrives=true`, { headers: auth(token), cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; name: string };
}

/** Lista o conteúdo de uma pasta (subpastas primeiro, depois arquivos). */
export async function driveListChildren(token: string, folderId: string): Promise<DriveEntry[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,webViewLink,iconLink,size,modifiedTime)");
  const res = await fetch(
    `${DRIVE}/files?q=${q}&fields=${fields}&pageSize=200&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: auth(token), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`drive: falha ao listar (${res.status})`);
  const j = (await res.json()) as {
    files?: { id: string; name: string; mimeType: string; webViewLink?: string; iconLink?: string; size?: string; modifiedTime?: string }[];
  };
  return (j.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    isFolder: f.mimeType === FOLDER_MIME,
    mimeType: f.mimeType,
    url: f.webViewLink,
    iconUrl: f.iconLink,
    size: f.size ? Number(f.size) : undefined,
    modifiedAt: f.modifiedTime,
  }));
}

/** Cria uma pasta dentro de parentId. Retorna o id. */
export async function driveCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
  const res = await fetch(`${DRIVE}/files?fields=id&supportsAllDrives=true`, {
    method: "POST",
    headers: { ...auth(token), "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
  if (!res.ok) throw new Error(`drive: falha ao criar pasta (${res.status})`);
  return ((await res.json()) as { id: string }).id;
}

/** Acha uma subpasta por nome dentro de parentId; cria se não existir. */
export async function driveEnsureChildFolder(token: string, parentId: string, name: string): Promise<string> {
  const q = encodeURIComponent(`'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`);
  const res = await fetch(`${DRIVE}/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: auth(token), cache: "no-store" });
  if (res.ok) {
    const j = (await res.json()) as { files?: { id: string }[] };
    if (j.files?.[0]?.id) return j.files[0].id;
  }
  return driveCreateFolder(token, name, parentId);
}

/** URL pública de uma pasta do Drive a partir do id. */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Provisiona a pasta de um cliente: cria (ou reusa) `<nome>` dentro de parentId
 * e garante as 5 subpastas padrão (00–04). Idempotente — rodar de novo não
 * duplica. parentId omitido = raiz do "Meu Drive" da conta conectada ("root").
 * Retorna id + link da pasta raiz do cliente.
 */
export async function driveProvisionClientFolder(
  token: string,
  clientName: string,
  parentId?: string,
): Promise<{ id: string; url: string }> {
  const name = (clientName || "Cliente").trim().slice(0, 120);
  const rootId = await driveEnsureChildFolder(token, parentId || "root", name);
  for (const cat of DRIVE_CATEGORIES) {
    await driveEnsureChildFolder(token, rootId, cat.name);
  }
  return { id: rootId, url: driveFolderUrl(rootId) };
}

export type DriveFile = { id: string; name: string; url?: string };

/** Sobe um arquivo (bytes) para uma pasta via multipart. */
export async function driveUploadFile(
  token: string,
  input: { name: string; mimeType: string; bytes: ArrayBuffer; parentId: string },
): Promise<DriveFile> {
  const boundary = `vio${Date.now().toString(36)}${Math.round(Math.random() * 1e9).toString(36)}`;
  const meta = JSON.stringify({ name: input.name, parents: [input.parentId] });
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${input.mimeType || "application/octet-stream"}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = new Blob([pre, input.bytes, post]);
  const res = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`, {
    method: "POST",
    headers: { ...auth(token), "Content-Type": `multipart/related; boundary=${boundary}` },
    cache: "no-store",
    body,
  });
  if (!res.ok) throw new Error(`drive: falha no upload (${res.status})`);
  const j = (await res.json()) as { id: string; name: string; webViewLink?: string };
  return { id: j.id, name: j.name, url: j.webViewLink };
}

/** Renomeia um arquivo/pasta. */
export async function driveRename(token: string, fileId: string, name: string): Promise<void> {
  const res = await fetch(`${DRIVE}/files/${fileId}?fields=id&supportsAllDrives=true`, {
    method: "PATCH",
    headers: { ...auth(token), "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`drive: falha ao renomear (${res.status})`);
}

/** Move um arquivo/pasta para a lixeira do Drive (reversível). */
export async function driveTrash(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE}/files/${fileId}?fields=id&supportsAllDrives=true`, {
    method: "PATCH",
    headers: { ...auth(token), "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok) throw new Error(`drive: falha ao excluir (${res.status})`);
}
