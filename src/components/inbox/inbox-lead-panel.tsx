"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  CalendarClock,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Search,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import type { WaConversation } from "@/lib/data/inbox";

type LeadContext = {
  leadId: string;
  name: string;
  stageLabel: string;
  stageColor: string;
  monthlyValue: number;
  owner: string | null;
  source: string | null;
  tags: string[];
  nextTask: { id: string; title: string; dueDate: string | null } | null;
  notes: { body: string; author: string | null; createdAt: string }[];
};

const inputCls = "w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

export function InboxLeadPanel({
  conversation,
  deals = [],
  onLinked,
}: {
  conversation: WaConversation;
  deals?: { id: string; name: string; stage?: string }[];
  onLinked: (leadId: string) => void;
}) {
  const leadId = conversation.leadId;
  const [ctx, setCtx] = useState<LeadContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [linkMode, setLinkMode] = useState(false);

  useEffect(() => {
    if (!leadId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCtx(null);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/inbox/lead-context?leadId=${leadId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setCtx(j.context ?? null); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [leadId]);

  async function saveNote() {
    if (!note.trim() || !leadId || busy) return;
    setBusy(true);
    const body = note.trim();
    setNote("");
    setCtx((c) => (c ? { ...c, notes: [{ body, author: "Você", createdAt: new Date().toISOString() }, ...c.notes].slice(0, 3) } : c));
    await fetch("/api/crm/interactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, channel: "note", body }),
    }).catch(() => {});
    setBusy(false);
  }

  async function addTask() {
    if (!taskTitle.trim() || !leadId || busy) return;
    setBusy(true);
    const title = taskTitle.trim();
    setTaskTitle("");
    setCtx((c) => (c ? { ...c, nextTask: { id: "tmp", title, dueDate: null } } : c));
    await fetch("/api/crm/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", leadId, title }),
    }).catch(() => {});
    setBusy(false);
  }

  async function createDeal() {
    setBusy(true);
    const res = await fetch("/api/inbox/create-deal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: conversation.id }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (j?.leadId) onLinked(j.leadId);
  }

  async function linkDeal(id: string) {
    setBusy(true);
    await fetch("/api/inbox/link-deal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: conversation.id, leadId: id }),
    }).catch(() => {});
    setBusy(false);
    setLinkMode(false);
    onLinked(id);
  }

  const dealMatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (term ? deals.filter((d) => d.name.toLowerCase().includes(term)) : deals).slice(0, 8);
  }, [deals, search]);

  // ── Sem negócio vinculado ──
  if (!leadId) {
    return (
      <div className="space-y-3 border-t border-line pt-3">
        <div className="rounded-xl border border-brand-400/40 bg-brand-50/40 p-3">
          <p className="text-xs text-muted">Este contato ainda não é um negócio.</p>
          <button
            onClick={createDeal}
            disabled={busy}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Criar negócio
          </button>
          <p className="mt-1.5 text-[11px] text-muted">Nasce em Pré-venda · Contactar Urgente, com o histórico da conversa junto.</p>
        </div>

        {linkMode ? (
          <div>
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar negócio…" className={inputCls + " pl-7"} />
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {dealMatches.map((d) => (
                <button key={d.id} onClick={() => linkDeal(d.id)} disabled={busy} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle">
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted" /> <span className="truncate text-ink">{d.name}</span>
                </button>
              ))}
              {dealMatches.length === 0 && <p className="px-2 py-1.5 text-xs text-muted">Nenhum negócio.</p>}
            </div>
            <button onClick={() => setLinkMode(false)} className="mt-1 text-xs text-muted hover:text-ink">cancelar</button>
          </div>
        ) : (
          <button onClick={() => setLinkMode(true)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <Link2 className="h-4 w-4" /> Vincular a negócio existente
          </button>
        )}
      </div>
    );
  }

  // ── Com negócio vinculado ──
  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Negócio</p>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
      </div>

      {ctx && (
        <>
          <div className="rounded-xl border border-line bg-canvas p-3">
            <p className="text-sm font-semibold text-ink">{ctx.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${ctx.stageColor}22`, color: ctx.stageColor }}>
                {ctx.stageLabel}
              </span>
              {ctx.monthlyValue > 0 && <span className="text-xs font-semibold text-ink">{formatBRL(ctx.monthlyValue)}</span>}
            </div>
            <div className="mt-1.5 space-y-0.5 text-[11px] text-muted">
              {ctx.owner && <p>Responsável: <span className="text-ink">{ctx.owner}</span></p>}
              {ctx.source && <p>Origem: <span className="text-ink">{ctx.source}</span></p>}
              {ctx.tags.length > 0 && <p>Tags: <span className="text-ink">{ctx.tags.join(", ")}</span></p>}
            </div>
          </div>

          {/* Próxima tarefa / nova tarefa */}
          <div>
            {ctx.nextTask ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{ctx.nextTask.title}</span>
                {ctx.nextTask.dueDate && <span className="shrink-0">{dayMonth(ctx.nextTask.dueDate)}</span>}
              </div>
            ) : (
              <div className="flex gap-1.5">
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Nova tarefa…" className={inputCls} />
                <button onClick={addTask} disabled={busy || !taskTitle.trim()} className="shrink-0 rounded-lg bg-brand-600 px-2.5 text-white hover:bg-brand-700 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
              </div>
            )}
          </div>

          {/* Registrar interação */}
          <div>
            <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted"><StickyNote className="h-3 w-3" /> Registrar interação</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="O que foi conversado…" className={inputCls + " resize-y"} />
            <button onClick={saveNote} disabled={busy || !note.trim()} className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-surface hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Salvar na timeline
            </button>
          </div>

          {/* Últimas notas */}
          {ctx.notes.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted">Últimas notas</p>
              {ctx.notes.map((n, i) => (
                <div key={i} className="rounded-lg bg-canvas px-2.5 py-1.5">
                  <p className="line-clamp-2 whitespace-pre-wrap text-xs text-ink">{n.body}</p>
                  <p className="text-[10px] text-muted">{n.author ?? "—"} · {dayMonth(n.createdAt)} {clockLabel(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Link href={`/gerencial/crm/${leadId}`} className={cn("flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle")}>
        <ExternalLink className="h-4 w-4" /> Abrir ficha completa
      </Link>
    </div>
  );
}
