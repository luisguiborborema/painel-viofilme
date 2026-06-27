import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  CalendarPlus,
  CreditCard,
  ExternalLink,
  FileBarChart,
  Flag,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Star,
  Undo2,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCSClientDetail } from "@/lib/data/cs";
import { getClientById } from "@/lib/data/queries";
import { ClientConfigCard } from "@/components/gerencial/client-config-card";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import type { CSTimelineEvent, Platform } from "@/lib/data/types";

function initials(name: string) {
  return name
    .replace(/[^A-Za-zÀ-ú ]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function scoreTone(s: number) {
  if (s >= 75) return "text-emerald-400";
  if (s >= 50) return "text-amber-400";
  return "text-rose-400";
}

const TIMELINE_ICON: Record<CSTimelineEvent["kind"], typeof Star> = {
  nps: Star,
  meeting: Calendar,
  refund: Undo2,
  payment: CreditCard,
  onboarding: Flag,
  note: MessageSquare,
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

const ACTIONS = [
  { label: "Registrar reunião", icon: CalendarPlus },
  { label: "Ver projeto (M3)", icon: FileBarChart },
  { label: "Ver faturas (M4)", icon: CreditCard },
  { label: "Gerar relatório", icon: FileBarChart },
  { label: "Adicionar NPS", icon: Star },
];

export default async function RaioXCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = getCSClientDetail(id);
  if (!d) notFound();

  const c = d.client;
  const portal = await getClientById(id);
  const config = {
    hasPaidTraffic: portal?.hasPaidTraffic ?? d.campaignsInvested > 0,
    clientType: portal?.clientType ?? ("local_business" as const),
    activeNetworks:
      portal?.activeNetworks ?? (["instagram", "facebook"] as Platform[]),
  };

  return (
    <div className="space-y-4">
      <Link
        href="/gerencial/clientes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Todas as contas
      </Link>

      {/* Cabeçalho do cliente */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
              {initials(c.name)}
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">
                {c.name}
              </h1>
              <p className="text-sm text-muted">
                {c.segment} · {c.city} · {d.contactName} · {d.contactRole}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {d.phone}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {d.email}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn("text-3xl font-bold", scoreTone(c.healthScore))}>
              {c.healthScore}
            </p>
            <p className="text-xs text-muted">Score · cliente desde {d.clientSince}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Plano" value={`${d.plan} · R$ ${formatNumber(c.mrr)}/mês`} />
          <Stat label="Tempo de casa" value={d.tenure} />
          <Stat label="LTV projetado" value={formatBRL(d.ltv)} />
          <Stat label="NPS atual" value={`${c.nps} · ${d.npsClassification}`} />
          <Stat label="Faturas" value={d.invoicesNote} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-subtle-strong"
            >
              <a.icon className="h-3.5 w-3.5" /> {a.label}
            </button>
          ))}
          <Link
            href="/cliente"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir portal do cliente
          </Link>
        </div>
      </Card>

      {/* NPS + Timeline + Reuniões */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">NPS &amp; satisfação</h2>
          <p className="mt-3 text-5xl font-bold text-emerald-400">{c.nps}</p>
          <p className="text-sm font-medium text-ink">{d.npsClassification}</p>
          <p className="mt-1 text-xs text-muted">
            Última pesquisa em {d.npsLastSurvey}
          </p>
          <p className="mt-3 rounded-xl bg-subtle p-3 text-sm italic text-ink/80">
            {d.npsQuote}
          </p>
        </Card>

        <Card className="p-5 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Timeline da conta</h2>
            <button className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          <ol className="relative ml-1 space-y-3 border-l border-line pl-5">
            {d.timeline.map((ev) => {
              const Icon = TIMELINE_ICON[ev.kind];
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <p className="text-sm text-ink/90">{ev.text}</p>
                  <p className="text-xs text-muted">{ev.date}</p>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Reuniões</h2>
            <button className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
              <Plus className="h-3.5 w-3.5" /> Agendar
            </button>
          </div>
          {d.nextMeeting && (
            <div className="rounded-xl bg-subtle p-3">
              <p className="text-xs font-medium text-emerald-300">
                {d.nextMeeting.whenLabel}
              </p>
              <p className="mt-0.5 text-sm font-medium text-ink">
                {d.nextMeeting.title}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-sky-400">
                <Video className="h-3.5 w-3.5" /> Google Meet
              </span>
            </div>
          )}
          <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
            {d.nextContact}
          </div>
        </Card>
      </div>

      {/* Briefing + Campanhas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Briefing da conta
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted">Objetivo principal</dt>
              <dd className="text-ink/90">{d.briefing.objetivo}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Tom de voz</dt>
              <dd className="text-ink/90">{d.briefing.tomDeVoz}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Público-alvo</dt>
              <dd className="text-ink/90">{d.briefing.publico}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Concorrentes</dt>
              <dd className="text-ink/90">{d.briefing.concorrentes}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Restrições</dt>
              <dd className="text-ink/90">{d.briefing.restricoes}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              Campanhas ativas &amp; performance
            </h2>
            <Link
              href="/gerencial/campanhas"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200"
            >
              Ver campanhas <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="space-y-2">
            {d.campaigns.map((cp) => (
              <li
                key={cp.name}
                className="flex items-center justify-between rounded-xl bg-subtle p-3"
              >
                <span className="text-sm text-ink">{cp.name}</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    cp.tone === "ok" ? "text-emerald-400" : "text-amber-400",
                  )}
                >
                  CPL {formatBRL(cp.cpl)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Total investido no mês:{" "}
            <span className="font-semibold text-ink">
              R$ {formatNumber(d.campaignsInvested)}
            </span>
          </p>
        </Card>
      </div>

      {/* Configuração do portal do cliente (R05 / CAM04 / ORG06) */}
      <ClientConfigCard clientId={id} initial={config} />
    </div>
  );
}
