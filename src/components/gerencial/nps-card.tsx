"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Smile } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  clientId: string;
  score: number | null;
  classification: string;
  lastSurvey: string;
  quote: string;
};

function toneOf(classification: string) {
  if (classification === "Promotor") return "text-emerald-500";
  if (classification === "Neutro") return "text-amber-500";
  if (classification === "Detrator") return "text-rose-500";
  return "text-muted";
}

function dotBg(n: number) {
  return n <= 6 ? "bg-rose-500" : n <= 8 ? "bg-amber-500" : "bg-emerald-500";
}

export function NpsCard({ clientId, score, classification, lastSurvey, quote }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(score === null);
  const [pick, setPick] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [respondent, setRespondent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pick === null) {
      setError("Selecione a nota (0–10).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gerencial/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          score: pick,
          comment: comment.trim() || undefined,
          respondent: respondent.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Falha ao registrar.");
        return;
      }
      setPick(null);
      setComment("");
      setRespondent("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Falha de rede ao registrar.");
    } finally {
      setSaving(false);
    }
  }

  const measured = score !== null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smile className="h-4 w-4 text-brand-300" />
          <h2 className="text-sm font-semibold text-ink">NPS — satisfação</h2>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-subtle"
        >
          {open ? "Fechar" : "Registrar pesquisa"}
        </button>
      </div>

      {measured ? (
        <div className="flex items-start gap-4">
          <div className="text-center">
            <span
              className={cn(
                "inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white",
                dotBg(score),
              )}
            >
              {score}
            </span>
          </div>
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold", toneOf(classification))}>{classification}</p>
            <p className="text-xs text-muted">Última pesquisa · {lastSurvey}</p>
            <p className="mt-1.5 text-sm text-ink/90">{quote}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-subtle px-3 py-3 text-sm text-muted">
          NPS ainda não coletado para este cliente. Registre a primeira pesquisa.
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">
              Nota (0–10) — o quanto recomendaria a Viofilme?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  onClick={() => setPick(n)}
                  className={cn(
                    "h-9 w-9 rounded-lg border text-sm font-semibold transition-colors",
                    pick === n
                      ? cn("border-transparent text-white", dotBg(n))
                      : "border-line text-ink hover:bg-subtle",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <input
            value={respondent}
            onChange={(e) => setRespondent(e.target.value)}
            placeholder="Quem respondeu (opcional)"
            className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
          />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentário do cliente (opcional)"
            rows={2}
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          />
          {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Registrando…" : "Registrar NPS"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
