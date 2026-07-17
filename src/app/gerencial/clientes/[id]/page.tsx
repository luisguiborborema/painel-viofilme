import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  Mail,
  Phone,
  Plus,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  getClientById,
  getClientTasks,
  getCSClientDetail,
  getEditorialLineView,
  getHubClientsOps,
} from "@/lib/data/queries";
import {
  getClientDocuments,
  getVioLaunch,
  RESPONSIBLE_ROLES,
  TASK_STAGES,
} from "@/lib/data/operacao";
import { ClientConfigCard } from "@/components/gerencial/client-config-card";
import { ClientGoalsCard } from "@/components/gerencial/client-goals-card";
import { ClientTabs, type ClientTab } from "@/components/gerencial/client-tabs";
import { LinhaEditorial } from "@/components/gerencial/linha-editorial";
import { VioDay } from "@/components/gerencial/vioday";
import { ClientTasksTab } from "@/components/gerencial/client-tasks-tab";
import { CriativosTab } from "@/components/gerencial/criativos-tab";
import { NpsCard } from "@/components/gerencial/nps-card";
import { ClientProfileCard } from "@/components/gerencial/client-profile-card";
import { ClientQuickActions } from "@/components/gerencial/client-quick-actions";
import { NewMeetingButton } from "@/components/gerencial/new-meeting-button";
import { PlatformIcon } from "@/components/dashboard/platform";
import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/data/types";

function initials(name: string) {
  return name
    .replace(/[^A-Za-zÀ-ú ]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium text-muted">{label}</dt>
      <dd className="text-right text-ink/90">{value}</dd>
    </div>
  );
}

const CLIENT_TYPE_LABEL: Record<string, string> = {
  lead_gen: "Geração de leads",
  ecommerce: "E-commerce",
  local_business: "Negócio local",
};

/** Tipologia da reunião derivada do título (Kickoff / VioLaunch / Media Day / Alinhamento). */
function meetingTag(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("kickoff") || t.includes("kick-off")) return "Kickoff";
  if (t.includes("violaunch") || t.includes("onboarding")) return "VioLaunch";
  if (t.includes("media day") || t.includes("mediaday") || t.includes("vioday")) return "Media Day";
  if (t.includes("resultado") || t.includes("mensal") || t.includes("alinhamento")) return "Alinhamento mensal";
  return "Reunião";
}

function healthTone(score: number) {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-600";
  if (score >= 55) return "bg-amber-500/15 text-amber-600";
  return "bg-rose-500/15 text-rose-500";
}

/** Barra de entregas do mês: verde = entregue, âmbar = aguardando cliente. */
function EntregasBar({ done, approval, total }: { done: number; approval: number; total: number }) {
  const t = Math.max(total, done + approval, 1);
  const donePct = (done / t) * 100;
  const apprPct = (approval / t) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-muted">Entregas do mês</span>
        <span className="text-ink/90">
          {done}/{total} entregues{approval > 0 ? ` · ${approval} aguard.` : ""}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-subtle-strong">
        <div className="h-full bg-emerald-500" style={{ width: `${donePct}%` }} />
        <div className="h-full bg-amber-500" style={{ width: `${apprPct}%` }} />
      </div>
    </div>
  );
}


export default async function RaioXCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const d = await getCSClientDetail(id);
  if (!d) notFound();

  const c = d.client;
  const [hubOps, clientTasks, portal] = await Promise.all([
    getHubClientsOps(),
    getClientTasks(c.name),
    getClientById(id),
  ]);
  const ops = hubOps.find((x) => x.id === id);
  const config = {
    hasPaidTraffic: portal?.hasPaidTraffic ?? d.campaignsInvested > 0,
    clientType: portal?.clientType ?? ("local_business" as const),
    activeNetworks:
      portal?.activeNetworks ?? (["instagram", "facebook"] as Platform[]),
    asaasCustomerId: portal?.asaasCustomerId ?? "",
    whatsapp: portal?.whatsapp ?? "",
  };

  const vl = getVioLaunch(id);
  const docs = getClientDocuments(id);
  const editorial = await getEditorialLineView(id);

  const subtitleParts = [c.segment, c.city, d.contactName, d.contactRole].filter(
    (x) => x && x !== "—",
  );
  const hasPhone = d.phone !== "—";
  const hasEmail = d.email !== "—";
  const activeNetworks = config.activeNetworks;
  const clientTypeLabel = CLIENT_TYPE_LABEL[config.clientType];
  const openTaskCount = clientTasks.filter((t) => t.stage !== "done").length;

  // --- Aba Resumo (HUB07 — 3 camadas) ---------------------------------------
  const lateTasks = clientTasks.filter((t) => t.late);
  const approvalTasks = clientTasks.filter((t) => t.stage === "approval");
  const STAGE_TONE: Record<string, string> = {
    todo: "text-muted", doing: "text-sky-500", review: "text-violet-500",
    approval: "text-amber-500", done: "text-emerald-500",
  };
  const resumo = (
    <div className="space-y-4">
      {/* Camada 1 — Precisa de ação agora */}
      <Card className="border-l-4 border-l-rose-400 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Precisa de ação agora</h2>
        {lateTasks.length === 0 && approvalTasks.length === 0 ? (
          <p className="rounded-lg bg-subtle px-3 py-3 text-sm text-muted">Nada pendente. Cliente em dia. ✅</p>
        ) : (
          <div className="space-y-3">
            {lateTasks.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-500">Atrasadas ({lateTasks.length})</p>
                <ul className="space-y-1">
                  {lateTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-rose-500/5 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-ink">{t.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-medium text-rose-500">{t.dueLabel}</span>
                        <Link href={`/gerencial/clientes/${id}?tab=tarefas`} className="inline-flex items-center gap-0.5 rounded-md bg-rose-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-600">
                          Resolver <ArrowRight className="h-3 w-3" />
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {approvalTasks.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">Aguardando aprovação ({approvalTasks.length})</p>
                <ul className="space-y-1">
                  {approvalTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/5 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-ink">{t.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-medium text-amber-600">{t.dueLabel}</span>
                        <Link href={`/gerencial/clientes/${id}?tab=tarefas`} className="inline-flex items-center gap-0.5 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-600">
                          Resolver <ArrowRight className="h-3 w-3" />
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Camada 2 — Em andamento (funil) */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Em andamento — funil de produção</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TASK_STAGES.map((s) => {
            const n = clientTasks.filter((t) => t.stage === s.key).length;
            return (
              <div key={s.key} className="rounded-xl border border-line p-3 text-center">
                <p className={cn("text-2xl font-bold", STAGE_TONE[s.key] ?? "text-ink")}>{n}</p>
                <p className="text-[11px] text-muted">{s.label}</p>
              </div>
            );
          })}
        </div>
        {clientTasks.length === 0 && <p className="mt-3 text-xs text-muted">Sem tarefas registradas para este cliente ainda.</p>}
      </Card>

      {/* Camada 3 — Estratégico / referência */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Contrato &amp; referência</h2>
          <p className="mb-3 text-xs text-muted">
            Serviços, entregáveis e responsáveis da conta — o status do mês fica no topo.
          </p>
          <dl className="space-y-2.5 text-sm">
            <Row2 label="Serviços" value={ops?.services.join(" · ") ?? ops?.plan ?? d.plan} />
            <Row2 label="Entregáveis do mês" value={ops?.deliverables ?? "—"} />
            {ops && RESPONSIBLE_ROLES.map((r) => (
              <Row2 key={r.key} label={r.label} value={ops.responsibles[r.key]} />
            ))}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Diretrizes da marca</h2>
          <dl className="space-y-2.5 text-sm">
            <Row2 label="Objetivo" value={d.briefing.objetivo} />
            <Row2 label="Tom de voz" value={d.briefing.tomDeVoz} />
            <Row2 label="Público" value={d.briefing.publico} />
            <Row2 label="Concorrentes" value={d.briefing.concorrentes} />
            <Row2 label="Restrições" value={d.briefing.restricoes} />
            {d.nextMeeting && <Row2 label="Próxima agenda" value={`${d.nextMeeting.whenLabel} · ${d.nextMeeting.title}`} />}
          </dl>
        </Card>
      </div>

      <NpsCard
        clientId={id}
        score={d.npsClassification === "Não medido" ? null : c.nps}
        classification={d.npsClassification}
        lastSurvey={d.npsLastSurvey}
        quote={d.npsQuote}
      />

      <ClientProfileCard
        clientId={id}
        initial={{
          city: c.city,
          csResponsavel: c.cs,
          contractModel: d.contractModel,
          driveFolderUrl: d.driveFolderUrl ?? "",
          contactName: d.contactName,
          contactRole: d.contactRole,
          contactPhone: d.phone,
          contactEmail: d.email,
          briefObjetivo: d.briefing.objetivo,
          briefTom: d.briefing.tomDeVoz,
          briefPublico: d.briefing.publico,
          briefConcorrentes: d.briefing.concorrentes,
          briefRestricoes: d.briefing.restricoes,
        }}
      />

      <ClientConfigCard clientId={id} initial={config} />
    </div>
  );

  // --- Aba Tarefas (HUB08) --------------------------------------------------
  const tarefas = <ClientTasksTab tasks={clientTasks} clientId={id} clientName={c.name} />;

  // --- Aba VioLaunch (HUB11 — estudo do negócio) ----------------------------
  const violaunch = (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">VioLaunch — estudo & implementação</h2>
          <p className="text-xs text-muted">Não é só onboarding: é o estudo do negócio do cliente.</p>
        </div>
        <span className="text-sm font-medium text-muted">
          {vl.step}/{vl.total} etapas · início {vl.startDate}
        </span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-subtle-strong">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${(vl.step / vl.total) * 100}%` }} />
      </div>
      <div className="space-y-2">
        {vl.steps.map((s) => (
          <details key={s.label} className="group rounded-xl border border-line" open={!s.done}>
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 text-sm">
              {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted" />}
              <span className={cn("flex-1 font-medium", s.done ? "text-ink" : "text-muted")}>{s.label}</span>
              <span className="text-xs text-muted">{s.date}</span>
            </summary>
            <div className="space-y-2 border-t border-line px-3 py-2.5 text-sm">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Entregas</p>
                <p className="text-ink/90">{s.entregas}</p>
              </div>
              {s.notes && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Anotações & ajustes</p>
                  <p className="text-ink/90">{s.notes}</p>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </Card>
  );

  // --- Aba Criativos (HUB10 — gera task) ------------------------------------
  const criativos = (
    <CriativosTab
      clientName={c.name}
      clientId={id}
      existing={clientTasks.filter((t) => t.title.startsWith("Criativo "))}
    />
  );

  // --- Aba Agenda -----------------------------------------------------------
  const interactions = d.timeline.filter(
    (ev) => ev.kind === "meeting" || ev.kind === "nps",
  );
  const agenda = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Próximas reuniões</h2>
          <NewMeetingButton clientId={id} clientName={c.name} defaultAttendee={d.email} />
        </div>
        {d.nextMeeting ? (
          <div className="rounded-xl border border-line bg-subtle p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-emerald-500">{d.nextMeeting.whenLabel}</p>
              <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-500">
                {meetingTag(d.nextMeeting.title)}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-ink">{d.nextMeeting.title}</p>
            <div className="mt-2.5 flex items-center gap-2">
              {d.nextMeeting.joinUrl ? (
                <a
                  href={d.nextMeeting.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-500 hover:bg-sky-500/20"
                >
                  <Video className="h-3.5 w-3.5" /> Entrar no Meet
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-subtle px-2.5 py-1.5 text-xs font-medium text-muted">
                  <Video className="h-3.5 w-3.5" /> Sem link de Meet
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-4 text-center">
            <p className="text-sm text-muted">
              A agenda está livre. Agende o próximo touchpoint com o cliente.
            </p>
          </div>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Histórico de interações</h2>
        {interactions.length > 0 ? (
          <ol className="relative ml-1 space-y-3 border-l border-line pl-5">
            {interactions.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[26px] top-0.5 h-3 w-3 rounded-full bg-brand-500/30" />
                <p className="text-sm text-ink/90">{ev.text}</p>
                <p className="text-xs text-muted">{ev.date}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">
            Sem reuniões ou pesquisas registradas ainda.
          </p>
        )}
      </Card>
    </div>
  );

  // --- Aba Documentos -------------------------------------------------------
  const documentos = (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">Documentos</h2>
      <ul className="divide-y divide-line">
        {docs.map((doc) => (
          <li key={doc.id} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-subtle text-muted">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{doc.title}</p>
              <p className="text-xs text-muted">{doc.meta}</p>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
              <Download className="h-3.5 w-3.5" /> Baixar
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );

  const tabs: ClientTab[] = [
    { key: "resumo", label: "Resumo", content: resumo },
    { key: "metas", label: "Metas", content: <ClientGoalsCard clientId={id} clientType={config.clientType} /> },
    {
      key: "tarefas",
      label: openTaskCount > 0 ? `Tarefas · ${openTaskCount}` : "Tarefas",
      content: tarefas,
    },
    {
      key: "editorial",
      label: "Linha editorial",
      content: <LinhaEditorial data={editorial} clientId={id} />,
    },
    { key: "criativos", label: "Criativos de performance", content: criativos },
    { key: "violaunch", label: "VioLaunch", content: violaunch },
    { key: "vioday", label: "VioDay", content: <VioDay editorial={editorial} /> },
    { key: "agenda", label: "Agenda", content: agenda },
    { key: "documentos", label: "Documentos", content: documentos },
  ];

  return (
    <div className="space-y-4">
      <Link
        href="/gerencial/clientes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Hub de clientes
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
              {subtitleParts.length > 0 && (
                <p className="text-sm text-muted">{subtitleParts.join(" · ")}</p>
              )}
              {/* Tags de contexto: tipo de negócio, redes ativas, tempo de casa, saúde */}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    d.contractModel === "pontual"
                      ? "bg-violet-500/15 text-violet-500"
                      : "bg-brand-500/15 text-brand-600",
                  )}
                  title={d.contractModel === "pontual" ? "Contrato pontual" : "Contrato recorrente"}
                >
                  {d.contractModel === "pontual" ? "VioProjects" : "VioDelivery"}
                </span>
                {clientTypeLabel && (
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted">
                    {clientTypeLabel}
                  </span>
                )}
                {activeNetworks.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    {activeNetworks.map((n) => (
                      <PlatformIcon key={n} platform={n} className="h-3.5 w-3.5 text-muted" />
                    ))}
                  </span>
                )}
                <span className="text-[11px] text-muted">Cliente há {d.tenure}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    healthTone(c.healthScore),
                  )}
                  title="Health score (indicativo)"
                >
                  Saúde {c.healthScore}
                </span>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                {hasPhone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {d.phone}
                  </span>
                )}
                {hasEmail && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {d.email}
                  </span>
                )}
                {!hasPhone && !hasEmail && (
                  <span className="inline-flex items-center gap-1 text-brand-500">
                    <Plus className="h-3.5 w-3.5" /> Adicionar contato
                  </span>
                )}
              </p>
            </div>
          </div>
          {ops && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                ops.semaforo.state === "atrasado"
                  ? "bg-rose-500/15 text-rose-500"
                  : ops.semaforo.state === "aguardando"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-emerald-500/15 text-emerald-600",
              )}
            >
              {ops.semaforo.state === "atrasado"
                ? `Atrasado · ${ops.semaforo.late}`
                : ops.semaforo.state === "aguardando"
                  ? `Aguardando cliente · ${ops.semaforo.approval}`
                  : "Em dia"}
            </span>
          )}
        </div>

        {/* Responsáveis por função (HUB06) */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4">
          {ops &&
            RESPONSIBLE_ROLES.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <span
                  title={ops.responsibles[r.key]}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-subtle-strong text-[10px] font-bold text-ink"
                >
                  {initials(ops.responsibles[r.key])}
                </span>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{r.label}</p>
                  <p className="text-sm font-medium text-ink">{ops.responsibles[r.key]}</p>
                </div>
              </div>
            ))}
          <div className="ml-auto">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Squad</p>
            <p className="text-sm font-medium text-ink">{ops?.squadName ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 items-end gap-4 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Serviços" value={ops?.services.join(" · ") ?? ops?.plan ?? d.plan} />
          <Stat label="Entregáveis do mês" value={ops?.deliverables ?? "—"} />
          {ops ? (
            <EntregasBar done={ops.monthDone} approval={ops.monthApproval} total={ops.monthTotal} />
          ) : (
            <Stat label="Entregas do mês" value="—" />
          )}
          <Stat
            label="Próx. ciclo"
            value={ops ? `${ops.leNextMonth.status}${ops.leNextMonth.date ? ` · ${ops.leNextMonth.date}` : ""}` : "—"}
          />
          <Stat label="Próxima agenda" value={ops?.nextAgenda ?? "—"} />
        </div>

        <div className="mt-4">
          <ClientQuickActions clientId={id} whatsapp={config.whatsapp} driveUrl={d.driveFolderUrl} />
        </div>
      </Card>

      <ClientTabs tabs={tabs} defaultKey={tab} />
    </div>
  );
}
