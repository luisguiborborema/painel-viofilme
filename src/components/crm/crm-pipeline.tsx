"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/utils";
import {
  DEFAULT_PIPELINE,
  toCard,
  scoreDeal,
  SCORE_TIERS,
  LEAD_PRIORITIES,
  unmetStageRequirements,
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
import { NewLeadModal } from "./new-lead-modal";
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
}: {
  card: CrmLeadCard;
  allTags: Tag[];
  teamMembers: Attendant[];
  onOpen: () => void;
  onDragStart: () => void;
  onDelete: () => void;
}) {
  const assignees = card.assignees?.length ? card.assignees : card.owner ? [card.owner] : [];
  const [confirm, setConfirm] = useState(false);
  return (
    <div
      draggable={!confirm}
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
    </div>
  );
}

export function CrmPipeline({
  cards: initial,
  pipelines = [DEFAULT_PIPELINE],
  tags = [],
  companies = [],
  contacts = [],
  team = [],
  teamMembers = [],
  currentUser = "",
}: {
  cards: CrmLeadCard[];
  pipelines?: Pipeline[];
  tags?: Tag[];
  companies?: Company[];
  contacts?: Contact[];
  team?: string[];
  teamMembers?: Attendant[];
  currentUser?: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [mine, setMine] = useState(false);

  const defaultId = pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? DEFAULT_PIPELINE.id;
  const [pipelineId, setPipelineId] = useState(defaultId);
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
  const visibleCards = cards.filter(
    (c) =>
      (c.pipelineId || defaultId) === pipelineId &&
      (!tagFilter || c.tags?.includes(tagFilter)) &&
      (!mine || assigneesOf(c).includes(currentUser)),
  );

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
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, stage: stage.key, daysInStage: 0, rot: "fresh" } : c,
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
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Novo negócio
          </button>
        </div>
      </div>

      {showNew && (
        <NewLeadModal
          onClose={() => setShowNew(false)}
          onCreated={addLead}
          companies={companies}
          contacts={contacts}
          stages={stages}
          pipelineId={pipeline.id}
          team={team}
          defaultOwner={currentUser}
        />
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((s) => {
          const inStage = visibleCards.filter((c) => c.stage === s.key);
          const sum = inStage.reduce((acc, c) => acc + c.monthlyValue, 0);
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
              {sum > 0 && (
                <p className="mb-2 px-1 text-[11px] text-muted">{formatBRL(sum)}</p>
              )}
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
                  />
                ))}
                {inStage.length === 0 && (
                  <p className="rounded-xl border border-dashed border-line px-2 py-6 text-center text-[11px] text-muted">
                    Arraste um card aqui
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
