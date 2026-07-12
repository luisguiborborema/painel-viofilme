"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CheckCircle2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  GitBranch,
  History,
  Link2,
  Maximize,
  MessageSquare,
  PanelRight,
  Plus,
  SlidersHorizontal,
  Square,
  Tag as TagIcon,
  Target,
  Trophy,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import {
  BANT_LABELS,
  CARD_PROP_PREFIX,
  DEFAULT_PIPELINE,
  resolveCardFields,
  stageLabel,
  type CardFieldSetting,
  type Company,
  type Contact,
  type CrmComment,
  type CrmInteraction,
  type CrmLead,
  type CrmTask,
  type Pipeline,
  type PropertyDef,
  type Stage,
  type StageChange,
  type Tag,
  type TaskFlow,
} from "@/lib/data/crm";
import {
  Composer,
  DeleteDealButton,
  LoseButton,
  ScoreCard,
  StageHistoryCard,
  TasksCard,
  Timeline,
} from "./lead-detail";
import { TagPicker } from "./tag-picker";
import { DealContacts } from "./deal-contacts";
import { WinModal } from "./win-modal";
import { ScheduleModal } from "./schedule-modal";
import { ProposalModal } from "./proposal-modal";
import { useLeadModalLayout, type LeadModalLayout } from "./lead-modal";
import { LeadComments } from "./lead-comments";
import type { Attendant } from "@/lib/data/inbox";

/**
 * Conteúdo do modal do negócio no layout estilo ClickUp: coluna de detalhes
 * (título, propriedades, descrição, link, campos) + coluna de Atividade
 * (timeline de interações + composer). Rodapé com excluir e ações do negócio.
 */
export function LeadModalContent({
  lead: initialLead,
  interactions: initialInteractions,
  tasks: initialTasks,
  company = null,
  companyContacts = [],
  dealContacts = [],
  tags = [],
  properties = [],
  teamMembers = [],
  lostReasons = [],
  flows = [],
  history = [],
  pipelines = [],
  comments = [],
  currentUser = "",
  cardFields = [],
}: {
  lead: CrmLead;
  interactions: CrmInteraction[];
  tasks: CrmTask[];
  company?: Company | null;
  companyContacts?: Contact[];
  dealContacts?: Contact[];
  tags?: Tag[];
  properties?: PropertyDef[];
  teamMembers?: Attendant[];
  lostReasons?: string[];
  flows?: TaskFlow[];
  history?: StageChange[];
  pipelines?: Pipeline[];
  comments?: CrmComment[];
  currentUser?: string;
  cardFields?: CardFieldSetting[];
}) {
  const router = useRouter();
  const { layout, setLayout } = useLeadModalLayout();
  const [lead, setLead] = useState(initialLead);
  const [items, setItems] = useState<CrmInteraction[]>(initialInteractions);
  const [tasks, setTasks] = useState<CrmTask[]>(initialTasks);
  const [showWin, setShowWin] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [won, setWon] = useState(lead.stage === "ganho");
  const [copied, setCopied] = useState(false);
  const [stageErr, setStageErr] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<"historico" | "comentarios">("historico");
  const [assignees, setAssignees] = useState<string[]>(
    lead.assignees?.length ? lead.assignees : lead.owner ? [lead.owner] : [],
  );

  const pendingTask = useMemo(() => tasks.find((t) => t.status === "pending"), [tasks]);

  const pipeline =
    pipelines.find((p) => p.id === (lead.pipelineId ?? "")) ??
    pipelines.find((p) => p.isDefault) ??
    pipelines[0] ??
    DEFAULT_PIPELINE;
  const stages = pipeline.stages ?? DEFAULT_PIPELINE.stages;
  const currentStage = stages.find((s) => s.key === lead.stage);

  function pushLocal(it: Omit<CrmInteraction, "id" | "leadId" | "createdAt">) {
    setItems((prev) => [
      ...prev,
      { ...it, id: `tmp-${prev.length}`, leadId: lead.id, createdAt: new Date().toISOString() },
    ]);
  }

  async function completeTaskToggle(task: CrmTask) {
    const next = task.status === "done" ? "pending" : "done";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    await fetch("/api/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: next === "done" ? "done" : "reopen", taskId: task.id }),
    }).catch(() => {});
  }

  async function addTask(title: string, dueIso?: string) {
    const tmp: CrmTask = {
      id: `tmp-${Date.now()}`,
      leadId: lead.id,
      title,
      dueDate: dueIso,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, tmp]);
    await fetch("/api/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", leadId: lead.id, title, dueDate: dueIso }),
    }).catch(() => {});
    router.refresh();
  }

  async function applyFlow(flowId: string) {
    await fetch("/api/crm/task-flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply", dealId: lead.id, flowId }),
    }).catch(() => {});
    router.refresh();
  }

  async function changeStage(stage: Stage) {
    if (stage.key === lead.stage) return;
    const prev = lead.stage;
    setStageErr(null);
    setLead((l) => ({ ...l, stage: stage.key }));
    setWon(stage.kind === "won");
    const res = await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        id: lead.id,
        stage: stage.key,
        stageId: stage.id,
        kind: stage.kind,
      }),
    }).catch(() => null);
    if (res && res.status === 422) {
      const j = await res.json().catch(() => ({}));
      setLead((l) => ({ ...l, stage: prev }));
      setWon(prev === "ganho");
      setStageErr((j.missing ?? []).join(", ") || "Requisitos do estágio não cumpridos.");
      return;
    }
    pushLocal({ channel: "system", body: `Estágio alterado para ${stage.label}.` });
    router.refresh();
  }

  async function saveAssignees(next: string[]) {
    setAssignees(next);
    setLead((l) => ({ ...l, assignees: next, owner: next[0] ?? undefined }));
    await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-assignees", id: lead.id, assignees: next }),
    }).catch(() => {});
    router.refresh();
  }

  async function saveProp(key: string, value: unknown) {
    setLead((l) => ({ ...l, properties: { ...(l.properties ?? {}), [key]: value } }));
    await fetch("/api/crm/object", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectType: "deal", id: lead.id, properties: { [key]: value } }),
    }).catch(() => {});
  }

  async function markLost(reason: string) {
    setLead((l) => ({ ...l, stage: "perdido" }));
    pushLocal({ channel: "system", body: `Lead marcado como perdido. Motivo: ${reason || "—"}` });
    await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", id: lead.id, stage: "perdido", reason }),
    }).catch(() => {});
    router.refresh();
  }

  function copyLink() {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  const descricao = String(lead.properties?.descricao ?? "");
  const link = String(lead.properties?.link ?? "");

  // Layout do card personalizável pelo Gestor: itens nativos + propriedades.
  const dealPropDefs = properties.filter((p) => p.objectType === "deal");
  const resolved = resolveCardFields(
    cardFields,
    dealPropDefs.map((p) => ({ key: p.key, label: p.label })),
  );
  const gridItems = resolved.filter((f) => f.visible && f.group === "grid");
  const sectionItems = resolved.filter((f) => f.visible && f.group === "section");

  // Propriedade customizada renderizada como campo do grid (edição inline).
  const renderPropField = (propKey: string) => {
    const def = dealPropDefs.find((d) => d.key === propKey);
    if (!def) return null;
    return (
      <Field icon={SlidersHorizontal} label={def.label}>
        <PropertyValueInput
          def={def}
          value={lead.properties?.[propKey]}
          onSave={(v) => saveProp(propKey, v)}
        />
      </Field>
    );
  };

  const gridRenderers: Record<string, () => React.ReactNode> = {
    status: () => (
      <Field icon={Circle} label="Status">
        <StagePill stages={stages} currentKey={lead.stage} onPick={changeStage} />
        {stageErr && <p className="mt-1 text-[11px] text-rose-500">{stageErr}</p>}
      </Field>
    ),
    responsaveis: () => (
      <Field icon={Users} label="Responsáveis">
        <AssigneesControl assignees={assignees} team={teamMembers} onChange={saveAssignees} />
      </Field>
    ),
    valor_mensal: () => (
      <Field icon={Wallet} label="Valor mensal">
        <span className="text-sm font-semibold text-ink">{formatBRL(lead.monthlyValue)}</span>
      </Field>
    ),
    proxima_acao: () => (
      <Field icon={Calendar} label="Próxima ação">
        <span className="text-sm text-ink">
          {pendingTask?.dueDate
            ? `${dayMonth(pendingTask.dueDate)} ${clockLabel(pendingTask.dueDate)}`
            : "—"}
        </span>
      </Field>
    ),
    probabilidade: () => (
      <Field icon={Target} label="Probabilidade">
        <span className="text-sm text-ink">{lead.probability}%</span>
      </Field>
    ),
    origem: () => (
      <Field icon={TagIcon} label="Origem">
        <span className="text-sm text-ink">{lead.source ?? "—"}</span>
      </Field>
    ),
    pipeline: () =>
      pipelines.length > 1 ? (
        <Field icon={GitBranch} label="Pipeline">
          <select
            value={lead.pipelineId ?? pipelines.find((p) => p.isDefault)?.id ?? ""}
            onChange={async (e) => {
              await fetch("/api/crm/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "change-pipeline",
                  id: lead.id,
                  pipelineId: e.target.value,
                }),
              }).catch(() => {});
              router.refresh();
            }}
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null,
    plano: () => (
      <Field icon={FileText} label="Plano">
        <span className="text-sm text-ink">{lead.plan || "—"}</span>
      </Field>
    ),
  };

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    descricao: () => (
      <Section title="Descrição">
        <AutoSaveTextarea
          initial={descricao}
          placeholder="Adicione uma descrição do negócio…"
          onSave={(v) => saveProp("descricao", v)}
        />
      </Section>
    ),
    link: () => (
      <Section title="Link">
        <AutoSaveInput
          initial={link}
          placeholder="https://…"
          type="url"
          onSave={(v) => saveProp("link", v)}
        />
      </Section>
    ),
    empresa: () =>
      company ? (
        <Section title="Empresa">
          <Link
            href={`/gerencial/crm/empresa/${company.id}`}
            className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 hover:bg-subtle"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{company.name}</p>
              <p className="truncate text-xs text-muted">{company.segment ?? "Ver empresa"}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </Link>
        </Section>
      ) : null,
    contatos: () => (
      <DealContacts
        dealId={lead.id}
        initial={dealContacts}
        candidates={companyContacts}
        primaryContactId={lead.primaryContactId}
      />
    ),
    tags: () => (
      <Section title="Tags">
        <TagPicker objectType="deal" id={lead.id} allTags={tags} initialIds={lead.tags ?? []} />
      </Section>
    ),
    bant: () => (
      <Section title="Qualificação (BANT)">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BANT_LABELS.map(({ key, label }) => (
            <div key={key} className="rounded-lg bg-canvas px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
              <p className="text-sm text-ink">
                {lead.bant[key]?.trim() || <span className="text-muted">—</span>}
              </p>
            </div>
          ))}
        </div>
      </Section>
    ),
    tarefas: () => (
      <TasksCard
        tasks={tasks}
        onToggle={completeTaskToggle}
        onAdd={addTask}
        flows={flows}
        onApplyFlow={applyFlow}
      />
    ),
    score: () => <ScoreCard lead={lead} />,
    historico: () => (history.length > 0 ? <StageHistoryCard history={history} /> : null),
  };

  return (
    <div className={cn("flex h-full w-full", layout === "side" ? "flex-col" : "flex-col lg:flex-row")}>
      {/* ── Coluna de detalhes ─────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Barra superior */}
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-muted">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: currentStage?.color ?? "#64748b" }}
            />
            Negócio
          </span>
          <div className="flex items-center gap-1.5">
            <LayoutSwitcher layout={layout} onChange={setLayout} />
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-subtle hover:text-ink"
            >
              <Link2 className="h-4 w-4" />
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            <button
              onClick={() => router.back()}
              title="Fechar (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Corpo rolável — itens conforme o layout configurado pelo Gestor */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <h1 className="text-2xl font-bold leading-tight text-ink">{lead.name}</h1>

          {gridItems.length > 0 && (
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
              {gridItems.map((f) => (
                <Fragment key={f.key}>
                  {f.key.startsWith(CARD_PROP_PREFIX)
                    ? renderPropField(f.key.slice(CARD_PROP_PREFIX.length))
                    : gridRenderers[f.key]?.()}
                </Fragment>
              ))}
            </div>
          )}

          {gridItems.length > 0 && sectionItems.length > 0 && <hr className="border-line" />}

          {sectionItems.map((f) => (
            <Fragment key={f.key}>{sectionRenderers[f.key]?.()}</Fragment>
          ))}
        </div>

        {/* Rodapé de ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <DeleteDealButton dealId={lead.id} dealName={lead.name} variant="modal" />
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowProposal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle"
            >
              <FileText className="h-4 w-4" /> Proposta
            </button>
            {!won && lead.stage !== "perdido" && (
              <>
                <button
                  onClick={() => setShowSchedule(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle"
                >
                  <CalendarClock className="h-4 w-4" /> Agendar
                </button>
                <LoseButton onConfirm={markLost} reasons={lostReasons} />
                <button
                  onClick={() => setShowWin(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Trophy className="h-4 w-4" /> Ganho
                </button>
              </>
            )}
            {won && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Ganho
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Coluna de Atividade ────────────────────────────── */}
      <div
        className={cn(
          "flex min-h-0 w-full shrink-0 flex-col bg-canvas",
          layout === "side"
            ? "h-[42vh] border-t border-line"
            : "border-t border-line lg:w-[400px] lg:border-l lg:border-t-0",
        )}
      >
        <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
          <ActivityTab
            active={activityTab === "historico"}
            onClick={() => setActivityTab("historico")}
            icon={History}
            label="Histórico"
          />
          <ActivityTab
            active={activityTab === "comentarios"}
            onClick={() => setActivityTab("comentarios")}
            icon={MessageSquare}
            label="Comentários"
            badge={comments.length || undefined}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {activityTab === "historico" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Timeline items={items} />
              </div>
              <div className="bg-surface">
                <Composer
                  lead={lead}
                  onPosted={(it) => pushLocal(it)}
                  onBant={(bant) => setLead((l) => ({ ...l, bant: { ...l.bant, ...bant } }))}
                />
              </div>
            </>
          ) : (
            <LeadComments
              leadId={lead.id}
              initial={comments}
              currentUser={currentUser}
              team={teamMembers.map((m) => m.name)}
            />
          )}
        </div>
      </div>

      {/* Modais auxiliares */}
      {showProposal && (
        <ProposalModal
          dealId={lead.id}
          contactName={lead.contactName}
          hasPhone={Boolean(lead.contactPhone) || dealContacts.some((c) => c.phone)}
          onClose={() => setShowProposal(false)}
        />
      )}
      {showSchedule && (
        <ScheduleModal
          lead={lead}
          onClose={() => setShowSchedule(false)}
          onScheduled={(meetLink) => {
            setShowSchedule(false);
            setLead((l) => ({ ...l, stage: "reuniao" }));
            pushLocal({
              channel: "system",
              body: `📅 Reunião agendada no Google Agenda.${meetLink ? `\nMeet: ${meetLink}` : ""}`,
            });
            router.refresh();
          }}
        />
      )}
      {showWin && (
        <WinModal
          lead={lead}
          onClose={() => setShowWin(false)}
          onConfirmed={() => {
            setShowWin(false);
            setWon(true);
            setLead((l) => ({ ...l, stage: "ganho" }));
            pushLocal({
              channel: "system",
              body: "🏆 Lead Ganho — onboarding iniciado (projeto, fatura, CS, portal e contrato).",
            });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ── Blocos auxiliares ─────────────────────────────────── */

function personInitials(name?: string) {
  if (!name) return "•";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function Avatar({ name, url, size = 24 }: { name?: string; url?: string; size?: number }) {
  if (!url) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      >
        {personInitials(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name ?? ""}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function AssigneesControl({
  assignees,
  team,
  onChange,
}: {
  assignees: string[];
  team: Attendant[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const avatarOf = (name: string) => team.find((t) => t.name === name)?.avatarUrl;

  function toggle(name: string) {
    onChange(assignees.includes(name) ? assignees.filter((a) => a !== name) : [...assignees, name]);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assignees.length === 0 && <span className="text-sm text-muted">Ninguém</span>}
      {assignees.map((name) => (
        <span
          key={name}
          className="group inline-flex items-center gap-1.5 rounded-full bg-subtle py-0.5 pl-0.5 pr-2 text-sm text-ink"
        >
          <Avatar name={name} url={avatarOf(name)} size={22} />
          {name}
          <button
            onClick={() => toggle(name)}
            title="Remover"
            className="text-muted opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          title="Adicionar responsável"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-line text-muted hover:bg-subtle hover:text-ink"
        >
          <Plus className="h-4 w-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
              {team.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted">Nenhum membro na equipe.</p>
              )}
              {team.map((m) => {
                const selected = assignees.includes(m.name);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.name)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle"
                  >
                    <Avatar name={m.name} url={m.avatarUrl} size={24} />
                    <span className="flex-1 text-ink">{m.name}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-brand-500" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActivityTab({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Square;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-subtle text-ink" : "text-muted hover:bg-subtle hover:text-ink",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
      {badge != null && (
        <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

const LAYOUTS: { key: LeadModalLayout; label: string; icon: typeof Square }[] = [
  { key: "modal", label: "Modal", icon: Square },
  { key: "full", label: "Tela cheia", icon: Maximize },
  { key: "side", label: "Barra lateral", icon: PanelRight },
];

function LayoutSwitcher({
  layout,
  onChange,
}: {
  layout: LeadModalLayout;
  onChange: (l: LeadModalLayout) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5">
      {LAYOUTS.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            title={o.label}
            aria-label={o.label}
            aria-pressed={layout === o.key}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              layout === o.key
                ? "bg-brand-600 text-white"
                : "text-muted hover:bg-subtle hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Circle;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="inline-flex w-36 shrink-0 items-center gap-2 text-sm text-muted">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function StagePill({
  stages,
  currentKey,
  onPick,
}: {
  stages: Stage[];
  currentKey: string;
  onPick: (s: Stage) => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = stages.find((s) => s.key === currentKey);
  const color = cur?.color ?? "#64748b";
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold"
        style={{ backgroundColor: `${color}22`, color }}
      >
        {cur?.label ?? stageLabel(currentKey)}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl">
            {stages.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-subtle"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-ink">{s.label}</span>
                {s.key === currentKey && <Check className="h-3.5 w-3.5 text-brand-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AutoSaveTextarea({
  initial,
  placeholder,
  onSave,
}: {
  initial: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== initial && onSave(value)}
      placeholder={placeholder}
      rows={3}
      className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
    />
  );
}

function AutoSaveInput({
  initial,
  placeholder,
  type = "text",
  onSave,
}: {
  initial: string;
  placeholder?: string;
  type?: string;
  onSave: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== initial && onSave(value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
    />
  );
}

const propInputCls =
  "w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

/** Editor inline de uma propriedade customizada (por tipo), salva ao sair/mudar. */
function PropertyValueInput({
  def,
  value,
  onSave,
}: {
  def: PropertyDef;
  value: unknown;
  onSave: (v: unknown) => void;
}) {
  switch (def.fieldType) {
    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onSave(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-brand-600"
          />
          {value ? "Sim" : "Não"}
        </label>
      );
    case "select": {
      const val = String(value ?? "");
      const known = !val || def.options.some((o) => o.value === val);
      return (
        <select value={val} onChange={(e) => onSave(e.target.value || null)} className={propInputCls}>
          <option value="">—</option>
          {!known && <option value={val}>{val}</option>}
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      if (def.options.length === 0) return <span className="text-sm text-muted">Sem opções</span>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {def.options.map((o) => {
            const on = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onSave(on ? arr.filter((v) => v !== o.value) : [...arr, o.value])}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  on ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value.slice(0, 10) : ""}
          onChange={(e) => onSave(e.target.value || null)}
          className={propInputCls}
        />
      );
    case "number":
    case "currency":
      return (
        <BlurInput
          type="number"
          initial={value == null ? "" : String(value)}
          placeholder={def.fieldType === "currency" ? "R$" : ""}
          onSave={(s) => onSave(s === "" ? null : Number(s))}
        />
      );
    default:
      return (
        <BlurInput
          type={def.fieldType === "email" ? "email" : def.fieldType === "url" ? "url" : "text"}
          initial={value == null ? "" : String(value)}
          onSave={(s) => onSave(s || null)}
        />
      );
  }
}

/** Input que só salva ao perder o foco (evita salvar a cada tecla). */
function BlurInput({
  type = "text",
  initial,
  placeholder,
  onSave,
}: {
  type?: string;
  initial: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <input
      type={type}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== initial && onSave(v)}
      placeholder={placeholder}
      className={propInputCls}
    />
  );
}
