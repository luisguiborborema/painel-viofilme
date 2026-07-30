"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { LogoHorizontal } from "@/components/brand/logo";

export type SignDoc = {
  token: string;
  title: string;
  content?: string;
  kind: string;
  value?: number | null;
  status: string;
  signedByName?: string | null;
  signedAt?: string | null;
  expired: boolean;
};

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15";

function fmtBRL(v?: number | null) {
  return v == null ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function SignDocument({ doc }: { doc: SignDoc }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadySigned = doc.status === "signed" || done;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !agree || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: doc.token, name, website }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "falha");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="w-full bg-brand-700 text-white">
        <div className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-6">
          <LogoHorizontal className="h-6 text-white sm:h-7" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-6">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{doc.kind}</p>
        <h1 className="text-2xl font-bold text-ink">{doc.title}</h1>
        {fmtBRL(doc.value) && <p className="mt-1 text-lg font-semibold text-brand-600">{fmtBRL(doc.value)}</p>}

        <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-ink">
          {doc.content?.trim() || "Documento sem conteúdo textual — confira com a equipe da Viofilme."}
        </div>

        <div className="mt-6">
          {alreadySigned ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="mt-2 text-base font-bold text-ink">Documento assinado!</p>
              <p className="mt-0.5 text-sm text-muted">
                {doc.signedByName ? `Por ${doc.signedByName}` : "Assinatura registrada"}
                {doc.signedAt ? ` · ${fmtDate(doc.signedAt)}` : ""}
              </p>
            </div>
          ) : doc.expired ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center text-sm text-amber-700">
              Este documento está expirado. Solicite um novo link à equipe.
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5">
              <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <PenLine className="h-4 w-4 text-brand-500" /> Assinar digitalmente
              </p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo *" className={inputCls} required />
              <label className="mt-3 flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/30" />
                <span>Li e concordo com os termos deste documento. Minha assinatura eletrônica, com data e IP, tem validade legal.</span>
              </label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              {error && <p className="mt-2 text-xs text-rose-500">Não foi possível assinar. Tente de novo.</p>}
              <button
                type="submit"
                disabled={busy || !name.trim() || !agree}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                Aceitar e assinar
              </button>
            </form>
          )}
        </div>
      </div>

      <footer className="px-4 py-6 text-center text-xs text-muted">
        Powered by <span className="font-semibold text-ink">Viofilme</span> · viofilme.com.br
      </footer>
    </div>
  );
}
