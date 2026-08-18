"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

function scoreTone(n: number, active: boolean) {
  if (!active) return "border-line bg-surface text-ink hover:border-brand-400 hover:bg-subtle";
  if (n <= 6) return "border-rose-500 bg-rose-500 text-white";
  if (n <= 8) return "border-amber-500 bg-amber-500 text-white";
  return "border-emerald-500 bg-emerald-500 text-white";
}

/** Formulário público de NPS (estilo Tally). Sem login. */
export function NpsForm({
  token,
  clientName,
  alreadyAnswered,
}: {
  token: string;
  clientName: string;
  alreadyAnswered: boolean;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyAnswered);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (score === null) {
      setError("Escolha uma nota de 0 a 10.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, score, comment, website }),
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
            <h1 className="mt-4 text-xl font-bold text-ink">Obrigado pelo seu feedback! 💚</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Sua opinião nos ajuda a melhorar cada vez mais o trabalho{clientName ? ` com a ${clientName}` : ""}.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold leading-snug text-ink">
              De 0 a 10, o quanto você recomendaria a <span className="text-brand-600">Viofilme</span> para um amigo ou colega?
            </h1>
            {clientName && (
              <p className="mt-1.5 text-sm text-muted">Pesquisa de satisfação · {clientName}</p>
            )}

            {/* Escala 0–10 */}
            <div className="mt-6 grid grid-cols-6 gap-2 sm:grid-cols-11">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  onClick={() => setScore(n)}
                  className={cn(
                    "flex h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-colors",
                    scoreTone(n, score === n),
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted">
              <span>Nada provável</span>
              <span>Muito provável</span>
            </div>

            <label className="mt-6 block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
                Quer deixar um comentário? <span className="font-normal text-muted">(opcional)</span>
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="O que motivou sua nota? O que podemos melhorar?"
                className="w-full resize-y rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
              />
            </label>

            {/* honeypot */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden
            />

            {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}

            <button
              onClick={submit}
              disabled={busy}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar resposta
            </button>
            <p className="mt-3 text-center text-[11px] text-muted">Leva menos de 1 minuto · resposta anônima para o time</p>
          </>
        )}
      </div>
    </main>
  );
}
