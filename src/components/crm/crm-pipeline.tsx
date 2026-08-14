"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRightLeft,
  BarChart3,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  List,
  Mail,
  Pause,
  PencilLine,
  Phone,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  ShieldAlert,
  Snowflake,
  Trash2,
  UserX,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/utils";
import { dayMonth } from "@/lib/datetime";
import { useReadOnly } from "@/components/shell/read-only-context";
import {
  DEFAULT_PIPELINE,
  toCard,
  LEAD_PRIORITIES,
  unmetStageRequirements,
  PIPELINE_VENDAS_ID,
  STAGE_RESERVOIR,
  STAGE_CADENCE_ON,
  STAGE_CADENCE_OFF,
  STAGE_NO_SHOW,
  STAGE_HANDOFF,
  type Company,
  type Contact,
  type CrmLead,
  type CrmLeadCard,
  type CrmStage,
  type LeadPriority,
  type Pipeline,
  type Stage,
  type StageRequirement,
  type Tag,
} from "@/lib/data/crm";
import type { Attendant } from "@/lib/data/inbox";
import type { SavedView } from "@/lib/data/listas";
import { NovoNegocioModal } from "./new-lead-modal";
import { CrmList } from "./crm-list";
import { CrmForecast } from "./crm-forecast";
import { TagChips } from "./tag-chips";
import { SettingsShortcut } from "./settings-shortcut";
import { withToast } from "@/lib/api";
import { toast } from "@/components/ui/toast";

function cardBorder(card: CrmLeadCard): string {
  if (card.rot === "stale") return "border-l-rose-500";
  if (card.probability >= 70) return "border-l-emerald-500";
  return "border-l-brand-400";
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// Prefixo AAAA-MM do mês atual (helper module-level — padrão permitido p/ new Date()).
function monthPrefixNow(): string {
  return new Date().toISOString().slice(0, 7);
}
// Data dd/mm/aaaa (determinístico — recebe a ISO, não usa "agora").
function dtBR(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-[140px] flex-1 border-r border-line px-4 py-3 text-center last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-brand-600">{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );
}

function LeadCard({
  card,
  allTags,
  onOpen,
  onDragStart,
  onDelete,
  onNoShow,
  onFreeze,
  onUnfreeze,
  onHandoff,
}: {
  card: CrmLeadCard;
  allTags: Tag[];
  onOpen: () => void;
  onDragStart: () => void;
  onDelete: () => void;
  onNoShow: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onHandoff: () => void;
}) {
  const assignees = card.assignees?.length ? card.assignees : card.owner ? [card.owner] : [];
  const [confirm, setConfirm] = useState(false);
  const frozen = Boolean(card.frozenAt);
  return (
    <div
      draggable={!confirm && !frozen}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={onOpen}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-l-4 border-line bg-surface p-3 shadow-sm transition-shadow hover:shadow-md",
        cardBorder(card),
      )}
    >
      {confirm && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-surface/95 p-2 text-center backdrop-blur-sm"
        >
          <p className="text-xs font-medium text-ink">Excluir este negócio?</p>
          <div className="flex gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Excluir
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirm(false); }}
              className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-subtle"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {/* Nome (link) + ações no hover — formato HubSpot */}
      <div className="flex items-start justify-between gap-2">
        <p className="pr-1 text-sm font-semibold leading-tight text-brand-600">{card.name}</p>
        <div className="flex shrink-0 items-center gap-1">
          {!frozen && (
            <button
              onClick={(e) => { e.stopPropagation(); onFreeze(); }}
              className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-sky-500 group-hover:opacity-100"
              title="Congelar negócio (reengajar depois)"
            >
              <Snowflake className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setConfirm(true); }}
            className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
            title="Excluir negócio"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Propriedades (estilo HubSpot: rótulo: valor) */}
      <p className="mt-1 text-[11px] text-muted">
        Proprietário do negócio: <span className="text-ink">{assignees[0] ?? "—"}</span>
      </p>
      {card.createdAt && (
        <p className="text-[11px] text-muted">Data de criação: {dtBR(card.createdAt)}</p>
      )}
      {card.source && (
        <p className="text-[11px] text-muted">Origem: <span className="text-ink">{card.source}</span></p>
      )}
      {card.contactName && (
        <p className="text-[11px] text-muted">Contato: <span className="text-ink">{card.contactName}</span></p>
      )}
      {(card.tags?.length ?? 0) > 0 && (
        <div className="mt-1.5">
          <TagChips ids={card.tags} tags={allTags} size="xs" />
        </div>
      )}

      {/* Divisória + status de tarefa + dono + ícones (rodapé do card HubSpot) */}
      <div className="mt-2 border-t border-line pt-2">
        {card.nextTaskDue ? (
          <p className="truncate text-[11px] font-semibold text-ink" title={card.nextTaskTitle ?? undefined}>
            Tarefa · {dayMonth(card.nextTaskDue)}
            {card.nextTaskTitle ? ` — ${card.nextTaskTitle}` : ""}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink">
            Sem tarefa
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full border border-rose-400 px-1 text-[9px] font-bold text-rose-500">!</span>
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[9px] font-semibold text-white">
              {initials(assignees[0] ?? card.name)}
            </span>
            <span className="truncate text-[11px] text-muted">{assignees[0] ?? "—"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-muted">
            <StickyNote className="h-3.5 w-3.5" />
            <Phone className="h-3.5 w-3.5" />
            <Mail className="h-3.5 w-3.5" />
            <PencilLine className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {/* Ação contextual por estágio (no-show / passagem de bastão / reativar) */}
      {frozen ? (
        <button
          onClick={(e) => { e.stopPropagation(); onUnfreeze(); }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink hover:bg-subtle"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reativar
        </button>
      ) : card.stage === STAGE_NO_SHOW ? (
        <button
          onClick={(e) => { e.stopPropagation(); onNoShow(); }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 px-2 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/10"
        >
          <UserX className="h-3.5 w-3.5" /> Registrar no-show
        </button>
      ) : card.stage === STAGE_HANDOFF ? (
        <button
          onClick={(e) => { e.stopPropagation(); onHandoff(); }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" /> Passar bastão
        </button>
      ) : null}
    </div>
  );
}

/** Adição rápida estilo Kommo: digita o nome da empresa + Enter cria o card cru. */
function QuickAdd({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) {
          onAdd(value.trim());
          setValue("");
        }
      }}
      placeholder="+ Empresa e Enter…"
      className="mb-2 w-full rounded-lg border border-dashed border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-brand-400"
    />
  );
}

/** Passagem de bastão SDR → Vendas: registra parecer (aceite híbrido). */
function HandoffModal({
  name,
  onClose,
  onSubmit,
}: {
  name: string;
  onClose: () => void;
  onSubmit: (result: "aceito" | "recusado", parecer: string) => void;
}) {
  const [parecer, setParecer] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <h2 className="text-base font-bold text-ink">Passagem de bastão</h2>
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-semibold text-ink">{name}</span> — registre o parecer da
          qualificação. Aceito segue para o funil de Vendas; recusado vira Perdido com o
          feedback anexado.
        </p>
        <textarea
          value={parecer}
          onChange={(e) => setParecer(e.target.value)}
          rows={4}
          placeholder="Parecer / contexto para o closer (dor, budget, decisor, urgência…)"
          className="mt-3 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => onSubmit("recusado", parecer)}
            className="rounded-xl border border-rose-500/40 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-500/10"
          >
            Recusar (Perdido)
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-subtle">
              Cancelar
            </button>
            <button
              onClick={() => onSubmit("aceito", parecer)}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Aceitar → Vendas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modal de motivo de perda (obrigatório) ao arrastar p/ Saídas › Perdido. */
function LoseModal({
  name,
  reasons,
  onClose,
  onConfirm,
}: {
  name: string;
  reasons: string[];
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const final = [reason, note.trim()].filter(Boolean).join(" — ");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <h2 className="text-base font-bold text-ink">Marcar como Perdido</h2>
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-semibold text-ink">{name}</span> — o motivo é obrigatório (insumo de qualificação).
        </p>
        {reasons.length > 0 ? (
          <select
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-3 w-full rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="">Motivo da perda…</option>
            {reasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo da perda"
            className="mt-3 w-full rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-400"
          />
        )}
        <div className="mt-1.5">
          <SettingsShortcut section="loss-reasons" label="Editar motivos de perda" />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação (opcional)"
          className="mt-2 w-full rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-400"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-subtle">Cancelar</button>
          <button
            onClick={() => onConfirm(final)}
            disabled={!reason}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            Confirmar perda
          </button>
        </div>
      </div>
    </div>
  );
}

type PipelineView = "kanban" | "lista" | "forecast" | "arquivados";

// Classe compartilhada dos selects da barra de filtros (estilo Sprint board).
const FILTER_CLS =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400";

/** Responsáveis do negócio (nomes). Fallback: [owner]. Multi conta p/ cada um. */
function respNamesOf(c: CrmLeadCard): string[] {
  return c.assignees?.length ? c.assignees : c.owner ? [c.owner] : [];
}

export function CrmPipeline({
  cards: initial,
  pipelines = [DEFAULT_PIPELINE],
  tags = [],
  companies = [],
  team = [],
  teamMembers = [],
  currentUser = "",
  lostReasons = [],
  savedViews = [],
}: {
  cards: CrmLeadCard[];
  pipelines?: Pipeline[];
  tags?: Tag[];
  companies?: Company[];
  contacts?: Contact[];
  team?: string[];
  teamMembers?: Attendant[];
  currentUser?: string;
  lostReasons?: string[];
  savedViews?: SavedView[];
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [showFrozen, setShowFrozen] = useState(false);
  const [handoff, setHandoff] = useState<{ id: string; name: string } | null>(null);
  const [lose, setLose] = useState<{ id: string; name: string } | null>(null);
  const [newFunil, setNewFunil] = useState("");
  const [creatingFunil, setCreatingFunil] = useState(false);
  const [view, setView] = useState<PipelineView>("kanban");
  // Barra de filtros (estilo Sprint board / Painel de Entregas).
  const [assignee, setAssignee] = useState<string | null>(null);
  const [companyF, setCompanyF] = useState<string | null>(null);
  const [sourceF, setSourceF] = useState<string | null>(null);
  const [stageF, setStageF] = useState<string | null>(null);
  const [priorityF, setPriorityF] = useState<LeadPriority | null>(null);
  const [stuckOnly, setStuckOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [showMetrics, setShowMetrics] = useState(false);
  const [hideMetrics, setHideMetrics] = useState(false);
  const [boardOpts, setBoardOpts] = useState(false);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) =>
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const defaultId = pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? DEFAULT_PIPELINE.id;
  const [pipelineId, setPipelineId] = useState(defaultId);

  // Persistência por usuário: funil, escopo, tag e visão.
  useEffect(() => {
    // Hidrata as preferências salvas no cliente (localStorage) após montar.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem("crm-pipe-prefs");
      if (raw) {
        const p = JSON.parse(raw) as { pipelineId?: string; mine?: boolean; tag?: string | null; view?: PipelineView };
        if (p.pipelineId && pipelines.some((x) => x.id === p.pipelineId)) setPipelineId(p.pipelineId);
        if (typeof p.mine === "boolean") setMine(p.mine);
        if (p.tag) setTagFilter(p.tag);
        if (p.view) setView(p.view);
      }
    } catch {
      /* ignore */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("crm-pipe-prefs", JSON.stringify({ pipelineId, mine, tag: tagFilter, view }));
    } catch {
      /* ignore */
    }
  }, [pipelineId, mine, tagFilter, view]);

  // Deep-link: hidrata os filtros da barra a partir da URL ao montar (compartilhável).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (p.get("q")) setSearch(p.get("q")!);
    if (p.get("resp")) setAssignee(p.get("resp"));
    if (p.get("cli")) setCompanyF(p.get("cli"));
    if (p.get("origem")) setSourceF(p.get("origem"));
    if (p.get("etapa")) setStageF(p.get("etapa"));
    if (p.get("prio")) setPriorityF(p.get("prio") as LeadPriority);
    if (p.get("parado") === "1") setStuckOnly(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Espelha os filtros da barra → URL (replaceState; preserva outros params).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const put = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
    put("q", search.trim());
    put("resp", assignee ?? "");
    put("cli", companyF ?? "");
    put("origem", sourceF ?? "");
    put("etapa", stageF ?? "");
    put("prio", priorityF ?? "");
    put("parado", stuckOnly ? "1" : "");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [search, assignee, companyF, sourceF, stageF, priorityF, stuckOnly]);
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0] ?? DEFAULT_PIPELINE;
  const stages = pipeline.stages;
  const [blocked, setBlocked] = useState<{
    dealId: string;
    stageLabel: string;
    missing: StageRequirement[];
  } | null>(null);

  const assigneesOf = respNamesOf;

  const closedKeys = new Set(stages.filter((s) => s.kind !== "open").map((s) => s.key));
  const wonKeys = new Set(stages.filter((s) => s.kind === "won").map((s) => s.key));
  const lostKeys = new Set(stages.filter((s) => s.kind === "lost").map((s) => s.key));
  const inThisPipeline = (c: CrmLeadCard) => (c.pipelineId || defaultId) === pipelineId;
  const frozenCount = cards.filter((c) => inThisPipeline(c) && Boolean(c.frozenAt)).length;

  // Opções dos filtros — derivadas dos próprios negócios (só mostra o que existe).
  const companyName = useMemo(() => {
    const m = new Map(companies.map((c) => [c.id, c.name]));
    return (id?: string) => (id ? m.get(id) ?? null : null);
  }, [companies]);
  const owners = useMemo(
    () => [...new Set([...team, ...cards.flatMap(respNamesOf)])].filter(Boolean).sort(),
    [team, cards],
  );
  const companyOptions = useMemo(() => {
    const ids = [...new Set(cards.map((c) => c.companyId).filter(Boolean) as string[])];
    return ids
      .map((id) => ({ id, name: companyName(id) }))
      .filter((o): o is { id: string; name: string } => Boolean(o.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, companyName]);
  const sourceOptions = useMemo(
    () => [...new Set(cards.map((c) => c.source).filter(Boolean) as string[])].sort(),
    [cards],
  );

  const term = search.trim().toLowerCase();
  const visibleCards = cards.filter(
    (c) =>
      inThisPipeline(c) &&
      (showFrozen ? Boolean(c.frozenAt) : !c.frozenAt) &&
      (!tagFilter || c.tags?.includes(tagFilter)) &&
      (!mine || assigneesOf(c).includes(currentUser)) &&
      (!assignee || assigneesOf(c).includes(assignee)) &&
      (!companyF || c.companyId === companyF) &&
      (!sourceF || c.source === sourceF) &&
      (!stageF || c.stage === stageF) &&
      (!priorityF || c.priority === priorityF) &&
      (!stuckOnly || c.rot === "stale") &&
      (!term ||
        c.name.toLowerCase().includes(term) ||
        (c.contactName ?? "").toLowerCase().includes(term) ||
        (companyName(c.companyId) ?? "").toLowerCase().includes(term)),
  );
  const isReservoir = stages[0]?.key === STAGE_RESERVOIR; // funil Pré-venda (SDR)

  const activeFilters =
    (assignee ? 1 : 0) + (companyF ? 1 : 0) + (sourceF ? 1 : 0) + (stageF ? 1 : 0) +
    (priorityF ? 1 : 0) + (stuckOnly ? 1 : 0) + (term ? 1 : 0);
  function clearFilters() {
    setSearch("");
    setAssignee(null);
    setCompanyF(null);
    setSourceF(null);
    setStageF(null);
    setPriorityF(null);
    setStuckOnly(false);
  }

  function addLead(lead: CrmLead) {
    setShowNew(false);
    setCards((prev) => [toCard(lead, new Date().toISOString()), ...prev]);
    router.refresh();
  }

  async function deleteCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    }).catch(() => {});
    router.refresh();
  }

  function post(payload: Record<string, unknown>) {
    // withToast: em falha, avisa o usuário (não engole). Devolve Response|null.
    return withToast(
      fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }

  async function markNoShow(id: string) {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, noShowCount: (c.noShowCount ?? 0) + 1 } : c)),
    );
    await post({ action: "no-show", id }).catch(() => {});
  }

  async function freezeCard(id: string) {
    const iso = new Date().toISOString();
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, frozenAt: iso } : c)));
    await post({ action: "freeze", id }).catch(() => {});
    router.refresh();
  }

  async function unfreezeCard(id: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, frozenAt: undefined } : c)));
    await post({ action: "unfreeze", id }).catch(() => {});
    router.refresh();
  }

  async function submitHandoff(result: "aceito" | "recusado", parecer: string) {
    if (!handoff) return;
    const id = handoff.id;
    setHandoff(null);
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return result === "aceito"
          ? { ...c, pipelineId: PIPELINE_VENDAS_ID, stage: "vnd_analise", cadenceActive: false, daysInStage: 0, rot: "fresh" as const }
          : { ...c, stage: "perdido", cadenceActive: false };
      }),
    );
    await post({ action: "handoff", id, result, parecer }).catch(() => {});
    router.refresh();
  }

  async function createFunil(name: string) {
    if (!name.trim() || creatingFunil) return;
    setCreatingFunil(true);
    const res = await fetch("/api/crm/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: name.trim() }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setCreatingFunil(false);
    setNewFunil("");
    if (j?.id) setPipelineId(j.id);
    router.refresh();
  }

  async function losePerdido(reason: string) {
    if (!lose) return;
    const id = lose.id;
    setLose(null);
    const lostStage = stages.find((s) => s.kind === "lost");
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage: lostStage?.key ?? "perdido" } : c)));
    await post({ action: "move", id, stage: lostStage?.key ?? "perdido", stageId: lostStage?.id, kind: "lost", reason }).catch(() => {});
    router.refresh();
  }

  async function quickAdd(name: string, stageId: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const iso = new Date().toISOString();
    const tempId = `tmp-${stageId}-${iso}`;
    const optimistic: CrmLeadCard = {
      id: tempId,
      name: trimmed,
      stage: STAGE_RESERVOIR,
      monthlyValue: 0,
      mediaBudget: 0,
      probability: 10,
      bant: {},
      pipelineId: pipeline.id,
      stageId,
      originKind: "outbound",
      stageChangedAt: iso,
      createdAt: iso,
      updatedAt: iso,
      daysInStage: 0,
      rot: "fresh",
      noShowCount: 0,
    };
    setCards((prev) => [optimistic, ...prev]);
    const res = await post({
      action: "create",
      name: trimmed,
      allowNoContact: true,
      originKind: "outbound",
      pipelineId: pipeline.id,
      stageId,
      stage: STAGE_RESERVOIR,
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (json?.id) {
      setCards((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: json.id } : c)));
    }
    router.refresh();
  }

  const openCards = visibleCards.filter((c) => !closedKeys.has(c.stage));
  const openValue = openCards.reduce((s, c) => s + c.monthlyValue, 0);
  // Valor ponderado (estilo HubSpot): valor × probabilidade da etapa.
  const openWeighted = openCards.reduce((s, c) => s + c.monthlyValue * (c.probability / 100), 0);
  const avgAge = openCards.length
    ? Math.round(openCards.reduce((s, c) => s + c.daysInStage, 0) / openCards.length)
    : 0;
  // Métricas do topo (6, estilo HubSpot): total · ponderado · aberto · fechado · novo · idade.
  // O quadro esconde etapas "perdido" (não há coluna) — total/novo seguem o que
  // o quadro mostra (aberto + ganho), sem inflar as métricas com perdidos.
  const boardCards = visibleCards.filter((c) => !lostKeys.has(c.stage));
  const allValue = boardCards.reduce((s, c) => s + c.monthlyValue, 0);
  const wonCards = visibleCards.filter((c) => wonKeys.has(c.stage));
  const wonValue = wonCards.reduce((s, c) => s + c.monthlyValue, 0);
  const monthPrefix = monthPrefixNow();
  const newCards = boardCards.filter((c) => (c.createdAt ?? "").slice(0, 7) === monthPrefix);
  const newValue = newCards.reduce((s, c) => s + c.monthlyValue, 0);
  const avgOf = (total: number, n: number) => (n ? total / n : 0);

  async function moveTo(stage: Stage) {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage.key) return;

    // Regras de movimentação: bloqueia se o negócio não cumpre os requisitos.
    const missing = unmetStageRequirements(card, stage);
    if (missing.length) {
      setBlocked({ dealId: id, stageLabel: stage.label, missing });
      return;
    }

    // Snapshot completo do card p/ reverter por inteiro (etapa + idade + rot +
    // cadência) caso o servidor recuse — restaurar só a etapa deixaria idade/rot
    // zerados e a cadência trocada.
    const prevCard = card;
    // Cadência amarrada à etapa: reflete ON/OFF no card na hora do arraste.
    const cadenceActive =
      stage.key === STAGE_CADENCE_ON ? true : stage.key === STAGE_CADENCE_OFF ? false : card.cadenceActive;
    const cadenceStep = stage.key === STAGE_CADENCE_ON ? 1 : card.cadenceStep;
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, stage: stage.key, daysInStage: 0, rot: "fresh", cadenceActive, cadenceStep } : c,
      ),
    );
    const revert = () => setCards((prev) => prev.map((c) => (c.id === id ? prevCard : c)));
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          id,
          stage: stage.key,
          stageId: stage.id,
          kind: stage.kind,
        }),
      });
      if (res.status === 422) {
        // Servidor recusou (requisitos): reverte o movimento otimista por completo.
        const json = await res.json().catch(() => ({}));
        revert();
        setBlocked({
          dealId: id,
          stageLabel: stage.label,
          missing: (json.missing ?? []).map((label: string) => ({
            source: "native" as const,
            field: "",
            label,
            op: "filled" as const,
          })),
        });
        return;
      }
      if (!res.ok) {
        // Falha real (não requisitos): avisa e reverte o movimento otimista.
        toast("Não foi possível mover o negócio. Tente de novo.", "error");
        revert();
        return;
      }
    } catch {
      // Sem conexão: reverte pra não deixar o card num estado não salvo.
      toast("Sem conexão — o movimento não foi salvo.", "error");
      revert();
      return;
    }
    router.refresh();
  }

  // Visões salvas de Negócios (board) — reusam saved_views (scope negocios).
  async function saveDealView() {
    const name = window.prompt("Nome da visualização:");
    if (!name?.trim()) return;
    const filters = { mine, assignee, companyF, sourceF, stageF, priorityF, tagFilter, stuckOnly, search, pipelineId };
    await withToast(
      fetch("/api/crm/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", scope: "negocios", name: name.trim(), display: { filters } }),
      }),
    );
    router.refresh();
  }
  function applyDealView(v: SavedView) {
    const f = (v.display?.filters ?? {}) as Record<string, unknown>;
    setMine(Boolean(f.mine));
    setAssignee((f.assignee as string) || null);
    setCompanyF((f.companyF as string) || null);
    setSourceF((f.sourceF as string) || null);
    setStageF((f.stageF as string) || null);
    setPriorityF((f.priorityF as LeadPriority) || null);
    setTagFilter((f.tagFilter as string) || null);
    setStuckOnly(Boolean(f.stuckOnly));
    setSearch((f.search as string) || "");
    if (f.pipelineId && pipelines.some((p) => p.id === f.pipelineId)) setPipelineId(f.pipelineId as string);
    setActiveView(v.id);
  }
  async function deleteDealView(id: string) {
    if (!window.confirm("Excluir esta visualização?")) return;
    await fetch("/api/crm/saved-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    }).catch(() => {});
    if (activeView === id) setActiveView(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho do objeto (estilo HubSpot): título + toggle de visão + ações */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Negócios</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-line p-0.5">
            {([["kanban", LayoutGrid, "Kanban"], ["lista", List, "Tabela"], ["forecast", BarChart3, "Forecast"], ["arquivados", Archive, "Arquivados"]] as const).map(
              ([k, Icon, label]) => (
                <button
                  key={k}
                  onClick={() => setView(k)}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    view === k ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ),
            )}
          </div>
          <SettingsShortcut section="import" label="Importar" />
          {!readOnly && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> Criar negócio
            </button>
          )}
        </div>
      </div>

      {showNew && (
        <NovoNegocioModal
          onClose={() => setShowNew(false)}
          onCreated={addLead}
          team={team}
          defaultOwner={currentUser}
          tags={tags}
        />
      )}

      {view === "lista" ? (
        <CrmList
          cards={cards}
          pipelines={pipelines}
          tags={tags}
          companies={companies}
          team={team}
          teamMembers={teamMembers}
          currentUser={currentUser}
        />
      ) : view === "arquivados" ? (
        <CrmList
          cards={cards}
          pipelines={pipelines}
          tags={tags}
          companies={companies}
          team={team}
          teamMembers={teamMembers}
          currentUser={currentUser}
          initialStatus="congelados"
        />
      ) : view === "forecast" ? (
        <CrmForecast
          cards={cards}
          pipelines={pipelines}
          defaultPipelineId={pipelineId}
          currentUser={currentUser}
        />
      ) : (
        <>
      {/* Abas de visualização (estilo HubSpot): padrão + visões salvas */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
        {([["todos", "Todos os negócios"], ["meus", "Meus negócios"]] as const).map(([k, label]) => {
          const active = !activeView && (k === "meus" ? mine : !mine);
          return (
            <button
              key={k}
              onClick={() => {
                if (activeView) { clearFilters(); setTagFilter(null); }
                setActiveView(null);
                setMine(k === "meus");
              }}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          );
        })}
        {savedViews.map((v) => (
          <span
            key={v.id}
            className={cn(
              "group -mb-px inline-flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              activeView === v.id ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <button type="button" onClick={() => applyDealView(v)}>{v.name}</button>
            <button
              type="button"
              onClick={() => deleteDealView(v.id)}
              className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
              title="Excluir visualização"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!readOnly && (
          <button
            onClick={saveDealView}
            className="ml-1 whitespace-nowrap px-2 py-2 text-sm font-medium text-brand-600 hover:text-brand-700"
            title="Salvar os filtros atuais como uma visualização"
          >
            + Adicionar visualização
          </button>
        )}
      </div>

      {/* Barra de ferramentas: funil + Ocultar métricas (estilo HubSpot) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {pipelines.length > 1 && (
            <select
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-brand-600 outline-none focus:border-brand-400"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1">
            <input
              value={newFunil}
              onChange={(e) => setNewFunil(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFunil(newFunil)}
              placeholder="+ Novo funil"
              className="w-28 rounded-xl border border-dashed border-line bg-surface px-2.5 py-2 text-xs text-ink outline-none transition-all focus:w-40 focus:border-brand-400"
              title="Criar funil — digite o nome e Enter"
            />
            {newFunil.trim() && (
              <button
                onClick={() => createFunil(newFunil)}
                disabled={creatingFunil}
                className="shrink-0 rounded-lg bg-brand-600 px-2 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <SettingsShortcut section="pipelines" label="Configurar funil" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideMetrics((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
          >
            {hideMetrics ? "Mostrar métricas" : "Ocultar métricas"}
          </button>
          <button
            onClick={() => setShowMetrics(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Métricas
          </button>
        </div>
      </div>

      {/* Faixa de métricas (6 KPIs, estilo HubSpot) */}
      {!hideMetrics && (
        <div data-tour="pipeline-metrics" className="flex items-stretch overflow-x-auto rounded-lg border border-line bg-surface">
          <MetricTile label="Valor total de negócio" value={formatBRL(allValue)} sub={`Média por negócio ${formatBRL(avgOf(allValue, boardCards.length))}`} />
          <MetricTile label="Valor ponderado de negócio" value={formatBRL(openWeighted)} sub={`Média por negócio ${formatBRL(avgOf(openWeighted, openCards.length))}`} />
          <MetricTile label="Valor de negócio aberto" value={formatBRL(openValue)} sub={`Média por negócio ${formatBRL(avgOf(openValue, openCards.length))}`} />
          <MetricTile label="Valor de negócio fechado" value={formatBRL(wonValue)} sub={`Média por negócio ${formatBRL(avgOf(wonValue, wonCards.length))}`} />
          <MetricTile label="Novo valor de negócio" value={formatBRL(newValue)} sub={`Média por negócio ${formatBRL(avgOf(newValue, newCards.length))}`} />
          <MetricTile label="Idade média de negócio" value={`${avgAge} dia${avgAge === 1 ? "" : "s"}`} sub="por negócio aberto" />
        </div>
      )}

      {/* Barra de filtros por propriedade (estilo HubSpot) */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={assignee ?? ""} onChange={(e) => setAssignee(e.target.value || null)} className={FILTER_CLS}>
          <option value="">Proprietário do negócio</option>
          {owners.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select value={companyF ?? ""} onChange={(e) => setCompanyF(e.target.value || null)} className={FILTER_CLS}>
          <option value="">Cliente</option>
          {companyOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select value={sourceF ?? ""} onChange={(e) => setSourceF(e.target.value || null)} className={FILTER_CLS}>
          <option value="">Origem</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={stageF ?? ""} onChange={(e) => setStageF(e.target.value || null)} className={FILTER_CLS}>
          <option value="">Etapa</option>
          {stages.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select
          value={priorityF ?? ""}
          onChange={(e) => setPriorityF((e.target.value as LeadPriority) || null)}
          className={FILTER_CLS}
        >
          <option value="">Prioridade</option>
          {LEAD_PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <button
          onClick={() => setStuckOnly((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
            stuckOnly ? "border-rose-400 bg-rose-50 text-rose-600" : "border-line text-muted hover:text-ink",
          )}
          title="Negócios parados (sem movimento há muitos dias)"
        >
          <Pause className="h-3.5 w-3.5" /> Parados
        </button>
        {(frozenCount > 0 || showFrozen) && (
          <button
            onClick={() => setShowFrozen((f) => !f)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
              showFrozen ? "border-sky-400 bg-sky-50 text-sky-600" : "border-line text-muted hover:text-ink",
            )}
            title="Negócios congelados/arquivados"
          >
            <Snowflake className="h-3.5 w-3.5" /> Congelados
            {frozenCount > 0 && (
              <span className={cn("rounded-full px-1.5 text-[10px]", showFrozen ? "bg-sky-500/20" : "bg-subtle")}>
                {frozenCount}
              </span>
            )}
          </button>
        )}
        {activeFilters > 0 && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <X className="h-3.5 w-3.5" /> limpar ({activeFilters})
          </button>
        )}
        {tags.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setTagFilter(null)}
              className={
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors " +
                (tagFilter === null ? "bg-ink text-surface" : "bg-subtle text-muted hover:bg-subtle-strong")
              }
            >
              Todas
            </button>
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => setTagFilter((cur) => (cur === t.id ? null : t.id))}
                className="rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity"
                style={{
                  backgroundColor: `${t.color}22`,
                  color: t.color,
                  opacity: tagFilter && tagFilter !== t.id ? 0.4 : 1,
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Busca + Opções do quadro (estilo HubSpot) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nome ou descrição"
            className="w-full rounded-lg border border-line bg-surface py-1.5 pl-9 pr-2 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setBoardOpts((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle"
          >
            Opções do quadro <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {boardOpts && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setBoardOpts(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                <button
                  onClick={() => { setHideMetrics((v) => !v); setBoardOpts(false); }}
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-subtle"
                >
                  {hideMetrics ? "Mostrar métricas" : "Ocultar métricas"}
                </button>
                <button
                  onClick={() => { setCollapsedStages(new Set(stages.filter((s) => s.kind !== "lost").map((s) => s.key))); setBoardOpts(false); }}
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-subtle"
                >
                  Recolher todas as colunas
                </button>
                <button
                  onClick={() => { setCollapsedStages(new Set()); setBoardOpts(false); }}
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-subtle"
                >
                  Expandir todas as colunas
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showFrozen && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-700">
          <Snowflake className="h-4 w-4 shrink-0" />
          Vendo negócios <strong>congelados/arquivados</strong> — reengaje quando fizer sentido.
          Use <strong>Reativar</strong> no card para devolvê-lo ao funil.
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.filter((s) => s.kind !== "lost").map((s, si) => {
          const inStage = visibleCards.filter((c) => c.stage === s.key);
          const sum = inStage.reduce((acc, c) => acc + c.monthlyValue, 0);
          const weighted = inStage.reduce((acc, c) => acc + c.monthlyValue * (c.probability / 100), 0);
          // Adição rápida (Kommo) só no reservatório do outbound (1ª coluna do SDR).
          const showQuickAdd = si === 0 && isReservoir && !showFrozen;
          const collapsed = collapsedStages.has(s.key);

          if (collapsed) {
            return (
              <button
                key={s.key}
                onClick={() => toggleCollapse(s.key)}
                onDragOver={(e) => { e.preventDefault(); setOverStage(s.key); }}
                onDrop={() => moveTo(s)}
                title={`Expandir ${s.label}`}
                className="flex w-11 shrink-0 flex-col items-center gap-2 rounded-2xl border border-line bg-canvas py-3 hover:bg-subtle"
              >
                <ChevronsRight className="h-4 w-4 text-muted" />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">{inStage.length}</span>
                <span className="mt-1 text-[11px] font-semibold text-ink [writing-mode:vertical-rl]">{s.label}</span>
              </button>
            );
          }
          return (
            <div
              key={s.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(s.key);
              }}
              onDragLeave={() => setOverStage((cur) => (cur === s.key ? null : cur))}
              onDrop={() => moveTo(s)}
              className={cn(
                "flex w-[240px] shrink-0 flex-col rounded-2xl border p-2.5 transition-colors",
                overStage === s.key
                  ? "border-brand-400 bg-brand-50/50"
                  : "border-line bg-canvas",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    {inStage.length}
                  </span>
                  <button
                    onClick={() => toggleCollapse(s.key)}
                    title="Recolher coluna"
                    className="rounded p-0.5 text-muted hover:bg-subtle hover:text-ink"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              {s.hint && <p className="mb-1 px-1 text-[10px] leading-tight text-muted">{s.hint}</p>}
              {showQuickAdd && <QuickAdd onAdd={(name) => quickAdd(name, s.id)} />}
              {/* Lista de cards com scroll interno (etapa fixa em cima/baixo, estilo HubSpot) */}
              <div className="flex max-h-[calc(100dvh-19rem)] min-h-[4rem] flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
                {inStage.map((c) => (
                  <LeadCard
                    key={c.id}
                    card={c}
                    allTags={tags}
                    onOpen={() => router.push(`/gerencial/crm/${c.id}`)}
                    onDragStart={() => setDragId(c.id)}
                    onDelete={() => deleteCard(c.id)}
                    onNoShow={() => markNoShow(c.id)}
                    onFreeze={() => freezeCard(c.id)}
                    onUnfreeze={() => unfreezeCard(c.id)}
                    onHandoff={() => setHandoff({ id: c.id, name: c.name })}
                  />
                ))}
                {inStage.length === 0 && !showQuickAdd && (
                  <p className="rounded-xl border border-dashed border-line px-2 py-6 text-center text-[11px] text-muted">
                    Arraste um card aqui
                  </p>
                )}
              </div>
              {/* Rodapé da coluna (estilo HubSpot): valor total + ponderado. */}
              <div className="mt-2 space-y-0.5 border-t border-line px-1 pt-2 text-[11px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">{formatBRL(sum)}</span>
                  <span className="text-muted">Valor total</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted">
                    {formatBRL(weighted)}
                    {s.probability != null ? ` (${s.probability}%)` : ""}
                  </span>
                  <span className="text-muted">Ponderado</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Coluna lateral "Saídas" (não é etapa): Perdido (motivo) · Congelado */}
        {!showFrozen && (
          <div className="flex w-[190px] shrink-0 flex-col gap-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Saídas</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setOverStage("__lost__"); }}
              onDragLeave={() => setOverStage((c) => (c === "__lost__" ? null : c))}
              onDrop={() => {
                const id = dragId;
                setDragId(null);
                setOverStage(null);
                const card = cards.find((c) => c.id === id);
                if (card) setLose({ id: card.id, name: card.name });
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed p-3 text-center transition-colors",
                overStage === "__lost__" ? "border-rose-500 bg-rose-500/10" : "border-line",
              )}
            >
              <XCircle className="h-5 w-5 text-rose-500" />
              <p className="mt-1 text-xs font-semibold text-rose-600">Perdido</p>
              <p className="text-[10px] text-muted">arraste aqui — pede motivo</p>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setOverStage("__frozen__"); }}
              onDragLeave={() => setOverStage((c) => (c === "__frozen__" ? null : c))}
              onDrop={() => {
                const id = dragId;
                setDragId(null);
                setOverStage(null);
                if (id) freezeCard(id);
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed p-3 text-center transition-colors",
                overStage === "__frozen__" ? "border-sky-500 bg-sky-500/10" : "border-line",
              )}
            >
              <Snowflake className="h-5 w-5 text-sky-500" />
              <p className="mt-1 text-xs font-semibold text-sky-600">Congelar</p>
              <p className="text-[10px] text-muted">reengajar depois</p>
            </div>
          </div>
        )}
      </div>

      {handoff && (
        <HandoffModal
          name={handoff.name}
          onClose={() => setHandoff(null)}
          onSubmit={submitHandoff}
        />
      )}

      {lose && (
        <LoseModal name={lose.name} reasons={lostReasons} onClose={() => setLose(null)} onConfirm={losePerdido} />
      )}

      {blocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBlocked(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">
                  Não é possível mover para “{blocked.stageLabel}”
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Este estágio exige que o negócio cumpra:
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {blocked.missing.map((m, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  {m.label}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setBlocked(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-subtle"
              >
                Fechar
              </button>
              <button
                onClick={() => router.push(`/gerencial/crm/${blocked.dealId}`)}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Abrir negócio
              </button>
            </div>
          </div>
        </div>
      )}

      {showMetrics && (
        <PipelineMetricsModal
          cards={cards.filter((c) => inThisPipeline(c) && !c.frozenAt)}
          wonKeys={wonKeys}
          lostKeys={lostKeys}
          onClose={() => setShowMetrics(false)}
        />
      )}
        </>
      )}
    </div>
  );
}

type PipeMetricPeriod = "semana" | "mes" | "tudo";
function pipeInPeriod(iso: string | undefined, period: PipeMetricPeriod): boolean {
  if (period === "tudo") return true;
  if (!iso) return false;
  const days = period === "semana" ? 7 : 30;
  return new Date(iso).getTime() >= Date.now() - days * 86_400_000;
}

function PipeRankTable({
  title,
  rows,
  max,
  tone,
  fmt,
}: {
  title: string;
  rows: { name: string; v: number }[];
  max: number;
  tone: string;
  fmt?: (v: number) => string;
}) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Sem dados no período.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((r) => (
            <li key={r.name} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-xs text-ink" title={r.name}>
                {r.name}
              </span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-full", tone)}
                  style={{ width: `${Math.max(6, (r.v / max) * 100)}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right text-xs font-semibold text-ink">
                {fmt ? fmt(r.v) : r.v}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PipelineMetricsModal({
  cards,
  wonKeys,
  lostKeys,
  onClose,
}: {
  cards: CrmLeadCard[];
  wonKeys: Set<string>;
  lostKeys: Set<string>;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<PipeMetricPeriod>("mes");

  const m = useMemo(() => {
    const isOpen = (c: CrmLeadCard) => !wonKeys.has(c.stage) && !lostKeys.has(c.stage);
    const open = cards.filter(isOpen);
    const won = cards.filter((c) => wonKeys.has(c.stage) && pipeInPeriod(c.wonAt, period));
    const lost = cards.filter((c) => lostKeys.has(c.stage) && pipeInPeriod(c.lostAt, period));
    const stuck = open.filter((c) => c.rot === "stale");

    const wip = new Map<string, number>();
    const value = new Map<string, number>();
    const wonBy = new Map<string, number>();
    const stuckBy = new Map<string, number>();
    for (const c of open)
      for (const n of respNamesOf(c)) {
        wip.set(n, (wip.get(n) ?? 0) + 1);
        value.set(n, (value.get(n) ?? 0) + c.monthlyValue);
      }
    for (const c of won) for (const n of respNamesOf(c)) wonBy.set(n, (wonBy.get(n) ?? 0) + 1);
    for (const c of stuck) for (const n of respNamesOf(c)) stuckBy.set(n, (stuckBy.get(n) ?? 0) + 1);

    const rank = (map: Map<string, number>) =>
      [...map.entries()].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v);
    const totalWonLost = won.length + lost.length;
    return {
      kpis: {
        abertos: open.length,
        valor: open.reduce((s, c) => s + c.monthlyValue, 0),
        ganhos: won.length,
        conversao: totalWonLost ? Math.round((won.length / totalWonLost) * 100) : 0,
      },
      byWip: rank(wip),
      byValue: rank(value),
      byWon: rank(wonBy),
      byStuck: rank(stuckBy),
    };
  }, [cards, wonKeys, lostKeys, period]);

  const maxWip = Math.max(1, ...m.byWip.map((r) => r.v));
  const maxValue = Math.max(1, ...m.byValue.map((r) => r.v));
  const maxWon = Math.max(1, ...m.byWon.map((r) => r.v));
  const maxStuck = Math.max(1, ...m.byStuck.map((r) => r.v));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <BarChart3 className="h-4 w-4 text-brand-500" /> Produtividade do funil
          </h3>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
              {(["semana", "mes", "tudo"] as PipeMetricPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium",
                    period === p ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {p === "semana" ? "7 dias" : p === "mes" ? "30 dias" : "Tudo"}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar"
              className="rounded-lg p-1 text-muted hover:bg-subtle"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Em aberto", value: String(m.kpis.abertos), tone: "text-ink" },
            { label: "Valor em aberto", value: formatBRL(m.kpis.valor), tone: "text-brand-600" },
            { label: "Ganhos no período", value: String(m.kpis.ganhos), tone: "text-emerald-600" },
            { label: "Conversão", value: `${m.kpis.conversao}%`, tone: "text-sky-600" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-line bg-canvas p-3">
              <p className={cn("text-xl font-bold", k.tone)}>{k.value}</p>
              <p className="text-[11px] text-muted">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PipeRankTable title="Negócios em aberto" rows={m.byWip} max={maxWip} tone="bg-brand-500" />
          <PipeRankTable title="Valor em aberto" rows={m.byValue} max={maxValue} tone="bg-emerald-500" fmt={formatBRL} />
          <PipeRankTable title="Ganhos no período" rows={m.byWon} max={maxWon} tone="bg-sky-500" />
          <PipeRankTable title="Parados por pessoa" rows={m.byStuck} max={maxStuck} tone="bg-rose-500" />
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Ganhos e conversão consideram o período (data de ganho/perda). Em aberto e parados são a foto
          atual do funil. Um negócio com vários responsáveis conta para cada um.
        </p>
      </div>
    </div>
  );
}
