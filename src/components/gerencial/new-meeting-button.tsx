"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function NewMeetingButton({
  clientId,
  clientName,
  defaultAttendee,
}: {
  clientId: string;
  clientName: string;
  defaultAttendee?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`Alinhamento — ${clientName}`);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [attendee, setAttendee] = useState(defaultAttendee && defaultAttendee !== "—" ? defaultAttendee : "");
  const [addMeet, setAddMeet] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !date || !time) {
      setError("Título, data e hora são obrigatórios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gerencial/agenda/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: title.trim(),
          date,
          time,
          durationMin: Number(duration) || 30,
          attendees: attendee.trim() ? [attendee.trim()] : [],
          addMeet,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Falha ao agendar.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Falha de rede ao agendar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-subtle"
      >
        <Plus className="h-3.5 w-3.5" /> Agendar novo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-ink">Agendar reunião</h2>
                <p className="text-xs text-muted">Cria no Google Calendar com link do Meet.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Título</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-1 block">
                  <span className="mb-1 block text-xs font-medium text-muted">Data</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-400" />
                </label>
                <label className="col-span-1 block">
                  <span className="mb-1 block text-xs font-medium text-muted">Hora</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-400" />
                </label>
                <label className="col-span-1 block">
                  <span className="mb-1 block text-xs font-medium text-muted">Min</span>
                  <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} className="h-10 w-full rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-400" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Convidado (e-mail do cliente)</span>
                <input value={attendee} onChange={(e) => setAttendee(e.target.value)} placeholder="contato@cliente.com.br" className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400" />
              </label>
              <button
                type="button"
                onClick={() => setAddMeet((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  addMeet ? "border-sky-400 bg-sky-500/10 text-sky-500" : "border-line text-muted hover:text-ink",
                )}
              >
                <Video className="h-3.5 w-3.5" /> {addMeet ? "Com Google Meet" : "Sem Meet"}
              </button>
              {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Cancelar</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                <Plus className="h-4 w-4" /> {saving ? "Agendando…" : "Agendar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
