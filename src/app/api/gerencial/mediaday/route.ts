import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getMediaDayView } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAPTURE = new Set(["pending", "done", "reshoot"]);
const FOOTAGE = new Set(["awaiting", "raw_delivered", "editing", "final"]);
const SESSION_STATUS = new Set(["planning", "ready", "shot", "delivered"]);

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  const mediaDay = await getMediaDayView(clientId);
  return NextResponse.json({ mediaDay });
}

type Body = {
  action?: "save-plan" | "set-capture" | "add-raw" | "set-footage";
  clientId?: string;
  postId?: string;
  taskId?: string;
  status?: string;
  url?: string;
  // save-plan
  scheduledLabel?: string;
  location?: string;
  team?: string;
  equipment?: string;
  notes?: string;
};

/** Persiste planejamento da sessão e o estado dos itens de captura. */
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
  if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Planejamento (Fase 1) — upsert da sessão do cliente.
  if (b.action === "save-plan") {
    const status = b.status && SESSION_STATUS.has(b.status) ? b.status : "planning";
    const { error } = await supabase.from("mediaday_sessions").upsert(
      {
        client_id: b.clientId,
        scheduled_label: b.scheduledLabel ?? null,
        location: b.location ?? null,
        team: b.team ?? null,
        equipment: b.equipment ?? null,
        notes: b.notes ?? null,
        status,
        updated_at: now,
      },
      { onConflict: "client_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // Daqui pra baixo tudo mexe num item (por post da LE).
  if (!b.postId) return NextResponse.json({ error: "postId ausente" }, { status: 400 });

  // Captura (Fase 2). "Capturado" avança a task de origem na LE.
  if (b.action === "set-capture") {
    if (!b.status || !CAPTURE.has(b.status)) {
      return NextResponse.json({ error: "status de captura inválido" }, { status: 400 });
    }
    const { error } = await supabase.from("mediaday_items").upsert(
      {
        client_id: b.clientId,
        post_id: b.postId,
        task_id: b.taskId ?? null,
        capture_status: b.status,
        updated_at: now,
      },
      { onConflict: "client_id,post_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Ao marcar "capturado", o post sai de "aguardando captação" (Backlog) e
    // avança para "Em produção" — libera o editor a trabalhar os brutos.
    let taskAdvanced = false;
    if (b.status === "done" && b.taskId) {
      const { data: t } = await supabase
        .from("delivery_tasks")
        .select("stage")
        .eq("id", b.taskId)
        .maybeSingle();
      if ((t as { stage: string | null } | null)?.stage === "todo") {
        await supabase
          .from("delivery_tasks")
          .update({ stage: "doing", updated_at: now })
          .eq("id", b.taskId);
        taskAdvanced = true;
      }
    }
    return NextResponse.json({ ok: true, persisted: true, taskAdvanced });
  }

  // Brutos (Fase 3) — anexa link e marca material como entregue.
  if (b.action === "add-raw") {
    if (!b.url?.trim()) return NextResponse.json({ error: "url ausente" }, { status: 400 });
    const { data: row } = await supabase
      .from("mediaday_items")
      .select("raw_assets")
      .eq("client_id", b.clientId)
      .eq("post_id", b.postId)
      .maybeSingle();
    const current = Array.isArray((row as { raw_assets: unknown } | null)?.raw_assets)
      ? ((row as { raw_assets: string[] }).raw_assets)
      : [];
    const next = [...current, b.url.trim()];
    const { error } = await supabase.from("mediaday_items").upsert(
      {
        client_id: b.clientId,
        post_id: b.postId,
        task_id: b.taskId ?? null,
        raw_assets: next,
        footage_status: "raw_delivered",
        updated_at: now,
      },
      { onConflict: "client_id,post_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, rawAssets: next });
  }

  // Progressão de pós-produção (brutos → edição → final).
  if (b.action === "set-footage") {
    if (!b.status || !FOOTAGE.has(b.status)) {
      return NextResponse.json({ error: "status de pós inválido" }, { status: 400 });
    }
    const { error } = await supabase.from("mediaday_items").upsert(
      {
        client_id: b.clientId,
        post_id: b.postId,
        task_id: b.taskId ?? null,
        footage_status: b.status,
        updated_at: now,
      },
      { onConflict: "client_id,post_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}
