import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "add" | "remove" | "setPrimary";
  dealId?: string;
  contactId?: string;
  role?: string;
};

/** Associa/desassocia contatos a um negócio (crm_deal_contacts). */
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

  if (!body.dealId || !body.contactId) {
    return NextResponse.json({ error: "dealId/contactId ausente" }, { status: 400 });
  }
  const action = body.action ?? "add";

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();

  if (action === "remove") {
    const { error } = await supabase
      .from("crm_deal_contacts")
      .delete()
      .eq("deal_id", body.dealId)
      .eq("contact_id", body.contactId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "setPrimary") {
    await supabase
      .from("crm_leads")
      .update({ primary_contact_id: body.contactId })
      .eq("id", body.dealId);
    await supabase
      .from("crm_deal_contacts")
      .update({ is_primary: false })
      .eq("deal_id", body.dealId);
    await supabase
      .from("crm_deal_contacts")
      .upsert(
        { deal_id: body.dealId, contact_id: body.contactId, is_primary: true },
        { onConflict: "deal_id,contact_id" },
      );
    return NextResponse.json({ ok: true, persisted: true });
  }

  // add
  const { error } = await supabase
    .from("crm_deal_contacts")
    .upsert(
      { deal_id: body.dealId, contact_id: body.contactId, role: body.role ?? null },
      { onConflict: "deal_id,contact_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
