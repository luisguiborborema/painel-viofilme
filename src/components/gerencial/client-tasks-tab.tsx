"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { OPS_TEAM, type DeliveryTask } from "@/lib/data/operacao";
import { TaskUniversal } from "./task-universal";

const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;
const STAGE_STATUS: Record<string, { label: string; chip: string }> = {
  done: { label: "Concluída", chip: "bg-emerald-500/15 text-emerald-600" },
  doing: { label: "Em produção", chip: "bg-sky-500/15 text-sky-500" },
  todo: { label: "Para produzir", chip: "bg-subtle text-muted" },
  review: { label: "Revisão interna", chip: "bg-violet-500/15 text-violet-500" },
  approval: { label: "Para aprovar", chip: "bg-amber-500/15 text-amber-600" },
};

export function ClientTasksTab({ tasks: initial }: { tasks: DeliveryTask[] }) {
  const [tasks, setTasks] = useState(initial);
  const [selected, setSelected] = useState<DeliveryTask | null>(null);

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-semibold text-ink">Sem tarefas</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Nenhuma tarefa registrada para este cliente. Elas aparecem aqui quando entram na Linha Editorial ou como pedido/projeto.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2.5">Tarefa</th>
              <th className="px-4 py-2.5">Prazo</th>
              <th className="px-4 py-2.5">Responsável</th>
              <th className="px-4 py-2.5">Origem</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const st = STAGE_STATUS[t.stage] ?? STAGE_STATUS.todo;
              return (
                <tr key={t.id} onClick={() => setSelected(t)} className="cursor-pointer border-b border-line/60 hover:bg-subtle">
                  <td className="px-4 py-3 font-medium text-ink">{t.title}</td>
                  <td className={cn("px-4 py-3 text-xs", t.late ? "font-medium text-rose-500" : "text-muted")}>{t.dueLabel}</td>
                  <td className="px-4 py-3 text-muted">
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={memberName(t.assignee)} size={22} />
                      {memberName(t.assignee)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{t.origin}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", st.chip)}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
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
