"use client";

import { useState } from "react";
import { Clapperboard, ImagePlus, Link2, Megaphone, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  ART_DIRECTIONS,
  DELIVERY_TODAY_ISO,
  OPS_TEAM,
  type ArtDirection,
  type CampaignGoal,
  type DeliveryTask,
  type EditorialFormat,
} from "@/lib/data/operacao";
import { TaskFicha } from "./linha-editorial";

// Objetivo de campanha (CP01.1) — a decisão mais importante, em cards coloridos.
const GOALS: { key: CampaignGoal; label: string; hint: string; card: string; chip: string }[] = [
  { key: "conversao", label: "Conversão", hint: "Vendas / leads", card: "border-emerald-400 bg-emerald-500/10", chip: "bg-emerald-500/15 text-emerald-600" },
  { key: "trafego", label: "Tráfego", hint: "Site / perfil", card: "border-sky-400 bg-sky-500/10", chip: "bg-sky-500/15 text-sky-500" },
  { key: "alcance", label: "Alcance", hint: "Mais gente", card: "border-violet-400 bg-violet-500/10", chip: "bg-violet-500/15 text-violet-500" },
  { key: "reconhecimento", label: "Reconhecimento", hint: "Marca na memória", card: "border-amber-400 bg-amber-500/10", chip: "bg-amber-500/15 text-amber-600" },
];
const GOAL_META = Object.fromEntries(GOALS.map((g) => [g.key, g]));

const FORMATS: EditorialFormat[] = ["Reels", "Feed", "Stories", "Carrossel"];

const STAGE_LABEL: Record<string, string> = {
  todo: "Backlog",
  doing: "Em produção",
  review: "Revisão interna",
  approval: "Aguardando cliente",
  done: "Pronto",
};
const STAGE_CHIP: Record<string, string> = {
  todo: "bg-subtle text-muted",
  doing: "bg-sky-500/15 text-sky-500",
  review: "bg-violet-500/15 text-violet-500",
  approval: "bg-amber-500/15 text-amber-600",
  done: "bg-emerald-500/15 text-emerald-600",
};

const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;
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
  const [goal, setGoal] = useState<CampaignGoal | "">("");
  const [format, setFormat] = useState<EditorialFormat | "">("");
  const [title, setTitle] = useState("");
  const [roteiro, setRoteiro] = useState("");
  const [art, setArt] = useState<ArtDirection>("Banco do cliente");
  const [refUrl, setRefUrl] = useState("");
  const [assignee, setAssignee] = useState(OPS_TEAM[0]?.id ?? "");
  const [secondary, setSecondary] = useState("");
  const [due, setDue] = useState("");
  const [tasks, setTasks] = useState<DeliveryTask[]>(existing);
  const [open, setOpen] = useState<DeliveryTask | null>(null);
  const [saving, setSaving] = useState(false);

  const canGenerate = !!goal && !!format && !!title.trim();
  const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";
  // Aviso leve se o prazo (dd/mm) já passou neste ano — não bloqueia o envio.
  const duePast = (() => {
    const m = due.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!m) return false;
    const now = new Date();
    const cand = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1]));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return cand < today;
  })();

  function briefingText() {
    const secName = OPS_TEAM.find((m) => m.id === secondary)?.name;
    return [
      "**Briefing de criativo (performance)**",
      goal && `Objetivo de campanha: ${GOAL_META[goal]?.label}`,
      `Formato: ${format}`,
      roteiro.trim() && `Instruções / roteiro:\n${roteiro.trim()}`,
      `Direcionamento de arte: ${art}`,
      refUrl.trim() && `Referência / moodboard: ${refUrl.trim()}`,
      secName && `Secundário: ${secName}`,
    ].filter(Boolean).join("\n");
  }

  async function create() {
    if (!canGenerate) return;
    setSaving(true);
    const type = format === "Reels" ? "Vídeo" : "Arte";
    const optimistic: DeliveryTask = {
      id: `cr-${seq++}`,
      title: title.trim(),
      client: clientName,
      type,
      origin: "Performance",
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
      campaignGoal: goal || undefined,
      contentFormat: format || undefined,
    };
    try {
      const res = await fetch("/api/gerencial/delivery-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: title.trim(),
          clientId,
          type,
          origin: "Performance",
          assignee,
          stage: "todo",
          campaignGoal: goal,
          contentFormat: format,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const realId = data?.id && data.id !== "demo" ? String(data.id) : null;
      if (realId) {
        optimistic.id = realId;
        await fetch("/api/gerencial/delivery-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add-comment", id: realId, comment: { text: briefingText(), author: "Tráfego" } }),
        });
      }
    } catch {
      /* demo/offline: card otimista local */
    } finally {
      setSaving(false);
    }
    setTasks((p) => [optimistic, ...p]);
    setGoal("");
    setFormat("");
    setTitle("");
    setRoteiro("");
    setRefUrl("");
    setDue("");
    setSecondary("");
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      {/* Esquerda · formulário de solicitação */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-ink">Solicitar criativo de performance</h2>
        </div>
        <p className="mb-4 text-xs text-muted">
          O gestor de tráfego pede o criativo — a tela gera a <strong>task de produção</strong> (entra na LE do mês como <code>performance</code>).
        </p>

        {/* 1. Objetivo de campanha */}
        <label className="mb-1.5 block text-xs font-medium text-muted">Objetivo de campanha</label>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GOALS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGoal(g.key)}
              className={cn(
                "rounded-xl border p-2.5 text-left transition-colors",
                goal === g.key ? g.card : "border-line bg-subtle hover:border-brand-300",
              )}
            >
              <p className="text-xs font-semibold text-ink">{g.label}</p>
              <p className="text-[10px] text-muted">{g.hint}</p>
            </button>
          ))}
        </div>

        {/* 2. Formato */}
        <label className="mb-1.5 block text-xs font-medium text-muted">Formato</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <button key={f} onClick={() => setFormat(f)} className={cn("rounded-full px-3 py-1 text-xs font-medium", format === f ? "bg-brand-600 text-white" : "border border-line text-muted hover:text-ink")}>{f}</button>
          ))}
        </div>

        {/* 3. Título / tema */}
        <label className="mb-1 block text-xs font-medium text-muted">Título / tema</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Oferta relâmpago fim de semana" className={cn(field, "mb-4")} />

        {/* 4. Instruções / roteiro (campo livre) */}
        <label className="mb-1 block text-xs font-medium text-muted">Instruções / roteiro</label>
        <textarea value={roteiro} onChange={(e) => setRoteiro(e.target.value)} rows={4} placeholder="Gancho, ângulo, CTA — como no briefing da task." className={cn(field, "mb-4 resize-y")} />

        {/* 5. Direção de arte + referência */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Direcionamento de arte</label>
            <select value={art} onChange={(e) => setArt(e.target.value as ArtDirection)} className={field}>
              {ART_DIRECTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {art === "Media Day" && (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
                <Clapperboard className="h-3 w-3" /> → entra no próximo VioDay
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Referência / moodboard</span>
            </label>
            <input value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="Cole um link (Meta Ads Library, TikTok…)" className={field} />
          </div>
        </div>

        {/* 6. Responsável + prazo */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Responsável principal</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}>
              {OPS_TEAM.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Secundário</label>
            <select value={secondary} onChange={(e) => setSecondary(e.target.value)} className={field}>
              <option value="">—</option>
              {OPS_TEAM.filter((m) => m.id !== assignee).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Prazo</label>
            <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="ex.: 28/06" className={field} />
            {duePast && <p className="mt-1 text-[11px] text-amber-600">Esse prazo já passou neste ano — confira a data.</p>}
          </div>
        </div>

        <button onClick={create} disabled={!canGenerate || saving} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          <Plus className="h-4 w-4" /> {saving ? "Gerando…" : "Gerar task de produção"}
        </button>
        <p className="mt-2 text-[11px] text-muted">Cria a task no Painel de Entregas e marca o criativo como <code>performance</code> na LE do mês.</p>
      </Card>

      {/* Direita · acompanhamento */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Criativos solicitados</h2>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted">
            <ImagePlus className="h-8 w-8 opacity-40" />
            <p className="text-sm">Nenhum criativo solicitado ainda.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => {
              const g = t.campaignGoal ? GOAL_META[t.campaignGoal] : null;
              return (
                <li key={t.id}>
                  <button onClick={() => setOpen(t)} className="w-full rounded-xl border border-line p-3 text-left hover:bg-subtle">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{t.title}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CHIP[t.stage] ?? STAGE_CHIP.todo)}>
                        {STAGE_LABEL[t.stage] ?? "Backlog"}
                      </span>
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      {t.contentFormat && <span className="rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted">{t.contentFormat}</span>}
                      {g && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", g.chip)}>{g.label}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <Avatar name={memberName(t.assignee)} size={20} /> {memberName(t.assignee)}
                      </span>
                      <span className="text-[11px] text-muted">{t.dueLabel}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {open && <TaskFicha task={open} clientId={clientId} onClose={() => setOpen(null)} />}
    </div>
  );
}
