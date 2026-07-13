import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "avatars";

// Allowlist de formatos rasterizados. SVG fica de fora de propósito: em bucket
// público um SVG serve HTML/JS ativo a partir da origem do Storage.
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Remove os arquivos do usuário na pasta dele (exceto, opcionalmente, um path atual). */
async function removeUserFiles(
  admin: SupabaseClient,
  userId: string,
  exceptPath?: string,
): Promise<void> {
  const { data: list } = await admin.storage.from(BUCKET).list(userId);
  const paths = (list ?? [])
    .map((o) => `${userId}/${o.name}`)
    .filter((p) => p !== exceptPath);
  if (paths.length) {
    await admin.storage.from(BUCKET).remove(paths).catch(() => {});
  }
}

/** Envia a foto de perfil do usuário logado (Storage) e grava em profiles.avatar_url. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json(
      { error: "Upload de foto indisponível no modo demonstração." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "formato não suportado (use JPG, PNG, WebP ou GIF)" },
      { status: 400 },
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "imagem acima de 5MB" }, { status: 413 });
  }

  const admin = createAdminClient();
  await admin.storage
    .createBucket(BUCKET, { public: true, fileSizeLimit: "5MB" })
    .catch(() => {});

  // Path derivado do content-type validado (nunca do nome enviado pelo cliente).
  const path = `${user.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Remove fotos anteriores do usuário para não deixar órfãos públicos.
  await removeUserFiles(admin, user.id, path);

  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, url });
}

/** Remove a foto de perfil (volta às iniciais) — apaga o objeto do Storage também. */
export async function DELETE() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ error: "indisponível" }, { status: 503 });
  }
  const admin = createAdminClient();
  await removeUserFiles(admin, user.id);
  const { error } = await admin.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
