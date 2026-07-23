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
  action?: "add" | "delete" | "set-status" | "generate" | "zapsign";
  id?: string;
  dealId?: string;
  companyId?: string;
  title?: string;
  url?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  kind?: string;
  // Central de rastreio
  status?: string;
  value?: number;
  owner?: string;
  expiresAt?: string;
  templateId?: string;
  content?: string;
  // Geração a partir de modelo / ZapSign
  signerName?: string;
  signerEmail?: string;
};

const STATUSES = new Set(["draft", "sent", "viewed", "signed", "refused", "expired"]);
const STATUS_STAMP: Record<string, string> = { sent: "sent_at", viewed: "viewed_at", signed: "signed_at" };

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

  // set-status — muda o status manualmente (fallback à integração) e carimba a data.
  if (b.action === "set-status") {
    if (!b.id || !b.status || !STATUSES.has(b.status)) {
      return NextResponse.json({ error: "id/status inválido" }, { status: 400 });
    }
    const patch: Record<string, unknown> = { status: b.status };
    const stamp = STATUS_STAMP[b.status];
    if (stamp) patch[stamp] = new Date().toISOString();
    const { error } = await supabase.from("crm_documents").update(patch).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // generate — cria um documento a partir de um modelo (sem arquivo; só content).
  if (b.action === "generate") {
    if (!b.title?.trim()) return NextResponse.json({ error: "título ausente" }, { status: 400 });
    const kind = b.kind && KINDS.has(b.kind) ? b.kind : "proposta";
    const { data, error } = await supabase
      .from("crm_documents")
      .insert({
        deal_id: b.dealId ?? null,
        company_id: b.companyId ?? null,
        title: b.title.trim(),
        kind,
        content: b.content ?? null,
        template_id: b.templateId ?? null,
        value: b.value ?? null,
        owner: b.owner ?? user.name,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, id: data.id });
  }

  // zapsign — envia contrato para assinatura via Edge Function (casca).
  // A chamada externa sai da Edge Function (token nunca no cliente). Enquanto
  // desabilitada, devolve modo manual — o gerencial move o status na mão.
  if (b.action === "zapsign") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const fnUrl = process.env.ZAPSIGN_SEND_URL;
    if (fnUrl && b.signerEmail) {
      try {
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId: b.dealId, name: b.signerName, email: b.signerEmail }),
        });
        const out = (await res.json().catch(() => ({}))) as { externalId?: string; url?: string; enabled?: boolean };
        if (res.ok && out.enabled !== false) {
          await supabase
            .from("crm_documents")
            .update({ status: "sent", sent_at: new Date().toISOString(), external_id: out.externalId ?? null, url: out.url ?? null })
            .eq("id", b.id);
          return NextResponse.json({ ok: true, persisted: true, mode: "zapsign", url: out.url });
        }
      } catch {
        /* cai no modo manual abaixo */
      }
    }
    // Fallback manual: apenas marca como enviado.
    await supabase.from("crm_documents").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", b.id);
    return NextResponse.json({ ok: true, persisted: true, mode: "manual" });
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
      status: b.status && STATUSES.has(b.status) ? b.status : "draft",
      value: b.value ?? null,
      owner: b.owner ?? user.name,
      expires_at: b.expiresAt ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
