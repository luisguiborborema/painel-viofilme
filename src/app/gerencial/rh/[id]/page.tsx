import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Mail,
  Pencil,
  Phone,
  Plus,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { getEmployeeProfile, type PdiObjectiveStatus } from "@/lib/data/rh";
import { cn, formatNumber } from "@/lib/utils";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const STATUS: Record<PdiObjectiveStatus, { label: string; chip: string }> = {
  not_started: { label: "Não iniciado", chip: "bg-subtle-strong text-muted" },
  in_progress: { label: "Em andamento", chip: "bg-sky-500/15 text-sky-300" },
  done: { label: "Concluído", chip: "bg-emerald-500/15 text-emerald-300" },
  missed: { label: "Não atingido", chip: "bg-rose-500/15 text-rose-300" },
};

function Stars({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i <= Math.round(score)
              ? "fill-amber-400 text-amber-400"
              : "text-line",
          )}
        />
      ))}
    </span>
  );
}

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Mail;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted" />}
        {value}
      </span>
    </div>
  );
}

export default async function EmployeeProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = getEmployeeProfile(id);
  if (!p) notFound();
  const e = p.employee;

  return (
    <div className="space-y-4">
      <Link
        href="/gerencial/rh"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> RH &amp; cultura
      </Link>

      {/* Cabeçalho */}
      <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
            {initials(e.name)}
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink">{e.name}</h1>
            <p className="text-sm text-muted">
              {e.role} · {e.squad}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-subtle-strong px-2 py-0.5 text-[10px] font-medium text-muted">
                {e.contractType.toUpperCase()}
              </span>
              {e.reviewPending && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  Aval. pendente
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
            <Pencil className="h-3.5 w-3.5" /> Editar perfil
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
            <Clock className="h-3.5 w-3.5" /> Lançar horas
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
            <Star className="h-3.5 w-3.5" /> Avaliar
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Dados contratuais
            </h2>
            <div className="divide-y divide-line">
              <Field label="Regime" value={e.contractType.toUpperCase()} />
              <Field label="Salário" value={`R$ ${formatNumber(e.salary)}/mês`} />
              <Field label="Início" value={e.admissionDate} />
              <Field label="E-mail" value={e.email} icon={Mail} />
              <Field label="WhatsApp" value={e.phone} icon={Phone} />
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-xs text-muted">Férias</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                    e.vacationSoon
                      ? "bg-amber-500/15 text-amber-300"
                      : "text-ink",
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {e.vacationDue === "—" ? "—" : `Vence ${e.vacationDue}`}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Banco de horas
              </h2>
              <span
                className={cn(
                  "text-lg font-bold",
                  e.hourBalance > e.hourLimit ? "text-rose-400" : "text-ink",
                )}
              >
                +{e.hourBalance}h
              </span>
            </div>
            {e.hourBalance > e.hourLimit && (
              <p className="mb-2 text-xs text-rose-300">
                Excedente do limite ({e.hourLimit}h/mês) — compensação recomendada.
              </p>
            )}
            <ul className="space-y-1.5">
              {p.weeks.map((w) => (
                <li
                  key={w.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted">{w.label}</span>
                  <span
                    className={cn(
                      "font-medium",
                      w.extra ? "text-amber-300" : "text-ink",
                    )}
                  >
                    {w.hours > 0 ? `+${w.hours}h` : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <button className="mt-3 w-full rounded-lg border border-line py-1.5 text-xs font-medium text-ink hover:bg-subtle">
              Compensar horas
            </button>
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Documentos
            </h2>
            <ul className="divide-y divide-line">
              {p.documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 py-2.5">
                  <FileText className="h-4 w-4 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{doc.title}</p>
                    <p className="text-xs text-muted">{doc.meta}</p>
                  </div>
                  <button className="text-muted hover:text-ink">
                    <Download className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">PDI · Q2 2025</h2>
              <button className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
                <Pencil className="h-3.5 w-3.5" /> editar
              </button>
            </div>
            <ul className="space-y-2.5">
              {p.pdiObjectives.map((o) => {
                const s = STATUS[o.status];
                return (
                  <li key={o.title} className="rounded-xl bg-subtle p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{o.title}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          s.chip,
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Indicador: {o.indicator} · prazo {o.deadline}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                Última avaliação — semestral
              </h2>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600">
                <Plus className="h-3.5 w-3.5" /> Iniciar jul/25
              </button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-subtle p-3 text-center">
                <p className="text-2xl font-bold text-ink">{p.review.self}</p>
                <p className="text-xs text-muted">Autoavaliação</p>
              </div>
              <div className="rounded-xl bg-subtle p-3 text-center">
                <p className="text-2xl font-bold text-ink">{p.review.leader}</p>
                <p className="text-xs text-muted">Liderança</p>
              </div>
            </div>
            <ul className="space-y-2">
              {p.review.criteria.map((cr) => (
                <li
                  key={cr.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted">{cr.label}</span>
                  <span className="flex items-center gap-3">
                    <Stars score={cr.leader} />
                    <span className="w-8 text-right font-medium text-ink">
                      {cr.leader.toFixed(1)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-xl bg-subtle p-3 text-xs italic text-ink/80">
              {p.review.note}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Histórico de atividades
            </h2>
            <ol className="relative ml-1 space-y-3 border-l border-line pl-5">
              {p.activity.map((a, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  </span>
                  <p className="text-sm text-ink/90">{a.text}</p>
                  <p className="text-xs text-muted">{a.when}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
