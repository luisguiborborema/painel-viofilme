"use client";

import { useState } from "react";
import { ImagePlus, Link2, Megaphone, Plus, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DELIVERY_TODAY_ISO,
  OPS_TEAM,
  type DeliveryTask,
} from "@/lib/data/operacao";
import { TaskUniversal } from "./task-universal";

// Posicionamentos de tráfego (não formatos orgânicos): um criativo de
// performance nasce para um posicionamento de anúncio.
const PLACEMENTS = [
  "Meta Ads · 1:1",
  "Meta Ads · 9:16",
  "Google · Display/Discovery",
  "TikTok Ads",
] as const;

const STAGE_LABEL: Record<string, string> = {
  todo: "Backlog",
  doing: "Em produção",
  review: "Revisão interna",
  approval: "Aguardando cliente",
  done: "Publicado",
};

let seq = 5000;

export function CriativosTab({
  clientName,
  clientId,
  existing = [],
}: {
  clientName: string;
  clientId: string;
  existing?: DeliveryTask[];
}) {
  const [placement, setPlacement] = useState<(typeof PLACEMENTS)[number]>(PLACEMENTS[0]);
  const [title, setTitle] = useState("");
  const [angle, setAngle] = useState("");
  const [copy, setCopy] = useState("");
  const [cta, setCta] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [assignee, setAssignee] = useState(OPS_TEAM[0]?.id ?? "");
  const [secondary, setSecondary] = useState("");
  const [due, setDue] = useState("");
  // Seed com os criativos reais já solicitados do cliente (status real do Kanban).
  const [tasks, setTasks] = useState<DeliveryTask[]>(existing);
  const [open, setOpen] = useState<DeliveryTask | null>(null);
  const [saving, setSaving] = useState(false);

  function briefingText() {
    const secName = OPS_TEAM.find((m) => m.id === secondary)?.name;
    return [
      "**Briefing de criativo (performance)**",
      `Posicionamento: ${placement}`,
      `Urgência: ${urgent ? "Escala / alta prioridade" : "Normal"}`,
      angle.trim() && `Ângulo da oferta / dor: ${angle.trim()}`,
      copy.trim() && `Copy principal (texto na arte): ${copy.trim()}`,
      cta.trim() && `CTA: ${cta.trim()}`,
      refUrl.trim() && `Referência: ${refUrl.trim()}`,
      secName && `Secundário: ${secName}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    const composedTitle = `Criativo ${placement} — ${title.trim()}`;
    const type = placement.includes("9:16") ? "Vídeo" : "Arte";
    const optimistic: DeliveryTask = {
      id: `cr-${seq++}`,
      title: composedTitle,
      client: clientName,
      type,
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
      comments: [],
    };
    try {
      const res = await fetch("/api/gerencial/delivery-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: composedTitle,
          clientId,
          type,
          origin: "Projeto",
          assignee,
          stage: "todo",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const realId = data?.id && data.id !== "demo" ? String(data.id) : null;
      if (realId) {
        optimistic.id = realId;
        // Briefing tático vai como primeiro comentário da task.
        await fetch("/api/gerencial/delivery-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-comment",
            id: realId,
            comment: { text: briefingText(), author: "Tráfego" },
          }),
        });
      }
    } catch {
      // demo/offline: segue com o card otimista local
    } finally {
      setSaving(false);
    }
    setTasks((p) => [optimistic, ...p]);
    setTitle("");
    setAngle("");
    setCopy("");
    setCta("");
    setRefUrl("");
    setDue("");
    setSecondary("");
    setUrgent(false);
  }

  const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-ink">Solicitar criativo de performance</h2>
        </div>
        <p className="mb-3 text-xs text-muted">
          O gestor de tráfego pede o criativo — a tela gera a <strong>task de produção</strong> no Painel de Entregas.
        </p>

        <label className="mb-1 block text-xs font-medium text-muted">Posicionamento / plataforma</label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PLACEMENTS.map((p) => (
            <button key={p} onClick={() => setPlacement(p)} className={cn("rounded-full px-3 py-1 text-xs font-medium", placement === p ? "bg-brand-600 text-white" : "border border-line text-muted hover:text-ink")}>{p}</button>
          ))}
        </div>

        <label className="mb-1 block text-xs font-medium text-muted">Título / tema</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Oferta relâmpago fim de semana" className={cn(field, "mb-3")} />

        {/* Briefing tático em blocos (criativo é mais curto/tático que roteiro orgânico) */}
        <label className="mb-1 block text-xs font-medium text-muted">Ângulo da oferta / dor a explorar</label>
        <textarea value={angle} onChange={(e) => setAngle(e.target.value)} rows={2} placeholder="Qual dor/oferta o anúncio ataca" className={cn(field, "mb-3 resize-none")} />

        <label className="mb-1 block text-xs font-medium text-muted">Copy principal (texto na arte)</label>
        <textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={2} placeholder="O texto que aparece na peça" className={cn(field, "mb-3 resize-none")} />

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">CTA</label>
            <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Ex.: Peça agora" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Prazo</label>
            <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="ex.: 28/06" className={field} />
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-muted">
          <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> URL de referência (biblioteca de anúncios)</span>
        </label>
        <input value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="Cole um link do Meta Ads Library ou TikTok Creative Center" className={cn(field, "mb-3")} />

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Responsável principal</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}>
              {OPS_TEAM.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Secundário (opcional)</label>
            <select value={secondary} onChange={(e) => setSecondary(e.target.value)} className={field}>
              <option value="">—</option>
              {OPS_TEAM.filter((m) => m.id !== assignee).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setUrgent((v) => !v)}
          className={cn(
            "mb-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            urgent ? "border-rose-400 bg-rose-500/10 text-rose-500" : "border-line text-muted hover:text-ink",
          )}
        >
          <Zap className="h-3.5 w-3.5" /> {urgent ? "Escala / alta prioridade" : "Prioridade normal"}
        </button>

        <div>
          <button onClick={create} disabled={!title.trim() || saving} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            <Plus className="h-4 w-4" /> {saving ? "Gerando…" : "Gerar task de produção"}
          </button>
          <p className="mt-2 text-[11px] text-muted">O criativo vira uma task no Painel de Entregas (origem Projeto).</p>
        </div>
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
                  <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-semibold text-muted">
                    {STAGE_LABEL[t.stage] ?? "Backlog"}
                  </span>
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
