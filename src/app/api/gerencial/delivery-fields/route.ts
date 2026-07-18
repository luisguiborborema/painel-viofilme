import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryFormField } from "@/lib/data/operacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["text", "textarea", "number", "select", "date", "checkbox", "url"]);

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "").slice(0, 40) || "campo";
}

/** Campos personalizados do board (default 'entregas'). */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const board = req.nextUrl.searchParams.get("board") ?? "entregas";
  if (!isSupabaseConfigured()) return NextResponse.json({ fields: [] });
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_form_fields")
    .select("id, field_key, label, field_type, options, required, position, active")
    .eq("board", board)
    .eq("active", true)
    .order("position");
  const fields: DeliveryFormField[] = ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    id: String(f.id),
    fieldKey: String(f.field_key),
    label: String(f.label),
    fieldType: f.field_type as DeliveryFormField["fieldType"],
    options: Array.isArray(f.options) ? (f.options as { value: string; label: string }[]) : [],
    required: !!f.required,
    position: Number(f.position ?? 0),
    active: !!f.active,
  }));
  return NextResponse.json({ fields });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: {
    action?: "create" | "delete";
    id?: string;
    board?: string;
    label?: string;
    fieldType?: string;
    options?: { value: string; label: string }[];
    required?: boolean;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const board = b.board ?? "entregas";

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    // soft delete: mantém dados existentes no custom_fields
    const { error } = await supabase.from("delivery_form_fields").update({ active: false }).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  const label = (b.label ?? "").trim();
  const fieldType = b.fieldType && TYPES.has(b.fieldType) ? b.fieldType : "text";
  if (!label) return NextResponse.json({ error: "label obrigatório" }, { status: 400 });
  const fieldKey = `${slug(label)}_${Date.now().toString(36).slice(-4)}`;
  const { data: last } = await supabase
    .from("delivery_form_fields")
    .select("position")
    .eq("board", board)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (Number((last as { position: number } | null)?.position ?? 0)) + 1;

  const { data, error } = await supabase
    .from("delivery_form_fields")
    .insert({
      board,
      field_key: fieldKey,
      label,
      field_type: fieldType,
      options: fieldType === "select" && Array.isArray(b.options) ? b.options : [],
      required: !!b.required,
      position,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id, fieldKey });
}
