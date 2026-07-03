import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "wa-media";

/** Recebe um arquivo (multipart) e devolve uma URL pública (Supabase Storage). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ error: "storage indisponível" }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const conversationId = String(form.get("conversationId") ?? "misc");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  }
  if (file.size > 16 * 1024 * 1024) {
    return NextResponse.json({ error: "arquivo acima de 16MB" }, { status: 413 });
  }

  const admin = createAdminClient();
  // Garante o bucket público (idempotente — ignora se já existe).
  await admin.storage
    .createBucket(BUCKET, { public: true, fileSizeLimit: "16MB" })
    .catch(() => {});

  const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
  const safe = `${conversationId}/${Date.now()}-${Math.round(
    file.size % 100000,
  )}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from(BUCKET).upload(safe, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(safe);
  return NextResponse.json({ ok: true, url: data.publicUrl, contentType: file.type });
}
