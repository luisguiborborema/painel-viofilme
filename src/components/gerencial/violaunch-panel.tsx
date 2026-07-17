"use client";

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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  VL_STATUS,
  type VioLaunchData,
  type VLGate,
  type VLResource,
  type VLStep,
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

function ResourceButton({ r }: { r: VLResource }) {
  const Icon = RES_ICON[r.kind];
  const verb = r.kind === "copiar" ? "Copiar" : r.kind === "abrir" ? "Abrir" : "Anexar";
  return (
    <button
      onClick={() => {
        if (r.kind === "copiar") void navigator.clipboard?.writeText(r.label);
      }}
      title="Recurso do manual — conteúdo real liga depois"
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
    >
      <Icon className="h-3.5 w-3.5 text-muted" /> {verb} · {r.label}
    </button>
  );
}

function StepItem({ step }: { step: VLStep }) {
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
        {step.placeholder ? (
          <p className="rounded-lg bg-subtle px-3 py-2 text-[11px] text-muted">
            Sub-passos deste passo virão do manual (VioLaunch). Estrutura pronta para receber ações, recursos e SLA.
          </p>
        ) : (
          <>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Ações</p>
              <ul className="space-y-1">
                {step.acoes.map((a) => (
                  <li key={a.label} className="flex items-center gap-2 text-sm">
                    {a.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-muted" />}
                    <span className={a.done ? "text-muted line-through" : "text-ink/90"}>{a.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            {step.recursos.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Recursos</p>
                <div className="flex flex-wrap gap-1.5">
                  {step.recursos.map((r) => <ResourceButton key={r.label} r={r} />)}
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted">SLA: {step.sla}</p>
          {step.statusTag && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              <Clock3 className="h-3 w-3" /> {step.statusTag}
            </span>
          )}
        </div>
      </div>
    </details>
  );
}

function GateRow({ gate }: { gate: VLGate }) {
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
          {gate.checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-xs">
              {c.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-muted" />}
              <span className={c.done ? "text-muted" : "text-ink/90"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function VioLaunchPanel({ data }: { data: VioLaunchData }) {
  const pct = Math.round((data.stepDone / data.total) * 100);

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
                  onClick={() => alert("Alternar Escopo Completo / Reduzido — em construção. O escopo reduzido remove B5 (template) e B6.")}
                  className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 hover:bg-brand-500/20"
                >
                  Escopo {data.scope === "completo" ? "Completo" : "Reduzido"}
                </button>
              </h2>
              <p className="text-xs text-muted">Produto Zero · consultoria de implementação · início {data.startDate}</p>
            </div>
          </div>
          <button
            onClick={() => alert("Editor do Roadmap — em construção. É onde o conteúdo dos 7 blocos será produzido (60% Playbook de Nicho + 40% personalizado).")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-subtle"
          >
            <FileEdit className="h-4 w-4" /> Editor do Roadmap
          </button>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-muted">Progresso geral</span>
            <span className="text-ink/90">{data.stepDone}/{data.total} passos</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-subtle-strong">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Jornada (esquerda) */}
        <div className="space-y-4 lg:col-span-2">
          {data.weeks.map((w) => (
            <Card key={w.n} className="p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-600">Semana {w.n} · {w.title}</p>
              <div className="space-y-2">
                {w.steps.map((s) => <StepItem key={s.n} step={s} />)}
                <GateRow gate={w.gate} />
              </div>
            </Card>
          ))}
        </div>

        {/* Roadmap (direita) */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Roadmap · 7 blocos</h3>
              <span className="text-xs font-medium text-muted">{data.roadmapPct}%</span>
            </div>
            <div className="space-y-2.5">
              {data.roadmap.map((b) => (
                <div key={b.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink/90"><span className="font-bold text-muted">{b.id}</span> · {b.label}</span>
                    <span className="text-muted">{b.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-subtle-strong">
                    <div className={cn("h-full rounded-full", b.pct >= 100 ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${b.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
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
    </div>
  );
}
