"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Workflow, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASSIGNMENT_MODES,
  type AssignmentConfig,
  type AssignmentMode,
  type Pipeline,
  type StageAutomation,
} from "@/lib/data/crm";

const inputCls = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

function describeAutomation(a: StageAutomation): string {
  switch (a.type) {
    case "task": return `Cria tarefa: “${a.title}”${a.dueDays != null ? ` (+${a.dueDays}d)` : ""}`;
    case "whatsapp": return "Envia WhatsApp ao contato";
    case "notify": return "Notifica o time";
    case "flow": return "Aplica cadência/fluxo de tarefas";
    default: return "Automação";
  }
}

export function AssignmentManager({
  config: initial,
  team = [],
  pipelines = [],
}: {
  config: AssignmentConfig;
  team?: string[];
  pipelines?: Pipeline[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AssignmentMode>(initial.mode);
  const [pool, setPool] = useState<string[]>(initial.pool ?? []);
  const [inbound, setInbound] = useState(initial.byOrigin?.inbound ?? "");
  const [outbound, setOutbound] = useState(initial.byOrigin?.outbound ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function togglePool(name: string) {
    setPool((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    await fetch("/api/crm/assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: { mode, pool, byOrigin: { inbound: inbound || undefined, outbound: outbound || undefined } },
      }),
    }).catch(() => {});
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  const stagesWithAuto = pipelines.flatMap((p) =>
    p.stages
      .filter((s) => (s.automations?.length ?? 0) > 0)
      .map((s) => ({ pipeline: p.name, stage: s.label, color: s.color, automations: s.automations })),
  );

  return (
    <div className="space-y-6">
      {/* Atribuição automática */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Atribuição de novos negócios</h3>
          <p className="text-xs text-muted">Como o responsável é definido quando ninguém escolhe na criação.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ASSIGNMENT_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                mode === m.key ? "border-brand-500 bg-brand-50/40" : "border-line hover:bg-subtle",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {mode === m.key && <Check className="h-3.5 w-3.5 text-brand-600" />}
                {m.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{m.hint}</span>
            </button>
          ))}
        </div>

        {mode === "origem" && (
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-canvas p-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">Inbound →</span>
              <select value={inbound} onChange={(e) => setInbound(e.target.value)} className={inputCls}>
                <option value="">— escolher —</option>
                {team.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">Outbound →</span>
              <select value={outbound} onChange={(e) => setOutbound(e.target.value)} className={inputCls}>
                <option value="">— escolher —</option>
                {team.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        )}

        {(mode === "rodizio" || mode === "carga") && (
          <div className="rounded-xl border border-line bg-canvas p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              Elegíveis {pool.length === 0 && <span className="normal-case">(vazio = todos os gerenciais)</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {team.map((n) => (
                <button
                  key={n}
                  onClick={() => togglePool(n)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    pool.includes(n) ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong",
                  )}
                >
                  {pool.includes(n) && <Check className="h-3 w-3" />}
                  {n}
                </button>
              ))}
              {team.length === 0 && <span className="text-xs text-muted">Nenhum membro na equipe.</span>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </button>
          {saved && <span className="text-xs font-medium text-emerald-600">Salvo ✓</span>}
        </div>
      </section>

      {/* Automações por etapa (leitura) */}
      <section className="space-y-2">
        <div>
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Zap className="h-4 w-4 text-amber-500" /> Automações por etapa
          </h3>
          <p className="text-xs text-muted">
            Disparadas quando um negócio entra na etapa. Edite em <strong>Pipelines &amp; estágios</strong>.
          </p>
        </div>
        {stagesWithAuto.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-muted">
            Nenhuma automação configurada. Adicione em Pipelines &amp; estágios.
          </p>
        ) : (
          <div className="space-y-2">
            {stagesWithAuto.map((s, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-3">
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.stage}
                  <span className="text-xs font-normal text-muted">· {s.pipeline}</span>
                </p>
                <ul className="space-y-1">
                  {s.automations.map((a, j) => (
                    <li key={j} className="flex items-center gap-2 text-xs text-muted">
                      <Workflow className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                      {describeAutomation(a)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
