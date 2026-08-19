import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { errorReason } from "./broadcasts";

export type InstanceStat = { name: string; sent: number; failed: number; total: number; rate: number };
export type DayStat = { day: string; sent: number; failed: number };
export type ReasonStat = { reason: string; count: number };
export type DeliveryStats = {
  periodDays: number;
  campaigns: number;
  totalSent: number;
  totalFailed: number;
  rate: number;
  byInstance: InstanceStat[];
  byDay: DayStat[];
  errorReasons: ReasonStat[];
  truncated: boolean;
};

const EMPTY: DeliveryStats = {
  periodDays: 0, campaigns: 0, totalSent: 0, totalFailed: 0, rate: 0,
  byInstance: [], byDay: [], errorReasons: [], truncated: false,
};

/** Agrega métricas de entrega dos disparos num período (dias; 0 = tudo). */
export async function getDeliveryStats(days: number): Promise<DeliveryStats> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const supabase = await createClient();
    const cutoff = days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString() : null;

    let bq = supabase.from("broadcasts").select("id, instance_name, created_at").order("created_at", { ascending: false }).limit(1000);
    if (cutoff) bq = bq.gte("created_at", cutoff);
    const { data: bcs } = await bq;
    const rows = (bcs ?? []) as { id: string; instance_name?: string | null }[];
    if (rows.length === 0) return { ...EMPTY, periodDays: days };

    const instByBroadcast = new Map<string, string>();
    for (const b of rows) instByBroadcast.set(String(b.id), String(b.instance_name ?? "Instância principal"));
    const ids = rows.map((b) => String(b.id));

    const LIMIT = 20_000;
    const { data: recs } = await supabase
      .from("broadcast_recipients")
      .select("broadcast_id, status, error, sent_at")
      .in("broadcast_id", ids)
      .in("status", ["sent", "failed"])
      .order("sent_at", { ascending: false })
      .limit(LIMIT);
    const list = (recs ?? []) as { broadcast_id: string; status: string; error?: string | null; sent_at?: string | null }[];

    let totalSent = 0;
    let totalFailed = 0;
    const inst = new Map<string, { sent: number; failed: number }>();
    const day = new Map<string, { sent: number; failed: number }>();
    const reasons = new Map<string, number>();

    for (const r of list) {
      const isSent = r.status === "sent";
      if (isSent) totalSent++; else totalFailed++;
      const iName = instByBroadcast.get(String(r.broadcast_id)) ?? "Instância principal";
      const ie = inst.get(iName) ?? { sent: 0, failed: 0 };
      if (isSent) ie.sent++; else ie.failed++;
      inst.set(iName, ie);

      if (r.sent_at) {
        const d = String(r.sent_at).slice(0, 10);
        const de = day.get(d) ?? { sent: 0, failed: 0 };
        if (isSent) de.sent++; else de.failed++;
        day.set(d, de);
      }
      if (!isSent) {
        const reason = errorReason(r.error);
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }
    }

    const attempted = totalSent + totalFailed;
    const byInstance: InstanceStat[] = [...inst.entries()]
      .map(([name, v]) => ({ name, sent: v.sent, failed: v.failed, total: v.sent + v.failed, rate: v.sent + v.failed > 0 ? Math.round((v.sent / (v.sent + v.failed)) * 100) : 0 }))
      .sort((a, b) => a.rate - b.rate || b.total - a.total);
    const byDay: DayStat[] = [...day.entries()].map(([d, v]) => ({ day: d, sent: v.sent, failed: v.failed })).sort((a, b) => a.day.localeCompare(b.day));
    const errorReasons: ReasonStat[] = [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

    return {
      periodDays: days,
      campaigns: rows.length,
      totalSent,
      totalFailed,
      rate: attempted > 0 ? Math.round((totalSent / attempted) * 1000) / 10 : 0,
      byInstance,
      byDay,
      errorReasons,
      truncated: list.length >= LIMIT,
    };
  } catch {
    return EMPTY;
  }
}
