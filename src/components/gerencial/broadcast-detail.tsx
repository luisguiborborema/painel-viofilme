"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Pause, Play, Send, Trash2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { broadcastProgress, statusLabel, statusTone, type BroadcastDetail as TBroadcastDetail, type RecipientStatus } from "@/lib/data/broadcasts";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const RECIPIENT_TONE: Record<RecipientStatus, string> = {
  pending: "text-muted",
  sent: "text-emerald-600",
  failed: "text-rose-600",
  skipped: "text-amber-600",
};

export function BroadcastDetail({ broadcast }: { broadcast: TBroadcastDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const pct = broadcastProgress(broadcast);

  // Enquanto envia, atualiza a página periodicamente para acompanhar o progresso.
  useEffect(() => {
    if (broadcast.status !== "sending") return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [broadcast.status, router]);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    try {
      const res = await fetch("/api/gerencial/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: broadcast.id, ...extra }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.error ?? "Não foi possível concluir.", "error");
        return;
      }
      if (action === "delete") {
        router.push("/gerencial/comercial/disparos");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const canSend = broadcast.status === "draft" || broadcast.status === "scheduled" || broadcast.status === "paused";
  const pendingCount = broadcast.recipients.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/gerencial/comercial/disparos" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Disparos
        </Link>
        <div className="flex items-center gap-2">
          {broadcast.status === "sending" && (
            <button onClick={() => act("pause")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60">
              {busy === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Pausar
            </button>
          )}
          {broadcast.status === "paused" && (
            <button onClick={() => act("resume")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60">
              {busy === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Retomar
            </button>
          )}
          {canSend && (
            <button onClick={() => act("send")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar agora
            </button>
          )}
          <button onClick={() => { if (window.confirm("Excluir este disparo?")) act("delete"); }} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-ink">{broadcast.title}</h1>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone(broadcast.status))}>{statusLabel(broadcast.status)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Criado {fmtDate(broadcast.createdAt)}{broadcast.scheduledFor ? ` · agendado ${fmtDate(broadcast.scheduledFor)}` : ""}{broadcast.createdBy ? ` · por ${broadcast.createdBy}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-ink">{broadcast.sent}<span className="text-base font-normal text-muted">/{broadcast.total}</span></p>
            <p className="text-[11px] text-muted">enviados{broadcast.failed > 0 ? ` · ${broadcast.failed} falhou` : ""}{pendingCount > 0 ? ` · ${pendingCount} na fila` : ""}</p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-4 whitespace-pre-wrap rounded-xl bg-subtle px-3 py-2 text-sm text-ink">{broadcast.message || "(sem texto)"}</div>
        {broadcast.mediaUrl && <p className="mt-2 truncate text-xs text-muted">Mídia ({broadcast.mediaType}): {broadcast.mediaUrl}</p>}
        <p className="mt-2 text-[11px] text-muted">Intervalo entre envios: {broadcast.delaySeconds}s</p>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-4 py-2.5">
          <p className="text-sm font-semibold text-ink">Destinatários ({broadcast.recipients.length})</p>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          <ul className="divide-y divide-line">
            {broadcast.recipients.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2">
                <span className={cn("shrink-0", RECIPIENT_TONE[r.status])}>
                  {r.status === "sent" ? <CheckCircle2 className="h-4 w-4" /> : r.status === "failed" ? <XCircle className="h-4 w-4" /> : <span className="block h-2 w-2 rounded-full bg-current" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{r.name || r.target}</p>
                  <p className="truncate text-[11px] text-muted">{r.kind === "group" ? "Grupo" : "Número"} · {r.target}{r.error ? ` · ${r.error}` : ""}</p>
                </div>
                <span className={cn("shrink-0 text-[11px] font-medium", RECIPIENT_TONE[r.status])}>
                  {r.status === "sent" ? "Enviado" : r.status === "failed" ? "Falhou" : r.status === "skipped" ? "Pulado" : "Na fila"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
