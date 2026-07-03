"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, MessageSquare, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OPS_TEAM,
  TASK_STAGES,
  TASK_TYPE_DURATIONS,
  type DeliveryTask,
  type TaskStage,
} from "@/lib/data/operacao";

const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;

/**
 * HUB14 — Task universal: componente único de task, invocável por task_id de
 * qualquer lugar (Kanban, LE, Criativos, Tarefas). Detalhes + checklist + time
 * tracking + comentários + mover estágio. Mudanças são locais (mock).
 */
export function TaskUniversal({
  task,
  onClose,
  onStage,
}: {
  task: DeliveryTask;
  onClose: () => void;
  onStage?: (id: string, stage: TaskStage) => void;
}) {
  const [stage, setStage] = useState<TaskStage>(task.stage);
  const [checklist, setChecklist] = useState<{ label: string; done: boolean }[]>([
    { label: "Briefing lido", done: true },
    { label: "Rascunho / primeira versão", done: task.stage !== "todo" },
    { label: "Revisão interna", done: ["review", "approval", "done"].includes(task.stage) },
    { label: "Aprovado pelo cliente", done: task.stage === "done" },
  ]);
  const [newItem, setNewItem] = useState("");
  const [comments, setComments] = useState<{ author: string; text: string }[]>([
    { author: memberName(task.assignee), text: "Comecei a produção, dúvida na paleta." },
  ]);
  const [comment, setComment] = useState("");

  function changeStage(s: TaskStage) {
    setStage(s);
    onStage?.(task.id, s);
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
          {/* Detalhes */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <D label="Responsável" value={memberName(task.assignee)} />
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
                  onClick={() => setChecklist((prev) => prev.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle"
                >
                  {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted" />}
                  <span className={cn(c.done ? "text-muted line-through" : "text-ink")}>{c.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newItem.trim() && (setChecklist((p) => [...p, { label: newItem.trim(), done: false }]), setNewItem(""))} placeholder="Novo item…" className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400" />
            </div>
          </div>

          {/* Time tracking */}
          <div className="rounded-xl bg-subtle p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink">
              <Clock className="h-3.5 w-3.5" /> Time tracking
            </div>
            <p className="text-xs text-muted">
              {memberName(task.assignee)}: {task.loggedH}h registradas de {task.estimateH}h estimadas.
            </p>
          </div>

          {/* Comentários */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
              <MessageSquare className="h-3.5 w-3.5" /> Comentários internos
            </div>
            <div className="space-y-2">
              {comments.map((c, i) => (
                <div key={i} className="rounded-lg bg-canvas px-3 py-2">
                  <p className="text-[11px] font-semibold text-ink">{c.author}</p>
                  <p className="text-sm text-ink/90">{c.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && comment.trim() && (setComments((p) => [...p, { author: "Você", text: comment.trim() }]), setComment(""))} placeholder="Comentar…" className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400" />
              <button onClick={() => comment.trim() && (setComments((p) => [...p, { author: "Você", text: comment.trim() }]), setComment(""))} className="rounded-lg bg-ink px-2.5 py-1.5 text-surface"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Footer — integração portal */}
        <div className="flex items-center justify-between gap-2 border-t border-line p-4">
          <button
            onClick={() => alert("Lembrete/aprovação enviado ao Portal do Cliente (simulado).")}
            className="rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-subtle"
          >
            Enviar ao portal do cliente
          </button>
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
