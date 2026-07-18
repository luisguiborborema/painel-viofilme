"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, MessageSquare, Plus, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DELIVERY_PRIORITIES,
  OPS_TEAM,
  TASK_STAGES,
  TASK_TYPE_DURATIONS,
  type DeliveryPriority,
  type DeliveryTask,
  type TaskStage,
} from "@/lib/data/operacao";

const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;

type CheckItem = { label: string; done: boolean };
type Comment = { author: string; text: string };

function defaultChecklist(stage: TaskStage): CheckItem[] {
  return [
    { label: "Briefing lido", done: stage !== "todo" },
    { label: "Rascunho / primeira versão", done: stage !== "todo" },
    { label: "Revisão interna", done: ["review", "approval", "done"].includes(stage) },
    { label: "Aprovado pelo cliente", done: stage === "done" },
  ];
}

async function postDelivery(body: unknown): Promise<boolean> {
  const res = await fetch("/api/gerencial/delivery-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/**
 * HUB14 — Task universal: detalhes + checklist + time tracking + comentários +
 * mover estágio + reatribuir responsável. No Painel real tudo é persistido.
 */
export function TaskUniversal({
  task,
  onClose,
  onStage,
  meName,
  onChanged,
}: {
  task: DeliveryTask;
  onClose: () => void;
  onStage?: (id: string, stage: TaskStage) => void;
  /** @deprecated multi-responsável agora usa OPS_TEAM direto. */
  team?: string[];
  meName?: string;
  onChanged?: () => void;
}) {
  const [stage, setStage] = useState<TaskStage>(task.stage);
  const [assignees, setAssignees] = useState<string[]>(
    task.assignees?.length ? task.assignees : task.assignee ? [task.assignee] : [],
  );
  const [priority, setPriority] = useState<DeliveryPriority>(task.priority ?? "media");
  const [requester, setRequester] = useState<string>(task.requester ?? "");
  const [logged, setLogged] = useState<number>(task.loggedH);
  const [addH, setAddH] = useState("");
  const [checklist, setChecklist] = useState<CheckItem[]>(() =>
    task.checklist?.length ? task.checklist : defaultChecklist(task.stage),
  );
  const [newItem, setNewItem] = useState("");
  const [comments, setComments] = useState<Comment[]>(() => task.comments ?? []);
  const [comment, setComment] = useState("");

  const author = meName || "Você";
  const primary = assignees[0] ?? "";

  function changeStage(s: TaskStage) {
    setStage(s);
    onStage?.(task.id, s);
  }

  function toggleAssignee(id: string) {
    const next = assignees.includes(id) ? assignees.filter((x) => x !== id) : [...assignees, id];
    setAssignees(next);
    void postDelivery({ action: "set-assignees", id: task.id, assignees: next }).then(() => onChanged?.());
  }
  function changePriority(p: DeliveryPriority) {
    setPriority(p);
    void postDelivery({ action: "set-priority", id: task.id, priority: p });
  }
  function changeRequester(r: string) {
    setRequester(r);
    void postDelivery({ action: "set-requester", id: task.id, requester: r });
  }

  function persistChecklist(next: CheckItem[]) {
    setChecklist(next);
    void postDelivery({ action: "set-checklist", id: task.id, checklist: next });
  }
  function toggleItem(i: number) {
    persistChecklist(checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)));
  }
  function addItem() {
    const label = newItem.trim();
    if (!label) return;
    persistChecklist([...checklist, { label, done: false }]);
    setNewItem("");
  }

  function addComment() {
    const text = comment.trim();
    if (!text) return;
    setComments((p) => [...p, { author, text }]);
    setComment("");
    void postDelivery({ action: "add-comment", id: task.id, comment: { author, text } });
  }

  async function logHours() {
    const h = Number(addH.replace(",", "."));
    if (!Number.isFinite(h) || h === 0) return;
    setLogged((v) => Math.max(0, v + h));
    setAddH("");
    await postDelivery({ action: "log-hours", id: task.id, hours: h });
  }

  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <p className="text-xs text-muted">{task.client}</p>
            <h2 className="text-base font-bold text-ink">{task.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {/* Responsáveis (multi) */}
          <div>
            <p className="mb-1 text-xs text-muted">Responsáveis {primary && <span className="text-[10px]">· principal: {memberName(primary)}</span>}</p>
            <div className="flex flex-wrap gap-1.5">
              {OPS_TEAM.map((m) => {
                const on = assignees.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleAssignee(m.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      on ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line text-muted hover:text-ink",
                    )}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-subtle-strong text-[8px] font-bold text-ink">{m.initials}</span>
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detalhes */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="mb-1 text-xs text-muted">Prioridade</p>
              <div className="flex flex-wrap gap-1">
                {DELIVERY_PRIORITIES.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => changePriority(p.key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold",
                      priority === p.key ? p.chip : "text-muted hover:text-ink",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} /> {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">Solicitante</p>
              <select
                value={requester}
                onChange={(e) => changeRequester(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-brand-400"
              >
                <option value="">—</option>
                {OPS_TEAM.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <D label="Prazo" value={task.dueLabel} tone={task.late ? "text-rose-500" : undefined} />
            <D label="Origem" value={task.origin} />
            <D label="Tipo" value={`${task.type} · ${TASK_TYPE_DURATIONS[task.type]}min`} />
          </div>

          {/* Mover estágio */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Estágio</p>
            <div className="flex flex-wrap gap-1.5">
              {TASK_STAGES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => changeStage(s.key)}
                  className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", stage === s.key ? "bg-brand-600 text-white" : "border border-line text-ink hover:bg-subtle")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist de entrega */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Checklist de entrega · {doneCount}/{checklist.length}</p>
            <div className="space-y-1">
              {checklist.map((c, i) => (
                <button
                  key={i}
                  onClick={() => toggleItem(i)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle"
                >
                  {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted" />}
                  <span className={cn(c.done ? "text-muted line-through" : "text-ink")}>{c.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                placeholder="Novo item…"
                className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
              />
            </div>
          </div>

          {/* Time tracking */}
          <div className="rounded-xl bg-subtle p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink">
              <Clock className="h-3.5 w-3.5" /> Time tracking
            </div>
            <p className="text-xs text-muted">
              {memberName(primary)}: {logged}h registradas de {task.estimateH}h estimadas.
            </p>
            <div className="mt-2 flex gap-1.5">
              <input
                value={addH}
                onChange={(e) => setAddH(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && logHours()}
                inputMode="decimal"
                placeholder="+ horas (ex.: 1,5)"
                className="w-32 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
              />
              <button
                onClick={logHours}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
              >
                <Plus className="h-3.5 w-3.5" /> Apontar
              </button>
            </div>
          </div>

          {/* Comentários */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
              <MessageSquare className="h-3.5 w-3.5" /> Comentários internos
            </div>
            <div className="space-y-2">
              {comments.length === 0 && (
                <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">Sem comentários ainda.</p>
              )}
              {comments.map((c, i) => (
                <div key={i} className="rounded-lg bg-canvas px-3 py-2">
                  <p className="text-[11px] font-semibold text-ink">{c.author}</p>
                  <p className="text-sm text-ink/90">{c.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="Comentar…"
                className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
              />
              <button onClick={addComment} className="rounded-lg bg-ink px-2.5 py-1.5 text-surface"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line p-4">
          <button onClick={onClose} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function D({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("font-medium text-ink", tone)}>{value}</p>
    </div>
  );
}
