"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEETING_DEFAULTS, type MeetingSurveyConfig } from "@/lib/data/meeting-survey";

const RATING_LABEL = ["", "Muito ruim", "Ruim", "Ok", "Boa", "Excelente"];

/** Formulário público da pesquisa pós-reunião (estrelas 1–5). Sem login. */
export function MeetingSurveyForm({
  token,
  clientName,
  alreadyAnswered,
  config = MEETING_DEFAULTS,
}: {
  token: string;
  clientName: string;
  alreadyAnswered: boolean;
  config?: MeetingSurveyConfig;
}) {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyAnswered);
  const [error, setError] = useState<string | null>(null);
  const setAnswer = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  async function submit() {
    if (rating < 1) {
      setError("Escolha de 1 a 5 estrelas.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const extra = config.questions
        .map((q) => ({ id: q.id, label: q.label, value: (answers[q.id] ?? "").trim() }))
        .filter((a) => a.value);
      const res = await fetch("/api/public/meeting-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, comment, website, extra }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      setDone(true);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || rating;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-xl sm:p-10">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-brand-600">
          <Sparkles className="h-5 w-5" /> Viofilme
        </div>

        {done ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-ink">Obrigado pelo seu retorno!</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{config.thankYou}</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold leading-snug text-ink">{config.headline}</h1>
            {(config.intro || clientName) && (
              <p className="mt-1.5 text-sm text-muted">
                {config.intro || `Pesquisa pós-reunião${clientName ? ` · ${clientName}` : ""}`}
              </p>
            )}

            {/* Estrelas 1–5 */}
            <div className="mt-6 flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                  className="rounded-lg p-1 transition-transform hover:scale-110"
                >
                  <Star className={cn("h-9 w-9", n <= shown ? "fill-amber-400 text-amber-400" : "text-line")} />
                </button>
              ))}
              {shown > 0 && <span className="ml-2 text-sm font-medium text-muted">{RATING_LABEL[shown]}</span>}
            </div>

            <label className="mt-6 block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
                {config.commentLabel} <span className="font-normal text-muted">(opcional)</span>
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Como foi a reunião? O que podemos melhorar?"
                className="w-full resize-y rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
              />
            </label>

            {config.questions.map((q) => (
              <div key={q.id} className="mt-5">
                <span className="mb-1.5 block text-sm font-medium text-ink">{q.label}</span>
                {q.type === "choice" && q.options.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
                          answers[q.id] === opt
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-line bg-surface text-ink hover:border-brand-400 hover:bg-subtle",
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    rows={2}
                    className="w-full resize-y rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
                  />
                )}
              </div>
            ))}

            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

            {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}

            <button
              onClick={submit}
              disabled={busy}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar avaliação
            </button>
            <p className="mt-3 text-center text-[11px] text-muted">Leva menos de 1 minuto</p>
          </>
        )}
      </div>
    </main>
  );
}
