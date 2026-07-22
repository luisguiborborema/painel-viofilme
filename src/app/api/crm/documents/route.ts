import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCrmDocuments } from "@/lib/data/queries";
import { CRM_DOCUMENT_KINDS } from "@/lib/data/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(CRM_DOCUMENT_KINDS.map((k) => k.key));

/** Lista documentos do Comercial (por negócio, empresa, ou todos). */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const dealId = req.nextUrl.searchParams.get("dealId") ?? undefined;
  const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
  const documents = await getCrmDocuments({ dealId, companyId });
  return NextResponse.json({ documents });
}

type Body = {
  action?: "add" | "delete";
  id?: string;
  dealId?: string;
  companyId?: string;
  title?: string;
  url?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  kind?: string;
};

/** Registra o metadado de um documento (após upload no bucket) ou remove. */
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
    const { error } = await supabase.from("crm_documents").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // add — precisa de um vínculo (negócio ou empresa) + título + url.
  if ((!b.dealId && !b.companyId) || !b.title?.trim() || !b.url?.trim()) {
    return NextResponse.json({ error: "vínculo (negócio/empresa), título e arquivo são obrigatórios" }, { status: 400 });
  }
  const kind = b.kind && KINDS.has(b.kind) ? b.kind : "outro";
  const { data, error } = await supabase
    .from("crm_documents")
    .insert({
      deal_id: b.dealId ?? null,
      company_id: b.companyId ?? null,
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
