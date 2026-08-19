/**
 * Motor de disparos (server-only). Processa broadcasts em lotes, respeitando o
 * intervalo anti-ban, dentro de um orçamento de tempo (limite de função da
 * Vercel). Chamado tanto pelo cron (/api/broadcasts/process) quanto pelo
 * "enviar agora" (dá feedback imediato dos primeiros envios). O restante segue
 * pelo agendador do Supabase (pg_cron → /api/broadcasts/process).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { sendWhatsappMediaTo, sendWhatsappTo, type WaMediaType } from "@/lib/whatsapp/send";
import { personalize } from "./broadcasts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BATCH = 5;

async function countBy(admin: SupabaseClient, id: string, status?: string): Promise<number> {
  let q = admin.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", id);
  if (status) q = q.eq("status", status);
  const { count } = await q;
  return count ?? 0;
}

/** Recalcula contadores; se não há mais pendentes, marca como concluído. */
async function recount(admin: SupabaseClient, id: string): Promise<number> {
  const [total, sent, failed, pending] = await Promise.all([
    countBy(admin, id),
    countBy(admin, id, "sent"),
    countBy(admin, id, "failed"),
    countBy(admin, id, "pending"),
  ]);
  const patch: Record<string, unknown> = { total, sent, failed, updated_at: new Date().toISOString() };
  if (pending === 0) {
    patch.status = "done";
    patch.finished_at = new Date().toISOString();
  }
  await admin.from("broadcasts").update(patch).eq("id", id);
  return pending;
}

export type RunResult = { ok: boolean; reason?: string; processed: number; sent: number; failed: number };

export async function runBroadcasts(opts: { onlyId?: string; budgetMs?: number } = {}): Promise<RunResult> {
  if (!hasServiceRole()) return { ok: false, reason: "sem service role", processed: 0, sent: 0, failed: 0 };
  const admin = createAdminClient();
  const deadline = Date.now() + Math.max(5000, Math.min(opts.budgetMs ?? 45000, 290_000));
  const nowIso = new Date().toISOString();

  // 1) Promove agendados vencidos → enviando.
  {
    let q = admin.from("broadcasts").update({ status: "sending", started_at: nowIso }).eq("status", "scheduled").lte("scheduled_for", nowIso);
    if (opts.onlyId) q = q.eq("id", opts.onlyId);
    await q;
  }

  // 2) Broadcasts em envio.
  let sel = admin.from("broadcasts").select("id, message, media_url, media_type, delay_seconds").eq("status", "sending");
  if (opts.onlyId) sel = sel.eq("id", opts.onlyId);
  const { data: active } = await sel.order("started_at", { ascending: true }).limit(5);

  let sent = 0;
  let failed = 0;
  let processed = 0;

  for (const b of active ?? []) {
    const id = String(b.id);
    const delayMs = Math.max(0, Math.min(Number(b.delay_seconds) || 8, 120)) * 1000;
    const mediaUrl = b.media_url ? String(b.media_url) : "";
    const mediaType = (b.media_type ? String(b.media_type) : "image") as WaMediaType;
    const message = String(b.message ?? "");

    while (Date.now() < deadline) {
      const { data: recs } = await admin
        .from("broadcast_recipients")
        .select("id, target, name")
        .eq("broadcast_id", id)
        .eq("status", "pending")
        .limit(BATCH);
      if (!recs || recs.length === 0) {
        await recount(admin, id);
        break;
      }
      for (const r of recs) {
        if (Date.now() >= deadline) break;
        const target = String(r.target ?? "");
        const text = personalize(message, r.name ? String(r.name) : "");
        let ok = false;
        try {
          ok = mediaUrl
            ? await sendWhatsappMediaTo(target, mediaType, mediaUrl, { caption: text })
            : await sendWhatsappTo(target, text);
        } catch {
          ok = false;
        }
        await admin
          .from("broadcast_recipients")
          .update({ status: ok ? "sent" : "failed", sent_at: new Date().toISOString(), error: ok ? null : "envio recusado" })
          .eq("id", r.id);
        processed += 1;
        if (ok) sent += 1;
        else failed += 1;
        if (delayMs && Date.now() + delayMs < deadline) await sleep(delayMs);
      }
      await recount(admin, id);
    }
    // Fecha se já não há pendentes (caso saiu por deadline com a fila zerada).
    await recount(admin, id);
  }

  return { ok: true, processed, sent, failed };
}
