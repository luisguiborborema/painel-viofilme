"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  FileText,
  FolderOpen,
  Megaphone,
  Plus,
  Star,
  Target,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import type {
  Announcement,
  AnnouncementCategory,
  Employee,
  HourRow,
  HrAlert,
  PdiEmployee,
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
  hourBank: { periodLabel: string; total: number; rows: HourRow[] };
  pdi: { quarter: string; deadline: string; active: number; employees: PdiEmployee[] };
  review: {
    cycle: string;
    label: string;
    description: string;
    pendingSelf: number;
    started: boolean;
  };
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
          <Link
            key={e.id}
            href={`/gerencial/rh/${e.id}`}
            className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-300"
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
        ))}
      </div>
    </div>
  );
}

// --- Banco de horas ---------------------------------------------------------
function BancoTab({ data }: { data: RhData }) {
  const { hourBank } = data;
  const barTone = (t: HourRow["tone"]) =>
    t === "danger" ? "bg-rose-400" : t === "warn" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          Banco de horas — {hourBank.periodLabel}
        </h3>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle">
          <Plus className="h-4 w-4" /> Lançar
        </button>
      </div>
      <ul className="space-y-3">
        {hourBank.rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <Avatar name={r.name} size="sm" />
            <span className="w-40 shrink-0 truncate text-sm text-ink">{r.name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
              <div
                className={cn("h-full rounded-full", barTone(r.tone))}
                style={{ width: `${Math.min(100, (r.balance / (r.limit * 2)) * 100)}%` }}
              />
            </div>
            <span className="w-20 text-right text-xs font-medium text-ink">
              {r.balance > 0 ? `+${r.balance}h acum.` : "0h"}
            </span>
            <span className="hidden w-40 text-xs text-muted sm:block">{r.note}</span>
            <button className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-subtle">
              {r.contractType === "pj" ? "Ver logs" : "Compensar"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
        Saldo total acumulado:{" "}
        <span className="font-semibold text-brand-300">+{hourBank.total}h</span> ·
        horas apontadas via tarefas do módulo Operação.
      </p>
    </Card>
  );
}

// --- PDIs -------------------------------------------------------------------
function PdisTab({ data }: { data: RhData }) {
  const { pdi } = data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Ciclo {pdi.quarter} · prazo {pdi.deadline} ·{" "}
          <span className="font-medium text-ink">{pdi.active} PDIs ativos</span>
        </p>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle">
          <Plus className="h-4 w-4" /> Novo ciclo Q3
        </button>
      </div>

      {pdi.employees.map((e) => (
        <Card key={e.id} className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={e.name} size="sm" />
              <div>
                <p className="text-sm font-semibold text-ink">
                  {e.name} — {e.role}
                </p>
                <p className="text-xs text-muted">
                  {e.total} objetivos · {e.done} concluído · {e.inProgress} em andamento
                </p>
              </div>
            </div>
            <span
              className={cn(
                "text-sm font-semibold",
                e.progressPct >= 75
                  ? "text-emerald-400"
                  : e.progressPct >= 50
                    ? "text-amber-400"
                    : "text-sky-400",
              )}
            >
              {e.progressPct}% completo
            </span>
          </div>
          <div className="rounded-xl bg-subtle p-3">
            <p className="text-xs font-medium text-muted">Obj. em aberto</p>
            <p className="text-sm font-medium text-ink">{e.openObjective.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              Indicador: {e.openObjective.indicator} · progresso:{" "}
              {e.openObjective.progress}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle-strong">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${e.progressPct}%` }}
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// --- Avaliações -------------------------------------------------------------
function AvaliacoesTab({ data }: { data: RhData }) {
  const { review } = data;
  return (
    <Card className="p-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted">
        <Star className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{review.label}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        {review.description}
      </p>
      <button className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
        Iniciar ciclo de avaliação
      </button>
    </Card>
  );
}

// --- Mural ------------------------------------------------------------------
function MuralTab({ data }: { data: RhData }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Novo comunicado
        </button>
      </div>
      {data.announcements.map((a) => {
        const cat = CAT[a.category];
        return (
          <Card key={a.id} className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Avatar name={a.author} size="sm" />
              <span className="text-sm font-semibold text-ink">{a.author}</span>
              <span className="text-xs text-muted">({a.authorRole})</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  cat.chip,
                )}
              >
                {cat.label}
              </span>
              <span className="ml-auto text-xs text-muted">{a.when}</span>
            </div>
            <p className="text-sm text-ink/90">{a.content}</p>
            <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
              Lido por {a.readBy} de {a.total}
              {a.note ? ` · ${a.note}` : ""}
            </p>
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
