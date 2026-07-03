"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

type Cal = { id: string; summary: string; primary: boolean; color?: string };

export function GoogleCalendarPicker() {
  const [cals, setCals] = useState<Cal[]>([]);
  const [writeId, setWriteId] = useState("primary");
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/google/calendars", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list: Cal[] = j.calendars ?? [];
        setCals(list);
        setWriteId(j.writeCalendarId ?? "primary");
        setReadIds(
          j.readCalendarIds?.length
            ? j.readCalendarIds
            : list.map((c) => c.id), // por padrão, mostra todos
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleRead(id: string) {
    setSaved(false);
    setReadIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/google/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writeCalendarId: writeId, readCalendarIds: readIds }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando calendários…
      </div>
    );
  }
  if (cals.length === 0) {
    return (
      <p className="px-1 py-2 text-xs text-muted">
        Nenhum calendário com permissão de escrita encontrado nesta conta.
      </p>
    );
  }

  return (
    <div className="space-y-4 border-t border-line pt-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Criar eventos em
        </label>
        <select
          value={writeId}
          onChange={(e) => {
            setWriteId(e.target.value);
            setSaved(false);
          }}
          className="w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        >
          {cals.map((c) => (
            <option key={c.id} value={c.id}>
              {c.summary}
              {c.primary ? " (principal)" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          Reuniões agendadas no CRM e solicitações do cliente entram aqui.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Mostrar na Agenda</p>
        <div className="flex flex-wrap gap-2">
          {cals.map((c) => {
            const on = readIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleRead(c.id)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (on
                    ? "border-brand-400 bg-brand-50 text-brand-700"
                    : "border-line text-muted hover:bg-subtle")
                }
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.color ?? "#9ca3af" }}
                />
                {c.summary}
                {on && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar calendários
        </button>
        {saved && <span className="text-xs text-emerald-600">Salvo!</span>}
      </div>
    </div>
  );
}
