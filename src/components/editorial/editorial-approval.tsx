"use client";

import { useState } from "react";
import { Check, ImageIcon, Loader2, MessageSquarePlus, ThumbsUp } from "lucide-react";
import { LogoHorizontal } from "@/components/brand/logo";

export type ApprovalPost = {
  id: string;
  n: number;
  title: string;
  format: string;
  pillar: string;
  description: string;
  legenda: string;
  date: string;
  weekday: string;
  image?: string;
  status: "pending" | "approved" | "changes";
  feedback: string;
};

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15";

export function EditorialApproval({
  token,
  clientName,
  month,
  objetivo,
  narrativa,
  posts,
}: {
  token: string;
  clientName: string;
  month: string;
  objetivo: string;
  narrativa: string;
  posts: ApprovalPost[];
}) {
  const [items, setItems] = useState(posts);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [website, setWebsite] = useState("");

  const reviewed = items.filter((p) => p.status !== "pending").length;

  async function send(post: ApprovalPost, decision: "approved" | "changes", comment: string) {
    setBusy(post.id);
    try {
      const res = await fetch("/api/public/le-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, postId: post.id, decision, comment, website }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, status: decision, feedback: decision === "changes" ? comment : "" }
              : p,
          ),
        );
        setOpenId(null);
        setText("");
      }
    } catch {
      /* mantém estado — o usuário pode tentar de novo */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="w-full bg-brand-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
          <LogoHorizontal className="h-6 text-white sm:h-7" />
          <h1 className="mt-4 text-xl font-bold sm:text-2xl">Linha editorial — {month}</h1>
          <p className="mt-1 text-sm text-white/70">
            {clientName} · aprove os posts ou peça ajustes
          </p>
          {(objetivo || narrativa) && (
            <div className="mt-3 space-y-1 rounded-xl bg-white/10 p-3 text-sm text-white/90">
              {objetivo && objetivo !== "—" && (
                <p>
                  <span className="font-semibold">Objetivo:</span> {objetivo}
                </p>
              )}
              {narrativa && narrativa !== "—" && (
                <p>
                  <span className="font-semibold">Narrativa:</span> {narrativa}
                </p>
              )}
            </div>
          )}
          {items.length > 0 && (
            <p className="mt-3 text-xs font-medium text-lime">
              {reviewed}/{items.length} revisados
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-5 py-8 sm:px-6">
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden
        />

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
            Nenhum post para revisar ainda. Assim que a equipe montar a linha editorial, ela
            aparecerá aqui.
          </p>
        ) : (
          items.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex flex-col sm:flex-row">
                <div className="flex aspect-square w-full shrink-0 items-center justify-center bg-subtle sm:w-48">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span className="font-bold text-ink">#{String(p.n).padStart(2, "0")}</span>
                    <span className="rounded-full bg-subtle px-2 py-0.5 font-medium">{p.format}</span>
                    {p.pillar && (
                      <span className="rounded-full bg-subtle px-2 py-0.5 font-medium">{p.pillar}</span>
                    )}
                    {p.date && (
                      <span>
                        {p.date}
                        {p.weekday && p.weekday !== "—" ? ` (${p.weekday})` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-semibold text-ink">{p.title}</p>
                  {p.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">{p.description}</p>
                  )}
                  {p.legenda && (
                    <div className="mt-2 rounded-lg bg-subtle px-3 py-2 text-sm text-ink/80">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Legenda
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap">{p.legenda}</p>
                    </div>
                  )}

                  {p.status === "approved" && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-600">
                      <Check className="h-4 w-4" /> Aprovado
                    </p>
                  )}
                  {p.status === "changes" && (
                    <div className="mt-3">
                      <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-600">
                        <MessageSquarePlus className="h-4 w-4" /> Ajuste solicitado
                      </p>
                      {p.feedback && <p className="mt-1 text-sm text-muted">“{p.feedback}”</p>}
                    </div>
                  )}

                  {openId !== p.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.status !== "approved" && (
                        <button
                          disabled={busy === p.id}
                          onClick={() => send(p, "approved", "")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {busy === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ThumbsUp className="h-4 w-4" />
                          )}{" "}
                          Aprovar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setOpenId(p.id);
                          setText(p.status === "changes" ? p.feedback : "");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle"
                      >
                        <MessageSquarePlus className="h-4 w-4" />{" "}
                        {p.status === "changes" ? "Editar ajuste" : "Pedir ajuste"}
                      </button>
                    </div>
                  )}

                  {openId === p.id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={3}
                        placeholder="O que ajustar neste post? (ex.: trocar a foto, ajustar a legenda…)"
                        className={inputCls}
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={busy === p.id || !text.trim()}
                          onClick={() => send(p, "changes", text.trim())}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                        >
                          {busy === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageSquarePlus className="h-4 w-4" />
                          )}{" "}
                          Enviar ajuste
                        </button>
                        <button
                          onClick={() => {
                            setOpenId(null);
                            setText("");
                          }}
                          className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-subtle"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="px-4 py-6 text-center text-xs text-muted">
        Powered by <span className="font-semibold text-ink">Viofilme</span> · viofilme.com.br
      </footer>
    </div>
  );
}
