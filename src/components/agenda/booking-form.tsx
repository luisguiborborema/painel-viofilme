"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { LogoHorizontal } from "@/components/brand/logo";
import type { AvailWindow } from "@/lib/data/agenda";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15";

// Fora do componente (evita a regra de pureza com Date).
function bookableDates(availability: AvailWindow[], daysAhead: number): string[] {
  const days = new Set(availability.map((w) => w.day));
  if (days.size === 0) return [];
  const out: string[] = [];
  const base = Date.now();
  const max = Math.min(60, Math.max(1, daysAhead));
  for (let i = 0; i < max; i++) {
    const iso = new Date(base + i * 86_400_000).toLocaleDateString("en-CA");
    const dow = new Date(`${iso}T12:00:00`).getDay();
    if (days.has(dow)) out.push(iso);
  }
  return out;
}
function dateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export type BookingLink = {
  slug: string;
  label: string;
  durationMin: number;
  daysAhead: number;
  availability: AvailWindow[];
  ownerName: string;
};

export function BookingForm({ link }: { link: BookingLink }) {
  const [dates] = useState(() => bookableDates(link.availability, link.daysAhead));
  const [date, setDate] = useState<string>(dates[0] ?? "");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [meet, setMeet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSlots(null);
    setTime("");
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/public/book?slug=${encodeURIComponent(link.slug)}&date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive) setSlots((j?.slots as string[]) ?? []);
      })
      .catch(() => {
        if (alive) setSlots([]);
      });
    return () => {
      alive = false;
    };
  }, [date, link.slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !time || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: link.slug, date, time, name, email, phone, website }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "falha");
      setDone(j.when ?? "");
      setMeet(j.meetLink ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
      // recarrega os slots (pode ter havido conflito)
      setSlots(null);
      fetch(`/api/public/book?slug=${encodeURIComponent(link.slug)}&date=${date}`)
        .then((r) => r.json())
        .then((j) => setSlots((j?.slots as string[]) ?? []))
        .catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="w-full bg-brand-700 text-white">
        <div className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-6">
          <LogoHorizontal className="h-6 text-white sm:h-7" />
          <h1 className="mt-4 text-xl font-bold sm:text-2xl">{link.label}</h1>
          <p className="mt-1 inline-flex items-center gap-2 text-sm text-white/70">
            <Clock className="h-4 w-4" /> {link.durationMin} min · com {link.ownerName}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-6">
        {done !== null ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h2 className="mt-4 text-xl font-bold text-ink">Reunião agendada!</h2>
            <p className="mt-1 text-sm text-muted">{done ? `${done} · ` : ""}Você e nossa equipe receberão a confirmação.</p>
            {meet && (
              <a
                href={meet}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <CalendarCheck className="h-4 w-4" /> Entrar no Google Meet
              </a>
            )}
          </div>
        ) : dates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
            Nenhum horário disponível no momento. Tente novamente mais tarde.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            {/* Datas */}
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Escolha o dia</p>
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    className={
                      "rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors " +
                      (d === date ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-ink hover:bg-subtle")
                    }
                  >
                    {dateLabel(d)}
                  </button>
                ))}
              </div>
            </div>

            {/* Horários */}
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Escolha o horário</p>
              {slots === null ? (
                <div className="flex py-4"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted">Sem horários livres neste dia — escolha outro.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(s)}
                      className={
                        "rounded-lg border px-2 py-2 text-sm font-medium transition-colors " +
                        (s === time ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-ink hover:bg-subtle")
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Contato */}
            {time && (
              <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
                <p className="text-sm font-semibold text-ink">Seus dados</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome *" className={inputCls} required />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={inputCls} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp" className={inputCls} />
                <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                {error && <p className="text-xs text-rose-500">Não foi possível agendar. Escolha outro horário e tente de novo.</p>}
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                  Confirmar agendamento
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      <footer className="px-4 py-6 text-center text-xs text-muted">
        Powered by <span className="font-semibold text-ink">Viofilme</span> · viofilme.com.br
      </footer>
    </div>
  );
}
