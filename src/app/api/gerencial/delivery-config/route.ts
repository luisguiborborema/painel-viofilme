import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getDeliveryConfig } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const config = await getDeliveryConfig();
  return NextResponse.json({ config });
}

type Body = {
  action?: "set-capacity" | "set-duration" | "set-default-assignee" | "set-sla" | "set-card-fields";
  capacityPerDay?: number;
  type?: string;
  minutes?: number;
  assignee?: string;
  days?: number;
  fields?: string[];
};

/** Ajusta capacidade (ENT12) ou duração default de um tipo (ENT10). */
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

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (b.action === "set-capacity") {
    const cap = Math.max(1, Math.min(50, Math.round(Number(b.capacityPerDay) || 0)));
    const { error } = await supabase
      .from("delivery_settings")
      .upsert({ id: 1, capacity_per_day: cap, updated_at: now }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, capacityPerDay: cap });
  }

  if (b.action === "set-duration") {
    if (!b.type?.trim()) return NextResponse.json({ error: "tipo ausente" }, { status: 400 });
    const min = Math.max(5, Math.min(600, Math.round(Number(b.minutes) || 0)));
    const { error } = await supabase
      .from("task_types")
      .update({ default_duration_min: min })
      .eq("name", b.type.trim());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, type: b.type.trim(), minutes: min });
  }

  if (b.action === "set-default-assignee") {
    if (!b.type?.trim()) return NextResponse.json({ error: "tipo ausente" }, { status: 400 });
    const { error } = await supabase
      .from("task_types")
      .update({ default_assignee: b.assignee?.trim() || null })
      .eq("name", b.type.trim());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (b.action === "set-card-fields") {
    const fields = Array.isArray(b.fields) ? b.fields.filter((f) => typeof f === "string").slice(0, 20) : [];
    const { error } = await supabase
      .from("delivery_settings")
      .upsert({ id: 1, card_fields: fields, updated_at: now }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, fields });
  }

  if (b.action === "set-sla") {
    if (!b.type?.trim()) return NextResponse.json({ error: "tipo ausente" }, { status: 400 });
    const days = Math.max(0, Math.min(60, Math.round(Number(b.days) || 0)));
    const { error } = await supabase
      .from("task_types")
      .update({ sla_days: days || null })
      .eq("name", b.type.trim());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, type: b.type.trim(), days });
  }

  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}
