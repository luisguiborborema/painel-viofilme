import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "update" | "move";
  id?: string;
  stage?: string;
  stageId?: string;
  kind?: "open" | "won" | "lost";
  reason?: string;
  name?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  segment?: string;
  monthlyValue?: number;
  mediaBudget?: number;
  plan?: string;
  probability?: number;
  source?: string;
  owner?: string;
  bant?: Record<string, string>;
};

/** Cria, atualiza ou move (troca de estágio) um lead do CRM. */
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

  const action = body.action ?? (body.id ? "update" : "create");

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (action === "move") {
    if (!body.id || !body.stage) {
      return NextResponse.json({ error: "id/stage ausente" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {
      stage: body.stage,
      stage_changed_at: now,
      updated_at: now,
    };
    if (body.stageId) patch.stage_id = body.stageId;
    // won/lost pelo TIPO do estágio (kind), com fallback às keys padrão.
    const kind = body.kind ?? (body.stage === "ganho" ? "won" : body.stage === "perdido" ? "lost" : "open");
    if (kind === "lost") {
      patch.lost_at = now;
      patch.lost_reason = body.reason ?? null;
    } else if (kind === "won") {
      patch.won_at = now;
    }
    const { error } = await supabase.from("crm_leads").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  const payload: Record<string, unknown> = {
    name: body.name,
    contact_name: body.contactName ?? null,
    contact_phone: body.contactPhone?.replace(/\D/g, "") || null,
    contact_email: body.contactEmail ?? null,
    segment: body.segment ?? null,
    monthly_value: body.monthlyValue ?? 0,
    media_budget: body.mediaBudget ?? 0,
    plan: body.plan ?? null,
    probability: body.probability ?? 0,
    source: body.source ?? null,
    owner: body.owner ?? user.name,
    bant: body.bant ?? {},
    updated_at: now,
  };

  if (action === "create") {
    if (!body.name) {
      return NextResponse.json({ error: "nome ausente" }, { status: 400 });
    }
    payload.stage = body.stage ?? "prospeccao";
    payload.stage_changed_at = now;
    const { data, error } = await supabase
      .from("crm_leads")
      .insert(payload)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, id: data.id });
  }

  // update
  if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  const { error } = await supabase.from("crm_leads").update(payload).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
