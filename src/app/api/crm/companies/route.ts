import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { tierHasFullAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "delete";
  id?: string;
  name?: string;
  segment?: string;
  website?: string;
  phone?: string;
  email?: string;
  city?: string;
  size?: string;
  owner?: string;
};

/** Cria (ou exclui) uma Empresa. Edição de campos usa /api/crm/object. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
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
    return NextResponse.json({ ok: true, persisted: false, id: `co-tmp-${Date.now()}` });
  }
  const supabase = await createClient();

  if (action === "delete") {
    if (!tierHasFullAccess(user.tier)) return NextResponse.json({ error: "Apenas Gestor ou Admin podem apagar empresas." }, { status: 403 });
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_companies").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "nome ausente" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("crm_companies")
    .insert({
      name: body.name.trim(),
      segment: body.segment ?? null,
      website: body.website ?? null,
      phone: body.phone?.replace(/\D/g, "") || null,
      email: body.email ?? null,
      city: body.city ?? null,
      size: body.size ?? null,
      owner: body.owner ?? user.name,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
