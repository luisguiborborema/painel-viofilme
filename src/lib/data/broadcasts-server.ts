import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Broadcast,
  BroadcastDetail,
  BroadcastMediaType,
  BroadcastMsgType,
  BroadcastRecipient,
  BroadcastStatus,
  RecipientKind,
  RecipientStatus,
} from "./broadcasts";

const COLS =
  "id, title, message, msg_type, media_url, media_type, instance_token, instance_name, delay_min_seconds, delay_max_seconds, ai_rewrite, status, scheduled_for, total, sent, failed, created_by, created_at, updated_at, started_at, finished_at";

function toBroadcast(r: Record<string, unknown>): Broadcast {
  return {
    id: String(r.id),
    title: String(r.title ?? "Disparo"),
    message: String(r.message ?? ""),
    msgType: String(r.msg_type ?? "text") as BroadcastMsgType,
    mediaUrl: r.media_url ? String(r.media_url) : null,
    mediaType: (r.media_type ? String(r.media_type) : null) as BroadcastMediaType | null,
    instanceToken: r.instance_token ? String(r.instance_token) : null,
    instanceName: r.instance_name ? String(r.instance_name) : null,
    delayMin: Number(r.delay_min_seconds ?? 3),
    delayMax: Number(r.delay_max_seconds ?? 8),
    aiRewrite: Boolean(r.ai_rewrite),
    status: String(r.status ?? "draft") as BroadcastStatus,
    scheduledFor: r.scheduled_for ? String(r.scheduled_for) : null,
    total: Number(r.total ?? 0),
    sent: Number(r.sent ?? 0),
    failed: Number(r.failed ?? 0),
    createdBy: r.created_by ? String(r.created_by) : "",
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
    startedAt: r.started_at ? String(r.started_at) : null,
    finishedAt: r.finished_at ? String(r.finished_at) : null,
  };
}

export async function getBroadcasts(): Promise<Broadcast[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("broadcasts").select(COLS).order("created_at", { ascending: false }).limit(200);
    const list = (data ?? []).map((r) => toBroadcast(r as Record<string, unknown>));

    // Amostra de erro para os disparos com falha (1 query só).
    const failedIds = list.filter((b) => b.failed > 0).map((b) => b.id);
    if (failedIds.length > 0) {
      const { data: errs } = await supabase
        .from("broadcast_recipients")
        .select("broadcast_id, target, error")
        .in("broadcast_id", failedIds)
        .eq("status", "failed")
        .limit(2000);
      const sample = new Map<string, string>();
      for (const e of errs ?? []) {
        const bid = String((e as { broadcast_id?: unknown }).broadcast_id ?? "");
        if (bid && !sample.has(bid)) {
          const t = String((e as { target?: unknown }).target ?? "");
          const msg = String((e as { error?: unknown }).error ?? "").trim();
          sample.set(bid, `${t}${msg ? `: ${msg}` : ""}`);
        }
      }
      for (const b of list) b.errorSample = sample.get(b.id) ?? null;
    }
    return list;
  } catch {
    return [];
  }
}

export async function getBroadcast(id: string): Promise<BroadcastDetail | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("broadcasts").select(COLS).eq("id", id).maybeSingle();
    if (!data) return null;
    const { data: recs } = await supabase
      .from("broadcast_recipients")
      .select("id, kind, target, name, vars, status, error, sent_at")
      .eq("broadcast_id", id)
      .order("status", { ascending: true })
      .limit(2000);
    const recipients: BroadcastRecipient[] = (recs ?? []).map((r) => ({
      id: String(r.id),
      kind: String(r.kind ?? "number") as RecipientKind,
      target: String(r.target ?? ""),
      name: r.name ? String(r.name) : "",
      vars: r.vars && typeof r.vars === "object" ? (r.vars as Record<string, string>) : {},
      status: String(r.status ?? "pending") as RecipientStatus,
      error: r.error ? String(r.error) : null,
      sentAt: r.sent_at ? String(r.sent_at) : null,
    }));
    return { ...toBroadcast(data as Record<string, unknown>), recipients };
  } catch {
    return null;
  }
}
