import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE: Record<string, string> = {
  company: "crm_companies",
  contact: "crm_contacts",
  deal: "crm_leads",
};

type Body = {
  objectType?: "company" | "contact" | "deal";
  id?: string;
  properties?: Record<string, unknown>; // mapa COMPLETO de propriedades (merge no servidor)
  tags?: string[]; // ids de tag (substitui)
  fields?: Record<string, unknown>; // colunas nativas (name, segment, owner...) — opcional
};

/**
 * Atualiza propriedades customizadas (jsonb), tags e/ou campos nativos de um
 * objeto do CRM (empresa/contato/deal). Faz merge do jsonb no servidor.
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const table = body.objectType ? TABLE[body.objectType] : undefined;
  if (!table || !body.id) {
    return NextResponse.json({ error: "objectType/id inválido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.properties && typeof body.properties === "object") {
    // Merge: lê as propriedades atuais e sobrepõe as recebidas.
    const { data: cur } = await supabase
      .from(table)
      .select("properties")
      .eq("id", body.id)
      .maybeSingle();
    const existing = (cur?.properties as Record<string, unknown> | null) ?? {};
    patch.properties = { ...existing, ...body.properties };
  }
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if (body.fields && typeof body.fields === "object") {
    for (const [k, v] of Object.entries(body.fields)) patch[k] = v;
  }

  const { error } = await supabase.from(table).update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
