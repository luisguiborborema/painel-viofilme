"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus, Trash2, Workflow as WorkflowIcon, Zap } from "lucide-react";
import {
  WORKFLOW_ACTION_TYPES,
  type Workflow,
  type WorkflowAction,
  type WorkflowActionType,
} from "@/lib/data/crm";
import { cn } from "@/lib/utils";
import { EmptyState } from "./settings-ui";

function post(body: unknown) {
  return fetch("/api/crm/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

type WorkflowStats = Record<string, { active: number; done: number; canceled: number }>;

export function WorkflowManager({
  workflows,
  stageOptions,
  dealProps,
  team = [],
  stats = {},
}: {
  workflows: Workflow[];
  stageOptions: { key: string; label: string }[];
  dealProps: { key: string; label: string }[];
  team?: string[];
  stats?: WorkflowStats;
}) {
  const router = useRouter();

  async function createWf() {
    const name = window.prompt("Nome do workflow:");
    if (!name?.trim()) return;
    await post({ action: "create", name: name.trim(), triggerType: "stage_enter", triggerConfig: {} });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-xs text-muted">
          Automações estilo HubSpot: quando um negócio <strong className="text-ink">entra numa etapa</strong> (ou é
          criado), o workflow roda a sequência de ações. Ative para o motor processar (via cron).
        </p>
        <button
          onClick={createWf}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Novo workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <EmptyState icon={WorkflowIcon}>
          Nenhum workflow ainda. Crie um para automatizar tarefas, mensagens e propriedades por etapa.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <WorkflowCard key={wf.id} wf={wf} stageOptions={stageOptions} dealProps={dealProps} team={team} stat={stats[wf.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  wf,
  stageOptions,
  dealProps,
  team,
  stat,
}: {
  wf: Workflow;
  stageOptions: { key: string; label: string }[];
  dealProps: { key: string; label: string }[];
  team: string[];
  stat?: { active: number; done: number; canceled: number };
}) {
  const router = useRouter();
  const [name, setName] = useState(wf.name);
  const stageKey = (wf.triggerConfig?.stageKey as string) ?? "";
  const propKey = (wf.triggerConfig?.key as string) ?? "";
  const propVal = (wf.triggerConfig?.value as string) ?? "";

  async function saveName() {
    if (name.trim() && name.trim() !== wf.name) {
      await post({ action: "update", id: wf.id, name: name.trim() });
      router.refresh();
    }
  }
  async function toggleActive() {
    await post({ action: "update", id: wf.id, isActive: !wf.isActive });
    router.refresh();
  }
  async function setTrigger(triggerType: string, cfg: Record<string, unknown>) {
    await post({ action: "update", id: wf.id, triggerType, triggerConfig: cfg });
    router.refresh();
  }
  async function removeWf() {
    if (!window.confirm("Excluir este workflow?")) return;
    await post({ action: "delete", id: wf.id });
    router.refresh();
  }
  async function addAction(actionType: WorkflowActionType) {
    await post({
      action: "add-action",
      workflowId: wf.id,
      actionType,
      position: wf.actions.length,
      config: {},
    });
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              wf.isActive ? "bg-brand-600 text-white" : "bg-subtle text-muted",
            )}
          >
            <Zap className="h-4 w-4" />
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            className="rounded-lg border border-transparent px-1.5 py-1 text-sm font-semibold text-ink outline-none hover:border-line focus:border-brand-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleActive}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              wf.isActive ? "bg-emerald-500/15 text-emerald-600" : "bg-subtle text-muted hover:bg-subtle-strong",
            )}
          >
            {wf.isActive ? "Ativo" : "Inativo"}
          </button>
          <button onClick={removeWf} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500" title="Excluir">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {stat && (stat.active + stat.done + stat.canceled) > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
          <span>▶ {stat.active} ativa{stat.active === 1 ? "" : "s"}</span>
          <span className="text-emerald-600">✓ {stat.done} concluída{stat.done === 1 ? "" : "s"}</span>
          {stat.canceled > 0 && <span className="text-rose-500">✕ {stat.canceled} cancelada{stat.canceled === 1 ? "" : "s"}</span>}
        </p>
      )}

      {/* Gatilho */}
      <div className="mt-3 rounded-xl border border-line bg-canvas p-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Quando (gatilho)</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={wf.triggerType}
            onChange={(e) => {
              const t = e.target.value;
              setTrigger(t, t === "stage_enter" ? { stageKey } : t === "property_change" ? { key: propKey, value: propVal } : {});
            }}
            className={inputCls + " w-auto"}
          >
            <option value="stage_enter">Negócio entra na etapa</option>
            <option value="created">Negócio é criado</option>
            <option value="property_change">Propriedade muda</option>
          </select>
          {wf.triggerType === "stage_enter" && (
            <select
              value={stageKey}
              onChange={(e) => setTrigger("stage_enter", { stageKey: e.target.value })}
              className={inputCls + " w-auto"}
            >
              <option value="">Escolha a etapa…</option>
              {stageOptions.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          )}
          {wf.triggerType === "property_change" && (
            <>
              <select
                value={propKey}
                onChange={(e) => setTrigger("property_change", { key: e.target.value, value: propVal })}
                className={inputCls + " w-auto"}
              >
                <option value="">Propriedade…</option>
                {dealProps.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              <input
                defaultValue={propVal}
                onBlur={(e) => setTrigger("property_change", { key: propKey, value: e.target.value })}
                placeholder="= valor (opcional)"
                className={inputCls + " w-40"}
              />
            </>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Então (ações)</p>
        <div className="space-y-2">
          {wf.actions.map((a, i) => (
            <ActionRow key={a.id} action={a} index={i} dealProps={dealProps} stageOptions={stageOptions} team={team} />
          ))}
          {wf.actions.length === 0 && (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
              Sem ações. Adicione a primeira abaixo.
            </p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WORKFLOW_ACTION_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => addAction(t.key)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-brand-400 hover:text-brand-600"
            >
              <Plus className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  action,
  index,
  dealProps,
  stageOptions,
  team,
}: {
  action: WorkflowAction;
  index: number;
  dealProps: { key: string; label: string }[];
  stageOptions: { key: string; label: string }[];
  team: string[];
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState<Record<string, unknown>>(action.config ?? {});

  function set(patch: Record<string, unknown>) {
    setCfg((c) => ({ ...c, ...patch }));
  }
  async function saveCfg(next?: Record<string, unknown>) {
    await post({ action: "update-action", id: action.id, config: next ?? cfg });
    router.refresh();
  }
  async function removeAction() {
    await post({ action: "delete-action", id: action.id });
    router.refresh();
  }

  const meta = WORKFLOW_ACTION_TYPES.find((t) => t.key === action.actionType);

  return (
    <div className="rounded-xl border border-line bg-canvas p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">{index + 1}</span>
          {action.actionType === "delay" ? <Clock className="h-3.5 w-3.5 text-muted" /> : null}
          {meta?.label ?? action.actionType}
        </span>
        <button onClick={removeAction} className="rounded-lg p-1 text-muted hover:text-rose-500" title="Remover ação">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {action.actionType === "delay" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">
            Dias
            <input type="number" min={0} value={Number(cfg.days ?? 0)} onChange={(e) => set({ days: Number(e.target.value) || 0 })} onBlur={() => saveCfg()} className={inputCls} />
          </label>
          <label className="text-xs text-muted">
            Horas
            <input type="number" min={0} max={23} value={Number(cfg.hours ?? 0)} onChange={(e) => set({ hours: Number(e.target.value) || 0 })} onBlur={() => saveCfg()} className={inputCls} />
          </label>
        </div>
      )}
      {(action.actionType === "whatsapp" || action.actionType === "notify") && (
        <textarea
          rows={2}
          value={String(cfg.message ?? "")}
          onChange={(e) => set({ message: e.target.value })}
          onBlur={() => saveCfg()}
          placeholder={action.actionType === "whatsapp" ? "Mensagem enviada ao contato…" : "Aviso à equipe…"}
          className={inputCls + " resize-none"}
        />
      )}
      {action.actionType === "task" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={String(cfg.title ?? "")}
            onChange={(e) => set({ title: e.target.value })}
            onBlur={() => saveCfg()}
            placeholder="Título da tarefa"
            className={inputCls + " flex-1"}
          />
          <label className="text-xs text-muted">
            Vence em (dias)
            <input type="number" min={0} value={Number(cfg.dueDays ?? 0)} onChange={(e) => set({ dueDays: Number(e.target.value) || 0 })} onBlur={() => saveCfg()} className={inputCls} />
          </label>
        </div>
      )}
      {action.actionType === "set_property" && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={String(cfg.key ?? "")} onChange={(e) => { const next = { ...cfg, key: e.target.value }; setCfg(next); saveCfg(next); }} className={inputCls + " w-auto"}>
            <option value="">Propriedade…</option>
            {dealProps.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <input
            value={String(cfg.value ?? "")}
            onChange={(e) => set({ value: e.target.value })}
            onBlur={() => saveCfg()}
            placeholder="Valor"
            className={inputCls + " flex-1"}
          />
        </div>
      )}
      {action.actionType === "set_stage" && (
        <select value={String(cfg.stageKey ?? "")} onChange={(e) => { const next = { ...cfg, stageKey: e.target.value }; setCfg(next); saveCfg(next); }} className={inputCls + " w-auto"}>
          <option value="">Mover para etapa…</option>
          {stageOptions.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      )}
      {action.actionType === "assign_owner" && (
        <select value={String(cfg.owner ?? "")} onChange={(e) => { const next = { ...cfg, owner: e.target.value }; setCfg(next); saveCfg(next); }} className={inputCls + " w-auto"}>
          <option value="">Responsável…</option>
          {team.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      )}
      {action.actionType === "condition" && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={String(cfg.key ?? "")} onChange={(e) => { const next = { ...cfg, key: e.target.value }; setCfg(next); saveCfg(next); }} className={inputCls + " w-auto"}>
            <option value="">Campo…</option>
            <optgroup label="Nativos">
              {CONDITION_NATIVES.map((k) => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </optgroup>
            <optgroup label="Propriedades">
              {dealProps.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </optgroup>
          </select>
          <select value={String(cfg.op ?? "eq")} onChange={(e) => { const next = { ...cfg, op: e.target.value }; setCfg(next); saveCfg(next); }} className={inputCls + " w-auto"}>
            {CONDITION_OPS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          {cfg.op !== "filled" && cfg.op !== "empty" && (
            <input
              value={String(cfg.value ?? "")}
              onChange={(e) => set({ value: e.target.value })}
              onBlur={() => saveCfg()}
              placeholder="valor"
              className={inputCls + " flex-1"}
            />
          )}
        </div>
      )}
    </div>
  );
}

const CONDITION_NATIVES: { key: string; label: string }[] = [
  { key: "stage", label: "Etapa (chave)" },
  { key: "monthly_value", label: "Valor/mês" },
  { key: "priority", label: "Prioridade" },
  { key: "probability", label: "Probabilidade" },
  { key: "source", label: "Origem" },
  { key: "owner", label: "Responsável" },
];

const CONDITION_OPS: { key: string; label: string }[] = [
  { key: "eq", label: "é" },
  { key: "neq", label: "não é" },
  { key: "contains", label: "contém" },
  { key: "gt", label: "maior que" },
  { key: "lt", label: "menor que" },
  { key: "filled", label: "preenchido" },
  { key: "empty", label: "vazio" },
];
