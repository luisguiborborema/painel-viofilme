"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  FileText,
  FolderOpen,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Star,
  Target,
  Trash2,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { CollaboratorModal } from "@/components/gerencial/collaborator-modal";
import { cn, formatNumber } from "@/lib/utils";
import type {
  Announcement,
  AnnouncementCategory,
  Employee,
  HourEntry,
  HourRow,
  HrAlert,
  PdiItem,
  PdiObjectiveStatus,
  ReviewItem,
  ReviewStatus,
} from "@/lib/data/rh";

type View =
  | "time"
  | "banco"
  | "pdis"
  | "avaliacoes"
  | "mural"
  | "documentos";

const TABS: { key: View; label: string; icon: LucideIcon }[] = [
  { key: "time", label: "Time", icon: Users },
  { key: "banco", label: "Banco de horas", icon: Clock },
  { key: "pdis", label: "PDIs", icon: Target },
  { key: "avaliacoes", label: "Avaliações", icon: Star },
  { key: "mural", label: "Mural", icon: Megaphone },
  { key: "documentos", label: "Documentos", icon: FolderOpen },
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold text-white",
        size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs",
      )}
    >
      {initials(name)}
    </span>
  );
}

function loadTone(pct: number) {
  if (pct > 100) return "bg-rose-400";
  if (pct >= 90) return "bg-amber-400";
  return "bg-emerald-400";
}

const CAT: Record<AnnouncementCategory, { label: string; chip: string }> = {
  operational: { label: "Operacional", chip: "bg-violet-500/15 text-violet-300" },
  culture: { label: "Cultura", chip: "bg-emerald-500/15 text-emerald-300" },
  career: { label: "Carreira", chip: "bg-amber-500/15 text-amber-300" },
};

export type RhData = {
  employees: Employee[];
  alerts: HrAlert[];
  hourBank: {
    periodLabel: string;
    total: number;
    rows: HourRow[];
    entries: HourEntry[];
    employeeNames: string[];
  };
  pdis: PdiItem[];
  reviews: ReviewItem[];
  announcements: Announcement[];
};

export function RhCultura({ data }: { data: RhData }) {
  const [view, setView] = useState<View>("time");

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === view;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand-500 text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {view === "time" && <TimeTab data={data} />}
      {view === "banco" && <BancoTab data={data} />}
      {view === "pdis" && <PdisTab data={data} />}
      {view === "avaliacoes" && <AvaliacoesTab data={data} />}
      {view === "mural" && <MuralTab data={data} />}
      {view === "documentos" && <DocumentosTab />}
    </div>
  );
}

// --- Time -------------------------------------------------------------------
function TimeTab({ data }: { data: RhData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function del(e: Employee) {
    if (!window.confirm(`Excluir ${e.name} do time? Esta ação não pode ser desfeita.`)) return;
    setBusyId(e.id);
    try {
      const res = await fetch("/api/gerencial/rh/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: e.id }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Não foi possível excluir.", "error");
      else router.refresh();
    } catch {
      toast("Falha de rede ao excluir.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {data.alerts.map((a) => (
        <div
          key={a.id}
          className={cn(
            "flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
            a.tone === "danger"
              ? "bg-rose-500/10 text-rose-300"
              : "bg-amber-500/10 text-amber-300",
          )}
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {a.text}
        </div>
      ))}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.employees.map((e) => (
          <div key={e.id} className="group relative">
            <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => setEditing(e)}
                className="rounded-lg border border-line bg-surface p-1.5 text-muted shadow-sm hover:bg-subtle hover:text-ink"
                aria-label={`Editar ${e.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => del(e)}
                disabled={busyId === e.id}
                className="rounded-lg border border-line bg-surface p-1.5 text-muted shadow-sm hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
                aria-label={`Excluir ${e.name}`}
              >
                {busyId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Link
              href={`/gerencial/rh/${e.id}`}
              className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-300"
            >
              <div className="flex items-center gap-3">
                <Avatar name={e.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{e.name}</p>
                  <p className="truncate text-xs text-muted">
                    {e.role} · {e.squad}
                  </p>
                </div>
              </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-subtle-strong px-2 py-0.5 text-[10px] font-medium text-muted">
                {e.contractType.toUpperCase()}
              </span>
              {e.pdiActive && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                  PDI ativo
                </span>
              )}
              {e.reviewPending && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  Aval. pendente
                </span>
              )}
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                <span>Carga semanal</span>
                <span>{e.weeklyLoadPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-subtle-strong">
                <div
                  className={cn("h-full rounded-full", loadTone(e.weeklyLoadPct))}
                  style={{ width: `${Math.min(100, e.weeklyLoadPct)}%` }}
                />
              </div>
            </div>
            </Link>
          </div>
        ))}
      </div>

      {editing && (
        <CollaboratorModal mode="edit" employee={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

// --- Banco de horas ---------------------------------------------------------
function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y.slice(2)}` : iso;
}

async function postHours(body: unknown): Promise<boolean> {
  const res = await fetch("/api/gerencial/hour-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return Boolean(res?.ok);
}

function BancoTab({ data }: { data: RhData }) {
  const router = useRouter();
  const { hourBank } = data;
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const barTone = (t: HourRow["tone"]) =>
    t === "danger" ? "bg-rose-400" : t === "warn" ? "bg-amber-400" : "bg-emerald-400";
  const hLabel = (h: number) => (h > 0 ? `+${h}h` : `${h}h`);

  async function remove(id: string) {
    setBusyId(id);
    await postHours({ action: "delete", id });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            Banco de horas — {hourBank.periodLabel}
          </h3>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle"
          >
            <Plus className="h-4 w-4" /> Lançar
          </button>
        </div>

        {showForm && (
          <div className="mb-4">
            <HourEntryForm
              names={hourBank.employeeNames}
              onClose={() => setShowForm(false)}
              onSaved={() => {
                setShowForm(false);
                router.refresh();
              }}
            />
          </div>
        )}

        {hourBank.rows.length === 0 ? (
          <p className="rounded-xl bg-subtle px-3 py-6 text-center text-sm text-muted">
            Nenhum saldo no mês. Lance as horas extras e compensações da equipe.
          </p>
        ) : (
          <ul className="space-y-3">
            {hourBank.rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <Avatar name={r.name} size="sm" />
                <span className="w-40 shrink-0 truncate text-sm text-ink">{r.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                  <div
                    className={cn("h-full rounded-full", barTone(r.tone))}
                    style={{ width: `${Math.min(100, (Math.abs(r.balance) / (r.limit * 2)) * 100)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs font-medium text-ink">{hLabel(r.balance)}</span>
                <span className="hidden w-40 text-xs text-muted sm:block">{r.note}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          Saldo total do mês:{" "}
          <span className="font-semibold text-brand-300">{hLabel(hourBank.total)}</span>
          {" · "}limite de referência 8h/mês (CLT).
        </p>
      </Card>

      {hourBank.entries.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Lançamentos recentes</h3>
          <ul className="divide-y divide-line/60">
            {hourBank.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {e.employee} ·{" "}
                    <span className={e.hours >= 0 ? "text-emerald-400" : "text-sky-400"}>
                      {hLabel(e.hours)}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {fmtDay(e.workDate)}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => remove(e.id)}
                  disabled={busyId === e.id}
                  className="inline-flex items-center justify-center rounded-lg border border-line p-1.5 text-muted hover:text-rose-300 disabled:opacity-60"
                  aria-label="Excluir lançamento"
                >
                  {busyId === e.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const NEW_HOURS = { employee: "", workDate: "", hours: "", note: "" };

function HourEntryForm({
  names,
  onClose,
  onSaved,
}: {
  names: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState(NEW_HOURS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hoursNum = Number(f.hours.replace(",", "."));
  const valid = f.employee.trim().length > 0 && Number.isFinite(hoursNum) && hoursNum !== 0;

  const inputCls =
    "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    const ok = await postHours({
      action: "create",
      employee: f.employee.trim(),
      workDate: f.workDate || undefined,
      hours: hoursNum,
      note: f.note.trim() || undefined,
    });
    setBusy(false);
    if (ok) onSaved();
    else setErr("Não foi possível salvar. Tente novamente.");
  }

  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Lançar horas</p>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Colaborador *</span>
          <input
            list="hour-emp-names"
            value={f.employee}
            onChange={(e) => setF({ ...f, employee: e.target.value })}
            placeholder="Nome"
            className={inputCls}
          />
          <datalist id="hour-emp-names">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">
            Horas * (negativo = compensação)
          </span>
          <input
            value={f.hours}
            onChange={(e) => setF({ ...f, hours: e.target.value })}
            inputMode="decimal"
            placeholder="Ex.: 2 ou -1,5"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Data</span>
          <input
            type="date"
            value={f.workDate}
            onChange={(e) => setF({ ...f, workDate: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Observação</span>
          <input
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
            placeholder="Opcional"
            className={inputCls}
          />
        </label>
      </div>
      {err && <p className="mt-2 text-xs text-rose-400">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={!valid || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Lançar
        </button>
      </div>
    </div>
  );
}

// --- PDIs -------------------------------------------------------------------
const PDI_STATUS: Record<PdiObjectiveStatus, { label: string; chip: string }> = {
  not_started: { label: "Não iniciado", chip: "bg-subtle-strong text-muted" },
  in_progress: { label: "Em andamento", chip: "bg-sky-500/15 text-sky-500" },
  done: { label: "Concluído", chip: "bg-emerald-500/15 text-emerald-600" },
  missed: { label: "Não atingido", chip: "bg-rose-500/15 text-rose-500" },
};
const inputSm =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

function PdisTab({ data }: { data: RhData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [f, setF] = useState({ collaboratorId: "", title: "", indicator: "", progress: "", status: "in_progress", deadline: "" });
  const setV = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function create() {
    const emp = data.employees.find((e) => e.id === f.collaboratorId);
    if (!emp || !f.title.trim()) {
      toast("Escolha o colaborador e descreva o objetivo.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/rh/pdis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          collaboratorId: emp.id, collaboratorName: emp.name, role: emp.role,
          title: f.title, indicator: f.indicator, progress: f.progress, status: f.status, deadline: f.deadline,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Falha ao salvar.", "error");
      else {
        setF({ collaboratorId: "", title: "", indicator: "", progress: "", status: "in_progress", deadline: "" });
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch("/api/gerencial/rh/pdis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Falha.", "error");
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function remove(id: string) {
    if (window.confirm("Excluir este objetivo de PDI?")) void patch(id, { action: "delete" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{data.pdis.length} objetivo(s) de desenvolvimento</p>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? "Cancelar" : "Novo objetivo"}
        </button>
      </div>

      {open && (
        <Card className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Colaborador</span>
            <select value={f.collaboratorId} onChange={(e) => setV("collaboratorId", e.target.value)} className={inputSm}>
              <option value="">Selecione…</option>
              {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Objetivo</span>
            <input value={f.title} onChange={(e) => setV("title", e.target.value)} placeholder="Ex.: Dominar Motion Design" className={inputSm} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Indicador</span>
            <input value={f.indicator} onChange={(e) => setV("indicator", e.target.value)} placeholder="Ex.: 4 Reels com motion" className={inputSm} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Progresso</span>
            <input value={f.progress} onChange={(e) => setV("progress", e.target.value)} placeholder="Ex.: 2/4" className={inputSm} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Status</span>
            <select value={f.status} onChange={(e) => setV("status", e.target.value)} className={inputSm}>
              {(Object.keys(PDI_STATUS) as PdiObjectiveStatus[]).map((k) => <option key={k} value={k}>{PDI_STATUS[k].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Prazo</span>
            <input value={f.deadline} onChange={(e) => setV("deadline", e.target.value)} placeholder="Ex.: 30/06/2025" className={inputSm} />
          </label>
          <div className="flex justify-end sm:col-span-2">
            <button onClick={create} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} Salvar objetivo
            </button>
          </div>
        </Card>
      )}

      {data.pdis.length === 0 && !open && (
        <Card className="p-8 text-center text-sm text-muted">Nenhum objetivo de PDI ainda.</Card>
      )}

      {data.pdis.map((p) => (
        <Card key={p.id} className="group p-4">
          <div className="mb-2 flex items-center gap-3">
            <Avatar name={p.collaboratorName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{p.collaboratorName}{p.role ? ` — ${p.role}` : ""}</p>
            </div>
            <select
              value={p.status}
              disabled={busyId === p.id}
              onChange={(e) => patch(p.id, { action: "update", status: e.target.value })}
              className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium outline-none", PDI_STATUS[p.status].chip)}
            >
              {(Object.keys(PDI_STATUS) as PdiObjectiveStatus[]).map((k) => <option key={k} value={k}>{PDI_STATUS[k].label}</option>)}
            </select>
            <button onClick={() => remove(p.id)} disabled={busyId === p.id} className="rounded-lg p-1 text-muted opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100" aria-label="Excluir">
              {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-sm font-medium text-ink">{p.title}</p>
          {(p.indicator || p.progress || p.deadline) && (
            <p className="mt-0.5 text-xs text-muted">
              {p.indicator}{p.progress ? ` · progresso: ${p.progress}` : ""}{p.deadline ? ` · prazo ${p.deadline}` : ""}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

const REVIEW_STATUS: Record<ReviewStatus, { label: string; chip: string }> = {
  pending: { label: "Pendente", chip: "bg-amber-500/15 text-amber-600" },
  self_done: { label: "Autoavaliação feita", chip: "bg-sky-500/15 text-sky-500" },
  done: { label: "Concluída", chip: "bg-emerald-500/15 text-emerald-600" },
};

function AvaliacoesTab({ data }: { data: RhData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [f, setF] = useState({ collaboratorId: "", cycle: "", selfScore: "", leaderScore: "", note: "", status: "pending" });
  const setV = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function create() {
    const emp = data.employees.find((e) => e.id === f.collaboratorId);
    if (!emp) {
      toast("Escolha o colaborador.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/rh/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          collaboratorId: emp.id, collaboratorName: emp.name, role: emp.role,
          cycle: f.cycle, selfScore: Number(f.selfScore) || 0, leaderScore: Number(f.leaderScore) || 0,
          note: f.note, status: f.status,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Falha ao salvar.", "error");
      else {
        setF({ collaboratorId: "", cycle: "", selfScore: "", leaderScore: "", note: "", status: "pending" });
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    if (!window.confirm("Excluir esta avaliação?")) return;
    setBusyId(id);
    void fetch("/api/gerencial/rh/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    })
      .then((r) => (r.ok ? router.refresh() : toast("Falha ao excluir.", "error")))
      .finally(() => setBusyId(null));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{data.reviews.length} avaliação(ões)</p>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? "Cancelar" : "Nova avaliação"}
        </button>
      </div>

      {open && (
        <Card className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Colaborador</span>
            <select value={f.collaboratorId} onChange={(e) => setV("collaboratorId", e.target.value)} className={inputSm}>
              <option value="">Selecione…</option>
              {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Ciclo</span>
            <input value={f.cycle} onChange={(e) => setV("cycle", e.target.value)} placeholder="Ex.: jul/25" className={inputSm} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Nota autoavaliação (0–5)</span>
            <input value={f.selfScore} onChange={(e) => setV("selfScore", e.target.value)} inputMode="decimal" className={inputSm} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Nota liderança (0–5)</span>
            <input value={f.leaderScore} onChange={(e) => setV("leaderScore", e.target.value)} inputMode="decimal" className={inputSm} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Status</span>
            <select value={f.status} onChange={(e) => setV("status", e.target.value)} className={inputSm}>
              {(Object.keys(REVIEW_STATUS) as ReviewStatus[]).map((k) => <option key={k} value={k}>{REVIEW_STATUS[k].label}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Observação</span>
            <textarea value={f.note} onChange={(e) => setV("note", e.target.value)} rows={2} className={inputSm + " resize-y"} />
          </label>
          <div className="flex justify-end sm:col-span-2">
            <button onClick={create} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />} Salvar avaliação
            </button>
          </div>
        </Card>
      )}

      {data.reviews.length === 0 && !open && (
        <Card className="p-8 text-center text-sm text-muted">Nenhuma avaliação registrada ainda.</Card>
      )}

      {data.reviews.map((r) => (
        <Card key={r.id} className="group p-4">
          <div className="mb-2 flex items-center gap-3">
            <Avatar name={r.collaboratorName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{r.collaboratorName}{r.role ? ` — ${r.role}` : ""}</p>
              {r.cycle && <p className="text-xs text-muted">Ciclo {r.cycle}</p>}
            </div>
            <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium", REVIEW_STATUS[r.status].chip)}>
              {REVIEW_STATUS[r.status].label}
            </span>
            <button onClick={() => remove(r.id)} disabled={busyId === r.id} className="rounded-lg p-1 text-muted opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100" aria-label="Excluir">
              {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted">Autoavaliação: <span className="font-semibold text-ink">{r.selfScore.toFixed(1)}</span></span>
            <span className="text-muted">Liderança: <span className="font-semibold text-ink">{r.leaderScore.toFixed(1)}</span></span>
          </div>
          {r.note && <p className="mt-1.5 text-sm text-ink/90">{r.note}</p>}
        </Card>
      ))}
    </div>
  );
}

// --- Mural ------------------------------------------------------------------
function MuralTab({ data }: { data: RhData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<AnnouncementCategory>("operational");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function create() {
    if (!content.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/rh/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", category, content }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Não foi possível publicar.", "error");
      else {
        setContent("");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este comunicado?")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/gerencial/rh/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Não foi possível excluir.", "error");
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? "Cancelar" : "Novo comunicado"}
        </button>
      </div>

      {open && (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CAT) as AnnouncementCategory[]).map((k) => (
              <button
                key={k}
                onClick={() => setCategory(k)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  category === k ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:text-ink",
                )}
              >
                {CAT[k].label}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Escreva o comunicado para o time…"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          />
          <div className="flex justify-end">
            <button
              onClick={create}
              disabled={busy || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Publicar
            </button>
          </div>
        </Card>
      )}

      {data.announcements.length === 0 && !open && (
        <Card className="p-8 text-center text-sm text-muted">Nenhum comunicado ainda. Publique o primeiro.</Card>
      )}

      {data.announcements.map((a) => {
        const cat = CAT[a.category];
        return (
          <Card key={a.id} className="group p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Avatar name={a.author} size="sm" />
              <span className="text-sm font-semibold text-ink">{a.author}</span>
              {a.authorRole && <span className="text-xs text-muted">({a.authorRole})</span>}
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cat.chip)}>{cat.label}</span>
              <span className="ml-auto text-xs text-muted">{a.when}</span>
              <button
                onClick={() => remove(a.id)}
                disabled={busyId === a.id}
                className="rounded-lg p-1 text-muted opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-50"
                aria-label="Excluir comunicado"
              >
                {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink/90">{a.content}</p>
            {a.total > 0 && (
              <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
                Lido por {a.readBy} de {a.total}
                {a.note ? ` · ${a.note}` : ""}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// --- Documentos -------------------------------------------------------------
function DocumentosTab() {
  return (
    <Card className="p-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted">
        <FileText className="h-6 w-6" />
      </span>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">
        Repositório de documentos admissionais por colaborador — contratos,
        holerites, ASOs e CNDs.
      </p>
      <button className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
        <FolderOpen className="h-4 w-4" /> Abrir repositório
      </button>
    </Card>
  );
}

export function formatSalary(n: number) {
  return `R$ ${formatNumber(n)}/mês`;
}
