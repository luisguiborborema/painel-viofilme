"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarClock, Images, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import {
  REQUEST_STATUS,
  type ClientRequests,
  type ContentRequest,
  type MeetingRequest,
  type RequestStatus,
} from "@/lib/data/requests";

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  scheduled: "bg-blue-500/15 text-blue-600",
  in_progress: "bg-violet-500/15 text-violet-600",
  done: "bg-emerald-500/15 text-emerald-600",
  declined: "bg-rose-500/15 text-rose-600",
};

const FMT_LABEL: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  carousel: "Carrossel",
  reel: "Reels",
  story: "Story",
};

export function RequestsBoard({ requests }: { requests: ClientRequests }) {
  const [tab, setTab] = useState<"meeting" | "content">(
    requests.meetings.length >= requests.content.length ? "meeting" : "content",
  );

  const pendMeet = requests.meetings.filter((r) => r.status === "pending").length;
  const pendCont = requests.content.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-xl border border-line bg-canvas p-1">
        <Tab
          active={tab === "meeting"}
          onClick={() => setTab("meeting")}
          icon={CalendarClock}
          label="Reuniões"
          badge={pendMeet}
        />
        <Tab
          active={tab === "content"}
          onClick={() => setTab("content")}
          icon={Images}
          label="Conteúdo"
          badge={pendCont}
        />
      </div>

      {tab === "meeting" ? (
        requests.meetings.length === 0 ? (
          <Empty>Nenhuma solicitação de reunião.</Empty>
        ) : (
          <div className="space-y-2">
            {requests.meetings.map((r) => (
              <MeetingCard key={r.id} req={r} />
            ))}
          </div>
        )
      ) : requests.content.length === 0 ? (
        <Empty>Nenhuma solicitação de conteúdo.</Empty>
      ) : (
        <div className="space-y-2">
          {requests.content.map((r) => (
            <ContentCard key={r.id} req={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ req }: { req: MeetingRequest }) {
  return (
    <Card
      kind="meeting"
      id={req.id}
      status={req.status}
      urgent={req.urgency === "urgent"}
      title={req.subject}
      client={req.clientName}
      when={req.createdAt}
    >
      {req.notes && <p className="whitespace-pre-wrap text-sm text-ink">{req.notes}</p>}
    </Card>
  );
}

function ContentCard({ req }: { req: ContentRequest }) {
  return (
    <Card
      kind="content"
      id={req.id}
      status={req.status}
      urgent={req.urgency === "urgent"}
      title={req.subject}
      client={req.clientName}
      when={req.createdAt}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full bg-subtle px-2 py-0.5 font-medium text-muted">
          {FMT_LABEL[req.format] ?? req.format}
        </span>
        {req.networks.map((n) => (
          <span key={n} className="rounded-full bg-subtle px-2 py-0.5 font-medium text-muted">
            {n}
          </span>
        ))}
        {(req.desiredDate || req.desiredTime) && (
          <span className="text-muted">
            Deseja: {req.desiredDate ?? ""} {req.desiredTime ?? ""}
          </span>
        )}
      </div>
      {req.description && (
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{req.description}</p>
      )}
      {req.guideline && <p className="mt-1 text-xs text-muted">Direcionamento: {req.guideline}</p>}
      {req.referenceUrls.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {req.referenceUrls.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-600 hover:underline"
            >
              Referência {i + 1}
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

function Card({
  kind,
  id,
  status,
  urgent,
  title,
  client,
  when,
  children,
}: {
  kind: "meeting" | "content";
  id: string;
  status: RequestStatus;
  urgent: boolean;
  title: string;
  client?: string;
  when: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [value, setValue] = useState<RequestStatus>(status);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);

  async function change(next: RequestStatus) {
    setValue(next);
    setBusy(true);
    await fetch("/api/gerencial/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, status: next }),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  /** Cria um negócio no CRM a partir da solicitação e leva o gestor até ele. */
  async function convertToDeal() {
    if (converting) return;
    setConverting(true);
    const res = await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: title,
        contactName: client || "Cliente do portal",
        source: kind === "meeting" ? "Portal — reunião" : "Portal — conteúdo",
      }),
    })
      .then((r) => r.json())
      .catch(() => null);

    if (res?.id) {
      await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          leadId: res.id,
          title: `Solicitação do portal: ${title}`,
        }),
      }).catch(() => {});
      await fetch("/api/gerencial/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, status: "in_progress" }),
      }).catch(() => {});
      router.push(`/gerencial/crm/${res.id}`);
      return;
    }
    setConverting(false);
    if (res?.persisted === false) {
      alert("Conexão com o CRM indisponível no momento (modo demonstração).");
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            {title}
            {urgent && (
              <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                URGENTE
              </span>
            )}
          </p>
          <p className="text-xs text-muted">
            {client ?? "Cliente"} · {dayMonth(when)} {clockLabel(when)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              STATUS_STYLE[value],
            )}
          >
            {REQUEST_STATUS.find((s) => s.key === value)?.label}
          </span>
          <select
            value={value}
            disabled={busy}
            onChange={(e) => change(e.target.value as RequestStatus)}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400 disabled:opacity-60"
          >
            {REQUEST_STATUS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {children}
      <div className="mt-3 flex items-center justify-end border-t border-line/60 pt-3">
        <button
          onClick={convertToDeal}
          disabled={converting || value === "done" || value === "declined"}
          title="Cria um negócio no CRM a partir desta solicitação"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          {converting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Briefcase className="h-3.5 w-3.5" />
          )}
          Gerar negócio no CRM
        </button>
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof CalendarClock;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            active ? "bg-white/20 text-white" : "bg-rose-500 text-white",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <Inbox className="h-6 w-6 text-muted/60" />
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}
