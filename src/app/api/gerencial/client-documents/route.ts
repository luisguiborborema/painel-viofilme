import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getClientDocumentsView } from "@/lib/data/queries";
import { DOCUMENT_KINDS } from "@/lib/data/operacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(DOCUMENT_KINDS.map((k) => k.key));

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  const documents = await getClientDocumentsView(clientId);
  return NextResponse.json({ documents });
}

type Body = {
  action?: "add" | "delete";
  id?: string;
  clientId?: string;
  title?: string;
  url?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  kind?: string;
};

/** Registra o metadado de um documento (após upload) ou remove um existente. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("client_documents").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // add
  if (!b.clientId || !b.title?.trim() || !b.url?.trim()) {
    return NextResponse.json({ error: "clientId/title/url ausente" }, { status: 400 });
  }
  const kind = b.kind && KINDS.has(b.kind) ? b.kind : "outro";
  const { data, error } = await supabase
    .from("client_documents")
    .insert({
      client_id: b.clientId,
      title: b.title.trim(),
      url: b.url.trim(),
      file_name: b.fileName ?? null,
      file_type: b.fileType ?? null,
      file_size: b.fileSize ?? null,
      kind,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
