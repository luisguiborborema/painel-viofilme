"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  Flag,
  GitBranch,
  History,
  Link2,
  ListTodo,
  Maximize,
  MessageSquare,
  Paperclip,
  PanelRight,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  StickyNote,
  Tag as TagIcon,
  Target,
  Trophy,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import {
  DEAL_SCRIPTS,
  DEFAULT_PIPELINE,
  PIPELINE_PREVENDA_ID,
  PIPELINE_VENDAS_ID,
  STAGE_RESERVOIR,
  STAGE_CADENCE_ON,
  cadenceLabel,
  daysBetween,
  stageLabel,
  suggestedScriptFor,
  DOC_STATUSES,
  TRACKED_DOC_KINDS,
  CRM_DOCUMENT_KINDS,
  BANT_LABELS,
  type CardFieldSetting,
  type Company,
  type Contact,
  type CrmComment,
  type CrmDocument,
  type CrmInteraction,
  type CrmLead,
  type CrmTask,
  type DealScript,
  type DocTemplate,
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
  Timeline,
} from "./lead-detail";
import { TagPicker } from "./tag-picker";
import { WinModal } from "./win-modal";
import { ScheduleModal } from "./schedule-modal";
import { ProposalModal } from "./proposal-modal";
import { useLeadModalLayout, type LeadModalLayout } from "./lead-modal";
import { LeadComments } from "./lead-comments";
import { CrmDocuments } from "./crm-documents";
import { SettingsShortcut } from "./settings-shortcut";
import { withToast } from "@/lib/api";
import type { Attendant } from "@/lib/data/inbox";

/**
 * Ficha do Lead (v2) — layout em 3 zonas (viofilme_spec_ficha_lead):
 *   ESQUERDA (consulta, sticky): dados do negócio + estado da cadência.
 *   CENTRO (foco): área de trabalho (tarefa aberta + nota + sub-abas) e as
 *     abas de dados Principal · Qualificação · Negociação.
 *   DIREITA (sticky): Timeline + Movimentações + registro rápido.
 * Princípio: a OPERAÇÃO é o palco; os campos são consulta.
 */
export function LeadModalContent({
  lead: initialLead,
  interactions: initialInteractions,
  tasks: initialTasks,
  company = null,
  companyContacts = [],
  dealContacts = [],
  tags = [],
  teamMembers = [],
  lostReasons = [],
  history = [],
  pipelines = [],
  comments = [],
  currentUser = "",
  scripts = DEAL_SCRIPTS,
  documents = [],
  templates = [],
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
  scripts?: DealScript[];
  documents?: CrmDocument[];
  templates?: DocTemplate[];
}) {
  const router = useRouter();
  const { layout, setLayout } = useLeadModalLayout();
  const [lead, setLead] = useState(initialLead);
  const [items, setItems] = useState<CrmInteraction[]>(initialInteractions);
  const [tasks, setTasks] = useState<CrmTask[]>(initialTasks);
  const [showWin, setShowWin] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [nextPrompt, setNextPrompt] = useState<{ count: number; nextId: string | null } | null>(null);
  const [won, setWon] = useState(lead.stage === "ganho");
  const [copied, setCopied] = useState(false);
  const [stageErr, setStageErr] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<"trabalho" | "principal" | "qualificacao" | "negociacao">("trabalho");
  const [rightTab, setRightTab] = useState<"timeline" | "movimentacoes" | "comentarios">("timeline");
  const [assignees, setAssignees] = useState<string[]>(
    lead.assignees?.length ? lead.assignees : lead.owner ? [lead.owner] : [],
  );

  const pendingTask = useMemo(() => tasks.find((t) => t.status === "pending"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  const pipeline =
    pipelines.find((p) => p.id === (lead.pipelineId ?? "")) ??
    pipelines.find((p) => p.isDefault) ??
    pipelines[0] ??
    DEFAULT_PIPELINE;
  const stages = pipeline.stages ?? DEFAULT_PIPELINE.stages;
  const currentStage = stages.find((s) => s.key === lead.stage);
  // Funil de passagem de bastão: parametrizável (etapa marcada como handoff em
  // Configurações) OU o funil de Pré-venda padrão / etapas sdr_ (retrocompat).
  const isSdr =
    stages.some((s) => s.isHandoff) ||
    lead.pipelineId === PIPELINE_PREVENDA_ID ||
    String(lead.stage).startsWith("sdr_");
  const closed = won || lead.stage === "perdido";

  const primaryContact =
    companyContacts.find((c) => c.id === lead.primaryContactId) ??
    dealContacts.find((c) => c.isPrimary) ??
    dealContacts[0] ??
    companyContacts[0] ??
    null;

  function pushLocal(it: Omit<CrmInteraction, "id" | "leadId" | "createdAt">) {
    setItems((prev) => [
      ...prev,
      { ...it, id: `tmp-${prev.length}`, leadId: lead.id, createdAt: new Date().toISOString() },
    ]);
  }

  async function logNote(body: string) {
    pushLocal({ channel: "note", body, author: currentUser || "Você" });
    await fetch("/api/crm/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, channel: "note", body }),
    }).catch(() => {});
  }

  async function completeTask(task: CrmTask, note: string) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)));
    if (note.trim()) await logNote(`✔️ ${task.title}\n${note.trim()}`);
    await fetch("/api/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "done", taskId: task.id }),
    }).catch(() => {});
    // Fluxo HubSpot: oferecer o próximo lead com tarefa aberta.
    try {
      const r = await fetch(`/api/crm/next-task-lead?exclude=${lead.id}`);
      const j = await r.json();
      if (j.count > 0) setNextPrompt({ count: j.count, nextId: j.nextId });
    } catch {
      /* silencioso */
    }
    router.refresh();
  }

  async function rescheduleTask(task: CrmTask, dueIso: string) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, dueDate: dueIso } : t)));
    await fetch("/api/crm/object", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectType: "task", id: task.id, fields: { due_date: dueIso } }),
    }).catch(() => {});
    pushLocal({ channel: "system", body: `Tarefa "${task.title}" remarcada para ${dayMonth(dueIso)}.` });
  }

  async function createTask(p: {
    title: string;
    dueIso?: string;
    type?: string;
    priority?: string;
    reminder?: string;
    recurrence?: string;
  }) {
    const tmp: CrmTask = {
      id: `tmp-${Date.now()}`,
      leadId: lead.id,
      title: p.title,
      dueDate: p.dueIso,
      status: "pending",
      priority: (p.priority as CrmTask["priority"]) ?? "media",
      createdAt: new Date().toISOString(),
      properties: { type: p.type, reminder: p.reminder, recurrence: p.recurrence },
    };
    setTasks((prev) => [...prev, tmp]);
    setShowFab(false);
    await fetch("/api/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        leadId: lead.id,
        title: p.title,
        dueDate: p.dueIso,
        priority: p.priority,
        type: p.type,
        properties: { reminder: p.reminder, recurrence: p.recurrence },
      }),
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
      body: JSON.stringify({ action: "move", id: lead.id, stage: stage.key, stageId: stage.id, kind: stage.kind }),
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

  async function submitHandoff(result: "aceito" | "recusado", parecer: string) {
    setShowHandoff(false);
    if (result === "aceito") {
      setLead((l) => ({ ...l, pipelineId: PIPELINE_VENDAS_ID, stage: "vnd_analise" }));
    } else {
      setLead((l) => ({ ...l, stage: "perdido" }));
    }
    pushLocal({
      channel: "system",
      body:
        result === "aceito"
          ? `🤝 Bastão passado — aceito na qualificação${parecer ? `: ${parecer}` : ""}`
          : `🚫 Bastão recusado — feedback: ${parecer || "—"}`,
    });
    await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "handoff", id: lead.id, result, parecer }),
    }).catch(() => {});
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
    await withToast(
      fetch("/api/crm/object", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectType: "deal", id: lead.id, properties: { [key]: value } }),
      }),
    );
  }

  async function saveObject(
    objectType: "company" | "contact",
    id: string,
    fields?: Record<string, unknown>,
    properties?: Record<string, unknown>,
  ) {
    await withToast(
      fetch("/api/crm/object", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectType, id, fields, properties }),
      }),
    );
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

  const noteItems = items.filter((it) => it.channel === "note");

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ── TOPO: breadcrumb + dias-na-etapa + chrome ─────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: currentStage?.color ?? "#64748b" }} />
            {pipeline.name}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate text-sm font-semibold text-ink">{lead.name}</span>
          <DaysBadge iso={lead.stageChangedAt} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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

      {/* ── Barra de estágios + ações ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <div className="flex items-center gap-2">
          <StagePill stages={stages} currentKey={lead.stage} onPick={changeStage} />
          {stageErr && <span className="text-[11px] text-rose-500">{stageErr}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowProposal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle"
          >
            <FileText className="h-4 w-4" /> Proposta
          </button>
          {!closed && (
            <>
              <button
                onClick={() => setShowSchedule(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle"
              >
                <CalendarClock className="h-4 w-4" /> Agendar
              </button>
              <LoseButton onConfirm={markLost} reasons={lostReasons} />
              {isSdr ? (
                <button
                  onClick={() => setShowHandoff(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <ArrowRightLeft className="h-4 w-4" /> Passar bastão
                </button>
              ) : (
                <button
                  onClick={() => setShowWin(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Trophy className="h-4 w-4" /> Ganho
                </button>
              )}
            </>
          )}
          {won && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Ganho
            </span>
          )}
        </div>
      </div>

      {/* ── 3 ZONAS ───────────────────────────────────────────── */}
      <div className={cn("flex min-h-0 flex-1", layout === "side" ? "flex-col overflow-y-auto" : "flex-col xl:flex-row")}>
        {/* ESQUERDA — consulta */}
        <aside
          className={cn(
            "shrink-0 space-y-1 border-line bg-canvas px-4 py-4",
            layout === "side" ? "border-b" : "border-b xl:w-[248px] xl:overflow-y-auto xl:border-b-0 xl:border-r",
          )}
        >
          <MiniField icon={Users} label="Responsáveis">
            <AssigneesControl assignees={assignees} team={teamMembers} onChange={saveAssignees} />
          </MiniField>
          <MiniField icon={TagIcon} label="Origem">
            {lead.source || "—"}
          </MiniField>
          <MiniField icon={Circle} label="Estágio">
            {currentStage?.label ?? stageLabel(lead.stage)}
          </MiniField>
          <MiniField icon={Target} label="Probabilidade">
            {lead.probability}%
          </MiniField>
          <MiniField icon={Wallet} label="Valor estimado">
            <span className="font-semibold">{formatBRL(lead.monthlyValue)}</span>
            <span className="text-muted">/mês</span>
          </MiniField>
          {pipelines.length > 1 && (
            <MiniField icon={GitBranch} label="Funil">
              {pipeline.name}
            </MiniField>
          )}
          <div className="pt-1">
            <ScoreCard lead={lead} />
          </div>
          <CadenceNotice lead={lead} isSdr={isSdr} />
          <div className="pt-1">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Tags</p>
            <TagPicker objectType="deal" id={lead.id} allTags={tags} initialIds={lead.tags ?? []} />
          </div>
          {company && (
            <Link
              href={`/gerencial/crm/empresa/${company.id}`}
              className="mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 hover:bg-subtle"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{company.name}</p>
                <p className="truncate text-xs text-muted">{company.segment ?? "Ver empresa"}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          )}
        </aside>

        {/* CENTRO — área de trabalho (palco) */}
        <div className={cn("flex min-w-0 flex-1 flex-col", layout === "side" ? "" : "xl:overflow-y-auto")}>
          <div className="flex items-center gap-1 border-b border-line px-3 py-1.5">
            <CenterTab active={centerTab === "trabalho"} onClick={() => setCenterTab("trabalho")} icon={ListTodo} label="Área de trabalho" />
            <CenterTab active={centerTab === "principal"} onClick={() => setCenterTab("principal")} icon={Building2} label="Principal" />
            <CenterTab active={centerTab === "qualificacao"} onClick={() => setCenterTab("qualificacao")} icon={Sparkles} label="Qualificação" />
            <CenterTab active={centerTab === "negociacao"} onClick={() => setCenterTab("negociacao")} icon={Briefcase} label="Negociação" />
          </div>

          <div className="min-h-0 flex-1 space-y-4 px-4 py-4">
            {centerTab === "trabalho" && (
              <WorkArea
                pendingTask={pendingTask}
                doneTasks={doneTasks}
                stageKey={lead.stage}
                notes={noteItems}
                scripts={scripts}
                dealId={lead.id}
                documents={documents}
                onComplete={completeTask}
                onReschedule={rescheduleTask}
                onNewTask={() => setShowFab(true)}
              />
            )}
            {centerTab === "principal" && (
              <PrincipalTab
                company={company}
                contact={primaryContact}
                onSaveCompany={(fields, props) => company && saveObject("company", company.id, fields, props)}
                onSaveContact={(fields, props) => primaryContact && saveObject("contact", primaryContact.id, fields, props)}
              />
            )}
            {centerTab === "qualificacao" && <QualiTab lead={lead} onSave={saveProp} />}
            {centerTab === "negociacao" && (
              <NegoTab lead={lead} onSave={saveProp} documents={documents} templates={templates} />
            )}
          </div>
        </div>

        {/* DIREITA — timeline + movimentações */}
        <aside
          className={cn(
            "flex shrink-0 flex-col border-line bg-canvas",
            layout === "side" ? "h-[42vh] border-t" : "border-t xl:w-[372px] xl:border-l xl:border-t-0",
          )}
        >
          <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
            <ActivityTab active={rightTab === "timeline"} onClick={() => setRightTab("timeline")} icon={MessageSquare} label="Timeline" />
            <ActivityTab active={rightTab === "movimentacoes"} onClick={() => setRightTab("movimentacoes")} icon={GitBranch} label="Movimentações" />
            <ActivityTab active={rightTab === "comentarios"} onClick={() => setRightTab("comentarios")} icon={History} label="Comentários" badge={comments.length || undefined} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {rightTab === "timeline" && (
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
            )}
            {rightTab === "movimentacoes" && (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {history.length > 0 ? (
                  <StageHistoryCard history={history} />
                ) : (
                  <p className="px-1 py-6 text-center text-sm text-muted">Sem movimentações de etapa ainda.</p>
                )}
              </div>
            )}
            {rightTab === "comentarios" && (
              <LeadComments
                leadId={lead.id}
                initial={comments}
                currentUser={currentUser}
                team={teamMembers.map((m) => m.name)}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Rodapé (excluir) */}
      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2">
        <DeleteDealButton dealId={lead.id} dealName={lead.name} variant="modal" />
        <p className="text-[11px] text-muted">Ficha do negócio · {isSdr ? "Pré-venda (SDR)" : "Vendas (Closer)"}</p>
      </div>

      {/* FAB — Nova tarefa (sempre visível) */}
      <button
        onClick={() => setShowFab(true)}
        className="absolute bottom-16 right-6 z-20 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> Nova tarefa
      </button>

      {/* Modais auxiliares */}
      {showFab && (
        <FabTaskCreator onClose={() => setShowFab(false)} onCreate={createTask} />
      )}
      {showHandoff && (
        <HandoffFichaModal lead={lead} onClose={() => setShowHandoff(false)} onSubmit={submitHandoff} />
      )}
      {nextPrompt && (
        <NextLeadPrompt
          count={nextPrompt.count}
          onStay={() => setNextPrompt(null)}
          onGo={() => {
            const id = nextPrompt.nextId;
            setNextPrompt(null);
            if (id) router.push(`/gerencial/crm/${id}`);
          }}
        />
      )}
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

/* ── Zona esquerda ─────────────────────────────────────── */

function MiniField({ icon: Icon, label, children }: { icon: typeof Circle; label: string; children: ReactNode }) {
  return (
    <div className="py-1.5">
      <p className="mb-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}

function CadenceNotice({ lead, isSdr }: { lead: CrmLead; isSdr: boolean }) {
  if (!isSdr) return null;
  if (lead.cadenceActive) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700">
        <Zap className="h-4 w-4 shrink-0" />
        {cadenceLabel(lead.originKind)} ativa · passo {lead.cadenceStep ?? 1}
      </div>
    );
  }
  if (lead.stage !== STAGE_RESERVOIR && lead.stage !== STAGE_CADENCE_ON) {
    return (
      <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-muted">
        Cadência encerrada. Ações manuais agora.
      </div>
    );
  }
  return null;
}

function DaysBadge({ iso }: { iso: string }) {
  const d = Math.max(0, daysBetween(iso, new Date().toISOString()));
  const stagnant = d >= 7;
  return (
    <span
      className={cn(
        "ml-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        stagnant ? "bg-rose-500/15 text-rose-600" : "bg-subtle text-muted",
      )}
    >
      {stagnant && <AlertTriangle className="h-3 w-3" />}
      {stagnant ? `Estagnado há ${d} dias` : d === 0 ? "Entrou hoje" : `${d} dia${d > 1 ? "s" : ""} na etapa`}
    </span>
  );
}

/* ── Zona central: área de trabalho ────────────────────── */

function WorkArea({
  pendingTask,
  doneTasks,
  stageKey,
  notes,
  scripts,
  dealId,
  documents,
  onComplete,
  onReschedule,
  onNewTask,
}: {
  pendingTask?: CrmTask;
  doneTasks: CrmTask[];
  stageKey: string;
  notes: CrmInteraction[];
  scripts: DealScript[];
  dealId: string;
  documents: CrmDocument[];
  onComplete: (task: CrmTask, note: string) => void;
  onReschedule: (task: CrmTask, dueIso: string) => void;
  onNewTask: () => void;
}) {
  const [sub, setSub] = useState<"tarefas" | "anotacoes" | "arquivos">("tarefas");
  return (
    <div className="space-y-4">
      {pendingTask ? (
        <OpenTaskCard task={pendingTask} stageKey={stageKey} scripts={scripts} onComplete={onComplete} onReschedule={onReschedule} />
      ) : (
        <button
          onClick={onNewTask}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-4 py-6 text-sm font-medium text-muted hover:bg-subtle"
        >
          <Plus className="h-4 w-4" /> Nenhuma tarefa aberta — criar próxima ação
        </button>
      )}

      <div className="flex items-center gap-1 border-b border-line">
        <SubTab active={sub === "tarefas"} onClick={() => setSub("tarefas")} icon={ListTodo} label="Tarefas" />
        <SubTab active={sub === "anotacoes"} onClick={() => setSub("anotacoes")} icon={StickyNote} label="Anotações" />
        <SubTab active={sub === "arquivos"} onClick={() => setSub("arquivos")} icon={Paperclip} label="Arquivos" />
      </div>

      {sub === "tarefas" && (
        <div className="space-y-1.5">
          {doneTasks.length === 0 && <p className="py-4 text-center text-sm text-muted">Sem tarefas concluídas ainda.</p>}
          {doneTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="flex-1 text-muted line-through">{t.title}</span>
              {t.dueDate && <span className="text-[11px] text-muted">{dayMonth(t.dueDate)}</span>}
            </div>
          ))}
        </div>
      )}
      {sub === "anotacoes" && (
        <div className="space-y-2">
          {notes.length === 0 && <p className="py-4 text-center text-sm text-muted">Sem anotações ainda.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-line bg-surface px-3 py-2">
              <p className="text-[11px] text-muted">
                {n.author ?? "—"} · {dayMonth(n.createdAt)} {clockLabel(n.createdAt)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{n.body}</p>
            </div>
          ))}
        </div>
      )}
      {sub === "arquivos" && <CrmDocuments dealId={dealId} documents={documents} compact />}
    </div>
  );
}

function OpenTaskCard({
  task,
  stageKey,
  scripts,
  onComplete,
  onReschedule,
}: {
  task: CrmTask;
  stageKey: string;
  scripts: DealScript[];
  onComplete: (task: CrmTask, note: string) => void;
  onReschedule: (task: CrmTask, dueIso: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showScripts, setShowScripts] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const activeScripts = scripts.filter((s) => s.isActive !== false && s.command);
  const suggested = suggestedScriptFor(stageKey, scripts);
  const slashQuery = note.trimStart();
  const showSlash = slashQuery.startsWith("/");
  const slashMatches = showSlash
    ? activeScripts.filter((s) => s.command.startsWith(slashQuery.split(/\s/)[0].toLowerCase()))
    : [];

  function inject(script: DealScript) {
    // Substitui o comando "/…" digitado (se houver) pelo corpo do roteiro.
    const base = showSlash ? "" : note ? note + "\n\n" : "";
    setNote(base + script.body + "\n");
    setShowScripts(false);
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Tarefa aberta</p>
          <p className="text-sm font-semibold text-ink">{task.title}</p>
          {task.dueDate && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" /> {dayMonth(task.dueDate)} {clockLabel(task.dueDate)}
            </p>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowScripts((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
          >
            <FileText className="h-3.5 w-3.5" /> Scripts
          </button>
          {showScripts && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowScripts(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl">
                {activeScripts.map((s) => (
                  <button
                    key={s.id ?? s.command}
                    onClick={() => inject(s)}
                    className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-subtle"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        {s.title}
                        {suggested?.command === s.command && (
                          <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">sugerido</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-muted">{s.command} · {s.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative mt-2.5">
        {showSlash && slashMatches.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-1 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {slashMatches.map((s) => (
              <button
                key={s.id ?? s.command}
                onClick={() => inject(s)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-subtle"
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{s.command}</span>
                  <span className="block text-[11px] text-muted">{s.title}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Anote o que foi conversado nesta tarefa… (digite / para roteiros e scripts)"
          className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
        />
      </div>

      {rescheduling ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="datetime-local"
            onChange={(e) => {
              if (e.target.value) {
                onReschedule(task, new Date(e.target.value).toISOString());
                setRescheduling(false);
              }
            }}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
          <button onClick={() => setRescheduling(false)} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-subtle">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => onComplete(task, note)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
          </button>
          <button
            onClick={() => setRescheduling(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Remarcar
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Zona central: abas de dados ───────────────────────── */

function EditRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function PrincipalTab({
  company,
  contact,
  onSaveCompany,
  onSaveContact,
}: {
  company: Company | null;
  contact: Contact | null;
  onSaveCompany: (fields?: Record<string, unknown>, props?: Record<string, unknown>) => void;
  onSaveContact: (fields?: Record<string, unknown>, props?: Record<string, unknown>) => void;
}) {
  const cp = (company?.properties ?? {}) as Record<string, unknown>;
  const kp = (contact?.properties ?? {}) as Record<string, unknown>;
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Empresa</p>
        {company ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditRow label="Razão social">
              <BlurInput initial={company.name} onSave={(v) => onSaveCompany({ name: v })} />
            </EditRow>
            <EditRow label="CNPJ">
              <BlurInput initial={String(cp.cnpj ?? "")} onSave={(v) => onSaveCompany(undefined, { cnpj: v })} />
            </EditRow>
            <EditRow label="Segmento">
              <BlurInput initial={company.segment ?? ""} onSave={(v) => onSaveCompany({ segment: v })} />
            </EditRow>
            <EditRow label="Cidade/UF">
              <BlurInput initial={company.city ?? ""} onSave={(v) => onSaveCompany({ city: v })} />
            </EditRow>
            <EditRow label="Site">
              <BlurInput type="url" initial={company.website ?? ""} onSave={(v) => onSaveCompany({ website: v })} />
            </EditRow>
            <EditRow label="Instagram">
              <BlurInput initial={String(cp.instagram ?? "")} onSave={(v) => onSaveCompany(undefined, { instagram: v })} />
            </EditRow>
            <EditRow label="LinkedIn">
              <BlurInput initial={String(cp.linkedin ?? "")} onSave={(v) => onSaveCompany(undefined, { linkedin: v })} />
            </EditRow>
            <EditRow label="Outras redes">
              <BlurInput initial={String(cp.outras_redes ?? "")} onSave={(v) => onSaveCompany(undefined, { outras_redes: v })} />
            </EditRow>
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhuma empresa vinculada.</p>
        )}
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Contato principal</p>
        {contact ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditRow label="Nome">
              <BlurInput initial={contact.name} onSave={(v) => onSaveContact({ name: v })} />
            </EditRow>
            <EditRow label="Cargo">
              <BlurInput initial={contact.title ?? ""} onSave={(v) => onSaveContact({ title: v })} />
            </EditRow>
            <EditRow label="WhatsApp">
              <BlurInput initial={contact.phone ?? ""} onSave={(v) => onSaveContact({ phone: v })} />
            </EditRow>
            <EditRow label="E-mail">
              <BlurInput type="email" initial={contact.email ?? ""} onSave={(v) => onSaveContact({ email: v })} />
            </EditRow>
            <EditRow label="LinkedIn pessoal">
              <BlurInput initial={String(kp.linkedin ?? "")} onSave={(v) => onSaveContact(undefined, { linkedin: v })} />
            </EditRow>
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhum contato vinculado.</p>
        )}
      </div>
    </div>
  );
}

function QualiTab({ lead, onSave }: { lead: CrmLead; onSave: (key: string, value: unknown) => void }) {
  const p = (lead.properties ?? {}) as Record<string, unknown>;
  const score = Number(p.q_score ?? 0);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <EditRow label="Fonte / origem do lead">
        <BlurInput initial={String(p.q_fonte ?? lead.source ?? "")} onSave={(v) => onSave("q_fonte", v)} />
      </EditRow>
      <EditRow label="Solução que procura">
        <BlurInput initial={String(p.q_solucao ?? "")} onSave={(v) => onSave("q_solucao", v)} />
      </EditRow>
      <EditRow label="Cargo do decisor">
        <BlurInput initial={String(p.q_cargo_decisor ?? "")} onSave={(v) => onSave("q_cargo_decisor", v)} />
      </EditRow>
      <EditRow label="Faturamento (faixa)">
        <BlurInput initial={String(p.q_faturamento ?? "")} onSave={(v) => onSave("q_faturamento", v)} />
      </EditRow>
      <label className="flex items-center gap-2 pt-5 text-sm text-ink">
        <input type="checkbox" checked={Boolean(p.q_decisor_final)} onChange={(e) => onSave("q_decisor_final", e.target.checked)} className="h-4 w-4 rounded border-line accent-brand-600" />
        É o decisor final
      </label>
      <label className="flex items-center gap-2 pt-5 text-sm text-ink">
        <input type="checkbox" checked={Boolean(p.q_agencia)} onChange={(e) => onSave("q_agencia", e.target.checked)} className="h-4 w-4 rounded border-line accent-brand-600" />
        Já trabalhou com agência
      </label>
      <div className="sm:col-span-2">
        <EditRow label="Dor principal">
          <textarea
            defaultValue={String(p.q_dor ?? "")}
            onBlur={(e) => e.target.value !== String(p.q_dor ?? "") && onSave("q_dor", e.target.value)}
            rows={2}
            className="w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </EditRow>
      </div>
      <div className="sm:col-span-2">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Nota do lead</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => onSave("q_score", n)} title={`${n} estrela${n > 1 ? "s" : ""}`}>
              <Flag className={cn("h-5 w-5", n <= score ? "fill-amber-400 text-amber-400" : "text-line")} />
            </button>
          ))}
          <span className="ml-2 text-sm text-muted">{score || "—"}/5</span>
        </div>
      </div>
      <div className="sm:col-span-2 border-t border-line pt-2">
        <SettingsShortcut section="properties" label="Adicione ou edite outras perguntas em Configurações" />
      </div>
    </div>
  );
}

const DOC_TONE: Record<string, string> = {
  muted: "bg-black/5 text-muted",
  brand: "bg-brand-100 text-brand-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
};
const DOC_KIND_LABEL = Object.fromEntries(CRM_DOCUMENT_KINDS.map((k) => [k.key, k.label]));
const DOC_STATUS_MAP = Object.fromEntries(DOC_STATUSES.map((s) => [s.key, s]));

/** Documentos do negócio (propostas/contratos) refletidos na Negociação. */
function NegoDocs({
  lead,
  documents,
  templates,
}: {
  lead: CrmLead;
  documents: CrmDocument[];
  templates: DocTemplate[];
}) {
  const router = useRouter();
  const [tplId, setTplId] = useState("");
  const [busy, setBusy] = useState(false);
  const docs = documents.filter((d) => TRACKED_DOC_KINDS.has(d.kind));
  const activeTpls = templates.filter((t) => t.isActive);

  async function generate() {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setBusy(true);
    const p = (lead.properties ?? {}) as Record<string, unknown>;
    const filled = (tpl.content ?? "")
      .replaceAll("{empresa}", lead.name ?? "")
      .replaceAll("{valor}", p.n_valor_proposta ? formatBRL(Number(p.n_valor_proposta)) : "{valor}");
    await fetch("/api/crm/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate",
        title: `${tpl.name} — ${lead.name}`,
        kind: tpl.kind,
        content: filled,
        templateId: tpl.id,
        dealId: lead.id,
        value: p.n_valor_proposta ? Number(p.n_valor_proposta) : undefined,
      }),
    }).catch(() => {});
    setBusy(false);
    setTplId("");
    router.refresh();
  }

  return (
    <div className="mb-3 rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
        <FileText className="h-4 w-4 text-brand-500" /> Documentos deste negócio
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-muted">Nenhuma proposta/contrato ainda. Gere um a partir de um modelo abaixo.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => {
            const s = DOC_STATUS_MAP[d.status ?? "draft"] ?? DOC_STATUS_MAP.draft;
            return (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.02] px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{d.title}</span>
                  <span className="ml-2 text-[11px] text-muted">{DOC_KIND_LABEL[d.kind] ?? d.kind}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {d.value != null && <span className="text-xs font-medium text-ink">{formatBRL(d.value)}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DOC_TONE[s.tone]}`}>{s.label}</span>
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-muted hover:text-brand-600">
                      abrir
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {activeTpls.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={tplId}
            onChange={(e) => setTplId(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
          >
            <option value="">Gerar a partir de um modelo…</option>
            {activeTpls.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!tplId || busy}
            onClick={generate}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Gerar
          </button>
        </div>
      )}
    </div>
  );
}

function NegoTab({
  lead,
  onSave,
  documents = [],
  templates = [],
}: {
  lead: CrmLead;
  onSave: (key: string, value: unknown) => void;
  documents?: CrmDocument[];
  templates?: DocTemplate[];
}) {
  const p = (lead.properties ?? {}) as Record<string, unknown>;
  return (
    <>
    <NegoDocs lead={lead} documents={documents} templates={templates} />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <EditRow label="Budget declarado">
        <BlurInput type="number" initial={String(p.n_budget_declarado ?? "")} onSave={(v) => onSave("n_budget_declarado", v === "" ? null : Number(v))} />
      </EditRow>
      <EditRow label="Budget aprovado">
        <BlurInput type="number" initial={String(p.n_budget_aprovado ?? "")} onSave={(v) => onSave("n_budget_aprovado", v === "" ? null : Number(v))} />
      </EditRow>
      <EditRow label="Valor da proposta">
        <BlurInput type="number" initial={String(p.n_valor_proposta ?? "")} onSave={(v) => onSave("n_valor_proposta", v === "" ? null : Number(v))} />
      </EditRow>
      <EditRow label="Tipo de contrato">
        <BlurInput initial={String(p.n_tipo_contrato ?? "")} onSave={(v) => onSave("n_tipo_contrato", v)} />
      </EditRow>
      <EditRow label="Data da proposta">
        <BlurInput type="date" initial={String(p.n_data_proposta ?? "")} onSave={(v) => onSave("n_data_proposta", v)} />
      </EditRow>
      <EditRow label="Data de assinatura">
        <BlurInput type="date" initial={String(p.n_data_assinatura ?? "")} onSave={(v) => onSave("n_data_assinatura", v)} />
      </EditRow>
      <EditRow label="Objeção principal">
        <BlurInput initial={String(p.n_objecao ?? "")} onSave={(v) => onSave("n_objecao", v)} />
      </EditRow>
      <EditRow label="Concorrente avaliado">
        <BlurInput initial={String(p.n_concorrente ?? "")} onSave={(v) => onSave("n_concorrente", v)} />
      </EditRow>
      <EditRow label="Nº de follow-ups">
        <BlurInput type="number" initial={String(p.n_followups ?? "")} onSave={(v) => onSave("n_followups", v === "" ? null : Number(v))} />
      </EditRow>
      <EditRow label="Link do contrato (ZapSign)">
        <BlurInput type="url" initial={String(p.n_zapsign ?? "")} onSave={(v) => onSave("n_zapsign", v)} />
      </EditRow>
    </div>
    </>
  );
}

/* ── FAB: criador de tarefa estilo HubSpot ─────────────── */

const DUE_SHORTCUTS: { label: string; days: number }[] = [
  { label: "Hoje", days: 0 },
  { label: "Amanhã", days: 1 },
  { label: "Em 3 dias", days: 3 },
  { label: "Próxima semana", days: 7 },
];

const TASK_TYPE_OPTS = [
  { key: "ligacao", label: "Ligação" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "reuniao", label: "Reunião" },
  { key: "todo", label: "To-do" },
];

function FabTaskCreator({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (p: { title: string; dueIso?: string; type?: string; priority?: string; reminder?: string; recurrence?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("ligacao");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [priority, setPriority] = useState("media");
  const [reminder, setReminder] = useState("no-horario");
  const [recurrence, setRecurrence] = useState("nenhuma");

  function applyShortcut(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  }

  function submit() {
    if (!title.trim()) return;
    const dueIso = dueDate ? new Date(`${dueDate}T${dueTime || "09:00"}`).toISOString() : undefined;
    onCreate({
      title: title.trim(),
      dueIso,
      type,
      priority,
      reminder: reminder === "sem" ? undefined : reminder,
      recurrence: recurrence === "nenhuma" ? undefined : recurrence,
    });
  }

  const inputCls = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Nova tarefa</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-subtle">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" className={inputCls} />

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPE_OPTS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setType(o.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    type === o.key ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <Clock className="h-3.5 w-3.5" /> Vencimento
            </p>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {DUE_SHORTCUTS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => applyShortcut(s.days)}
                  className="rounded-full bg-subtle px-2.5 py-1 text-xs font-medium text-muted hover:bg-subtle-strong"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Bell className="h-3.5 w-3.5" /> Lembrete</span>
              <select value={reminder} onChange={(e) => setReminder(e.target.value)} className={inputCls}>
                <option value="30min">30 min antes</option>
                <option value="1h">1 hora antes</option>
                <option value="no-horario">No horário</option>
                <option value="sem">Sem lembrete</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Flag className="h-3.5 w-3.5" /> Prioridade</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                <option value="baixa">Baixa</option>
                <option value="media">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><RefreshCw className="h-3.5 w-3.5" /> Recorrência</span>
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inputCls}>
                <option value="nenhuma">Não repetir</option>
                <option value="diaria">A cada dia</option>
                <option value="semanal">A cada semana</option>
                <option value="mensal">A cada mês</option>
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-subtle">Cancelar</button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Criar tarefa
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Passagem de bastão (SDR → Vendas) ─────────────────── */

function HandoffFichaModal({
  lead,
  onClose,
  onSubmit,
}: {
  lead: CrmLead;
  onClose: () => void;
  onSubmit: (result: "aceito" | "recusado", parecer: string) => void;
}) {
  const [parecer, setParecer] = useState("");
  const props = (lead.properties ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null ? "" : String(v)).trim();
  // Campos da qualificação que o closer precisa receber preenchidos.
  const quali: { label: string; value: string }[] = [
    { label: "Solução procurada", value: str(props.q_solucao) },
    { label: "Cargo do decisor", value: str(props.q_cargo_decisor) },
    { label: "Faturamento", value: str(props.q_faturamento) },
    { label: "Dor principal", value: str(props.q_dor) || str(lead.bant?.need) },
  ];
  const bantMissing = BANT_LABELS.filter((b) => !str(lead.bant?.[b.key])).map((b) => b.label);
  const qualiMissing = quali.filter((q) => !q.value).map((q) => q.label);
  const missing = [...bantMissing, ...qualiMissing];
  const canAccept = missing.length === 0 && parecer.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <h2 className="text-base font-bold text-ink">Passagem de bastão</h2>
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-semibold text-ink">{lead.name}</span> — o closer precisa receber a qualificação
          completa. Confira e complete antes de passar. Aceito segue para Vendas; recusado vira Perdido.
        </p>

        {/* Resumo da qualificação (BANT + campos-chave) */}
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-canvas p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">BANT</p>
          <div className="grid grid-cols-2 gap-2">
            {BANT_LABELS.map((b) => {
              const v = str(lead.bant?.[b.key]);
              return (
                <div key={b.key} className="text-xs">
                  <span className="text-muted">{b.label}: </span>
                  {v ? <span className="text-ink">{v}</span> : <span className="italic text-rose-500">faltando</span>}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Qualificação</p>
          <div className="grid grid-cols-2 gap-2">
            {quali.map((q) => (
              <div key={q.label} className="text-xs">
                <span className="text-muted">{q.label}: </span>
                {q.value ? <span className="text-ink">{q.value}</span> : <span className="italic text-rose-500">faltando</span>}
              </div>
            ))}
          </div>
          {str(lead.prospectingNotes) && (
            <p className="mt-1 text-xs"><span className="text-muted">Prospecção: </span><span className="text-ink">{str(lead.prospectingNotes)}</span></p>
          )}
        </div>

        <textarea
          value={parecer}
          onChange={(e) => setParecer(e.target.value)}
          rows={3}
          placeholder="Parecer / contexto para o closer (dor, budget, decisor, urgência…)"
          className="mt-3 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        />

        {missing.length > 0 && (
          <p className="mt-2 text-[11px] text-amber-600">
            Preencha na ficha (aba Qualificação) antes de passar o bastão: <strong>{missing.join(", ")}</strong>.
          </p>
        )}
        {missing.length === 0 && !parecer.trim() && (
          <p className="mt-2 text-[11px] text-amber-600">Escreva o parecer para liberar a passagem.</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={() => onSubmit("recusado", parecer)} className="rounded-xl border border-rose-500/40 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-500/10">
            Recusar (Perdido)
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-subtle">Cancelar</button>
            <button
              onClick={() => onSubmit("aceito", parecer)}
              disabled={!canAccept}
              title={canAccept ? "" : "Complete a qualificação e o parecer"}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Aceitar → Vendas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NextLeadPrompt({ count, onGo, onStay }: { count: number; onGo: () => void; onStay: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-2xl">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        <p className="text-sm text-ink">
          Tarefa concluída! Você tem <strong>{count}</strong> {count === 1 ? "lead" : "leads"} com tarefa aberta.
        </p>
        <button onClick={onStay} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle">Ficar aqui</button>
        <button onClick={onGo} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
          Próximo lead <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Blocos auxiliares reaproveitados ──────────────────── */

function personInitials(name?: string) {
  if (!name) return "•";
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
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
    <img src={url} alt={name ?? ""} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
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
        <span key={name} className="group inline-flex items-center gap-1.5 rounded-full bg-subtle py-0.5 pl-0.5 pr-2 text-sm text-ink">
          <Avatar name={name} url={avatarOf(name)} size={22} />
          {name}
          <button onClick={() => toggle(name)} title="Remover" className="text-muted opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100">
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
              {team.length === 0 && <p className="px-2 py-1.5 text-xs text-muted">Nenhum membro na equipe.</p>}
              {team.map((m) => {
                const selected = assignees.includes(m.name);
                return (
                  <button key={m.id} onClick={() => toggle(m.name)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle">
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

function CenterTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Square; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-subtle text-ink" : "text-muted hover:bg-subtle hover:text-ink",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function SubTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Square; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
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
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-subtle text-ink" : "text-muted hover:bg-subtle hover:text-ink",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
      {badge != null && <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{badge}</span>}
    </button>
  );
}

const LAYOUTS: { key: LeadModalLayout; label: string; icon: typeof Square }[] = [
  { key: "modal", label: "Modal", icon: Square },
  { key: "full", label: "Tela cheia", icon: Maximize },
  { key: "side", label: "Barra lateral", icon: PanelRight },
];

function LayoutSwitcher({ layout, onChange }: { layout: LeadModalLayout; onChange: (l: LeadModalLayout) => void }) {
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
              layout === o.key ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function StagePill({ stages, currentKey, onPick }: { stages: Stage[]; currentKey: string; onPick: (s: Stage) => void }) {
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
      className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
    />
  );
}
