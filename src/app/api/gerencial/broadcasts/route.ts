import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { runBroadcasts } from "@/lib/data/broadcast-run";
import { resolveInstance } from "@/lib/whatsapp/instances";
import { cleanNumber, type BroadcastMsgType } from "@/lib/data/broadcasts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SheetRow = { number: string; name?: string; vars?: Record<string, string> };

type Audiences = {
  clients?: boolean;
  leads?: boolean;
  numbers?: string[];
  groups?: { jid: string; name?: string }[];
  rows?: SheetRow[];
};

type Body = {
  action?: "create" | "update" | "delete" | "send" | "schedule" | "pause" | "resume" | "retry-failed" | "cancel";
  id?: string;
  title?: string;
  message?: string;
  msgType?: string;
  mediaUrl?: string;
  instanceId?: string;
  delayMin?: number;
  delayMax?: number;
  aiRewrite?: boolean;
  scheduledFor?: string;
  mode?: "draft" | "now" | "scheduled";
  audiences?: Audiences;
};

const MSG_TYPES = new Set(["text", "image", "video", "audio", "document"]);
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

type Rec = { kind: "number" | "group"; target: string; name: string; vars: Record<string, string> };

/** Resolve os públicos escolhidos em destinatários únicos. */
async function buildRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  a: Audiences,
): Promise<Rec[]> {
  const out: Rec[] = [];
  const seen = new Set<string>();
  const push = (r: Rec) => {
    if (!r.target || seen.has(r.target)) return;
    seen.add(r.target);
    out.push(r);
  };

  if (a.clients) {
    const { data } = await supabase.from("clients").select("name, whatsapp").not("whatsapp", "is", null);
    for (const c of data ?? []) {
      const num = cleanNumber(String((c as { whatsapp?: string }).whatsapp ?? ""));
      if (num.length >= 12) push({ kind: "number", target: num, name: String((c as { name?: string }).name ?? ""), vars: {} });
    }
  }
  if (a.leads) {
    const { data } = await supabase.from("crm_leads").select("name, contact_name, contact_phone").not("contact_phone", "is", null);
    for (const l of data ?? []) {
      const row = l as { name?: string; contact_name?: string; contact_phone?: string };
      const num = cleanNumber(String(row.contact_phone ?? ""));
      if (num.length >= 12) push({ kind: "number", target: num, name: row.contact_name || row.name || "", vars: {} });
    }
  }
  for (const raw of a.numbers ?? []) {
    const num = cleanNumber(raw);
    if (num.length >= 12) push({ kind: "number", target: num, name: "", vars: {} });
  }
  for (const r of a.rows ?? []) {
    const num = cleanNumber(String(r.number ?? ""));
    if (num.length < 12) continue;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.vars ?? {})) vars[String(k)] = String(v ?? "");
    push({ kind: "number", target: num, name: String(r.name ?? ""), vars });
  }
  for (const g of a.groups ?? []) {
    const jid = String(g.jid ?? "").trim();
    if (jid.includes("@")) push({ kind: "group", target: jid, name: String(g.name ?? ""), vars: {} });
  }
  return out;
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  try {
    if (b.action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("broadcasts").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (b.action === "pause" || b.action === "resume") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const status = b.action === "pause" ? "paused" : "sending";
      const { error } = await supabase.from("broadcasts").update({ status, updated_at: new Date().toISOString() }).eq("id", b.id);
      if (error) throw error;
      if (b.action === "resume") runBroadcasts({ onlyId: b.id, budgetMs: 50_000 }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (b.action === "schedule") {
      if (!b.id || !b.scheduledFor) return NextResponse.json({ error: "id/data ausente" }, { status: 400 });
      const { error } = await supabase
        .from("broadcasts")
        .update({ status: "scheduled", scheduled_for: b.scheduledFor, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (b.action === "cancel") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      await supabase.from("broadcast_recipients").update({ status: "skipped" }).eq("broadcast_id", b.id).eq("status", "pending");
      const { error } = await supabase.from("broadcasts").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (b.action === "retry-failed") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error: e1 } = await supabase
        .from("broadcast_recipients")
        .update({ status: "pending", error: null, sent_at: null })
        .eq("broadcast_id", b.id)
        .eq("status", "failed");
      if (e1) throw e1;
      const { error } = await supabase
        .from("broadcasts")
        .update({ status: "sending", started_at: new Date().toISOString(), finished_at: null, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      if (error) throw error;
      const res = await runBroadcasts({ onlyId: b.id, budgetMs: 50_000 });
      return NextResponse.json({ ok: true, run: res });
    }

    if (b.action === "send") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase
        .from("broadcasts")
        .update({ status: "sending", started_at: new Date().toISOString(), scheduled_for: null, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      if (error) throw error;
      const res = await runBroadcasts({ onlyId: b.id, budgetMs: 50_000 });
      return NextResponse.json({ ok: true, run: res });
    }

    // create
    const recipients = await buildRecipients(supabase, b.audiences ?? {});
    if (recipients.length === 0) return NextResponse.json({ error: "Nenhum destinatário válido nos públicos escolhidos." }, { status: 400 });

    const mode = b.mode ?? "draft";
    const scheduledFor = mode === "scheduled" ? clean(b.scheduledFor) : null;
    const status = mode === "now" ? "sending" : mode === "scheduled" ? "scheduled" : "draft";
    const msgType: BroadcastMsgType = (b.msgType && MSG_TYPES.has(b.msgType) ? b.msgType : "text") as BroadcastMsgType;
    const isMedia = msgType !== "text";
    const mediaUrl = clean(b.mediaUrl);
    const inst = resolveInstance(b.instanceId ?? null);
    const dMin = Math.max(0, Math.min(Number(b.delayMin) || 3, 600));
    const dMax = Math.max(dMin, Math.min(Number(b.delayMax) || 8, 600));

    const { data: created, error } = await supabase
      .from("broadcasts")
      .insert({
        title: clean(b.title) ?? "Disparo",
        message: b.message?.trim() ?? "",
        msg_type: msgType,
        media_url: isMedia ? mediaUrl : null,
        media_type: isMedia ? (msgType === "audio" ? "audio" : msgType) : null,
        instance_token: inst?.id ?? null,
        instance_name: inst?.name ?? null,
        delay_min_seconds: dMin,
        delay_max_seconds: dMax,
        ai_rewrite: Boolean(b.aiRewrite),
        status,
        scheduled_for: scheduledFor,
        total: recipients.length,
        created_by: user.name || user.email || "",
        started_at: mode === "now" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const broadcastId = String(created.id);

    // Insere destinatários em lotes.
    for (let i = 0; i < recipients.length; i += 500) {
      const chunk = recipients.slice(i, i + 500).map((r) => ({
        broadcast_id: broadcastId,
        kind: r.kind,
        target: r.target,
        name: r.name || null,
        vars: r.vars && Object.keys(r.vars).length ? r.vars : {},
      }));
      const { error: e2 } = await supabase.from("broadcast_recipients").insert(chunk);
      if (e2) throw e2;
    }

    let run = null;
    if (mode === "now") run = await runBroadcasts({ onlyId: broadcastId, budgetMs: 48_000 });

    return NextResponse.json({ ok: true, id: broadcastId, total: recipients.length, run });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/broadcasts?.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json({ error: "Tabela ainda não existe. Rode a migração 0124_broadcasts.sql." }, { status: 409 });
    }
    if (/column .* does not exist|42703/i.test(msg)) {
      return NextResponse.json({ error: "Faltam colunas novas. Rode a migração 0125_broadcasts_v2.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
