"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, CalendarClock, History, Loader2, Send, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TabNav, type TabItem } from "@/components/ui/tab-nav";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone, type Broadcast } from "@/lib/data/broadcasts";
import { BroadcastComposer } from "./broadcast-composer";
import { BroadcastHistory } from "./broadcast-history";
import { BroadcastDelivery } from "./broadcast-delivery";

type TabKey = "novo" | "agendados" | "historico" | "entrega";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ScheduledList({ items }: { items: Broadcast[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "send" | "cancel") {
    if (action === "cancel" && !window.confirm("Cancelar este disparo agendado?")) return;
    setBusy(id);
    try {
      const res = await fetch("/api/gerencial/broadcasts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) { toast("Não foi possível concluir.", "error"); return; }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) return <Card className="p-10 text-center text-sm text-muted">Nenhum disparo agendado.</Card>;
  return (
    <div className="space-y-3">
      {items.map((b) => (
        <Card key={b.id} className="flex flex-wrap items-center gap-3 p-4">
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone(b.status))}>{statusLabel(b.status)}</span>
          <div className="min-w-0 flex-1">
            <Link href={`/gerencial/comercial/disparos/${b.id}`} className="truncate text-sm font-medium text-ink hover:underline">{b.title}</Link>
            <p className="text-xs text-muted">Envio: {fmtDate(b.scheduledFor)} · {b.total} destino(s){b.instanceName ? ` · ${b.instanceName}` : ""}</p>
          </div>
          <button onClick={() => act(b.id, "send")} disabled={busy === b.id} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Enviar agora
          </button>
          <button onClick={() => act(b.id, "cancel")} disabled={busy === b.id} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-60">
            <X className="h-3.5 w-3.5" /> Cancelar
          </button>
        </Card>
      ))}
    </div>
  );
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

  const tabs: TabItem<TabKey>[] = [
    { key: "novo", label: "Novo disparo", icon: Send },
    { key: "agendados", label: "Agendados", icon: CalendarClock, count: scheduled.length },
    { key: "historico", label: "Histórico", icon: History, count: broadcasts.length },
    { key: "entrega", label: "Entrega", icon: Activity },
  ];

  return (
    <div className="space-y-4">
      <TabNav tabs={tabs} active={tab} onChange={setTab} />

      {tab === "novo" && (
        <BroadcastComposer
          clientsWithWa={clientsWithWa}
          leadsWithPhone={leadsWithPhone}
          onDone={(id) => { if (id) router.push(`/gerencial/comercial/disparos/${id}`); else router.refresh(); }}
        />
      )}
      {tab === "agendados" && <ScheduledList items={scheduled} />}
      {tab === "historico" && <BroadcastHistory broadcasts={broadcasts} />}
      {tab === "entrega" && <BroadcastDelivery />}
    </div>
  );
}
