import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  clientId?: string;
  city?: string;
  csResponsavel?: string;
  contactName?: string;
  contactRole?: string;
  contactPhone?: string;
  contactEmail?: string;
  briefObjetivo?: string;
  briefTom?: string;
  briefPublico?: string;
  briefConcorrentes?: string;
  briefRestricoes?: string;
  contractModel?: string;
  driveFolderUrl?: string;
};

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** Contatos e briefing do cliente (gerencial). Persiste em colunas de `clients`. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId) {
    return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      city: clean(b.city),
      cs_responsavel: clean(b.csResponsavel),
      contact_name: clean(b.contactName),
      contact_role: clean(b.contactRole),
      contact_phone: clean(b.contactPhone),
      contact_email: clean(b.contactEmail),
      brief_objetivo: clean(b.briefObjetivo),
      brief_tom: clean(b.briefTom),
      brief_publico: clean(b.briefPublico),
      brief_concorrentes: clean(b.briefConcorrentes),
      brief_restricoes: clean(b.briefRestricoes),
      contract_model: b.contractModel === "pontual" ? "pontual" : "recorrente",
      drive_folder_url: clean(b.driveFolderUrl),
    })
    .eq("id", b.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
