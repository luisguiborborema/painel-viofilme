import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Broadcast,
  BroadcastDetail,
  BroadcastMediaType,
  BroadcastRecipient,
  BroadcastStatus,
  RecipientKind,
  RecipientStatus,
} from "./broadcasts";

const COLS =
  "id, title, message, media_url, media_type, delay_seconds, status, scheduled_for, total, sent, failed, created_by, created_at, updated_at, started_at, finished_at";

function toBroadcast(r: Record<string, unknown>): Broadcast {
  return {
    id: String(r.id),
    title: String(r.title ?? "Disparo"),
    message: String(r.message ?? ""),
    mediaUrl: r.media_url ? String(r.media_url) : null,
    mediaType: (r.media_type ? String(r.media_type) : null) as BroadcastMediaType | null,
    delaySeconds: Number(r.delay_seconds ?? 8),
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
    return (data ?? []).map((r) => toBroadcast(r as Record<string, unknown>));
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
      .select("id, kind, target, name, status, error, sent_at")
      .eq("broadcast_id", id)
      .order("status", { ascending: true })
      .limit(2000);
    const recipients: BroadcastRecipient[] = (recs ?? []).map((r) => ({
      id: String(r.id),
      kind: String(r.kind ?? "number") as RecipientKind,
      target: String(r.target ?? ""),
      name: r.name ? String(r.name) : "",
      status: String(r.status ?? "pending") as RecipientStatus,
      error: r.error ? String(r.error) : null,
      sentAt: r.sent_at ? String(r.sent_at) : null,
    }));
    return { ...toBroadcast(data as Record<string, unknown>), recipients };
  } catch {
    return null;
  }
}
