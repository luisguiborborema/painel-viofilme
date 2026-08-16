/**
 * Cliente do Google Drive (server-only), escopo drive.file: a plataforma cria
 * e gerencia as pastas/arquivos que ela mesma cria — não acessa arquivos
 * pré-existentes do usuário (isso exigiria escopo restrito + verificação).
 * A conta é a mesma conexão "agency" do Calendar (getValidAccess).
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

/** Cria uma pasta no Drive (opcionalmente dentro de parentId). Retorna o id. */
export async function driveCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
  const res = await fetch(`${DRIVE}/files?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`drive: falha ao criar pasta (${res.status})`);
  const j = (await res.json()) as { id: string };
  return j.id;
}

export type DriveFile = { id: string; name: string; url?: string };

/** Sobe um arquivo (bytes) para uma pasta do Drive via multipart. */
export async function driveUploadFile(
  token: string,
  input: { name: string; mimeType: string; bytes: ArrayBuffer; parentId: string },
): Promise<DriveFile> {
  const boundary = `vio${Date.now().toString(36)}${Math.round(Math.random() * 1e9).toString(36)}`;
  const meta = JSON.stringify({ name: input.name, parents: [input.parentId] });
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${input.mimeType || "application/octet-stream"}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = new Blob([pre, input.bytes, post]);
  const res = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    cache: "no-store",
    body,
  });
  if (!res.ok) throw new Error(`drive: falha no upload (${res.status})`);
  const j = (await res.json()) as { id: string; name: string; webViewLink?: string };
  return { id: j.id, name: j.name, url: j.webViewLink };
}
