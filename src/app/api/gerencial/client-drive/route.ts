import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/google/config";
import { getValidAccess } from "@/lib/google/client";
import { clientDriveRoot, provisionClientDrive } from "@/lib/google/drive-store";
import {
  driveListChildren,
  driveCreateFolder,
  driveRename,
  driveTrash,
  driveGetName,
  parseDriveFolderId,
  driveEnsureClientMonth,
} from "@/lib/google/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "list" | "mkdir" | "rename" | "delete" | "provision";
  clientId?: string;
  folderId?: string;
  fileId?: string;
  name?: string;
};

/** Navega e edita a pasta do Google Drive do cliente (listar/criar/renomear/excluir). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Google não configurado" }, { status: 503 });
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const access = await getValidAccess();
  if (!access?.token) {
    return NextResponse.json({ error: "Google Drive não conectado. Reconecte o Google em Integrações." }, { status: 409 });
  }
  const token = access.token;
  const writable = !user.readOnly;

  try {
    const action = b.action ?? "list";

    if (action === "list") {
      if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
      let folderId = b.folderId;
      if (!folderId) {
        const root = await clientDriveRoot(b.clientId);
        if (!root) {
          return NextResponse.json({ connected: false, error: "sem-pasta" });
        }
        folderId = root;
        // Auto todo mês: garante a pasta do mês atual sob 01/02 ao abrir o Drive.
        if (writable) {
          const now = new Date();
          try {
            await driveEnsureClientMonth(token, root, now.getFullYear(), now.getMonth() + 1);
          } catch {
            /* não bloqueia a listagem se a criação do mês falhar */
          }
        }
      }
      const [info, entries] = await Promise.all([driveGetName(token, folderId), driveListChildren(token, folderId)]);
      return NextResponse.json({ connected: true, folderId, folderName: info?.name ?? "Drive", entries });
    }

    if (!writable) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });

    if (action === "provision") {
      if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
      const url = await provisionClientDrive(b.clientId);
      if (!url) {
        return NextResponse.json({ error: "Não foi possível criar a pasta. Verifique a conexão do Google." }, { status: 502 });
      }
      const folderId = parseDriveFolderId(url)!;
      const entries = await driveListChildren(token, folderId);
      const info = await driveGetName(token, folderId);
      return NextResponse.json({ connected: true, folderId, folderName: info?.name ?? "Drive", entries, url });
    }

    if (action === "mkdir") {
      if (!b.folderId || !b.name?.trim()) return NextResponse.json({ error: "pasta/nome ausente" }, { status: 400 });
      const id = await driveCreateFolder(token, b.name.trim().slice(0, 120), b.folderId);
      return NextResponse.json({ ok: true, id });
    }
    if (action === "rename") {
      if (!b.fileId || !b.name?.trim()) return NextResponse.json({ error: "id/nome ausente" }, { status: 400 });
      await driveRename(token, b.fileId, b.name.trim().slice(0, 200));
      return NextResponse.json({ ok: true });
    }
    if (action === "delete") {
      if (!b.fileId) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      await driveTrash(token, b.fileId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
