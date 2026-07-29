import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upload de anexo de comentário (bucket wa-media/task-files). Gerencial-only. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!hasServiceRole()) {
    return NextResponse.json({ error: "upload indisponível (sem service role)" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  }
  if (file.size > 16 * 1024 * 1024) {
    return NextResponse.json({ error: "arquivo acima de 16MB" }, { status: 413 });
  }

  const admin = createAdminClient();
  await admin.storage.createBucket("wa-media", { public: true, fileSizeLimit: "16MB" }).catch(() => {});

  const safeName = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "-").slice(0, 80) || "arquivo";
  const path = `task-files/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from("wa-media").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = admin.storage.from("wa-media").getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ ok: true, name: file.name, url });
}
