import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "delete";
  id?: string;
  name?: string;
  title?: string;
  phone?: string;
  email?: string;
  companyId?: string;
  isPrimary?: boolean;
  owner?: string;
};

/** Cria (ou exclui) um Contato. Edição de campos usa /api/crm/object. */
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

  const action = body.action ?? "create";

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false, id: `ct-tmp-${Date.now()}` });
  }
  const supabase = await createClient();

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_contacts").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "nome ausente" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      company_id: body.companyId ?? null,
      name: body.name.trim(),
      title: body.title ?? null,
      phone: body.phone?.replace(/\D/g, "") || null,
      email: body.email ?? null,
      is_primary: body.isPrimary ?? false,
      owner: body.owner ?? user.name,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
