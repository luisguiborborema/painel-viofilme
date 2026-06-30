"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  GanttChartSquare,
  KanbanSquare,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  OPS_TEAM,
  TASK_STAGES,
  WEEKDAYS,
  type DeliveryTask,
  type TaskOrigin,
  type TaskType,
} from "@/lib/data/operacao";

type View = "geral" | "kanban" | "calendario" | "gantt" | "workload";

const VIEWS: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "geral", label: "Visão geral", icon: LayoutDashboard },
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
  { key: "gantt", label: "Linha do tempo", icon: GanttChartSquare },
  { key: "workload", label: "Workload", icon: Users },
];

const TYPE_COLOR: Record<TaskType, string> = {
  Arte: "bg-sky-500/15 text-sky-300",
  Vídeo: "bg-rose-500/15 text-rose-300",
  Copy: "bg-violet-500/15 text-violet-300",
  Tráfego: "bg-amber-500/15 text-amber-300",
};

const ORIGINS: TaskOrigin[] = ["Linha editorial", "Projeto", "Tarefa avulsa"];

function memberName(id: string) {
  return OPS_TEAM.find((m) => m.id === id)?.name ?? id;
}
function memberInitials(id: string) {
  return OPS_TEAM.find((m) => m.id === id)?.initials ?? "?";
}

function Avatar({ id }: { id: string }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
      {memberInitials(id)}
    </span>
  );
}

function TaskCard({ t }: { t: DeliveryTask }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[11px] text-muted">{t.client}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{t.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            TYPE_COLOR[t.type],
          )}
        >
          {t.type}
        </span>
        {t.estimateH > 0 && (
          <span className="text-[10px] text-muted">{t.estimateH}h est.</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <Avatar id={t.assignee} />
        <span
          className={cn(
            "text-[11px] font-medium",
            t.late ? "text-rose-400" : "text-muted",
          )}
        >
          {t.dueLabel}
        </span>
      </div>
    </div>
  );
}

export function DeliveryPanel({ tasks }: { tasks: DeliveryTask[] }) {
  const [view, setView] = useState<View>("geral");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [origin, setOrigin] = useState<TaskOrigin | null>(null);

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!assignee || t.assignee === assignee) &&
          (!origin || t.origin === origin),
      ),
    [tasks, assignee, origin],
  );

  return (
    <div className="space-y-4">
      {/* Toggle de visões */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.key ? "bg-subtle text-ink" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Responsável:
        </span>
        {OPS_TEAM.map((m) => (
          <button
            key={m.id}
            onClick={() => setAssignee(assignee === m.id ? null : m.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              assignee === m.id
                ? "bg-brand-500 text-white"
                : "bg-surface text-muted hover:text-ink",
            )}
          >
            {m.name}
          </button>
        ))}
        <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted">
          Origem:
        </span>
        {ORIGINS.map((o) => (
          <button
            key={o}
            onClick={() => setOrigin(origin === o ? null : o)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              origin === o ? "bg-ink text-surface" : "bg-surface text-muted hover:text-ink",
            )}
          >
            {o}
          </button>
        ))}
      </div>

      {view === "geral" && <Geral tasks={filtered} />}
      {view === "kanban" && <Kanban tasks={filtered} />}
      {view === "calendario" && <Calendario tasks={filtered} />}
      {view === "gantt" && <Gantt tasks={filtered} />}
      {view === "workload" && <Workload tasks={filtered} />}
    </div>
  );
}

// --- Visão geral ------------------------------------------------------------
function Geral({ tasks }: { tasks: DeliveryTask[] }) {
  const total = tasks.length;
  const doing = tasks.filter((t) => t.stage === "doing").length;
  const late = tasks.filter((t) => t.late).length;
  const approval = tasks.filter((t) => t.stage === "approval").length;
  const maxStage = Math.max(
    1,
    ...TASK_STAGES.map((s) => tasks.filter((t) => t.stage === s.key).length),
  );

  const stat = (label: string, value: number, tone?: string) => (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", tone ?? "text-ink")}>{value}</p>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat("Total de tarefas", total)}
        {stat("Em andamento", doing, "text-sky-400")}
        {stat("Atrasadas", late, late > 0 ? "text-rose-400" : "text-ink")}
        {stat("Aguardando cliente", approval, "text-amber-400")}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Por estágio</h3>
          <div className="space-y-2.5">
            {TASK_STAGES.map((s) => {
              const n = tasks.filter((t) => t.stage === s.key).length;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-muted">
                    {s.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${(n / maxStage) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-sm font-medium text-ink">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Carga da equipe</h3>
          <div className="space-y-2.5">
            {OPS_TEAM.map((m) => {
              const h = tasks
                .filter((t) => t.assignee === m.id)
                .reduce((s, t) => s + t.estimateH, 0);
              const cap = m.capacityH * WEEKDAYS.length;
              const pct = Math.min(100, (h / cap) * 100);
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-muted">{m.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct > 90 ? "bg-rose-400" : pct > 70 ? "bg-amber-400" : "bg-emerald-400",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-xs text-muted">
                    {h}h/{cap}h
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Kanban -----------------------------------------------------------------
function Kanban({ tasks }: { tasks: DeliveryTask[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {TASK_STAGES.map((s) => {
        const col = tasks.filter((t) => t.stage === s.key);
        return (
          <div key={s.key} className="rounded-2xl bg-subtle p-2.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-ink">{s.label}</span>
              <span className="text-xs text-muted">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((t) => (
                <TaskCard key={t.id} t={t} />
              ))}
              {col.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-muted">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Calendário (semana) ----------------------------------------------------
function Calendario({ tasks }: { tasks: DeliveryTask[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {WEEKDAYS.map((wd, i) => {
        const day = tasks.filter((t) => t.day === i);
        return (
          <div key={wd} className="rounded-2xl border border-line bg-surface p-2.5">
            <p className="mb-2 px-1 text-sm font-semibold text-ink">{wd}</p>
            <div className="space-y-2">
              {day.map((t) => (
                <TaskCard key={t.id} t={t} />
              ))}
              {day.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-muted">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Linha do tempo (Gantt) -------------------------------------------------
function Gantt({ tasks }: { tasks: DeliveryTask[] }) {
  const members = OPS_TEAM.filter((m) => tasks.some((t) => t.assignee === m.id));
  return (
    <Card className="overflow-x-auto p-4">
      <div className="min-w-[640px]">
        <div className="mb-2 grid grid-cols-[160px_repeat(5,1fr)] gap-1 text-center text-xs font-medium text-muted">
          <span />
          {WEEKDAYS.map((wd) => (
            <span key={wd}>{wd}</span>
          ))}
        </div>
        <div className="space-y-3">
          {members.map((m) => {
            const mtasks = tasks.filter((t) => t.assignee === m.id);
            return (
              <div key={m.id}>
                <p className="mb-1 text-sm font-medium text-ink">{m.name}</p>
                <div className="space-y-1">
                  {mtasks.map((t) => (
                    <div
                      key={t.id}
                      className="grid grid-cols-[160px_repeat(5,1fr)] items-center gap-1"
                    >
                      <span className="truncate pr-2 text-xs text-muted">
                        {t.title}
                      </span>
                      {WEEKDAYS.map((_, d) => {
                        const inBar = d >= t.startDay && d < t.startDay + t.span;
                        return (
                          <span
                            key={d}
                            className={cn(
                              "h-6 rounded-md",
                              inBar
                                ? t.late
                                  ? "bg-rose-400"
                                  : "bg-brand-500"
                                : "bg-subtle",
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// --- Workload ---------------------------------------------------------------
function Workload({ tasks }: { tasks: DeliveryTask[] }) {
  return (
    <Card className="overflow-x-auto p-4">
      <div className="min-w-[640px]">
        <div className="mb-2 grid grid-cols-[160px_repeat(5,1fr)] gap-1 text-center text-xs font-medium text-muted">
          <span />
          {WEEKDAYS.map((wd) => (
            <span key={wd}>{wd}</span>
          ))}
        </div>
        <div className="space-y-1.5">
          {OPS_TEAM.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[160px_repeat(5,1fr)] items-center gap-1"
            >
              <div className="flex items-center gap-2 pr-2">
                <Avatar id={m.id} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                  <p className="text-[10px] text-muted">{m.role}</p>
                </div>
              </div>
              {WEEKDAYS.map((_, d) => {
                const h = tasks
                  .filter((t) => t.assignee === m.id && t.day === d)
                  .reduce((s, t) => s + t.estimateH, 0);
                const tone =
                  h === 0
                    ? "bg-subtle text-muted"
                    : h <= m.capacityH
                      ? "bg-emerald-500/20 text-emerald-300"
                      : h <= m.capacityH + 2
                        ? "bg-amber-500/25 text-amber-300"
                        : "bg-rose-500/25 text-rose-300";
                return (
                  <span
                    key={d}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-md text-xs font-semibold",
                      tone,
                    )}
                  >
                    {h > 0 ? `${h}h` : "—"}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Capacidade de referência: 8h/dia por pessoa. Verde = dentro, âmbar =
          no limite, vermelho = sobrecarga.
        </p>
      </div>
    </Card>
  );
}
