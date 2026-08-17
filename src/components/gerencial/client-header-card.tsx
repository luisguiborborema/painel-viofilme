import { Mail, Phone, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RESPONSIBLE_ROLES } from "@/lib/data/operacao";
import { PlatformIcon } from "@/components/dashboard/platform";
import { ClientQuickActions } from "@/components/gerencial/client-quick-actions";
import { ClientManageActions } from "@/components/gerencial/client-manage-actions";
import { ClientLogo } from "@/components/gerencial/client-logo";
import { cn } from "@/lib/utils";
import type {
  ClientDetail,
  ClientOps,
  ClientPortal,
} from "@/lib/data/client-detail";
import { buildClientConfig } from "@/lib/data/client-detail";

function initials(name: string) {
  return name
    .replace(/[^A-Za-zÀ-ú ]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// Uma função pode ter mais de um responsável (texto separado por vírgula).
function splitPeople(s: string): string[] {
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("text-sm font-semibold text-ink", valueClass)}>{value}</p>
    </div>
  );
}

// HUB06.1 — cor da "Próx. ciclo" na head conforme o prazo aperta.
const LE_HEAD_TONE: Record<string, string> = {
  ok: "text-emerald-600",
  neutral: "text-ink",
  warn: "text-amber-600",
  late: "text-rose-500",
};

const CLIENT_TYPE_LABEL: Record<string, string> = {
  lead_gen: "Geração de leads",
  ecommerce: "E-commerce",
  local_business: "Negócio local",
};

function healthTone(score: number) {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-600";
  if (score >= 55) return "bg-amber-500/15 text-amber-600";
  return "bg-rose-500/15 text-rose-500";
}

/** Barra de entregas do mês: verde = entregue, âmbar = aguardando cliente. */
function EntregasBar({
  done,
  approval,
  total,
}: {
  done: number;
  approval: number;
  total: number;
}) {
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

/** Cabeçalho do cliente (compartilhado por todas as abas via layout). */
export function ClientHeaderCard({
  id,
  d,
  ops,
  portal,
  avatarByName = {},
}: {
  id: string;
  d: ClientDetail;
  ops: ClientOps;
  portal: ClientPortal;
  avatarByName?: Record<string, string>;
}) {
  const c = d.client;
  const config = buildClientConfig(portal, d);
  const subtitleParts = [c.segment, c.city, d.contactName, d.contactRole].filter(
    (x) => x && x !== "—",
  );
  const hasPhone = d.phone !== "—";
  const hasEmail = d.email !== "—";
  const activeNetworks = config.activeNetworks;
  const clientTypeLabel = CLIENT_TYPE_LABEL[config.clientType];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ClientLogo clientId={id} name={c.name} logoUrl={c.logoUrl} />
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
          RESPONSIBLE_ROLES.filter((r) => ops.responsibles[r.key]?.trim()).map((r) => {
            const people = splitPeople(ops.responsibles[r.key]);
            return (
              <div key={r.key} className="flex items-center gap-2">
                <span className="flex -space-x-1.5">
                  {people.slice(0, 3).map((p) =>
                    avatarByName[p] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p}
                        src={avatarByName[p]}
                        alt={p}
                        title={p}
                        className="h-7 w-7 rounded-full object-cover ring-2 ring-surface"
                      />
                    ) : (
                      <span
                        key={p}
                        title={p}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-subtle-strong text-[10px] font-bold text-ink ring-2 ring-surface"
                      >
                        {initials(p)}
                      </span>
                    ),
                  )}
                </span>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{r.label}</p>
                  <p className="text-sm font-medium text-ink">{people.join(", ")}</p>
                </div>
              </div>
            );
          })}
        <div className="ml-auto">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Squad</p>
          <p className="text-sm font-medium text-ink">{ops?.squadName ?? "—"}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 items-end gap-4 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Serviços" value={ops && ops.services.length ? ops.services.join(" · ") : "—"} />
        <Stat label="Entregáveis do mês" value={ops?.deliverables ?? "—"} />
        {ops ? (
          <EntregasBar done={ops.monthDone} approval={ops.monthApproval} total={ops.monthTotal} />
        ) : (
          <Stat label="Entregas do mês" value="—" />
        )}
        <Stat
          label="Próx. ciclo"
          value={ops ? `${ops.leNextMonth.status}${ops.leNextMonth.date ? ` · ${ops.leNextMonth.date}` : ""}` : "—"}
          valueClass={ops ? LE_HEAD_TONE[ops.leNextMonth.tone] : undefined}
        />
        <Stat label="Próxima agenda" value={d.nextMeeting ? `${d.nextMeeting.whenLabel} · ${d.nextMeeting.title}` : "Agenda livre"} />
      </div>

      <div className="mt-4" data-tour="client-quickactions">
        <ClientQuickActions clientId={id} whatsapp={config.whatsapp} driveUrl={d.driveFolderUrl} />
      </div>

      {/* Gestão interna da conta: briefing pro squad, responsáveis, serviços/entregáveis */}
      <div className="mt-2 border-t border-line pt-3" data-tour="client-manage">
        <ClientManageActions
          clientId={id}
          clientName={c.name}
          brief={d.briefing}
          services={ops?.services ?? []}
          deliverablesText={ops?.deliverables ?? ""}
          responsibles={ops?.responsibles ?? {}}
          squadName={ops?.squadName ?? ""}
          squadId={ops?.squadId ?? ""}
          segment={c.segment}
          city={c.city}
          contactName={d.contactName}
          contactRole={d.contactRole}
          phone={d.phone}
          email={d.email}
          contractModel={d.contractModel}
        />
      </div>
    </Card>
  );
}
