import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  name?: string;
  role?: string;
  squad?: string;
  contractType?: string;
  salary?: number;
  admissionDate?: string;
  email?: string;
  phone?: string;
  vacationDue?: string;
  weeklyLoadPct?: number;
  hourLimit?: number;
  pdiActive?: boolean;
  reviewPending?: boolean;
};

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

/** Monta as colunas nativas a partir das chaves presentes no corpo. */
function toFields(b: Body): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (b.name !== undefined && b.name.trim()) f.name = b.name.trim();
  if ("role" in b) f.role = clean(b.role);
  if ("squad" in b) f.squad = clean(b.squad);
  if ("contractType" in b) f.contract_type = b.contractType === "pj" ? "pj" : "clt";
  if ("salary" in b) f.salary = Number(b.salary) || 0;
  if ("admissionDate" in b) f.admission_date = clean(b.admissionDate);
  if ("email" in b) f.email = clean(b.email);
  if ("phone" in b) f.phone = clean(b.phone);
  if ("vacationDue" in b) f.vacation_due = clean(b.vacationDue);
  if ("weeklyLoadPct" in b) f.weekly_load_pct = Math.max(0, Math.round(Number(b.weeklyLoadPct) || 0));
  if ("hourLimit" in b) f.hour_limit = Number(b.hourLimit) || 8;
  if ("pdiActive" in b) f.pdi_active = !!b.pdiActive;
  if ("reviewPending" in b) f.review_pending = !!b.reviewPending;
  return f;
}

/** RH — cadastro de colaboradores (criar/editar/excluir). Só gerencial. */
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

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const action = b.action ?? "create";

  try {
    if (action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("collaborators").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch = toFields(b);
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("collaborators").update(patch).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // create
    if (!b.name?.trim()) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });
    const { data, error } = await supabase
      .from("collaborators")
      .insert(toFields(b))
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    // Tabela ainda não criada (migração 0111 não rodou).
    if (/relation .*collaborators.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json(
        { error: "Tabela de colaboradores ainda não existe. Rode a migração 0111_rh_collaborators.sql." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
