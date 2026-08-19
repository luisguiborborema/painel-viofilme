"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, CalendarClock, History, Send, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TabNav, type TabItem } from "@/components/ui/tab-nav";
import { cn } from "@/lib/utils";
import { broadcastProgress, statusLabel, statusTone, type Broadcast } from "@/lib/data/broadcasts";
import { BroadcastComposer } from "./broadcast-composer";

type TabKey = "novo" | "agendados" | "historico" | "entrega";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function BroadcastRow({ b, dateField }: { b: Broadcast; dateField: "scheduled" | "created" }) {
  const pct = broadcastProgress(b);
  return (
    <li>
      <Link href={`/gerencial/comercial/disparos/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
          <Send className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{b.title}</p>
          <p className="truncate text-xs text-muted">{b.message || "(sem texto)"}</p>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <Users className="h-3.5 w-3.5" /> {b.total}
        </div>
        <div className="hidden w-28 sm:block">
          <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-0.5 text-right text-[10px] text-muted">{b.sent}/{b.total}{b.failed > 0 ? ` · ${b.failed} falhou` : ""}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone(b.status))}>{statusLabel(b.status)}</span>
        <span className="hidden shrink-0 text-xs text-muted md:block">{dateField === "scheduled" ? fmtDate(b.scheduledFor) : fmtDate(b.createdAt)}</span>
      </Link>
    </li>
  );
}

function EmptyList({ label }: { label: string }) {
  return <p className="py-12 text-center text-sm text-muted">{label}</p>;
}

export function BroadcastsWorkspace({
  broadcasts,
  clientsWithWa,
  leadsWithPhone,
}: {
  broadcasts: Broadcast[];
  clientsWithWa: number;
  leadsWithPhone: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("novo");

  const scheduled = useMemo(() => broadcasts.filter((b) => b.status === "scheduled"), [broadcasts]);
  const history = useMemo(() => broadcasts.filter((b) => b.status !== "scheduled"), [broadcasts]);

  // Métricas de entrega (agregado).
  const stats = useMemo(() => {
    const done = broadcasts.filter((b) => b.status === "done" || b.status === "sending");
    const totalSent = broadcasts.reduce((s, b) => s + b.sent, 0);
    const totalFailed = broadcasts.reduce((s, b) => s + b.failed, 0);
    const totalTargets = broadcasts.reduce((s, b) => s + b.total, 0);
    const attempted = totalSent + totalFailed;
    const rate = attempted > 0 ? Math.round((totalSent / attempted) * 100) : 0;
    return { campaigns: done.length, totalSent, totalFailed, totalTargets, rate };
  }, [broadcasts]);

  const tabs: TabItem<TabKey>[] = [
    { key: "novo", label: "Novo disparo", icon: Send },
    { key: "agendados", label: "Agendados", icon: CalendarClock, count: scheduled.length },
    { key: "historico", label: "Histórico", icon: History, count: history.length },
    { key: "entrega", label: "Entrega", icon: Activity },
  ];

  return (
    <div className="space-y-4">
      <TabNav tabs={tabs} active={tab} onChange={setTab} />

      {tab === "novo" && (
        <BroadcastComposer
          clientsWithWa={clientsWithWa}
          leadsWithPhone={leadsWithPhone}
          onDone={(id) => {
            if (id) router.push(`/gerencial/comercial/disparos/${id}`);
            else router.refresh();
          }}
        />
      )}

      {tab === "agendados" && (
        <Card className="overflow-hidden p-0">
          {scheduled.length === 0 ? (
            <EmptyList label="Nenhum disparo agendado." />
          ) : (
            <ul className="divide-y divide-line">{scheduled.map((b) => <BroadcastRow key={b.id} b={b} dateField="scheduled" />)}</ul>
          )}
        </Card>
      )}

      {tab === "historico" && (
        <Card className="overflow-hidden p-0">
          {history.length === 0 ? (
            <EmptyList label="Nenhum disparo ainda." />
          ) : (
            <ul className="divide-y divide-line">{history.map((b) => <BroadcastRow key={b.id} b={b} dateField="created" />)}</ul>
          )}
        </Card>
      )}

      {tab === "entrega" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4"><p className="text-xs text-muted">Campanhas</p><p className="mt-1 text-2xl font-bold text-ink">{stats.campaigns}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted">Enviados</p><p className="mt-1 text-2xl font-bold text-emerald-600">{stats.totalSent}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted">Falhas</p><p className="mt-1 text-2xl font-bold text-rose-600">{stats.totalFailed}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted">Taxa de entrega</p><p className="mt-1 text-2xl font-bold text-ink">{stats.rate}%</p></Card>
          </div>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-line px-4 py-2.5"><p className="text-sm font-semibold text-ink">Entregas por disparo</p></div>
            {broadcasts.length === 0 ? (
              <EmptyList label="Sem dados de entrega ainda." />
            ) : (
              <ul className="divide-y divide-line">
                {broadcasts.map((b) => {
                  const attempted = b.sent + b.failed;
                  const rate = attempted > 0 ? Math.round((b.sent / attempted) * 100) : 0;
                  return (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/gerencial/comercial/disparos/${b.id}`} className="truncate text-sm font-medium text-ink hover:underline">{b.title}</Link>
                        <p className="text-xs text-muted">{fmtDate(b.createdAt)} · {b.total} destinatário(s){b.instanceName ? ` · ${b.instanceName}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink">{b.sent}<span className="font-normal text-muted">/{b.total}</span></p>
                        <p className="text-[11px] text-muted">{rate}% entregue{b.failed > 0 ? ` · ${b.failed} falhou` : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
