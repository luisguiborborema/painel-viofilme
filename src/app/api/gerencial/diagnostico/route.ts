import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  templateId?: string;
  clientId?: string;
  leadId?: string;
  subject?: string;
  title?: string;
  answers?: Record<string, unknown>;
};

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

/** Diagnósticos (comercial + entregas): criar/editar/excluir. Só gerencial. */
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
      const { error } = await supabase.from("diagnostics").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // answers: mapa {id: string}
    const answers: Record<string, string> = {};
    if (b.answers && typeof b.answers === "object") {
      for (const [k, v] of Object.entries(b.answers)) answers[String(k)] = v == null ? "" : String(v);
    }

    if (b.action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch: Record<string, unknown> = { answers, updated_at: new Date().toISOString() };
      if (b.title !== undefined) patch.title = b.title.trim() || "Diagnóstico";
      if (b.subject !== undefined && b.subject.trim()) patch.subject = b.subject.trim();
      const { error } = await supabase.from("diagnostics").update(patch).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // create
    const subject = b.subject?.trim();
    if (!subject) return NextResponse.json({ error: "informe o cliente/empresa" }, { status: 400 });
    const { data, error } = await supabase
      .from("diagnostics")
      .insert({
        subject,
        title: b.title?.trim() || "Diagnóstico",
        template_id: clean(b.templateId),
        client_id: clean(b.clientId),
        lead_id: clean(b.leadId),
        answers,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/diagnostics.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json({ error: "Módulo ainda não ativado. Rode a migração 0122_diagnostics.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
