"use client";

import { useState } from "react";
import { CalendarClock, Loader2, Video, X } from "lucide-react";
import type { CrmLead } from "@/lib/data/crm";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

export function ScheduleModal({
  lead,
  onClose,
  onScheduled,
}: {
  lead: CrmLead;
  onClose: () => void;
  onScheduled: (meetLink?: string) => void;
}) {
  const [summary, setSummary] = useState(`Reunião — ${lead.name}`);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [duration, setDuration] = useState("30");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!date || !time || busy) return;
    setBusy(true);
    setError(null);
    try {
      const startIso = new Date(`${date}T${time}`).toISOString();
      const res = await fetch("/api/crm/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          summary,
          startIso,
          durationMin: Number(duration),
          description,
          attendees: lead.contactEmail ? [lead.contactEmail] : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      onScheduled(json.event?.hangoutLink);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Agendar reunião</h2>
              <p className="text-xs text-muted">
                Cria o evento no Google Agenda com link do Meet.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Título</span>
            <input value={summary} onChange={(e) => setSummary(e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-1 block">
              <span className="mb-1 block text-xs font-medium text-muted">Data</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </label>
            <label className="col-span-1 block">
              <span className="mb-1 block text-xs font-medium text-muted">Hora</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </label>
            <label className="col-span-1 block">
              <span className="mb-1 block text-xs font-medium text-muted">Duração</span>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls}>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hora</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Descrição (opcional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputCls + " resize-none"}
            />
          </label>
          {lead.contactEmail && (
            <p className="text-xs text-muted">
              Convite enviado para <strong className="text-ink">{lead.contactEmail}</strong>.
            </p>
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line p-4">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy || !date}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            Agendar com Meet
          </button>
        </div>
      </div>
    </div>
  );
}
