"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/utils";
import { CRM_STAGES, toCard, type CrmLead, type CrmLeadCard, type CrmStage } from "@/lib/data/crm";
import { NewLeadModal } from "./new-lead-modal";

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
  onOpen,
  onDragStart,
}: {
  card: CrmLeadCard;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={onOpen}
      className={cn(
        "cursor-pointer rounded-xl border border-l-4 border-line bg-surface p-3 shadow-sm transition-shadow hover:shadow-md",
        cardBorder(card),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{card.name}</p>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-600">
          {initials(card.owner ?? card.name)}
        </span>
      </div>
      {card.contactName && (
        <p className="mt-0.5 text-xs text-muted">{card.contactName}</p>
      )}
      <p className="mt-2 text-sm font-bold text-ink">
        {formatBRL(card.monthlyValue)}
        <span className="text-xs font-normal text-muted">/mês</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.plan && (
          <span className="rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted">
            {card.plan}
          </span>
        )}
        {card.probability >= 70 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            {card.probability}%
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

export function CrmPipeline({ cards: initial }: { cards: CrmLeadCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const [showNew, setShowNew] = useState(false);

  function addLead(lead: CrmLead) {
    setShowNew(false);
    setCards((prev) => [toCard(lead, new Date().toISOString()), ...prev]);
    router.refresh();
  }

  const openValue = cards
    .filter((c) => c.stage !== "ganho" && c.stage !== "perdido")
    .reduce((s, c) => s + c.monthlyValue, 0);

  async function moveTo(stage: CrmStage) {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, stage, daysInStage: 0, rot: "fresh" } : c)),
    );
    try {
      await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", id, stage }),
      });
    } catch {
      /* otimista: mantém no board mesmo se falhar */
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {cards.filter((c) => c.stage !== "ganho" && c.stage !== "perdido").length}{" "}
          negócios · <span className="font-semibold text-ink">{formatBRL(openValue)}</span>{" "}
          em aberto
        </p>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-muted sm:block">
            Borda <span className="text-emerald-600">verde</span> = alta probabilidade ·{" "}
            <span className="text-rose-500">vermelha</span> = parado
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Novo lead
          </button>
        </div>
      </div>

      {showNew && (
        <NewLeadModal onClose={() => setShowNew(false)} onCreated={addLead} />
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {CRM_STAGES.map((s) => {
          const inStage = cards.filter((c) => c.stage === s.key);
          const sum = inStage.reduce((acc, c) => acc + c.monthlyValue, 0);
          return (
            <div
              key={s.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(s.key);
              }}
              onDragLeave={() => setOverStage((cur) => (cur === s.key ? null : cur))}
              onDrop={() => moveTo(s.key)}
              className={cn(
                "flex w-[240px] shrink-0 flex-col rounded-2xl border p-2.5 transition-colors",
                overStage === s.key
                  ? "border-brand-400 bg-brand-50/50"
                  : "border-line bg-canvas",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-ink">{s.label}</span>
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
                    onOpen={() => router.push(`/gerencial/crm/${c.id}`)}
                    onDragStart={() => setDragId(c.id)}
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
    </div>
  );
}
