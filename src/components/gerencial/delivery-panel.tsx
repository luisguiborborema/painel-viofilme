"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  KanbanSquare,
  LayoutDashboard,
  Users,
  UserSquare2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { TaskUniversal } from "./task-universal";
import { cn } from "@/lib/utils";
import {
  DELIVERY_CAPACITY_PER_DAY as CAP,
  DELIVERY_TODAY_ISO,
  DELIVERY_TODAY_IDX,
  OPS_TEAM,
  TASK_STAGES,
  TASK_TYPE_DURATIONS,
  WEEKDAYS,
  type DeliveryTask,
  type TaskOrigin,
  type TaskStage,
  type TaskType,
} from "@/lib/data/operacao";

type View = "geral" | "kanban" | "calendario" | "timeline" | "workload" | "cliente";

const VIEWS: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "geral", label: "Visão geral", icon: LayoutDashboard },
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
  { key: "timeline", label: "Linha do tempo", icon: Clock },
  { key: "workload", label: "Workload", icon: Users },
  { key: "cliente", label: "Entregas por cliente", icon: UserSquare2 },
];

const TYPE_COLOR: Record<TaskType, string> = {
  Arte: "bg-sky-500/15 text-sky-500",
  Vídeo: "bg-rose-500/15 text-rose-500",
  Copy: "bg-violet-500/15 text-violet-500",
  Tráfego: "bg-amber-500/15 text-amber-600",
};

const ORIGINS: TaskOrigin[] = ["Linha editorial", "Projeto", "Tarefa avulsa"];
const CLIENT_PALETTE = ["#2a63c9", "#059669", "#d97706", "#7c3aed", "#e11d48", "#0284c7", "#be185d", "#0f766e"];

const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;
const memberInitials = (id: string) => OPS_TEAM.find((m) => m.id === id)?.initials ?? "?";

function sameDay(a: string, b: string) {
  const x = new Date(a), y = new Date(b);
  return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth() && x.getUTCDate() === y.getUTCDate();
}
function capTone(count: number): "ok" | "warn" | "over" {
  if (count <= CAP) return "ok";
  if (count === CAP + 1) return "warn";
  return "over";
}

function Avatar({ id }: { id: string }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
      {memberInitials(id)}
    </span>
  );
}

export function DeliveryPanel({ tasks: initial, meName }: { tasks: DeliveryTask[]; meName?: string }) {
  const [items, setItems] = useState(initial);
  const [view, setView] = useState<View>("geral");
  const [mode, setMode] = useState<"meu" | "time">("time");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [origin, setOrigin] = useState<TaskOrigin | null>(null);
  const [client, setClient] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeliveryTask | null>(null);
  const [drill, setDrill] = useState<{ title: string; list: DeliveryTask[] } | null>(null);

  const meId = useMemo(() => {
    if (!meName) return null;
    const m = OPS_TEAM.find((x) => meName.toLowerCase().includes(x.name.split(" ")[0].toLowerCase()));
    return m?.id ?? null;
  }, [meName]);

  const allClients = useMemo(
    () => [...new Set(items.map((t) => t.client))].sort(),
    [items],
  );
  const clientColor = (c: string) => CLIENT_PALETTE[allClients.indexOf(c) % CLIENT_PALETTE.length];

  const filtered = useMemo(
    () =>
      items.filter(
        (t) =>
          (mode === "time" || !meId || t.assignee === meId) &&
          (!assignee || t.assignee === assignee) &&
          (!origin || t.origin === origin) &&
          (!client || t.client === client),
      ),
    [items, mode, meId, assignee, origin, client],
  );

  function setStage(id: string, stage: TaskStage) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, stage } : t)));
    setSelected((s) => (s && s.id === id ? { ...s, stage } : s));
  }

  const shared = { openTask: setSelected, clientColor };

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

      {/* Meu/Time + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {(["meu", "time"] as const).map((mo) => (
            <button
              key={mo}
              onClick={() => setMode(mo)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                mode === mo ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
              )}
            >
              {mo === "meu" ? "Meu" : "Time"}
            </button>
          ))}
        </div>
        <select
          value={assignee ?? ""}
          onChange={(e) => setAssignee(e.target.value || null)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          <option value="">Todos responsáveis</option>
          {OPS_TEAM.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          value={client ?? ""}
          onChange={(e) => setClient(e.target.value || null)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          <option value="">Todos clientes</option>
          {allClients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={origin ?? ""}
          onChange={(e) => setOrigin((e.target.value as TaskOrigin) || null)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          <option value="">Todas origens</option>
          {ORIGINS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {mode === "meu" && !meId && (
          <span className="text-xs text-amber-600">Seu usuário não está no time de produção.</span>
        )}
      </div>

      {view === "geral" && <Geral tasks={filtered} onDrill={setDrill} {...shared} />}
      {view === "kanban" && <Kanban tasks={filtered} onStage={setStage} {...shared} />}
      {view === "calendario" && <Calendario tasks={filtered} {...shared} />}
      {view === "timeline" && <Timeline tasks={filtered} {...shared} />}
      {view === "workload" && <Workload tasks={filtered} onDrill={setDrill} />}
      {view === "cliente" && <PorCliente tasks={filtered} {...shared} />}

      {selected && (
        <TaskUniversal task={selected} onClose={() => setSelected(null)} onStage={setStage} />
      )}
      {drill && (
        <DrillModal
          title={drill.title}
          list={drill.list}
          onClose={() => setDrill(null)}
          onOpen={(t) => {
            setDrill(null);
            setSelected(t);
          }}
        />
      )}
    </div>
  );
}

type Shared = { openTask: (t: DeliveryTask) => void; clientColor: (c: string) => string };

function TaskCard({ t, openTask, clientColor, draggable, onDragStart }: {
  t: DeliveryTask;
  openTask: (t: DeliveryTask) => void;
  clientColor: (c: string) => string;
  draggable?: boolean;
  onDragStart?: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => openTask(t)}
      className="cursor-pointer rounded-xl border border-l-4 border-line bg-surface p-3 hover:shadow-sm"
      style={{ borderLeftColor: clientColor(t.client) }}
    >
      <p className="text-[11px] text-muted">{t.client}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{t.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TYPE_COLOR[t.type])}>{t.type}</span>
        <span className="text-[10px] text-muted">{TASK_TYPE_DURATIONS[t.type]}min</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <Avatar id={t.assignee} />
        <span className={cn("text-[11px] font-medium", t.late ? "text-rose-500" : "text-muted")}>{t.dueLabel}</span>
      </div>
    </div>
  );
}

// --- Visão geral (ENT01-04) --------------------------------------------------
function Stat({ label, value, tone, onClick }: { label: string; value: number; tone?: string; onClick?: () => void }) {
  return (
    <Card className={cn("p-4", onClick && value > 0 && "cursor-pointer transition-shadow hover:shadow-md")}>
      <button className="w-full text-left" onClick={onClick} disabled={!onClick || value === 0}>
        <p className="text-xs text-muted">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold", tone ?? "text-ink")}>{value}</p>
        {onClick && value > 0 && <p className="text-[10px] text-brand-500">ver quem</p>}
      </button>
    </Card>
  );
}

function Geral({ tasks, onDrill }: {
  tasks: DeliveryTask[];
  onDrill: (d: { title: string; list: DeliveryTask[] }) => void;
} & Shared) {
  const open = tasks.filter((t) => t.stage !== "done");
  const doing = tasks.filter((t) => t.stage === "doing").length;
  const approval = tasks.filter((t) => t.stage === "approval").length;
  const lateList = tasks.filter((t) => t.late);
  const isActionable = (t: DeliveryTask) => ["todo", "doing", "review"].includes(t.stage);
  const today = tasks.filter((t) => isActionable(t) && sameDay(t.dueDate, DELIVERY_TODAY_ISO) && !t.late);
  const week = tasks.filter((t) => isActionable(t) && !t.late);
  const maxStage = Math.max(1, ...TASK_STAGES.map((s) => tasks.filter((t) => t.stage === s.key).length));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Tarefas abertas" value={open.length} />
        <Stat label="Em andamento" value={doing} tone="text-sky-500" />
        <Stat label="Aguardando cliente" value={approval} tone="text-amber-500" />
        <Stat
          label="Atrasadas"
          value={lateList.length}
          tone={lateList.length > 0 ? "text-rose-500" : "text-ink"}
          onClick={() => onDrill({ title: "Tarefas atrasadas", list: lateList })}
        />
        <Stat label="Vence hoje" value={today.length} tone="text-brand-600" onClick={() => onDrill({ title: "Vence hoje", list: today })} />
        <Stat label="Vence esta semana" value={week.length} onClick={() => onDrill({ title: "Vence esta semana", list: week })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Por estágio</h3>
          <div className="space-y-2.5">
            {TASK_STAGES.map((s) => {
              const n = tasks.filter((t) => t.stage === s.key).length;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-muted">{s.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(n / maxStage) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-sm font-medium text-ink">{n}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-semibold text-ink">Carga da equipe</h3>
          <p className="mb-3 text-xs text-muted">Em nº de tasks. Alerta pela capacidade ({CAP}/dia).</p>
          <div className="space-y-2.5">
            {OPS_TEAM.map((m) => {
              const mine = tasks.filter((t) => t.assignee === m.id && t.stage !== "done");
              const peak = Math.max(0, ...WEEKDAYS.map((_, d) => mine.filter((t) => t.day === d).length));
              const tone = capTone(peak);
              const maxCount = Math.max(1, ...OPS_TEAM.map((mm) => tasks.filter((t) => t.assignee === mm.id && t.stage !== "done").length));
              return (
                <button
                  key={m.id}
                  onClick={() => mine.length && onDrill({ title: `Tarefas de ${m.name}`, list: mine })}
                  className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-subtle"
                >
                  <span className="w-24 shrink-0 text-sm text-muted">{m.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                    <div
                      className={cn("h-full rounded-full", tone === "over" ? "bg-rose-500" : tone === "warn" ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${(mine.length / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs text-muted">{mine.length} tasks</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
      <p className="text-xs text-muted">Dica: clique em <strong className="text-ink">Atrasadas</strong>, <strong className="text-ink">Vence hoje</strong> ou numa barra de carga para ver as tarefas.</p>
    </div>
  );
}

// --- Kanban (ENT05-07) -------------------------------------------------------
function Kanban({ tasks, onStage, openTask, clientColor }: {
  tasks: DeliveryTask[];
  onStage: (id: string, s: TaskStage) => void;
} & Shared) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStage | null>(null);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {TASK_STAGES.map((s) => {
        const col = tasks.filter((t) => t.stage === s.key);
        return (
          <div
            key={s.key}
            onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
            onDragLeave={() => setOver((c) => (c === s.key ? null : c))}
            onDrop={() => { if (dragId) onStage(dragId, s.key); setDragId(null); setOver(null); }}
            className={cn("rounded-2xl p-2.5 transition-colors", over === s.key ? "bg-brand-50" : "bg-subtle")}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-ink">{s.label}</span>
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-xs font-medium text-muted">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((t) => (
                <TaskCard key={t.id} t={t} openTask={openTask} clientColor={clientColor} draggable onDragStart={() => setDragId(t.id)} />
              ))}
              {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Calendário (ENT08-09) — por data de entrega, cor por cliente ------------
function Calendario({ tasks, openTask, clientColor }: { tasks: DeliveryTask[] } & Shared) {
  const [sub, setSub] = useState<"dia" | "semana" | "mes">("semana");
  const [dayIdx, setDayIdx] = useState(DELIVERY_TODAY_IDX);

  const SubToggle = (
    <div className="mb-3 inline-flex rounded-lg border border-line bg-surface p-0.5">
      {(["dia", "semana", "mes"] as const).map((s) => (
        <button key={s} onClick={() => setSub(s)}
          className={cn("rounded-md px-3 py-1 text-xs font-medium", sub === s ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}>
          {s === "dia" ? "Dia" : s === "semana" ? "Semana" : "Mês"}
        </button>
      ))}
    </div>
  );

  if (sub === "dia") {
    const day = tasks.filter((t) => t.day === dayIdx);
    return (
      <div>
        {SubToggle}
        <div className="mb-3 flex gap-1">
          {WEEKDAYS.map((wd, i) => (
            <button key={wd} onClick={() => setDayIdx(i)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", dayIdx === i ? "bg-brand-600 text-white" : "bg-surface text-muted hover:text-ink")}>
              {wd}{i === DELIVERY_TODAY_IDX ? " (hoje)" : ""}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {day.map((t) => <TaskCard key={t.id} t={t} openTask={openTask} clientColor={clientColor} />)}
          {day.length === 0 && <Card className="p-8 text-center text-sm text-muted">Sem entregas neste dia.</Card>}
        </div>
      </div>
    );
  }

  if (sub === "semana") {
    return (
      <div>
        {SubToggle}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {WEEKDAYS.map((wd, i) => {
            const day = tasks.filter((t) => t.day === i);
            return (
              <div key={wd} className={cn("rounded-2xl border p-2.5", i === DELIVERY_TODAY_IDX ? "border-brand-400 bg-brand-50/40" : "border-line bg-surface")}>
                <p className="mb-2 px-1 text-sm font-semibold text-ink">{wd}{i === DELIVERY_TODAY_IDX ? " · hoje" : ""}</p>
                <div className="space-y-2">
                  {day.map((t) => <TaskCard key={t.id} t={t} openTask={openTask} clientColor={clientColor} />)}
                  {day.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mês — grade do mês de "hoje", tasks na data real de entrega
  const today = new Date(DELIVERY_TODAY_ISO);
  const y = today.getUTCFullYear(), mo = today.getUTCMonth();
  const first = new Date(Date.UTC(y, mo, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const tasksOn = (d: number) => tasks.filter((t) => { const dd = new Date(t.dueDate); return dd.getUTCFullYear() === y && dd.getUTCMonth() === mo && dd.getUTCDate() === d; });

  return (
    <div>
      {SubToggle}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const list = d ? tasksOn(d) : [];
            const isToday = d === today.getUTCDate();
            return (
              <div key={i} className={cn("min-h-[72px] rounded-lg border p-1", isToday ? "border-brand-400 bg-brand-50/40" : "border-line")}>
                {d && <p className="px-1 text-[10px] font-medium text-muted">{d}</p>}
                <div className="space-y-0.5">
                  {list.slice(0, 3).map((t) => (
                    <button key={t.id} onClick={() => openTask(t)}
                      className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white"
                      style={{ backgroundColor: clientColor(t.client) }}>
                      {t.title}
                    </button>
                  ))}
                  {list.length > 3 && <p className="px-1 text-[9px] text-muted">+{list.length - 3}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// --- Linha do tempo (ENT10-11) — agenda por membro, blocos por duração -------
function Timeline({ tasks, openTask, clientColor }: { tasks: DeliveryTask[] } & Shared) {
  const [dayIdx, setDayIdx] = useState(DELIVERY_TODAY_IDX);
  const START = 9, END = 19; // 9h–19h
  const totalMin = (END - START) * 60;
  const members = OPS_TEAM.filter((m) => tasks.some((t) => t.assignee === m.id));

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {WEEKDAYS.map((wd, i) => (
          <button key={wd} onClick={() => setDayIdx(i)}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", dayIdx === i ? "bg-brand-600 text-white" : "bg-surface text-muted hover:text-ink")}>
            {wd}{i === DELIVERY_TODAY_IDX ? " (hoje)" : ""}
          </button>
        ))}
      </div>
      <Card className="overflow-x-auto p-4">
        <div className="min-w-[720px]">
          {/* Régua de horas */}
          <div className="mb-1 grid gap-0" style={{ gridTemplateColumns: `120px 1fr` }}>
            <span />
            <div className="flex justify-between text-[10px] text-muted">
              {Array.from({ length: END - START + 1 }, (_, h) => <span key={h}>{START + h}h</span>)}
            </div>
          </div>
          <div className="space-y-2">
            {members.map((m) => {
              const dayTasks = tasks.filter((t) => t.assignee === m.id && t.day === dayIdx);
              let cursor = 0; // minutos desde START
              return (
                <div key={m.id} className="grid items-center gap-0" style={{ gridTemplateColumns: `120px 1fr` }}>
                  <div className="flex items-center gap-2 pr-2">
                    <Avatar id={m.id} />
                    <span className="truncate text-xs font-medium text-ink">{m.name}</span>
                  </div>
                  <div className="relative h-9 rounded-lg bg-subtle">
                    {dayTasks.map((t) => {
                      const dur = TASK_TYPE_DURATIONS[t.type];
                      const left = (cursor / totalMin) * 100;
                      const width = Math.min(100 - left, (dur / totalMin) * 100);
                      cursor += dur;
                      if (left >= 100) return null;
                      return (
                        <button key={t.id} onClick={() => openTask(t)}
                          title={`${t.title} · ${dur}min`}
                          className="absolute top-0 flex h-9 items-center overflow-hidden rounded-md px-2 text-[10px] font-medium text-white"
                          style={{ left: `${left}%`, width: `${Math.max(4, width)}%`, backgroundColor: clientColor(t.client) }}>
                          <span className="truncate">{t.title}</span>
                        </button>
                      );
                    })}
                    {dayTasks.length === 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted">livre</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-muted">Blocos sequenciais a partir das {START}h, tamanho pela duração padrão do tipo de task. Cor por cliente.</p>
        </div>
      </Card>
    </div>
  );
}

// --- Workload (ENT12-13) — nº de tasks, capacidade compartilhada -------------
function Workload({ tasks, onDrill }: { tasks: DeliveryTask[]; onDrill: (d: { title: string; list: DeliveryTask[] }) => void }) {
  return (
    <Card className="overflow-x-auto p-4">
      <div className="min-w-[640px]">
        <div className="mb-2 grid grid-cols-[160px_repeat(5,1fr)] gap-1 text-center text-xs font-medium text-muted">
          <span />
          {WEEKDAYS.map((wd) => <span key={wd}>{wd}</span>)}
        </div>
        <div className="space-y-1.5">
          {OPS_TEAM.map((m) => (
            <div key={m.id} className="grid grid-cols-[160px_repeat(5,1fr)] items-center gap-1">
              <div className="flex items-center gap-2 pr-2">
                <Avatar id={m.id} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                  <p className="text-[10px] text-muted">{m.role}</p>
                </div>
              </div>
              {WEEKDAYS.map((_, d) => {
                const list = tasks.filter((t) => t.assignee === m.id && t.day === d && t.stage !== "done");
                const n = list.length;
                const tone = n === 0 ? "bg-subtle text-muted" : capTone(n) === "over" ? "bg-rose-500/25 text-rose-500" : capTone(n) === "warn" ? "bg-amber-500/25 text-amber-600" : "bg-emerald-500/20 text-emerald-600";
                return (
                  <button key={d} onClick={() => n && onDrill({ title: `${m.name} · ${WEEKDAYS[d]}`, list })}
                    className={cn("flex h-9 items-center justify-center rounded-md text-xs font-semibold", tone)}>
                    {n > 0 ? n : "—"}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Capacidade: {CAP} tasks/dia por pessoa. Verde ≤{CAP}, âmbar {CAP + 1}, vermelho {CAP + 2}+. Clique numa célula para ver as tarefas.</p>
      </div>
    </Card>
  );
}

// --- Entregas por cliente (ENT14-15) — kanban por cliente + janela -----------
function PorCliente({ tasks, openTask, clientColor }: { tasks: DeliveryTask[] } & Shared) {
  const [win, setWin] = useState<"dia" | "semana" | "mes">("semana");
  const today = new Date(DELIVERY_TODAY_ISO);
  const inWin = (t: DeliveryTask) => {
    const d = new Date(t.dueDate);
    if (win === "dia") return sameDay(t.dueDate, DELIVERY_TODAY_ISO);
    if (win === "mes") return d.getUTCFullYear() === today.getUTCFullYear() && d.getUTCMonth() === today.getUTCMonth();
    return true; // semana (mock: todas na semana atual)
  };
  const list = tasks.filter(inWin);
  const clients = [...new Set(list.map((t) => t.client))].sort();

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-line bg-surface p-0.5">
        {(["dia", "semana", "mes"] as const).map((w) => (
          <button key={w} onClick={() => setWin(w)}
            className={cn("rounded-md px-3 py-1 text-xs font-medium", win === w ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}>
            {w === "dia" ? "Hoje" : w === "semana" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>
      {clients.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">Sem entregas nesta janela.</Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {clients.map((c) => {
            const col = list.filter((t) => t.client === c);
            return (
              <div key={c} className="w-[240px] shrink-0 rounded-2xl border border-line bg-canvas p-2.5">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: clientColor(c) }} />
                  <span className="flex-1 truncate text-sm font-semibold text-ink">{c}</span>
                  <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-muted">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((t) => <TaskCard key={t.id} t={t} openTask={openTask} clientColor={clientColor} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DrillModal({ title, list, onClose, onOpen }: {
  title: string;
  list: DeliveryTask[];
  onClose: () => void;
  onOpen: (t: DeliveryTask) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-sm font-semibold text-ink">{title} · {list.length}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
        </div>
        <div className="divide-y divide-line">
          {list.map((t) => (
            <button key={t.id} onClick={() => onOpen(t)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-subtle">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                <p className="text-xs text-muted">{t.client} · {memberName(t.assignee)}</p>
              </div>
              <span className={cn("shrink-0 text-[11px] font-medium", t.late ? "text-rose-500" : "text-muted")}>{t.dueLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
