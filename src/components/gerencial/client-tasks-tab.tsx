"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, ListChecks, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { OPS_TEAM, type DeliveryTask } from "@/lib/data/operacao";
import { TaskUniversal } from "./task-universal";

const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;

// Rótulos canônicos (display) — mesmos nomes usados na spec do Hub.
const STAGE_STATUS: Record<string, { label: string; chip: string }> = {
  todo: { label: "Backlog", chip: "bg-subtle text-muted" },
  doing: { label: "Em produção", chip: "bg-sky-500/15 text-sky-500" },
  review: { label: "Revisão interna", chip: "bg-violet-500/15 text-violet-500" },
  approval: { label: "Aguardando cliente", chip: "bg-amber-500/15 text-amber-600" },
  done: { label: "Publicado", chip: "bg-emerald-500/15 text-emerald-600" },
};

type Chip = "todas" | "atrasadas" | "aguardando" | "concluidas";

export function ClientTasksTab({ tasks: initial }: { tasks: DeliveryTask[] }) {
  const [tasks, setTasks] = useState(initial);
  const [selected, setSelected] = useState<DeliveryTask | null>(null);
  const [chip, setChip] = useState<Chip>("todas");
  const [showDone, setShowDone] = useState(false);

  const lateCount = tasks.filter((t) => t.late).length;
  const awaitingCount = tasks.filter((t) => t.stage === "approval").length;
  const doneCount = tasks.filter((t) => t.stage === "done").length;

  // Filtro padrão: só ativas (esconde concluídas), salvo toggle/chip explícito.
  const visible = useMemo(() => {
    return tasks.filter((t) => {
      if (chip === "atrasadas") return t.late;
      if (chip === "aguardando") return t.stage === "approval";
      if (chip === "concluidas") return t.stage === "done";
      // "todas": ativas por padrão; concluídas só com o toggle
      if (t.stage === "done" && !showDone) return false;
      return true;
    });
  }, [tasks, chip, showDone]);

  // Agrupamento lógico por origem (Linha editorial / Projeto / Tarefa avulsa).
  const groups = useMemo(() => {
    const map = new Map<string, DeliveryTask[]>();
    for (const t of visible) {
      const key = t.origin || "Outros";
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()];
  }, [visible]);

  const CHIPS: { key: Chip; label: string; icon: typeof AlertTriangle; count?: number }[] = [
    { key: "todas", label: "Todas", icon: ListChecks },
    { key: "atrasadas", label: "Atrasadas", icon: AlertTriangle, count: lateCount },
    { key: "aguardando", label: "Aguardando cliente", icon: Clock3, count: awaitingCount },
    { key: "concluidas", label: "Concluídas", icon: CheckCircle2, count: doneCount },
  ];

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-semibold text-ink">Sem tarefas</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Nenhuma tarefa registrada para este cliente. Elas aparecem aqui quando entram na Linha Editorial ou como pedido/projeto.
        </p>
        <Link
          href="/gerencial/entregas"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-subtle"
        >
          <Plus className="h-3.5 w-3.5" /> Criar tarefa manual
        </Link>
      </Card>
    );
  }

  return (
    <>
      {/* Chips de exceção */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CHIPS.map((ch) => {
          const Icon = ch.icon;
          const active = chip === ch.key;
          return (
            <button
              key={ch.key}
              onClick={() => setChip(ch.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line text-muted hover:text-ink",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {ch.label}
              {ch.count !== undefined && ch.count > 0 && (
                <span className="rounded-full bg-subtle-strong px-1.5 text-[10px] font-bold text-ink">{ch.count}</span>
              )}
            </button>
          );
        })}
        {chip === "todas" && doneCount > 0 && (
          <button
            onClick={() => setShowDone((v) => !v)}
            className="ml-auto text-xs font-medium text-muted hover:text-ink"
          >
            {showDone ? "Ocultar concluídas" : "Mostrar concluídas / histórico"}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">Nada neste filtro.</Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([origin, list]) => {
            const done = list.filter((t) => t.stage === "done").length;
            const pct = Math.round((done / list.length) * 100);
            return (
              <Card key={origin} className="overflow-hidden p-0">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                  <p className="text-sm font-semibold text-ink">{origin}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-subtle-strong">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-muted">{pct}%</span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {list.map((t) => {
                      const st = STAGE_STATUS[t.stage] ?? STAGE_STATUS.todo;
                      return (
                        <tr key={t.id} onClick={() => setSelected(t)} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-subtle">
                          <td className="px-4 py-3 font-medium text-ink">{t.title}</td>
                          <td className={cn("px-4 py-3 text-xs", t.late ? "font-medium text-rose-500" : "text-muted")}>{t.dueLabel}</td>
                          <td className="px-4 py-3 text-muted">
                            <span className="inline-flex items-center gap-2">
                              <Avatar name={memberName(t.assignee)} size={22} />
                              {memberName(t.assignee)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", st.chip)}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <TaskUniversal
          task={selected}
          onClose={() => setSelected(null)}
          onStage={(id, stage) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, stage } : t)))}
        />
      )}
    </>
  );
}
