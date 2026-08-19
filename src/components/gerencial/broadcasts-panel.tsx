"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Send, Users, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { broadcastProgress, statusLabel, statusTone, type Broadcast } from "@/lib/data/broadcasts";
import { BroadcastComposer } from "./broadcast-composer";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function BroadcastsPanel({
  broadcasts,
  clientsWithWa,
  leadsWithPhone,
}: {
  broadcasts: Broadcast[];
  clientsWithWa: number;
  leadsWithPhone: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? "Fechar" : "Novo disparo"}
        </button>
      </div>

      {open && (
        <BroadcastComposer
          clientsWithWa={clientsWithWa}
          leadsWithPhone={leadsWithPhone}
          onDone={(id) => {
            setOpen(false);
            if (id) router.push(`/gerencial/comercial/disparos/${id}`);
            else router.refresh();
          }}
        />
      )}

      <Card className="overflow-hidden p-0">
        {broadcasts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Megaphone className="h-8 w-8 text-muted/50" />
            <p className="text-sm text-muted">Nenhum disparo ainda. Crie o primeiro.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {broadcasts.map((b) => {
              const pct = broadcastProgress(b);
              return (
                <li key={b.id}>
                  <Link href={`/gerencial/comercial/disparos/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
                      <Send className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{b.title}</p>
                      <p className="truncate text-xs text-muted">
                        {b.message || "(sem texto)"}
                      </p>
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
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone(b.status))}>
                      {statusLabel(b.status)}
                    </span>
                    <span className="hidden shrink-0 text-xs text-muted md:block">
                      {b.status === "scheduled" ? fmtDate(b.scheduledFor) : fmtDate(b.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
