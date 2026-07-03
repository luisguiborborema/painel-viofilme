"use client";

import { useState } from "react";
import { ImagePlus, Megaphone, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DELIVERY_TODAY_ISO,
  OPS_TEAM,
  type DeliveryTask,
} from "@/lib/data/operacao";
import { TaskUniversal } from "./task-universal";

const FORMATS = ["Reels", "Feed", "Stories", "Carrossel"] as const;
let seq = 5000;

export function CriativosTab({ clientName }: { clientName: string }) {
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("Reels");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [assignee, setAssignee] = useState(OPS_TEAM[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [open, setOpen] = useState<DeliveryTask | null>(null);

  function create() {
    if (!title.trim()) return;
    const task: DeliveryTask = {
      id: `cr-${seq++}`,
      title: `Criativo ${format} — ${title.trim()}`,
      client: clientName,
      type: format === "Reels" ? "Vídeo" : "Arte",
      origin: "Projeto",
      assignee,
      stage: "todo",
      dueLabel: due.trim() ? `Prazo: ${due.trim()}` : "A definir",
      late: false,
      estimateH: 2,
      loggedH: 0,
      day: 2,
      startDay: 2,
      span: 1,
      dueDate: DELIVERY_TODAY_ISO,
    };
    setTasks((p) => [task, ...p]);
    setOpen(task);
    setTitle("");
    setObjective("");
    setDue("");
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-ink">Solicitar criativo de performance</h2>
        </div>
        <p className="mb-3 text-xs text-muted">
          O gestor de tráfego pede o criativo — a tela gera a <strong>task de produção</strong> (o resultado é monitorado no Portal/Campanhas, não aqui).
        </p>

        <label className="mb-1 block text-xs font-medium text-muted">Formato</label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <button key={f} onClick={() => setFormat(f)} className={cn("rounded-full px-3 py-1 text-xs font-medium", format === f ? "bg-brand-600 text-white" : "border border-line text-muted hover:text-ink")}>{f}</button>
          ))}
        </div>

        <label className="mb-1 block text-xs font-medium text-muted">Título / tema</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Oferta relâmpago fim de semana" className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400" />

        <label className="mb-1 block text-xs font-medium text-muted">Objetivo / instruções</label>
        <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} placeholder="Gancho, CTA, ângulo…" className="mb-3 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400" />

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Designer</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand-400">
              {OPS_TEAM.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Prazo</label>
            <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="ex.: 28/06" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400" />
          </div>
        </div>

        <button onClick={create} disabled={!title.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          <Plus className="h-4 w-4" /> Gerar task de produção
        </button>
        <p className="mt-2 text-[11px] text-muted">O criativo entra na Linha Editorial normal do cliente e vira uma task no Painel de Entregas.</p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Criativos solicitados</h2>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted">
            <ImagePlus className="h-8 w-8 opacity-40" />
            <p className="text-sm">Nenhum criativo solicitado ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((t) => (
              <li key={t.id}>
                <button onClick={() => setOpen(t)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-subtle">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{t.title}</span>
                    <span className="text-xs text-muted">{t.dueLabel}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[10px] text-muted">Para produzir</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && <TaskUniversal task={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
