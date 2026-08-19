"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Loader2, RefreshCw, RotateCw, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { broadcastProgress, statusLabel, statusTone, type Broadcast } from "@/lib/data/broadcasts";

type PillKey = "todos" | "enviados" | "enviando" | "agendados" | "erro" | "cancelados";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const selectCls = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

export function BroadcastHistory({ broadcasts }: { broadcasts: Broadcast[] }) {
  const router = useRouter();
  const [pill, setPill] = useState<PillKey>("todos");
  const [userF, setUserF] = useState("");
  const [instF, setInstF] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const users = useMemo(() => [...new Set(broadcasts.map((b) => b.createdBy).filter(Boolean))] as string[], [broadcasts]);
  const instances = useMemo(() => [...new Set(broadcasts.map((b) => b.instanceName).filter(Boolean))] as string[], [broadcasts]);

  const counts = useMemo(() => ({
    todos: broadcasts.length,
    enviados: broadcasts.filter((b) => b.status === "done").length,
    enviando: broadcasts.filter((b) => b.status === "sending").length,
    agendados: broadcasts.filter((b) => b.status === "scheduled").length,
    erro: broadcasts.filter((b) => b.failed > 0).length,
    cancelados: broadcasts.filter((b) => b.status === "canceled").length,
  }), [broadcasts]);

  const pills: { key: PillKey; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: counts.todos },
    { key: "enviados", label: "Enviados", count: counts.enviados },
    { key: "enviando", label: "Enviando", count: counts.enviando },
    { key: "agendados", label: "Agendados", count: counts.agendados },
    { key: "erro", label: "Com erro", count: counts.erro },
    { key: "cancelados", label: "Cancelados", count: counts.cancelados },
  ];

  const filtered = useMemo(() => broadcasts.filter((b) => {
    if (userF && b.createdBy !== userF) return false;
    if (instF && b.instanceName !== instF) return false;
    if (pill === "enviados") return b.status === "done";
    if (pill === "enviando") return b.status === "sending";
    if (pill === "agendados") return b.status === "scheduled";
    if (pill === "erro") return b.failed > 0;
    if (pill === "cancelados") return b.status === "canceled";
    return true;
  }), [broadcasts, pill, userF, instF]);

  async function retry(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/gerencial/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry-failed", id }),
      });
      if (!res.ok) { toast("Não foi possível reenviar.", "error"); return; }
      toast("Reenviando falhas…", "success");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{filtered.length} disparo(s)</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={userF} onChange={(e) => setUserF(e.target.value)} className={selectCls}>
            <option value="">Todos os usuários</option>
            {users.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <select value={instF} onChange={(e) => setInstF(e.target.value)} className={selectCls}>
            <option value="">Todas as instâncias</option>
            {instances.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <button onClick={() => router.refresh()} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {pills.map((p) => (
          <button key={p.key} onClick={() => setPill(p.key)}
            className={cn("rounded-xl px-3 py-1.5 text-sm font-medium", pill === p.key ? "bg-ink text-white" : "border border-line bg-surface text-muted hover:text-ink")}>
            {p.label} ({p.count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">Nenhum disparo neste filtro.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const pct = broadcastProgress(b);
            const attempted = b.sent + b.failed;
            return (
              <Card key={b.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", statusTone(b.status))}>
                    {b.status === "done" && <CheckCircle2 className="h-3 w-3" />}{statusLabel(b.status)}
                  </span>
                  <span className="font-bold uppercase tracking-wide text-muted">{b.msgType}</span>
                  {b.instanceName && <span className="text-muted">· {b.instanceName}</span>}
                  {b.createdBy && <span className="text-muted">· por {b.createdBy}</span>}
                  <span className="ml-auto text-muted">{fmtDate(b.createdAt)}</span>
                </div>

                <Link href={`/gerencial/comercial/disparos/${b.id}`} className="mt-2 block">
                  <p className="line-clamp-2 text-sm text-ink">{b.message || "(sem texto)"}</p>
                </Link>

                <p className="mt-1.5 text-xs text-muted">
                  {b.total} destino(s){b.aiRewrite && <span className="ml-1 inline-flex items-center gap-0.5 text-brand-600"><Sparkles className="h-3 w-3" /> IA</span>}
                </p>

                {(attempted > 0 || b.status === "sending" || b.status === "done") && (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{b.sent}/{b.total} enviados{b.failed > 0 ? ` · ${b.failed} falha(s)` : ""}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                {b.failed > 0 && b.errorSample && (
                  <p className="mt-1.5 truncate text-xs text-rose-600">{b.errorSample}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a href={`/api/gerencial/broadcasts/${b.id}/log?type=log`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
                    <Download className="h-3.5 w-3.5" /> Baixar planilha de Log (.xlsx)
                  </a>
                  {b.failed > 0 && (
                    <button onClick={() => retry(b.id)} disabled={busy === b.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60">
                      {busy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />} Reenviar falhas ({b.failed})
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
