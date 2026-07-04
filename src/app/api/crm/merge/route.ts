import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  type?: "company" | "contact";
  primaryId?: string;
  mergeIds?: string[];
};

/**
 * Mescla duplicados no registro primário e apaga os demais.
 * Empresa: contatos e negócios apontam para o primário.
 * Contato: associações (deal_contacts) e primary_contact_id apontam p/ o primário.
 */
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
  const merges = (b.mergeIds ?? []).filter((id) => id && id !== b.primaryId);
  if (!b.type || !b.primaryId || !merges.length) {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();

  if (b.type === "company") {
    for (const id of merges) {
      await supabase.from("crm_contacts").update({ company_id: b.primaryId }).eq("company_id", id);
      await supabase.from("crm_leads").update({ company_id: b.primaryId }).eq("company_id", id);
      await supabase.from("crm_companies").delete().eq("id", id);
    }
    return NextResponse.json({ ok: true, merged: merges.length });
  }

  // contato
  for (const id of merges) {
    // deals ligados ao contato duplicado (via associação)
    const { data: rels } = await supabase
      .from("crm_deal_contacts").select("deal_id").eq("contact_id", id);
    for (const r of rels ?? []) {
      await supabase
        .from("crm_deal_contacts")
        .upsert({ deal_id: r.deal_id, contact_id: b.primaryId }, { onConflict: "deal_id,contact_id" });
    }
    await supabase.from("crm_deal_contacts").delete().eq("contact_id", id);
    await supabase.from("crm_leads").update({ primary_contact_id: b.primaryId }).eq("primary_contact_id", id);
    await supabase.from("crm_contacts").delete().eq("id", id);
  }
  return NextResponse.json({ ok: true, merged: merges.length });
}
