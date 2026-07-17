"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Inbox, Video, X, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { NewMeetingButton } from "./new-meeting-button";
import type { CSClientDetail, CSTimelineEvent } from "@/lib/data/types";

type Meeting = CSClientDetail["agendaMeetings"][number];
type Request = CSClientDetail["agendaRequests"][number];

function meetingTag(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("kickoff") || t.includes("kick-off")) return "Kickoff";
  if (t.includes("violaunch") || t.includes("onboarding")) return "VioLaunch";
  if (t.includes("media day") || t.includes("mediaday") || t.includes("vioday")) return "Media Day";
  if (t.includes("resultado") || t.includes("mensal") || t.includes("alinhamento")) return "Alinhamento mensal";
  return "Reunião";
}

const TAG_CHIP: Record<string, string> = {
  Kickoff: "bg-brand-500/15 text-brand-600",
  VioLaunch: "bg-violet-500/15 text-violet-500",
  "Media Day": "bg-amber-500/15 text-amber-600",
  "Alinhamento mensal": "bg-sky-500/15 text-sky-500",
  Reunião: "bg-subtle text-muted",
};

const emailName = (e: string) => e.split("@")[0].replace(/[._-]+/g, " ");

/** Pauta (antes) / Ata (depois) inline por reunião. */
function NotesEditor({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const isAta = meeting.isPast;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState((isAta ? meeting.nextSteps : meeting.agenda) ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/gerencial/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-notes",
          meetingId: meeting.id,
          ...(isAta ? { nextSteps: text } : { agenda: text }),
        }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const label = isAta ? "Registrar ata" : "Adicionar pauta";
  const current = isAta ? meeting.nextSteps : meeting.agenda;

  return (
    <div className="mt-2">
      {current && !open && (
        <div className="mb-1 rounded-lg bg-subtle px-2.5 py-1.5 text-[11px] text-ink/90">
          <span className="font-semibold text-muted">{isAta ? "Ata: " : "Pauta: "}</span>
          {current}
        </div>
      )}
      {open ? (
        <div className="space-y-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={isAta ? "Decisões e próximos passos…" : "Tópicos em bullets…"}
            className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
          />
          <div className="flex gap-1.5">
            <button onClick={save} disabled={saving} className="rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-subtle">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600">
          <FileText className="h-3 w-3" /> {current ? "Editar" : label}
        </button>
      )}
    </div>
  );
}

function MeetingCard({ m }: { m: Meeting }) {
  const tag = meetingTag(m.title);
  return (
    <div className={cn("rounded-xl border p-3.5", m.isPast ? "border-line bg-subtle/40" : "border-line bg-subtle")}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-xs font-semibold", m.isPast ? "text-muted" : "text-emerald-500")}>
          {m.whenLabel}{m.isPast && " · realizada"}
        </p>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", TAG_CHIP[tag] ?? TAG_CHIP.Reunião)}>{tag}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-ink">{m.title}</p>
      {m.participants.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          {m.participants.slice(0, 5).map((p) => (
            <span key={p} title={p}><Avatar name={emailName(p)} size={22} /></span>
          ))}
        </div>
      )}
      {!m.isPast && (
        <div className="mt-2.5">
          {m.joinUrl ? (
            <a href={m.joinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-500 hover:bg-sky-500/20">
              <Video className="h-3.5 w-3.5" /> Entrar no Meet
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-subtle px-2.5 py-1.5 text-xs font-medium text-muted">
              <Video className="h-3.5 w-3.5" /> Sem link de Meet
            </span>
          )}
        </div>
      )}
      <NotesEditor meeting={m} />
    </div>
  );
}

function RequestCard({ r, clientId, defaultAttendee }: { r: Request; clientId: string; defaultAttendee?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(r.subject);
  const [date, setDate] = useState(r.preferredIso ? r.preferredIso.slice(0, 10) : "");
  const [time, setTime] = useState(r.preferredIso ? new Date(r.preferredIso).toISOString().slice(11, 16) : "10:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!date || !time) {
      setError("Defina data e hora.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const startIso = new Date(`${date}T${time}:00-03:00`).toISOString();
      const res = await fetch("/api/gerencial/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve-request",
          requestId: r.id,
          clientId,
          title: title.trim(),
          startIso,
          attendees: defaultAttendee && defaultAttendee !== "—" ? [defaultAttendee] : [],
          addMeet: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Falha ao aprovar.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de rede.");
    } finally {
      setSaving(false);
    }
  }

  async function decline() {
    setSaving(true);
    try {
      await fetch("/api/gerencial/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline-request", requestId: r.id }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{r.subject}</p>
        {r.urgency === "urgent" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
            <Zap className="h-3 w-3" /> Urgente
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted">Sugestão: {r.whenLabel}</p>
      {r.notes && <p className="mt-1 text-xs text-ink/80">{r.notes}</p>}

      {open ? (
        <div className="mt-2 space-y-1.5 border-t border-amber-300/40 pt-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-400" />
          <div className="flex gap-1.5">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 flex-1 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-400" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-8 w-24 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-400" />
          </div>
          {error && <p className="text-[11px] font-medium text-rose-500">{error}</p>}
          <div className="flex gap-1.5">
            <button onClick={approve} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              <Check className="h-3 w-3" /> {saving ? "Agendando…" : "Confirmar e criar Meet"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-subtle">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-1.5">
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-700">
            <Check className="h-3 w-3" /> Aprovar
          </button>
          <button onClick={decline} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-subtle disabled:opacity-60">
            <X className="h-3 w-3" /> Recusar
          </button>
        </div>
      )}
    </div>
  );
}

export function AgendaTab({
  clientId,
  clientName,
  defaultAttendee,
  meetings,
  requests,
  interactions,
}: {
  clientId: string;
  clientName: string;
  defaultAttendee?: string | null;
  meetings: Meeting[];
  requests: Request[];
  interactions: CSTimelineEvent[];
}) {
  const upcoming = meetings.filter((m) => !m.isPast);
  const past = meetings.filter((m) => m.isPast);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Solicitações do Portal */}
        {requests.length > 0 && (
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Inbox className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-ink">Solicitações pendentes</h2>
              <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-600">{requests.length}</span>
            </div>
            <div className="space-y-2">
              {requests.map((r) => (
                <RequestCard key={r.id} r={r} clientId={clientId} defaultAttendee={defaultAttendee} />
              ))}
            </div>
          </Card>
        )}

        {/* Próximas reuniões */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Próximas reuniões</h2>
            <NewMeetingButton clientId={clientId} clientName={clientName} defaultAttendee={defaultAttendee} />
          </div>
          {upcoming.length > 0 ? (
            <div className="space-y-2.5">
              {upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4 text-center">
              <p className="text-sm text-muted">A agenda está livre. Agende o próximo touchpoint com o cliente.</p>
            </div>
          )}
        </Card>

        {/* Reuniões recentes (registrar ata) */}
        {past.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Reuniões recentes</h2>
            <div className="space-y-2.5">
              {past.map((m) => <MeetingCard key={m.id} m={m} />)}
            </div>
          </Card>
        )}
      </div>

      {/* Histórico de interações */}
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
          <p className="text-sm text-muted">Sem reuniões ou pesquisas registradas ainda.</p>
        )}
      </Card>
    </div>
  );
}
