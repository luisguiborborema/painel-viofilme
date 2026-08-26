import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX = 10 * 1024 * 1024; // 10 MB
const TIPOS = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic",
]);

/** Anexa comprovante/nota a um lançamento (bucket wa-media, como os demais). */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ error: "armazenamento indisponível" }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const alvo = String(form?.get("target") ?? ""); // "p-<uuid>" | "e-<uuid>"
  if (!(file instanceof File)) return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Arquivo acima de 10 MB." }, { status: 400 });
  if (file.type && !TIPOS.has(file.type)) {
    return NextResponse.json({ error: "Envie PDF ou imagem (PNG, JPG, WEBP)." }, { status: 400 });
  }
  if (!/^[pe]-[0-9a-f-]{36}$/i.test(alvo)) {
    return NextResponse.json({ error: "lançamento inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().slice(0, 8);
  const path = `financeiro/${alvo}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await admin.storage.from("wa-media").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const url = admin.storage.from("wa-media").getPublicUrl(path).data.publicUrl;

  // Grava a URL no lançamento — com a sessão do usuário, respeitando o RLS.
  const supabase = await createClient();
  const tabela = alvo.startsWith("p-") ? "payments" : "expenses";
  const { error: e2 } = await supabase
    .from(tabela)
    .update({ attachment_url: url })
    .eq("id", alvo.slice(2));
  if (e2) {
    if (/attachment_url|42703/i.test(e2.message)) {
      return NextResponse.json({ error: "Rode a migração 0136_finance_completo.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url });
}
