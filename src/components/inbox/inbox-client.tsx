"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCheck,
  Loader2,
  MessagesSquare,
  Search,
  Send,
  UserCircle2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clockLabel, dayMonth } from "@/lib/datetime";
import {
  WA_STATUS,
  conversationTitle,
  formatPhone,
  type Attendant,
  type WaConversation,
  type WaMessage,
  type WaStatus,
} from "@/lib/data/inbox";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function stamp(iso?: string) {
  if (!iso) return "";
  const now = new Date();
  const d = new Date(iso);
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  return sameDay ? clockLabel(iso) : dayMonth(iso);
}

export function InboxClient({
  initialConversations,
  attendants,
}: {
  initialConversations: WaConversation[];
  attendants: Attendant[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [status, setStatus] = useState<WaStatus>("open");
  const [attendantFilter, setAttendantFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [selected, setSelected] = useState<WaConversation | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = conversations
    .filter((c) => c.status === status)
    .filter((c) => (attendantFilter ? c.assignedTo === attendantFilter : true))
    .filter((c) =>
      query
        ? conversationTitle(c).toLowerCase().includes(query.toLowerCase()) ||
          c.phone.includes(query.replace(/\D/g, ""))
        : true,
    );

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/inbox/conversations?status=${status}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setConversations(json.conversations ?? []);
      }
    } catch {
      /* mantém estado atual */
    }
  }, [status]);

  const loadMessages = useCallback(async (id: string, read = false) => {
    try {
      const res = await fetch(
        `/api/inbox/messages?conversationId=${id}${read ? "&read=1" : ""}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const json = await res.json();
        setMessages(json.messages ?? []);
        setSelected(json.conversation ?? null);
      }
    } catch {
      /* ignora */
    }
  }, []);

  // Polling: lista a cada 6s; chat aberto a cada 4s.
  useEffect(() => {
    const t = setInterval(loadConversations, 6000);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => loadMessages(selectedId), 4000);
    return () => clearInterval(t);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function openConversation(c: WaConversation) {
    setSelectedId(c.id);
    setSelected(c);
    setMessages([]);
    loadMessages(c.id, true);
    // zera o badge local
    setConversations((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)),
    );
  }

  async function send() {
    if (!text.trim() || !selectedId || sending) return;
    setSending(true);
    const body = text.trim();
    setText("");
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${prev.length}`,
        conversationId: selectedId,
        direction: "out",
        type: "text",
        body,
        author: "Você",
        createdAt: new Date().toISOString(),
      },
    ]);
    await fetch("/api/inbox/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId, text: body }),
    }).catch(() => {});
    setSending(false);
    loadConversations();
  }

  async function assign(assignedTo: string | null) {
    if (!selectedId) return;
    setSelected((s) => (s ? { ...s, assignedTo: assignedTo ?? undefined, assignedName: attendants.find((a) => a.id === assignedTo)?.name } : s));
    await fetch("/api/inbox/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId, assignedTo }),
    }).catch(() => {});
    loadConversations();
  }

  async function changeStatus(newStatus: WaStatus) {
    if (!selectedId) return;
    await fetch("/api/inbox/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId, status: newStatus }),
    }).catch(() => {});
    setSelected((s) => (s ? { ...s, status: newStatus } : s));
    loadConversations();
    if (newStatus !== status) setSelectedId(null);
  }

  // Contadores por atendente (controle de atendentes).
  const counts = attendants.map((a) => ({
    ...a,
    open: conversations.filter((c) => c.assignedTo === a.id && c.status !== "closed").length,
  }));
  const unassigned = conversations.filter((c) => !c.assignedTo && c.status !== "closed").length;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden border-t border-line">
      {/* Coluna 1 — lista de conversas */}
      <aside className="flex w-full max-w-xs flex-col border-r border-line bg-surface md:w-80">
        <div className="border-b border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <MessagesSquare className="h-4 w-4 text-brand-600" />
            <h1 className="text-sm font-semibold text-ink">Atendimento</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar contato ou número"
              className="w-full rounded-lg border border-line bg-canvas py-1.5 pl-8 pr-2 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          <div className="mt-2 flex gap-1">
            {WA_STATUS.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setStatus(s.key);
                  setSelectedId(null);
                }}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                  status === s.key ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <select
            value={attendantFilter}
            onChange={(e) => setAttendantFilter(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
          >
            <option value="">Todos os atendentes</option>
            {attendants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nenhuma conversa {WA_STATUS.find((s) => s.key === status)?.label.toLowerCase()}.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-line px-3 py-3 text-left transition-colors hover:bg-canvas",
                  selectedId === c.id && "bg-canvas",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-600">
                  {initials(conversationTitle(c))}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {conversationTitle(c)}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted">{stamp(c.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {c.lastDirection === "out" && "Você: "}
                    {c.lastMessagePreview ?? formatPhone(c.phone)}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {c.assignedName && (
                      <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-muted">
                        {c.assignedName}
                      </span>
                    )}
                    {c.unreadCount > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Coluna 2 — chat */}
      <section className="flex min-w-0 flex-1 flex-col bg-canvas">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
            <MessagesSquare className="h-10 w-10 opacity-40" />
            <p className="text-sm">Selecione uma conversa para começar.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-600">
                  {initials(conversationTitle(selected))}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{conversationTitle(selected)}</p>
                  <p className="text-xs text-muted">{formatPhone(selected.phone)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.leadId && (
                  <Link
                    href={`/gerencial/crm/${selected.leadId}`}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
                  >
                    Ver lead
                  </Link>
                )}
                <select
                  value={selected.status}
                  onChange={(e) => changeStatus(e.target.value as WaStatus)}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
                >
                  {WA_STATUS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label.replace(/s$/, "")}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      m.direction === "out"
                        ? "rounded-br-sm bg-emerald-600 text-white"
                        : "rounded-bl-sm bg-surface text-ink",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <span
                      className={cn(
                        "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                        m.direction === "out" ? "text-white/70" : "text-muted",
                      )}
                    >
                      {clockLabel(m.createdAt)}
                      {m.direction === "out" &&
                        (m.status === "read" ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        ))}
                    </span>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">Sem mensagens ainda.</p>
              )}
            </div>

            <div className="border-t border-line bg-surface p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Escreva uma mensagem…"
                  className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
                />
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Coluna 3 — contato + controle de atendentes */}
      <aside className="hidden w-72 shrink-0 flex-col border-l border-line bg-surface xl:flex">
        {selected ? (
          <div className="space-y-4 p-4">
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-xl font-semibold text-emerald-600">
                {initials(conversationTitle(selected))}
              </span>
              <p className="mt-2 text-sm font-semibold text-ink">{conversationTitle(selected)}</p>
              <p className="text-xs text-muted">{formatPhone(selected.phone)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Atendente responsável</p>
              <select
                value={selected.assignedTo ?? ""}
                onChange={(e) => assign(e.target.value || null)}
                className="w-full rounded-lg border border-line bg-canvas px-2 py-2 text-sm text-ink outline-none focus:border-brand-400"
              >
                <option value="">Sem atendente</option>
                {attendants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            {selected.leadId ? (
              <Link
                href={`/gerencial/crm/${selected.leadId}`}
                className="flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-sm text-ink hover:bg-subtle-strong"
              >
                <UserCircle2 className="h-4 w-4" /> Abrir ficha do lead
              </Link>
            ) : (
              <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
                Este contato ainda não é um lead do CRM.
              </p>
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-ink">Controle de atendentes</h2>
            </div>
            <div className="space-y-1.5">
              {counts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAttendantFilter((cur) => (cur === a.id ? "" : a.id))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    attendantFilter === a.id ? "bg-brand-50 text-brand-700" : "hover:bg-subtle",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-600">
                      {initials(a.name)}
                    </span>
                    <span className="text-ink">{a.name}</span>
                  </span>
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-muted">
                    {a.open}
                  </span>
                </button>
              ))}
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                <span className="text-muted">Sem atendente</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
                  {unassigned}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
