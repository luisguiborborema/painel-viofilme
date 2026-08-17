import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getRhDocumentsView } from "@/lib/data/queries";
import { RH_DOCUMENT_KINDS } from "@/lib/data/rh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(RH_DOCUMENT_KINDS.map((k) => k.key));

type Body = {
  action?: "add" | "delete";
  id?: string;
  collaboratorId?: string;
  title?: string;
  url?: string;
  fileName?: string;
  fileType?: string | null;
  fileSize?: number;
  kind?: string;
};

/** GET: lista os documentos de um colaborador. */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const collaboratorId = req.nextUrl.searchParams.get("collaboratorId");
  if (!collaboratorId) return NextResponse.json({ error: "collaboratorId ausente" }, { status: 400 });
  const documents = await getRhDocumentsView(collaboratorId);
  return NextResponse.json({ documents });
}

/** POST: adiciona/exclui documento admissional. Só gerencial. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  try {
    if (b.action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("rh_documents").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, persisted: true });
    }

    if (!b.collaboratorId || !b.title?.trim() || !b.url?.trim()) {
      return NextResponse.json({ error: "collaboratorId/title/url ausente" }, { status: 400 });
    }
    const kind = b.kind && KINDS.has(b.kind) ? b.kind : "outro";
    const { data, error } = await supabase
      .from("rh_documents")
      .insert({
        collaborator_id: b.collaboratorId,
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
    if (error) throw error;
    return NextResponse.json({ ok: true, persisted: true, id: data.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/rh_documents.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json(
        { error: "Tabela de documentos do RH ainda não existe. Rode a migração 0115_rh_documents.sql." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
