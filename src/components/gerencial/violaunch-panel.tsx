"use client";

import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clapperboard,
  Clock3,
  Copy,
  ExternalLink,
  FileEdit,
  Lock,
  Paperclip,
  Rocket,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  VL_STATUS,
  type VioLaunchData,
  type VLBlock,
  type VLGate,
  type VLResource,
  type VLStatus,
  type VLStep,
  type VLWeek,
} from "@/lib/data/violaunch";

const GATE_STATE: Record<VLGate["state"], { label: string; chip: string; icon: typeof Lock }> = {
  liberado: { label: "Liberado", chip: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  validando: { label: "Validando", chip: "bg-amber-500/15 text-amber-600", icon: Clock3 },
  bloqueado: { label: "Bloqueado", chip: "bg-subtle text-muted", icon: Lock },
};

const RES_ICON = { copiar: Copy, abrir: ExternalLink, anexar: Paperclip } as const;
const CONNECTION = {
  vioday: { label: "VioDay", icon: Clapperboard, chip: "bg-amber-500/15 text-amber-600" },
  le: { label: "Linha Editorial", icon: FileEdit, chip: "bg-violet-500/15 text-violet-500" },
  agenda: { label: "Agenda", icon: CalendarDays, chip: "bg-sky-500/15 text-sky-500" },
} as const;

const STEP_STATUSES: VLStatus[] = ["proximo", "andamento", "concluido", "bloqueado"];
const GATE_STATES: VLGate["state"][] = ["bloqueado", "validando", "liberado"];

async function persist(body: Record<string, unknown>) {
  await fetch("/api/gerencial/violaunch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

function ResourceButton({ r }: { r: VLResource }) {
  const Icon = RES_ICON[r.kind];
  const verb = r.kind === "copiar" ? "Copiar" : r.kind === "abrir" ? "Abrir" : "Anexar";
  const [copied, setCopied] = useState(false);
  const has = !!r.ref;

  function act() {
    if (r.kind === "copiar") {
      void navigator.clipboard?.writeText(r.ref || r.label);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else if (has) {
      window.open(r.ref, "_blank", "noopener");
    }
  }

  return (
    <button
      onClick={act}
      title={has ? undefined : "Recurso do manual — conteúdo real liga depois"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
        has ? "border-line text-ink hover:bg-subtle" : "border-dashed border-line text-muted hover:bg-subtle",
      )}
    >
      <Icon className="h-3.5 w-3.5 text-muted" /> {copied ? "Copiado!" : `${verb} · ${r.label}`}
    </button>
  );
}

function StepItem({
  step,
  onStatus,
  onToggleAction,
}: {
  step: VLStep;
  onStatus: (n: number, status: VLStatus) => void;
  onToggleAction: (n: number, actionIndex: number, done: boolean) => void;
}) {
  const st = VL_STATUS[step.status];
  const conn = step.connection ? CONNECTION[step.connection] : null;
  return (
    <details className="group rounded-xl border border-line" open={step.status === "andamento"}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5">
        {step.status === "concluido" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : step.status === "bloqueado" ? (
          <Lock className="h-4 w-4 shrink-0 text-muted" />
        ) : (
          <Circle className={cn("h-4 w-4 shrink-0", step.status === "andamento" ? "text-sky-500" : "text-muted")} />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium", step.status === "proximo" || step.status === "bloqueado" ? "text-muted" : "text-ink")}>
            <span className="text-[10px] font-bold text-muted">{String(step.n).padStart(2, "0")} · </span>
            {step.label}
          </p>
          <p className="text-[11px] text-muted">{step.owner} · {step.date}</p>
        </div>
        {conn && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", conn.chip)}>
            <conn.icon className="h-3 w-3" /> {conn.label}
          </span>
        )}
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", st.chip)}>{st.label}</span>
      </summary>

      <div className="space-y-3 border-t border-line px-3 py-3">
        {step.placeholder && step.acoes.length === 0 ? (
          <p className="rounded-lg bg-subtle px-3 py-2 text-[11px] text-muted">
            Sub-passos deste passo virão do manual (VioLaunch). Estrutura pronta para receber ações, recursos e SLA.
          </p>
        ) : (
          <>
            {step.acoes.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Ações</p>
                <ul className="space-y-1">
                  {step.acoes.map((a, i) => (
                    <li key={i}>
                      <button
                        onClick={() => onToggleAction(step.n, i, !a.done)}
                        className="flex w-full items-center gap-2 text-left text-sm"
                      >
                        {a.done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted" />}
                        <span className={a.done ? "text-muted line-through" : "text-ink/90"}>{a.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {step.recursos.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Recursos</p>
                <div className="flex flex-wrap gap-1.5">
                  {step.recursos.map((r, i) => <ResourceButton key={i} r={r} />)}
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted">SLA: {step.sla}</p>
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            Status
            <select
              value={step.status}
              onChange={(e) => onStatus(step.n, e.target.value as VLStatus)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-ink outline-none focus:border-brand-400"
            >
              {STEP_STATUSES.map((s) => <option key={s} value={s}>{VL_STATUS[s].label}</option>)}
            </select>
          </label>
        </div>
      </div>
    </details>
  );
}

function GateRow({
  gate,
  gateNumber,
  onStatus,
  onToggleItem,
}: {
  gate: VLGate;
  gateNumber: number;
  onStatus: (gateNumber: number, state: VLGate["state"]) => void;
  onToggleItem: (gateNumber: number, itemIndex: number, done: boolean) => void;
}) {
  const meta = GATE_STATE[gate.state];
  return (
    <details className="rounded-xl border border-dashed border-line bg-subtle/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
        <meta.icon className="h-3.5 w-3.5 text-muted" />
        <span className="flex-1 text-xs font-semibold text-ink">{gate.label}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.chip)}>{meta.label}</span>
      </summary>
      <div className="border-t border-line px-3 py-2.5">
        <p className="mb-2 text-[11px] italic text-muted">{gate.rule}</p>
        <ul className="space-y-1">
          {gate.checklist.map((c, i) => (
            <li key={i}>
              <button onClick={() => onToggleItem(gateNumber, i, !c.done)} className="flex w-full items-center gap-2 text-left text-xs">
                {c.done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted" />}
                <span className={c.done ? "text-muted" : "text-ink/90"}>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <label className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          Trava
          <select
            value={gate.state}
            onChange={(e) => onStatus(gateNumber, e.target.value as VLGate["state"])}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-ink outline-none focus:border-brand-400"
          >
            {GATE_STATES.map((s) => <option key={s} value={s}>{GATE_STATE[s].label}</option>)}
          </select>
        </label>
      </div>
    </details>
  );
}

// Escopo Reduzido (VL): remove B6 e trata B5 como template (não conta no %).
function applyScope(roadmap: VLBlock[], scope: "completo" | "reduzido"): { visible: VLBlock[]; note: Record<string, string> } {
  if (scope !== "reduzido") return { visible: roadmap, note: {} };
  const visible = roadmap.filter((b) => b.id !== "B6").map((b) => (b.id === "B5" ? { ...b, label: `${b.label} · template` } : b));
  return { visible, note: { B5: "template", B6: "removido" } };
}

export function VioLaunchPanel({ clientId, data }: { clientId: string; data: VioLaunchData }) {
  const [weeks, setWeeks] = useState<VLWeek[]>(data.weeks);
  const [roadmap, setRoadmap] = useState(data.roadmap);
  const [scope, setScope] = useState(data.scope);
  const [editorOpen, setEditorOpen] = useState(false);

  const { visible: visibleRoadmap } = applyScope(roadmap, scope);
  const allSteps = weeks.flatMap((w) => w.steps);
  const stepDone = allSteps.filter((s) => s.status === "concluido").length;
  const total = allSteps.length;
  const pct = total ? Math.round((stepDone / total) * 100) : 0;
  const roadmapPct = visibleRoadmap.length ? Math.round(visibleRoadmap.reduce((a, b) => a + b.pct, 0) / visibleRoadmap.length) : 0;

  function setStepStatus(n: number, status: VLStatus) {
    setWeeks((prev) => prev.map((w) => ({ ...w, steps: w.steps.map((s) => (s.n === n ? { ...s, status } : s)) })));
    void persist({ action: "set-step-status", clientId, stepNumber: n, status });
  }
  function toggleAction(n: number, actionIndex: number, done: boolean) {
    setWeeks((prev) => prev.map((w) => ({
      ...w,
      steps: w.steps.map((s) => (s.n === n ? { ...s, acoes: s.acoes.map((a, i) => (i === actionIndex ? { ...a, done } : a)) } : s)),
    })));
    void persist({ action: "toggle-action", clientId, stepNumber: n, actionIndex, done });
  }
  function setGateStatus(gateNumber: number, state: VLGate["state"]) {
    setWeeks((prev) => prev.map((w) => (w.n === gateNumber ? { ...w, gate: { ...w.gate, state } } : w)));
    void persist({ action: "set-gate-status", clientId, gateNumber, status: state });
  }
  function toggleGateItem(gateNumber: number, itemIndex: number, done: boolean) {
    setWeeks((prev) => prev.map((w) => (
      w.n === gateNumber
        ? { ...w, gate: { ...w.gate, checklist: w.gate.checklist.map((c, i) => (i === itemIndex ? { ...c, done } : c)) } }
        : w
    )));
    void persist({ action: "toggle-gate-item", clientId, gateNumber, itemIndex, done });
  }
  function setBlockProgress(id: string, value: number) {
    const p = Math.max(0, Math.min(100, Math.round(value) || 0));
    setRoadmap((prev) => prev.map((b) => (b.id === id ? { ...b, pct: p } : b)));
    void persist({ action: "set-block-progress", clientId, blockCode: id, progress: p });
  }
  function setBlockContent(id: string, content: string) {
    setRoadmap((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
    void persist({ action: "set-block-content", clientId, blockCode: id, content });
  }
  function toggleScope() {
    const next = scope === "completo" ? "reduzido" : "completo";
    setScope(next);
    void persist({ action: "set-scope", clientId, scope: next });
  }

  return (
    <div className="space-y-4">
      {/* Header do produto */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Rocket className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                VioLaunch™
                <button
                  onClick={toggleScope}
                  title="Escopo Reduzido remove B5 (template) e B6 — lógica de blocos liga depois."
                  className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 hover:bg-brand-500/20"
                >
                  Escopo {scope === "completo" ? "Completo" : "Reduzido"}
                </button>
              </h2>
              <p className="text-xs text-muted">Produto Zero · consultoria de implementação · início {data.startDate}</p>
            </div>
          </div>
          <button
            onClick={() => setEditorOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-subtle"
          >
            <FileEdit className="h-4 w-4" /> Editor do Roadmap
          </button>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-muted">Progresso geral</span>
            <span className="text-ink/90">{stepDone}/{total} passos</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-subtle-strong">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Jornada (esquerda) */}
        <div className="space-y-4 lg:col-span-2">
          {weeks.map((w) => (
            <Card key={w.n} className="p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-600">Semana {w.n} · {w.title}</p>
              <div className="space-y-2">
                {w.steps.map((s) => (
                  <StepItem key={s.n} step={s} onStatus={setStepStatus} onToggleAction={toggleAction} />
                ))}
                <GateRow gate={w.gate} gateNumber={w.n} onStatus={setGateStatus} onToggleItem={toggleGateItem} />
              </div>
            </Card>
          ))}
        </div>

        {/* Roadmap (direita) */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Roadmap · 7 blocos</h3>
              <span className="text-xs font-medium text-muted">{roadmapPct}%</span>
            </div>
            <div className="space-y-2.5">
              {visibleRoadmap.map((b) => (
                <div key={b.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink/90"><span className="font-bold text-muted">{b.id}</span> · {b.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={b.pct}
                      onChange={(e) => setBlockProgress(b.id, Number(e.target.value))}
                      className="w-14 rounded border border-line bg-surface px-1.5 py-0.5 text-right text-[11px] text-ink outline-none focus:border-brand-400"
                    />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-subtle-strong">
                    <div className={cn("h-full rounded-full", b.pct >= 100 ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${b.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setEditorOpen(true)}
              className="mt-3 w-full rounded-lg border border-dashed border-line py-2 text-xs font-medium text-muted hover:bg-subtle"
            >
              Abrir editor do Roadmap
            </button>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">Conexões</h3>
            <ul className="space-y-1.5 text-xs text-muted">
              <li className="flex items-center gap-2"><Clapperboard className="h-3.5 w-3.5 text-amber-600" /> Passo 10 (Media Day) → aba VioDay</li>
              <li className="flex items-center gap-2"><FileEdit className="h-3.5 w-3.5 text-violet-500" /> Passo 8 (Editorial) → Linha Editorial</li>
              <li className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-sky-500" /> Onboarding · Kickoff · Launch → Agenda</li>
            </ul>
          </Card>
        </div>
      </div>

      {editorOpen && (
        <RoadmapEditor blocks={visibleRoadmap} onSave={setBlockContent} onClose={() => setEditorOpen(false)} />
      )}
    </div>
  );
}

// Editor do conteúdo dos blocos do Roadmap (VL04) — persiste content por bloco.
function RoadmapEditor({
  blocks,
  onSave,
  onClose,
}: {
  blocks: VLBlock[];
  onSave: (id: string, content: string) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(blocks[0]?.id ?? "");
  const current = blocks.find((b) => b.id === active) ?? blocks[0];
  const [text, setText] = useState(current?.content ?? "");
  const [saved, setSaved] = useState(false);

  function pick(id: string) {
    setActive(id);
    setText(blocks.find((b) => b.id === id)?.content ?? "");
    setSaved(false);
  }
  function save() {
    if (!current) return;
    onSave(current.id, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Editor do Roadmap</h3>
            <p className="text-[11px] text-muted">Conteúdo dos 7 blocos · 60% Playbook de Nicho + 40% personalizado</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="w-40 shrink-0 overflow-y-auto border-r border-line p-2">
            {blocks.map((b) => (
              <button
                key={b.id}
                onClick={() => pick(b.id)}
                className={cn("mb-1 w-full rounded-lg px-2.5 py-2 text-left text-xs", b.id === active ? "bg-brand-500/10 font-semibold text-brand-600" : "text-ink hover:bg-subtle")}
              >
                <span className="font-bold text-muted">{b.id}</span> · {b.label}
                <span className="block text-[10px] text-muted">{b.pct}%</span>
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-4">
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setSaved(false); }}
              placeholder={`Conteúdo do bloco ${current?.id ?? ""}… (texto/markdown)`}
              className="min-h-[280px] flex-1 resize-none rounded-lg border border-line bg-canvas p-3 text-sm text-ink outline-none focus:border-brand-400"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              {saved && <span className="text-xs text-emerald-600">Salvo</span>}
              <button onClick={save} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Salvar bloco
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
