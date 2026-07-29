import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "delete";
  id?: string;
  employee?: string;
  workDate?: string;
  hours?: number;
  note?: string;
};

/** Apontamento de banco de horas (gerencial). */
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

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("hour_entries").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // create
  const employee = (b.employee ?? "").trim();
  const hours = Number(b.hours);
  if (!employee || !Number.isFinite(hours) || hours === 0) {
    return NextResponse.json(
      { error: "colaborador e horas (diferente de zero) são obrigatórios" },
      { status: 400 },
    );
  }
  const { data, error } = await supabase
    .from("hour_entries")
    .insert({
      employee,
      work_date: b.workDate || new Date().toISOString().slice(0, 10),
      hours,
      note: b.note?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
