import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RESPONSIBLE_ROLES, TASK_STAGES } from "@/lib/data/operacao";
import { NpsCard } from "@/components/gerencial/nps-card";
import { ClientProfileCard } from "@/components/gerencial/client-profile-card";
import { ClientConfigCard } from "@/components/gerencial/client-config-card";
import { ClientFormsCard } from "@/components/gerencial/client-forms-card";
import { ClientBillingCard } from "@/components/gerencial/client-billing-card";
import { EditOperationButton } from "@/components/gerencial/edit-operation-button";
import { getClientFormSubmissions } from "@/lib/data/queries";
import { isAsaasApiConfigured } from "@/lib/asaas/client";
import { cn } from "@/lib/utils";
import {
  getClientDetailCached,
  getClientOpsCached,
  getClientPortalCached,
  getClientTasksCached,
  buildClientConfig,
} from "@/lib/data/client-detail";

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium text-muted">{label}</dt>
      <dd className="text-right text-ink/90">{value}</dd>
    </div>
  );
}

const STAGE_TONE: Record<string, string> = {
  todo: "text-muted",
  doing: "text-sky-500",
  review: "text-violet-500",
  approval: "text-amber-500",
  done: "text-emerald-500",
};

export default async function ResumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getClientDetailCached(id);
  if (!d) notFound();
  const c = d.client;
  const [ops, portal, clientTasks, formSubs] = await Promise.all([
    getClientOpsCached(id),
    getClientPortalCached(id),
    getClientTasksCached(c.name),
    getClientFormSubmissions(id),
  ]);
  const config = buildClientConfig(portal, d);

  const lateTasks = clientTasks.filter((t) => t.late);
  const approvalTasks = clientTasks.filter((t) => t.stage === "approval");

  return (
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
                        <Link href={`/gerencial/clientes/${id}/tarefas`} className="inline-flex items-center gap-0.5 rounded-md bg-rose-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-600">
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
                        <Link href={`/gerencial/clientes/${id}/tarefas`} className="inline-flex items-center gap-0.5 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-600">
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
          <div className="mb-1 flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Contrato &amp; referência</h2>
            <div className="flex shrink-0 items-center gap-1.5">
              <EditOperationButton clientId={id} target="resp" className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink hover:bg-subtle">
                Responsáveis
              </EditOperationButton>
              <EditOperationButton clientId={id} target="ops" className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink hover:bg-subtle">
                Serviços &amp; entregáveis
              </EditOperationButton>
            </div>
          </div>
          <p className="mb-3 text-xs text-muted">
            Serviços, entregáveis e responsáveis da conta — o status do mês fica no topo.
          </p>
          <dl className="space-y-2.5 text-sm">
            <Row2 label="Serviços" value={ops && ops.services.length ? ops.services.join(" · ") : "—"} />
            <Row2 label="Entregáveis do mês" value={ops?.deliverables ?? "—"} />
            {ops && RESPONSIBLE_ROLES.filter((r) => ops.responsibles[r.key]?.trim()).map((r) => (
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

      {formSubs.length > 0 && <ClientFormsCard subs={formSubs} />}

      {isAsaasApiConfigured() && <ClientBillingCard clientId={id} />}

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
}
