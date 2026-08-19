/**
 * Motor de disparos (server-only). Processa broadcasts em lotes, respeitando o
 * intervalo anti-ban aleatório, dentro de um orçamento de tempo (limite de
 * função da Vercel). Chamado pelo cron (/api/broadcasts/process) e pelo
 * "enviar agora". O restante segue pelo agendador do Supabase (pg_cron).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { sendWhatsappMediaTo, sendWhatsappTo, type WaConn, type WaMediaType } from "@/lib/whatsapp/send";
import { resolveInstance } from "@/lib/whatsapp/instances";
import { rewriteAntiBan } from "@/lib/ai/rewrite";
import { personalize, randomDelayMs } from "./broadcasts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BATCH = 5;

async function countBy(admin: SupabaseClient, id: string, status?: string): Promise<number> {
  let q = admin.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", id);
  if (status) q = q.eq("status", status);
  const { count } = await q;
  return count ?? 0;
}

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
  let sel = admin
    .from("broadcasts")
    .select("id, message, msg_type, media_url, media_type, instance_token, delay_min_seconds, delay_max_seconds, ai_rewrite")
    .eq("status", "sending");
  if (opts.onlyId) sel = sel.eq("id", opts.onlyId);
  const { data: active } = await sel.order("started_at", { ascending: true }).limit(5);

  let sent = 0;
  let failed = 0;
  let processed = 0;

  for (const b of active ?? []) {
    const id = String(b.id);
    const min = Number(b.delay_min_seconds ?? 3);
    const max = Number(b.delay_max_seconds ?? 8);
    const msgType = String(b.msg_type ?? "text");
    const isMedia = msgType !== "text";
    const mediaUrl = b.media_url ? String(b.media_url) : "";
    const mediaType = (String(b.media_type ?? msgType) || "image") as WaMediaType;
    const message = String(b.message ?? "");
    const aiRewrite = Boolean(b.ai_rewrite);
    const inst = resolveInstance(b.instance_token ? String(b.instance_token) : null);
    const conn: WaConn | undefined = inst ? { url: inst.url, token: inst.token } : undefined;

    while (Date.now() < deadline) {
      const { data: recs } = await admin
        .from("broadcast_recipients")
        .select("id, target, name, vars")
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
        const vars = (r.vars && typeof r.vars === "object" ? (r.vars as Record<string, string>) : {}) as Record<string, string>;
        let text = personalize(message, r.name ? String(r.name) : "", vars);
        if (aiRewrite && text.trim()) text = await rewriteAntiBan(text);

        let ok = false;
        try {
          if (isMedia && mediaUrl) {
            // Áudio não leva legenda: envia o áudio e, se houver texto, manda em seguida.
            if (mediaType === "audio") {
              ok = await sendWhatsappMediaTo(target, "audio", mediaUrl, undefined, conn);
              if (ok && text.trim()) await sendWhatsappTo(target, text, conn);
            } else {
              ok = await sendWhatsappMediaTo(target, mediaType, mediaUrl, { caption: text }, conn);
            }
          } else {
            ok = await sendWhatsappTo(target, text, conn);
          }
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
        const delay = randomDelayMs(min, max);
        if (delay && Date.now() + delay < deadline) await sleep(delay);
      }
      await recount(admin, id);
    }
    await recount(admin, id);
  }

  return { ok: true, processed, sent, failed };
}
