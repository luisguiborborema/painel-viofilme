import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/google/config";
import { uploadToClientDrive } from "@/lib/google/drive-store";
import { DRIVE_CATEGORIES } from "@/lib/google/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATS = new Set(DRIVE_CATEGORIES.map((c) => c.key));

/** Sobe um arquivo (postagem/ativo) para a pasta 00–04 do cliente no Google Drive. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google não configurado" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const clientId = String(form?.get("clientId") ?? "");
  const category = String(form?.get("category") ?? "00");
  if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "arquivo acima de 100MB" }, { status: 413 });
  const cat = CATS.has(category) ? category : "00";

  try {
    const bytes = await file.arrayBuffer();
    const uploaded = await uploadToClientDrive(clientId, cat, {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
    });
    return NextResponse.json({ ok: true, file: uploaded });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (msg === "google-desconectado") {
      return NextResponse.json(
        { error: "Google Drive não conectado. Vá em Integrações e (re)conecte o Google para habilitar o Drive." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
