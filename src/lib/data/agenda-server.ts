// Acesso a dados da Agenda (server-only). Dual-mode: Supabase ou vazio (demo).
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, RoutineBlock, RoutineTemplate, SchedulingLink } from "./agenda";

export async function getRoutineBlocks(ownerId: string): Promise<RoutineBlock[]> {
  if (!isSupabaseConfigured() || !ownerId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("routine_blocks")
    .select("id,template_id,owner_id,title,weekday,start_time,end_time,color,activity_type")
    .eq("owner_id", ownerId);
  return (data ?? []).map(mapBlock);
}

export async function getRoutineTemplates(ownerId: string): Promise<RoutineTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  // Modelos de cargo (is_base / owner null) + os pessoais do usuário.
  const { data } = await supabase
    .from("routine_templates")
    .select("id,name,role_or_squad,is_base,owner_id")
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
    .order("is_base", { ascending: false });
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    roleOrSquad: r.role_or_squad ? String(r.role_or_squad) : undefined,
    isBase: Boolean(r.is_base),
    ownerId: r.owner_id ? String(r.owner_id) : undefined,
  }));
}

export async function getSchedulingLinks(ownerId: string): Promise<SchedulingLink[]> {
  if (!isSupabaseConfigured() || !ownerId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduling_links")
    .select("id,url,label,active,slug,duration_min,buffer_min,days_ahead,availability")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: String(r.id),
    url: r.url ? String(r.url) : null,
    label: String(r.label),
    active: Boolean(r.active),
    slug: r.slug ? String(r.slug) : null,
    durationMin: r.duration_min != null ? Number(r.duration_min) : 30,
    bufferMin: r.buffer_min != null ? Number(r.buffer_min) : 0,
    daysAhead: r.days_ahead != null ? Number(r.days_ahead) : 14,
    availability: Array.isArray(r.availability)
      ? (r.availability as { day: number; start: string; end: string }[])
      : [],
  }));
}

export async function getCalendarEvents(ownerId: string, fromIso: string, toIso: string): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured() || !ownerId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("id,owner_id,title,type,start_at,end_at,deal_id,client_id,google_event_id,meet_link")
    .eq("owner_id", ownerId)
    .gte("start_at", fromIso)
    .lte("start_at", toIso);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    ownerId: r.owner_id ? String(r.owner_id) : undefined,
    title: String(r.title),
    type: String(r.type ?? "meeting"),
    startAt: String(r.start_at),
    endAt: r.end_at ? String(r.end_at) : undefined,
    dealId: r.deal_id ? String(r.deal_id) : undefined,
    clientId: r.client_id ? String(r.client_id) : undefined,
    googleEventId: r.google_event_id ? String(r.google_event_id) : undefined,
    meetLink: r.meet_link ? String(r.meet_link) : undefined,
  }));
}

function mapBlock(r: Record<string, unknown>): RoutineBlock {
  return {
    id: String(r.id),
    templateId: r.template_id ? String(r.template_id) : undefined,
    ownerId: r.owner_id ? String(r.owner_id) : undefined,
    title: String(r.title),
    weekday: Number(r.weekday ?? 1),
    startTime: String(r.start_time ?? "09:00"),
    endTime: String(r.end_time ?? "10:00"),
    color: String(r.color ?? "#2a63c9"),
    activityType: r.activity_type ? String(r.activity_type) : undefined,
  };
}
