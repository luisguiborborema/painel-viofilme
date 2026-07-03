"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Pin,
  CalendarClock,
  Send,
  Sparkles,
  StickyNote,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Building2, Check, ListTodo, Plus } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import {
  BANT_LABELS,
  stageLabel,
  type Bant,
  type Company,
  type Contact,
  type CrmInteraction,
  type CrmLead,
  type CrmTask,
  type PropertyDef,
  type Tag,
} from "@/lib/data/crm";
import { WinModal } from "./win-modal";
import { ScheduleModal } from "./schedule-modal";
import { ObjectProperties } from "./object-properties";
import { TagPicker } from "./tag-picker";
import { DealContacts } from "./deal-contacts";

type Composer = "note" | "whatsapp" | "email" | "call";

const CHANNEL_META: Record<
  CrmInteraction["channel"],
  { icon: LucideIcon; color: string; label: string }
> = {
  whatsapp: { icon: MessageCircle, color: "text-emerald-500 bg-emerald-500/15", label: "WhatsApp" },
  email: { icon: Mail, color: "text-blue-500 bg-blue-500/15", label: "E-mail" },
  call: { icon: Phone, color: "text-violet-500 bg-violet-500/15", label: "Ligação" },
  note: { icon: StickyNote, color: "text-muted bg-subtle", label: "Nota" },
  system: { icon: Sparkles, color: "text-brand-500 bg-brand-500/15", label: "Sistema" },
};

const COMPOSERS: { key: Composer; label: string }[] = [
  { key: "note", label: "Nota" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "call", label: "Ligação" },
];

export function LeadDetail({
  lead: initialLead,
  interactions: initialInteractions,
  tasks: initialTasks,
  company = null,
  companyContacts = [],
  dealContacts = [],
  tags = [],
  properties = [],
  team = [],
  lostReasons = [],
}: {
  lead: CrmLead;
  interactions: CrmInteraction[];
  tasks: CrmTask[];
  company?: Company | null;
  companyContacts?: Contact[];
  dealContacts?: Contact[];
  tags?: Tag[];
  properties?: PropertyDef[];
  team?: string[];
  lostReasons?: string[];
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [items, setItems] = useState<CrmInteraction[]>(initialInteractions);
  const [tasks, setTasks] = useState<CrmTask[]>(initialTasks);
  const [showWin, setShowWin] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [won, setWon] = useState(lead.stage === "ganho");

  const pendingTask = useMemo(
    () => tasks.find((t) => t.status === "pending"),
    [tasks],
  );

  function pushLocal(it: Omit<CrmInteraction, "id" | "leadId" | "createdAt">) {
    setItems((prev) => [
      ...prev,
      { ...it, id: `tmp-${prev.length}`, leadId: lead.id, createdAt: new Date().toISOString() },
    ]);
  }

  async function completeTask(taskId: string) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "done" } : t)));
    await fetch("/api/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "done", taskId }),
    }).catch(() => {});
  }

  async function toggleTask(task: CrmTask) {
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

  const stageChip = stageLabel(lead.stage);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/gerencial/crm?tab=pipeline"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-subtle"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-ink">{lead.name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <span className="rounded-full bg-subtle px-2 py-0.5 font-medium text-ink">
                {stageChip}
              </span>
              {lead.segment && <span>{lead.segment}</span>}
              {lead.contactName && <span>· {lead.contactName}</span>}
            </div>
          </div>
        </div>
        {!won && lead.stage !== "perdido" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSchedule(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle"
            >
              <CalendarClock className="h-4 w-4" /> Agendar
            </button>
            <LoseButton onConfirm={markLost} reasons={lostReasons} />
            <button
              onClick={() => setShowWin(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Trophy className="h-4 w-4" /> Ganho
            </button>
          </div>
        )}
        {won && (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3.5 py-2 text-sm font-semibold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Ganho — onboarding iniciado
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Coluna principal: ação fixada + timeline + composer */}
        <div className="space-y-4 lg:col-span-2">
          {pendingTask && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Pin className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Próxima ação
                    </p>
                    <p className="text-sm font-medium text-ink">{pendingTask.title}</p>
                    {pendingTask.dueDate && (
                      <p className="text-xs text-muted">
                        {dayMonth(pendingTask.dueDate)} às {clockLabel(pendingTask.dueDate)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => completeTask(pendingTask.id)}
                  className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Histórico de interações</h2>
            </div>
            <Timeline items={items} />
            <Composer
              lead={lead}
              onPosted={(it) => pushLocal(it)}
              onBant={(bant) => setLead((l) => ({ ...l, bant: { ...l.bant, ...bant } }))}
            />
          </div>
        </div>

        {/* Coluna lateral: dados + BANT */}
        <div className="space-y-4">
          <Card title="Principal">
            <Row label="Valor mensal" value={formatBRL(lead.monthlyValue)} strong />
            <OwnerRow dealId={lead.id} owner={lead.owner} team={team} />
            <Row label="Origem" value={lead.source ?? "—"} />
            <Row label="Plano" value={lead.plan ?? "—"} />
            <Row label="Probabilidade" value={`${lead.probability}%`} />
            {lead.contactPhone && <Row label="Telefone" value={lead.contactPhone} />}
            {lead.contactEmail && <Row label="E-mail" value={lead.contactEmail} />}
          </Card>

          <TasksCard tasks={tasks} onToggle={toggleTask} onAdd={addTask} />

          {company && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink">Empresa</h2>
              <Link
                href={`/gerencial/crm/empresa/${company.id}`}
                className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 hover:bg-subtle"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{company.name}</p>
                  <p className="truncate text-xs text-muted">
                    {company.segment ?? "Ver empresa"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </div>
          )}

          <DealContacts
            dealId={lead.id}
            initial={dealContacts}
            candidates={companyContacts}
            primaryContactId={lead.primaryContactId}
          />

          <TagPicker
            objectType="deal"
            id={lead.id}
            allTags={tags}
            initialIds={lead.tags ?? []}
          />

          <ObjectProperties
            objectType="deal"
            id={lead.id}
            defs={properties.filter((p) => p.objectType === "deal")}
            initialValues={lead.properties ?? {}}
          />

          <Card title="Qualificação (BANT)">
            <div className="space-y-2">
              {BANT_LABELS.map(({ key, label }) => (
                <div key={key} className="rounded-lg bg-canvas px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {label}
                  </p>
                  <p className="text-sm text-ink">
                    {lead.bant[key]?.trim() || <span className="text-muted">—</span>}
                  </p>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted">
                Dica: digite <code className="rounded bg-subtle px-1">/qualificação</code> no
                campo de anotação para preencher direto na call.
              </p>
            </div>
          </Card>
        </div>
      </div>

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

function Timeline({ items }: { items: CrmInteraction[] }) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted">
        Sem interações ainda. Registre a primeira abaixo.
      </p>
    );
  }
  return (
    <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
      {items.map((it) => {
        const meta = CHANNEL_META[it.channel];
        const Icon = meta.icon;
        return (
          <div key={it.id} className="flex gap-3">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.color)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-medium text-ink">{it.author ?? meta.label}</span>
                {it.direction && (
                  <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px]">
                    {it.direction === "in" ? "recebido" : "enviado"}
                  </span>
                )}
                <span>· {dayMonth(it.createdAt)} {clockLabel(it.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{it.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Composer({
  lead,
  onPosted,
  onBant,
}: {
  lead: CrmLead;
  onPosted: (it: Omit<CrmInteraction, "id" | "leadId" | "createdAt">) => void;
  onBant: (bant: Bant) => void;
}) {
  const [channel, setChannel] = useState<Composer>("note");
  const [text, setText] = useState("");
  const [bantMode, setBantMode] = useState(false);
  const [bant, setBantState] = useState<Bant>({});
  const [busy, setBusy] = useState(false);

  const showSlash = text.startsWith("/") && !bantMode;

  async function submitNote() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const send = channel === "whatsapp";
    onPosted({ channel, direction: send ? "out" : null, body: text.trim(), author: "Você" });
    const body = text.trim();
    setText("");
    await fetch("/api/crm/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        channel,
        body,
        send,
        toPhone: lead.contactPhone,
      }),
    }).catch(() => {});
    setBusy(false);
  }

  async function submitBant() {
    if (busy) return;
    setBusy(true);
    const summary = BANT_LABELS.filter(({ key }) => bant[key]?.trim())
      .map(({ key, label }) => `${label}: ${bant[key]}`)
      .join("\n");
    onPosted({ channel: "note", body: `Qualificação BANT atualizada.\n${summary}`, author: "Você" });
    onBant(bant);
    await fetch("/api/crm/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        channel: "note",
        body: `Qualificação BANT atualizada.\n${summary}`,
        bant,
      }),
    }).catch(() => {});
    setBant({});
    setBantMode(false);
    setBusy(false);
  }

  function setBant(b: Bant) {
    setBantState(b);
  }

  return (
    <div className="border-t border-line p-3">
      {bantMode ? (
        <div className="rounded-xl border border-brand-400/40 bg-brand-50/40 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <p className="text-xs font-semibold text-ink">/qualificação — checklist BANT</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BANT_LABELS.map(({ key, label, hint }) => (
              <label key={key} className="block">
                <span className="mb-0.5 block text-[11px] font-medium text-muted">{label}</span>
                <input
                  value={bant[key] ?? ""}
                  onChange={(e) => setBant({ ...bant, [key]: e.target.value })}
                  placeholder={hint}
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
                />
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setBantMode(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle"
            >
              Cancelar
            </button>
            <button
              onClick={submitBant}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Salvar qualificação
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {COMPOSERS.map((c) => (
              <button
                key={c.key}
                onClick={() => setChannel(c.key)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  channel === c.key ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="relative">
            {showSlash && (
              <div className="absolute bottom-full left-0 z-10 mb-1 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                <button
                  onClick={() => {
                    setBantMode(true);
                    setText("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-subtle"
                >
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  <span className="flex-1">
                    <span className="font-medium text-ink">/qualificação</span>
                    <span className="block text-[11px] text-muted">Checklist BANT</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </button>
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote();
              }}
              rows={2}
              placeholder={
                channel === "whatsapp"
                  ? "Mensagem de WhatsApp… (envia ao contato)"
                  : "Adicione uma nota, ou use / para atalhos…"
              }
              className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-muted">
              {channel === "whatsapp"
                ? "Enviado via Uazapi ao contato."
                : "⌘/Ctrl + Enter para salvar."}
            </p>
            <button
              onClick={submitNote}
              disabled={busy || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {channel === "whatsapp" ? "Enviar" : "Salvar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function LoseButton({
  onConfirm,
  reasons,
}: {
  onConfirm: (reason: string) => void;
  reasons: string[];
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle"
      >
        <XCircle className="h-4 w-4" /> Perdido
      </button>
    );
  }
  const finalReason = [reason, note.trim()].filter(Boolean).join(" — ");
  return (
    <div className="flex items-center gap-1.5">
      {reasons.length > 0 ? (
        <select
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-44 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
        >
          <option value="">Motivo da perda…</option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo da perda"
          className="w-40 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
        />
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="observação (opcional)"
        className="w-40 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
      />
      <button
        onClick={() => onConfirm(finalReason)}
        disabled={!reason}
        className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        Confirmar
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-subtle"
      >
        ✕
      </button>
    </div>
  );
}

function TasksCard({
  tasks,
  onToggle,
  onAdd,
}: {
  tasks: CrmTask[];
  onToggle: (t: CrmTask) => void;
  onAdd: (title: string, dueIso?: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const sorted = [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9");
  });
  const pending = tasks.filter((t) => t.status === "pending").length;

  function submit() {
    if (!title.trim()) return;
    onAdd(title.trim(), due ? new Date(due).toISOString() : undefined);
    setTitle("");
    setDue("");
    setAdding(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <ListTodo className="h-4 w-4" /> Tarefas{pending ? ` (${pending})` : ""}
        </h2>
        <button
          onClick={() => setAdding((a) => !a)}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2 py-1 text-[11px] font-medium text-muted hover:bg-subtle"
        >
          <Plus className="h-3 w-3" /> nova
        </button>
      </div>

      {adding && (
        <div className="mb-2 space-y-2 rounded-xl border border-brand-400/40 bg-brand-50/40 p-2.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Título da tarefa"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
            />
            <button
              onClick={submit}
              disabled={!title.trim()}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted">Nenhuma tarefa.</p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <button
                onClick={() => onToggle(t)}
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  t.status === "done"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-line hover:border-brand-400",
                )}
              >
                {t.status === "done" && <Check className="h-3 w-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", t.status === "done" ? "text-muted line-through" : "text-ink")}>
                  {t.title}
                </p>
                {t.dueDate && (
                  <p className="text-[11px] text-muted">
                    {dayMonth(t.dueDate)} {clockLabel(t.dueDate)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("text-ink", strong && "text-base font-bold")}>{value}</span>
    </div>
  );
}

function OwnerRow({
  dealId,
  owner,
  team,
}: {
  dealId: string;
  owner?: string;
  team: string[];
}) {
  const [value, setValue] = useState(owner ?? "");
  const options = team.includes(value) || !value ? team : [value, ...team];

  async function change(next: string) {
    setValue(next);
    await fetch("/api/crm/object", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectType: "deal", id: dealId, fields: { owner: next } }),
    }).catch(() => {});
  }

  if (team.length === 0) {
    return <Row label="Responsável" value={owner ?? "—"} />;
  }
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">Responsável</span>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-brand-400"
      >
        {!value && <option value="">—</option>}
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
