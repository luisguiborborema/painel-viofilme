"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DeliveryStats } from "@/lib/data/broadcast-stats";

const PERIODS: { key: number; label: string }[] = [
  { key: 7, label: "7 dias" },
  { key: 14, label: "14 dias" },
  { key: 30, label: "30 dias" },
  { key: 0, label: "Tudo" },
];

function rateColor(rate: number): string {
  if (rate < 50) return "text-rose-600";
  if (rate < 75) return "text-amber-600";
  if (rate < 95) return "text-yellow-600";
  return "text-emerald-600";
}

function dayLabel(iso: string): string {
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
}

export function BroadcastDelivery() {
  const [days, setDays] = useState(14);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(d: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/gerencial/broadcasts/stats?days=${d}`);
      const j = (await res.json().catch(() => null)) as DeliveryStats | null;
      setStats(j);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega stats ao trocar período
    load(days);
  }, [days]);

  const maxDay = stats ? Math.max(1, ...stats.byDay.map((d) => d.sent + d.failed)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{stats ? stats.campaigns : 0} disparo(s) no período{stats?.truncated ? " · amostra parcial" : ""}</p>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setDays(p.key)} className={cn("px-3 py-1.5 font-medium", days === p.key ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(days)} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Enviados</p><p className="mt-1 text-3xl font-bold text-ink">{stats?.totalSent ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Falhas</p><p className="mt-1 text-3xl font-bold text-rose-600">{stats?.totalFailed ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Taxa de sucesso</p><p className={cn("mt-1 text-3xl font-bold", rateColor(stats?.rate ?? 0))}>{stats?.rate ?? 0}%</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Disparos</p><p className="mt-1 text-3xl font-bold text-ink">{stats?.campaigns ?? 0}</p></Card>
      </div>

      {/* Por instância */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-ink">Por instância <span className="font-normal text-muted">· pior taxa primeiro</span></p>
        {!stats || stats.byInstance.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Sem envios no período.</p>
        ) : (
          <div className="space-y-3">
            {stats.byInstance.map((i) => (
              <div key={i.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-ink">{i.name}</span>
                  <span className="shrink-0 text-xs text-muted">{i.sent}/{i.total} · <b className={rateColor(i.rate)}>{i.rate}%</b>{i.failed > 0 ? ` · ${i.failed} falha(s)` : ""}</span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-subtle">
                  <div className="h-full bg-emerald-500" style={{ width: `${i.rate}%` }} />
                  <div className="h-full bg-rose-400" style={{ width: `${100 - i.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Por dia */}
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Por dia</p>
          {!stats || stats.byDay.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Sem dados.</p>
          ) : (
            <>
              <div className="flex h-40 items-end gap-1.5">
                {stats.byDay.map((d) => {
                  const total = d.sent + d.failed;
                  const h = Math.round((total / maxDay) * 100);
                  const sentH = total > 0 ? Math.round((d.sent / total) * 100) : 0;
                  return (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${dayLabel(d.day)} · ${d.sent} enviados · ${d.failed} falhas`}>
                      <div className="flex w-full flex-col justify-end overflow-hidden rounded-t bg-subtle" style={{ height: `${Math.max(3, h)}%` }}>
                        <div className="w-full bg-rose-400" style={{ height: `${100 - sentH}%` }} />
                        <div className="w-full bg-emerald-500" style={{ height: `${sentH}%` }} />
                      </div>
                      <span className="text-[9px] text-muted">{dayLabel(d.day)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Enviados</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Falhas</span>
              </div>
            </>
          )}
        </Card>

        {/* Motivos de erro */}
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Principais motivos de erro</p>
          {!stats || stats.errorReasons.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Nenhuma falha no período. 🎉</p>
          ) : (
            <ul className="divide-y divide-line">
              {stats.errorReasons.map((r) => (
                <li key={r.reason} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{r.reason}</span>
                  <span className="font-bold text-rose-600">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted">Contagem por destino (cada mensagem que falhou). Para o log completo, baixe a planilha no Histórico.</p>
        </Card>
      </div>
    </div>
  );
}
