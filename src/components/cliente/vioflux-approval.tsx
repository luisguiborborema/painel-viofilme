"use client";

import { useState } from "react";
import { Camera, CheckCircle2, Globe, Loader2, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FluxPost, FluxNetwork } from "@/lib/data/flux";

const NET_ICON: Record<FluxNetwork, typeof Camera> = { instagram: Camera, facebook: Globe };

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/cliente/vioflux", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return Boolean(res?.ok);
}

function PostRow({ p, onDone }: { p: FluxPost; onDone: (id: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "change">(null);

  async function approve() {
    setBusy("approve");
    if (await post({ action: "approve", id: p.id })) onDone(p.id);
    else setBusy(null);
  }
  async function requestChange() {
    if (!comment.trim()) return;
    setBusy("change");
    if (await post({ action: "request-change", id: p.id, comment: comment.trim() })) onDone(p.id);
    else setBusy(null);
  }

  return (
    <Card className="overflow-hidden">
      {p.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.mediaUrl} alt={p.title} className="h-44 w-full object-cover" />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-subtle text-xs text-muted">Sem prévia de mídia</div>
      )}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{p.title}</p>
            <p className="text-xs text-muted">{p.format}</p>
          </div>
          <span className="flex items-center gap-1 text-muted">
            {p.networks.map((n) => {
              const Icon = NET_ICON[n];
              return <Icon key={n} className="h-3.5 w-3.5" />;
            })}
          </span>
        </div>
        {p.caption && <p className="rounded-lg bg-canvas p-3 text-sm text-ink/90">{p.caption}</p>}

        <div className="flex gap-2">
          <button
            onClick={approve}
            disabled={busy !== null}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aprovar
          </button>
          <button
            onClick={() => setAsking((a) => !a)}
            disabled={busy !== null}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60"
          >
            <MessageSquare className="h-4 w-4" /> Pedir ajuste
          </button>
        </div>
        {asking && (
          <div className="flex gap-1.5">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="O que ajustar?"
              className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-400"
            />
            <button
              onClick={requestChange}
              disabled={!comment.trim() || busy !== null}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy === "change" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar"}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function VioFluxApproval({ posts }: { posts: FluxPost[] }) {
  const [pending, setPending] = useState<FluxPost[]>(posts.filter((p) => p.state === "aguardando"));
  const done = (id: string) => setPending((prev) => prev.filter((p) => p.id !== id));

  if (pending.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Aguardando sua aprovação</h2>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600">{pending.length}</span>
      </div>
      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
        {pending.map((p) => <PostRow key={p.id} p={p} onDone={done} />)}
      </div>
    </div>
  );
}
