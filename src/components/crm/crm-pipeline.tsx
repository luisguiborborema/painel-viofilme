"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRightLeft,
  BarChart3,
  Bell,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  ShieldAlert,
  Snowflake,
  Trash2,
  UserX,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/utils";
import {
  DEFAULT_PIPELINE,
  toCard,
  scoreDeal,
  SCORE_TIERS,
  LEAD_PRIORITIES,
  unmetStageRequirements,
  cadenceLabel,
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
  type Pipeline,
  type Stage,
  type StageRequirement,
  type Tag,
} from "@/lib/data/crm";
import type { Attendant } from "@/lib/data/inbox";
import { AvatarStack } from "@/components/ui/avatar";
import { NovoNegocioModal } from "./new-lead-modal";
import { CrmList } from "./crm-list";
import { CrmForecast } from "./crm-forecast";
import { TagChips } from "./tag-chips";

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

function LeadCard({
  card,
  allTags,
  teamMembers,
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
  teamMembers: Attendant[];
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
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{card.name}</p>
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
          {assignees.length > 0 ? (
            <AvatarStack names={assignees} team={teamMembers} />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-[10px] font-semibold text-muted ring-2 ring-surface">
              {initials(card.name)}
            </span>
          )}
        </div>
      </div>
      {card.contactName && (
        <p className="mt-0.5 text-xs text-muted">{card.contactName}</p>
      )}
      {(card.tags?.length ?? 0) > 0 && (
        <div className="mt-1.5">
          <TagChips ids={card.tags} tags={allTags} size="xs" />
        </div>
      )}
      <p className="mt-2 text-sm font-bold text-ink">
        {formatBRL(card.monthlyValue)}
        <span className="text-xs font-normal text-muted">/mês</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.cadenceActive && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"
            title="Cadência ativa amarrada à etapa"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            {cadenceLabel(card.originKind)} · passo {card.cadenceStep ?? 1}
          </span>
        )}
        {(card.noShowCount ?? 0) > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-600"
            title="No-shows acumulados"
          >
            <UserX className="h-3 w-3" /> {card.noShowCount} no-show
          </span>
        )}
        {!frozen && !card.nextTaskDue && card.stage !== "ganho" && card.stage !== "perdido" && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"
            title="Sem próxima ação agendada"
          >
            <Bell className="h-3 w-3" /> Sem próxima ação
          </span>
        )}
        {(() => {
          const p = LEAD_PRIORITIES.find((x) => x.key === (card.priority ?? "media"));
          if (!p || (card.priority !== "alta" && card.priority !== "urgente")) return null;
          return (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", p.chip)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} /> {p.label}
            </span>
          );
        })()}
        {(() => {
          const sc = scoreDeal(card, new Date().toISOString());
          const meta = SCORE_TIERS[sc.tier];
          return (
            <span
              className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.chip)}
              title={`Lead score: ${sc.score}/100 (${meta.label})`}
            >
              {meta.label} · {sc.score}
            </span>
          );
        })()}
        {card.plan && (
          <span className="rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted">
            {card.plan}
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-2 text-[11px]",
          card.rot === "stale" ? "font-semibold text-rose-500" : "text-muted",
        )}
      >
        {card.daysInStage === 0
          ? "Hoje"
          : `Há ${card.daysInStage} dia${card.daysInStage > 1 ? "s" : ""}`}
        {card.rot === "stale" && " · parado"}
      </p>

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

export function CrmPipeline({
  cards: initial,
  pipelines = [DEFAULT_PIPELINE],
  tags = [],
  companies = [],
  team = [],
  teamMembers = [],
  currentUser = "",
  lostReasons = [],
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
}) {
  const router = useRouter();
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
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0] ?? DEFAULT_PIPELINE;
  const stages = pipeline.stages;
  const [blocked, setBlocked] = useState<{
    dealId: string;
    stageLabel: string;
    missing: StageRequirement[];
  } | null>(null);

  const assigneesOf = (c: CrmLeadCard) =>
    c.assignees?.length ? c.assignees : c.owner ? [c.owner] : [];

  const closedKeys = new Set(stages.filter((s) => s.kind !== "open").map((s) => s.key));
  const inThisPipeline = (c: CrmLeadCard) => (c.pipelineId || defaultId) === pipelineId;
  const frozenCount = cards.filter((c) => inThisPipeline(c) && Boolean(c.frozenAt)).length;
  const visibleCards = cards.filter(
    (c) =>
      inThisPipeline(c) &&
      (showFrozen ? Boolean(c.frozenAt) : !c.frozenAt) &&
      (!tagFilter || c.tags?.includes(tagFilter)) &&
      (!mine || assigneesOf(c).includes(currentUser)),
  );
  const isReservoir = stages[0]?.key === STAGE_RESERVOIR; // funil Pré-venda (SDR)

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
    return fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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

  const openValue = visibleCards
    .filter((c) => !closedKeys.has(c.stage))
    .reduce((s, c) => s + c.monthlyValue, 0);

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

    const prevStage = card.stage;
    // Cadência amarrada à etapa: reflete ON/OFF no card na hora do arraste.
    const cadenceActive =
      stage.key === STAGE_CADENCE_ON ? true : stage.key === STAGE_CADENCE_OFF ? false : card.cadenceActive;
    const cadenceStep = stage.key === STAGE_CADENCE_ON ? 1 : card.cadenceStep;
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, stage: stage.key, daysInStage: 0, rot: "fresh", cadenceActive, cadenceStep } : c,
      ),
    );
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
        // Servidor recusou (requisitos): reverte o movimento otimista.
        const json = await res.json().catch(() => ({}));
        setCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, stage: prevStage } : c)),
        );
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
    } catch {
      /* otimista: mantém no board mesmo se falhar por rede */
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Barra: alternador Kanban/Lista + Novo negócio (compartilhado) */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-line p-0.5">
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === "kanban" ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView("lista")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === "lista" ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
            )}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            onClick={() => setView("forecast")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === "forecast" ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Forecast
          </button>
          <button
            onClick={() => setView("arquivados")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === "arquivados" ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
            )}
          >
            <Archive className="h-3.5 w-3.5" /> Arquivados
          </button>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Novo negócio
        </button>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {pipelines.length > 1 && (
            <select
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand-400"
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
          <p className="text-sm text-muted">
            {visibleCards.filter((c) => !closedKeys.has(c.stage)).length}{" "}
            negócios · <span className="font-semibold text-ink">{formatBRL(openValue)}</span>{" "}
            em aberto
          </p>
        </div>
        <div className="flex items-center gap-3">
          {currentUser && (
            <button
              onClick={() => setMine((m) => !m)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                (mine ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")
              }
            >
              Meus negócios
            </button>
          )}
          {(frozenCount > 0 || showFrozen) && (
            <button
              onClick={() => setShowFrozen((f) => !f)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                (showFrozen ? "bg-sky-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")
              }
              title="Negócios congelados/arquivados"
            >
              <Snowflake className="h-3.5 w-3.5" /> Congelados
              {frozenCount > 0 && (
                <span className={cn("rounded-full px-1.5 text-[10px]", showFrozen ? "bg-white/25" : "bg-surface")}>
                  {frozenCount}
                </span>
              )}
            </button>
          )}
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5">
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
          // Adição rápida (Kommo) só no reservatório do outbound (1ª coluna do SDR).
          const showQuickAdd = si === 0 && isReservoir && !showFrozen;
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
                <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  {inStage.length}
                </span>
              </div>
              {s.hint && <p className="mb-1 px-1 text-[10px] leading-tight text-muted">{s.hint}</p>}
              {sum > 0 && (
                <p className="mb-2 px-1 text-[11px] text-muted">{formatBRL(sum)}</p>
              )}
              {showQuickAdd && <QuickAdd onAdd={(name) => quickAdd(name, s.id)} />}
              <div className="flex flex-1 flex-col gap-2">
                {inStage.map((c) => (
                  <LeadCard
                    key={c.id}
                    card={c}
                    allTags={tags}
                    teamMembers={teamMembers}
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
        </>
      )}
    </div>
  );
}
