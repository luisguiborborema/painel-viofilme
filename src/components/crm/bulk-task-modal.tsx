"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Loader2, Search, Square, X } from "lucide-react";
import { TASK_TYPES } from "@/lib/data/crm";
import { apiPost } from "@/lib/api";
import { toast } from "@/components/ui/toast";

const input = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
const DUE_SHORTCUTS: { label: string; days: number }[] = [
  { label: "Hoje", days: 0 },
  { label: "Amanhã", days: 1 },
  { label: "Em 3 dias", days: 3 },
  { label: "Próx. semana", days: 7 },
];

/**
 * Criação de tarefas em massa (estilo HubSpot): mesmo título/tipo/prazo/
 * responsável aplicado a vários registros de uma vez. Reaproveita a ação
 * bulk-add da rota /api/crm/tasks. Os alvos vêm da seleção (leadIds/contactIds/
 * companyIds) ou de um seletor de negócios (pickTargets, tela Atividades).
 */
export function BulkTaskModal({
  targetLabel,
  count,
  team,
  currentUser,
  leadIds,
  contactIds,
  companyIds,
  pickTargets,
  onClose,
  onDone,
}: {
  targetLabel: string;
  count: number;
  team: string[];
  currentUser: string;
  leadIds?: string[];
  contactIds?: string[];
  companyIds?: string[];
  pickTargets?: { deals: { id: string; name: string }[] };
  onClose: () => void;
  onDone: (created: number, skipped: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("ligacao");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [priority, setPriority] = useState("media");
  const [assignee, setAssignee] = useState(currentUser || team[0] || "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const team2 = useMemo(() => [...new Set([currentUser, ...team].filter(Boolean))], [team, currentUser]);
  const dealMatches = useMemo(() => {
    if (!pickTargets) return [];
    const term = q.trim().toLowerCase();
    return pickTargets.deals.filter((d) => !term || d.name.toLowerCase().includes(term));
  }, [pickTargets, q]);

  const effectiveCount = pickTargets ? picked.size : count;
  const dueIso = () => (date ? new Date(`${date}T${time || "09:00"}`).toISOString() : undefined);

  function shortcut(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }
  function togglePick(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function save() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      action: "bulk-add",
      title: title.trim(),
      type,
      dueDate: dueIso(),
      priority,
      assignees: assignee ? [assignee] : [],
    };
    if (pickTargets) payload.leadIds = [...picked];
    else {
      if (leadIds?.length) payload.leadIds = leadIds;
      if (contactIds?.length) payload.contactIds = contactIds;
      if (companyIds?.length) payload.companyIds = companyIds;
    }
    const res = await apiPost<{ created?: number; skipped?: number }>("/api/crm/tasks", payload);
    setBusy(false);
    if (!res.ok) return; // apiPost já toasta o erro
    const created = res.data?.created ?? 0;
    const skipped = res.data?.skipped ?? 0;
    toast(`${created} tarefa${created !== 1 ? "s" : ""} criada${created !== 1 ? "s" : ""}${skipped ? `, ${skipped} ignorada${skipped !== 1 ? "s" : ""}` : ""}.`, "success");
    onDone(created, skipped);
  }

  const disabled = busy || !title.trim() || (pickTargets ? false : count === 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-ink">Criar tarefas em massa</h2>
            <p className="text-xs text-muted">
              {pickTargets ? `${effectiveCount || "nenhum"} negócio${effectiveCount === 1 ? "" : "s"} selecionado${effectiveCount === 1 ? "" : "s"}` : `Para ${targetLabel}`}
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" className={input} />

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${type === t.key ? "border-brand-500 bg-brand-500 text-white" : "border-line text-muted hover:text-ink"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Prazo</p>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {DUE_SHORTCUTS.map((s) => (
                <button key={s.label} type="button" onClick={() => shortcut(s.days)} className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:text-ink">
                  {s.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Prioridade</p>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={input}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Responsável</p>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={input}>
                {team2.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {pickTargets && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Negócios ({picked.size})</p>
              <div className="relative mb-1.5">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negócio…" className={input + " pl-8"} />
              </div>
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1">
                {dealMatches.length === 0 && <p className="px-2 py-2 text-center text-xs text-muted">Nenhum negócio.</p>}
                {dealMatches.slice(0, 200).map((d) => {
                  const on = picked.has(d.id);
                  return (
                    <button key={d.id} type="button" onClick={() => togglePick(d.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5">
                      {on ? <CheckSquare className="h-4 w-4 shrink-0 text-brand-500" /> : <Square className="h-4 w-4 shrink-0 text-muted" />}
                      <span className="truncate text-ink">{d.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-muted">Sem seleção, cria tarefas avulsas para o responsável.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-subtle">Cancelar</button>
          <button onClick={save} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
            Criar {pickTargets ? (picked.size || "") : count} tarefa{effectiveCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
