"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: number; role: "user" | "assistant"; content: string; seed?: boolean };
type Scope = "cliente" | "gerencial";

const SUGGESTIONS_CLIENTE = [
  "Como estão minhas campanhas?",
  "Qual post teve melhor resultado?",
  "Tenho fatura em aberto?",
  "O que posso melhorar este mês?",
];

const SUGGESTIONS_GERENCIAL = [
  "Qual cliente teve melhor desempenho?",
  "Quais clientes ainda não conectaram a Meta?",
  "Resumo geral da carteira este mês",
  "Onde estamos investindo mais em mídia?",
];

function greeting(name: string, scope: Scope): Msg {
  const content =
    scope === "gerencial"
      ? `Oi, ${name}! 👋 Eu sou a Bruna. No painel gerencial eu tenho a visão de todos os clientes — desempenho, investimento em mídia, conexões com a Meta e conteúdo. Pergunte o que quiser — ou comece por uma sugestão abaixo.`
      : `Oi, ${name}! 👋 Eu sou a Bruna, assistente de IA da Viofilme. Tenho acesso aos seus resultados de campanhas, conteúdo, orgânico e financeiro. Pode me perguntar qualquer coisa — ou começar por uma sugestão abaixo.`;
  return { id: 0, role: "assistant", seed: true, content };
}

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

export function AiChat({
  clientName,
  scope = "cliente",
}: {
  clientName: string;
  scope?: Scope;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([greeting(clientName, scope)]);
  const suggestions = scope === "gerencial" ? SUGGESTIONS_GERENCIAL : SUGGESTIONS_CLIENTE;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");

    const userMsg: Msg = { id: nextId.current++, role: "user", content: q };
    const aiMsg: Msg = { id: nextId.current++, role: "assistant", content: "" };
    const convo = [...messages, userMsg]
      .filter((m) => !m.seed)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: convo }),
      });
      if (!res.ok || !res.body) throw new Error("fail");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsg.id ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id
            ? {
                ...m,
                content:
                  "Desculpe, não consegui responder agora. Tente novamente em instantes.",
              }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const showSuggestions = messages.filter((m) => !m.seed).length === 0;

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 py-3 pl-3.5 pr-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-transform hover:scale-105"
          aria-label="Falar com a Bruna, assistente de IA"
        >
          <Sparkles className="h-5 w-5" />
          <span className="hidden sm:inline">Falar com a Bruna</span>
        </button>
      )}

      {/* Painel */}
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-50 flex h-[75vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:h-[600px] sm:w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Bruna</p>
                <p className="text-[11px] text-white/80 leading-tight">
                  Assistente IA · Viofilme
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/90 hover:bg-white/15"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                    m.role === "user"
                      ? "bg-brand-500 text-white"
                      : "bg-subtle text-ink",
                  )}
                >
                  {m.content ? (
                    <Rich text={m.content} />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  )}
                </div>
              </div>
            ))}

            {showSuggestions && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs text-ink transition-colors hover:border-brand-300 hover:text-brand-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-line p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Pergunte sobre seus resultados…"
                className="max-h-28 flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
                aria-label="Enviar"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted">
              A IA pode cometer erros. Confira informações importantes.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
