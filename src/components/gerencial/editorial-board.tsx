"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, StickyNote, X } from "lucide-react";
import { EDITORIAL_STAGES, type EditorialStage, type EditorialLineCard, type EditorialDraft } from "@/lib/data/operacao";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Tom da faixa por coluna (só o cabeçalho).
const STAGE_TONE: Record<EditorialStage, string> = {
  rascunho: "text-muted",
  em_producao: "text-sky-600",
  aprovacao_interna: "text-violet-600",
  em_aprovacao: "text-amber-600",
  em_postagem: "text-emerald-600",
  concluida: "text-emerald-700",
};

/**
 * Quadro (kanban) das linhas editoriais do cliente. Cada card é uma LE inteira
 * (um mês), que se move pelos estágios. Clicar abre a LE completa (?le=<id>).
 */
export function EditorialBoard({
  clientId,
  lines,
  drafts,
}: {
  clientId: string;
  lines: EditorialLineCard[];
  drafts: EditorialDraft[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState<EditorialLineCard[]>(lines);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<EditorialStage | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);

  function open(id: string) {
    router.push(`/gerencial/clientes/${clientId}/editorial?le=${id}`);
  }

  async function moveTo(stage: EditorialStage) {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    const prev = card.stage;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage } : c)));
    try {
      const res = await fetch("/api/gerencial/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-stage", id, stage }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast("Não foi possível mover a linha editorial.", "error");
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: prev } : c)));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-ink">Linha editorial</h2>
          <p className="text-sm text-muted">Cada card é uma linha do mês — arraste pelos estágios. Clique para abrir com as postagens.</p>
        </div>
        <button
          onClick={() => setNovaOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nova LE
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {EDITORIAL_STAGES.map((s) => {
          const colCards = cards.filter((c) => c.stage === s.key);
          return (
            <div
              key={s.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(s.key);
              }}
              onDragLeave={() => setOverStage((v) => (v === s.key ? null : v))}
              onDrop={() => moveTo(s.key)}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-canvas/40 p-2",
                overStage === s.key ? "border-brand-400 bg-brand-500/5" : "border-line",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={cn("text-xs font-bold uppercase tracking-wide", STAGE_TONE[s.key])}>{s.label}</span>
                <span className="rounded-full bg-subtle px-1.5 text-[11px] font-semibold text-muted">{colCards.length}</span>
              </div>
              <div className="flex min-h-[60px] flex-col gap-2">
                {colCards.map((c) => (
                  <button
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    onClick={() => open(c.id)}
                    className="cursor-pointer rounded-lg border border-line bg-surface p-3 text-left shadow-sm transition-shadow hover:shadow-md"
                  >
                    <p className="text-sm font-semibold text-ink">{c.month}</p>
                    {c.objetivo && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.objetivo}</p>}
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <StickyNote className="h-3 w-3" />
                        {c.postsCount} {c.postsCount === 1 ? "postagem" : "postagens"}
                      </span>
                      {c.approvedCount > 0 && <span className="text-emerald-600">· {c.approvedCount} aprovadas</span>}
                    </div>
                    {c.builtBy && <p className="mt-1 truncate text-[10px] text-muted">por {c.builtBy}</p>}
                  </button>
                ))}
                {colCards.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line px-2 py-3 text-center text-[11px] text-muted">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {novaOpen && (
        <NovaLE
          clientId={clientId}
          drafts={drafts}
          lastLineId={cards[0]?.id}
          onClose={() => setNovaOpen(false)}
          onResume={(id) => router.push(`/gerencial/clientes/${clientId}/editorial?le=${id}&edit=1`)}
          onCreated={(id) => router.push(`/gerencial/clientes/${clientId}/editorial?le=${id}&edit=1`)}
        />
      )}
    </div>
  );
}

function NovaLE({
  clientId,
  drafts,
  lastLineId,
  onClose,
  onResume,
  onCreated,
}: {
  clientId: string;
  drafts: EditorialDraft[];
  lastLineId?: string;
  onClose: () => void;
  onResume: (id: string) => void;
  onCreated: (id: string) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [objetivo, setObjetivo] = useState("");
  const [duplicate, setDuplicate] = useState(Boolean(lastLineId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referenceMonth = month && year ? `${year}-${month}` : "";
  const monthLabel = referenceMonth ? `${MESES[Number(month) - 1]} ${year}` : "";

  async function create() {
    if (!referenceMonth) {
      setError("Selecione o mês e o ano.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gerencial/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-line",
          clientId,
          month: monthLabel,
          referenceMonth,
          objetivo: objetivo.trim() || undefined,
          duplicateFromId: duplicate && lastLineId ? lastLineId : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError("Já existe uma linha editorial para esse mês.");
        return;
      }
      if (!res.ok || !j.id) {
        setError(j.error ?? "Falha ao criar a linha editorial.");
        return;
      }
      onCreated(j.id as string);
    } catch {
      setError("Falha de rede ao criar.");
    } finally {
      setSaving(false);
    }
  }

  const selCls = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Nova linha editorial</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          {drafts.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Retomar rascunho</p>
              <div className="space-y-1">
                {drafts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => onResume(d.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-sm text-ink hover:bg-subtle"
                  >
                    <span className="truncate">{d.month}</span>
                    <span className="text-[11px] text-brand-600">abrir</span>
                  </button>
                ))}
              </div>
              <div className="my-3 border-t border-line" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Mês *</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={selCls}>
                {MESES.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Ano *</span>
              <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} className={selCls} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Objetivo do mês</span>
            <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={2} className="w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400" placeholder="Ex.: Aumentar consideração da marca…" />
          </label>

          {lastLineId && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={duplicate} onChange={(e) => setDuplicate(e.target.checked)} className="h-4 w-4 rounded border-line" />
              Duplicar estrutura da última LE (pilares e posts)
            </label>
          )}

          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <button onClick={onClose} className="rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle">Cancelar</button>
          <button onClick={create} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar LE
          </button>
        </div>
      </div>
    </div>
  );
}
