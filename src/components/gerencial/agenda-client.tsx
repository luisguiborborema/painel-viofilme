"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReadOnly } from "@/components/shell/read-only-context";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Layers,
  Link2,
  Loader2,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Settings2,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clockLabel } from "@/lib/datetime";
import {
  ROUTINE_ACTIVITIES,
  WEEKDAYS,
  minutesOf,
  timeReserved,
  type CalendarEvent,
  type RoutineBlock,
  type RoutineTemplate,
  type SchedulingLink,
} from "@/lib/data/agenda";

type Meeting = {
  id: string;
  title: string;
  start: string;
  end?: string;
  source: "own" | "google";
  link?: string;
  type?: string;
  description?: string;
  attendees?: string[];
  calendarId?: string;
};
type Task = { id: string; title: string; dueDate?: string; status: string; type?: string; leadId?: string; dealName?: string };

const START_H = 7;
const END_H = 21;
const ROW_H = 44; // px por hora
const HOURS = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // segunda
  return x;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const iso = (d: Date) => d.toISOString();

export function AgendaClient({
  routineBlocks: initialBlocks,
  templates = [],
  schedulingLinks: initialLinks,
  events = [],
  googleEvents = [],
  googleConnected = false,
  googleConfigured = false,
  tasks = [],
  currentUser = "",
}: {
  routineBlocks: RoutineBlock[];
  templates?: RoutineTemplate[];
  schedulingLinks: SchedulingLink[];
  events?: CalendarEvent[];
  googleEvents?: {
    id: string;
    summary: string;
    start?: string;
    end?: string;
    hangoutLink?: string;
    htmlLink?: string;
    allDay?: boolean;
    description?: string;
    attendees?: string[];
    calendarId?: string;
  }[];
  googleConnected?: boolean;
  googleConfigured?: boolean;
  tasks?: Task[];
  currentUser?: string;
}) {
  const router = useRouter();
  const now = new Date();
  const [view, setView] = useState<"dia" | "semana" | "mes">("semana");
  const [anchor, setAnchor] = useState(now);
  const [showRotina, setShowRotina] = useState(true);
  const [sideOpen, setSideOpen] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [newAt, setNewAt] = useState<Date | null>(null);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);

  // Link público de agendamento (Calendly-like) para enviar ao cliente.
  const readOnly = useReadOnly();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const nativeLink = initialLinks.find((l) => l.slug);
  const bookingUrl = nativeLink ? `${origin}/agendar/${nativeLink.slug}` : "";
  const [copiedLink, setCopiedLink] = useState(false);
  const ensuredRef = useRef(false);

  // Sem link nativo ainda? Gera um padrão automaticamente (idempotente no server)
  // e recarrega — o usuário não precisa configurar nada.
  useEffect(() => {
    if (nativeLink || readOnly || ensuredRef.current) return;
    ensuredRef.current = true;
    fetch("/api/agenda/scheduling-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure-default" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) router.refresh(); })
      .catch(() => {});
  }, [nativeLink, readOnly, router]);

  function copyBooking() {
    if (!bookingUrl) return;
    navigator.clipboard?.writeText(bookingUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    });
  }
  const waHref = bookingUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Olá! Agende um horário comigo por aqui: ${bookingUrl}`)}`
    : "#";

  useEffect(() => {
    // Hidrata preferências do cliente (localStorage) após montar.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const v = localStorage.getItem("agenda-view");
      if (v === "dia" || v === "semana" || v === "mes") setView(v);
      const r = localStorage.getItem("agenda-rotina");
      if (r != null) setShowRotina(r === "1");
    } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => { try { localStorage.setItem("agenda-view", view); } catch {} }, [view]);
  useEffect(() => { try { localStorage.setItem("agenda-rotina", showRotina ? "1" : "0"); } catch {} }, [showRotina]);

  const blocks = initialBlocks;

  // Reuniões unificadas (próprias + Google).
  const meetings: Meeting[] = useMemo(() => {
    const own: Meeting[] = events.map((e) => ({ id: e.id, title: e.title, start: e.startAt, end: e.endAt, source: "own", type: e.type, link: e.meetLink }));
    // Dedupe: eventos criados por agendamento têm par local + Google (mesmo id) —
    // mostra só o local (que já carrega o Meet).
    const linkedGoogleIds = new Set(events.map((e) => e.googleEventId).filter(Boolean) as string[]);
    const g: Meeting[] = googleEvents
      .filter((e) => e.start && !e.allDay && !linkedGoogleIds.has(e.id))
      .map((e) => ({
        id: e.id,
        title: e.summary,
        start: e.start!,
        end: e.end,
        source: "google",
        link: e.hangoutLink ?? e.htmlLink,
        description: e.description,
        attendees: e.attendees,
        calendarId: e.calendarId,
      }));
    return [...own, ...g];
  }, [events, googleEvents]);

  const days = view === "semana" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)) : [anchor];

  const periodLabel = view === "mes"
    ? anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : view === "dia"
      ? anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
      : `${addDays(startOfWeek(anchor), 0).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${addDays(startOfWeek(anchor), 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  function nav(dir: number) {
    if (view === "mes") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, dir * (view === "semana" ? 7 : 1)));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor(now)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-subtle">Hoje</button>
          <div className="flex items-center gap-0.5">
            <button onClick={() => nav(-1)} className="rounded-lg p-1.5 text-muted hover:bg-subtle"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => nav(1)} className="rounded-lg p-1.5 text-muted hover:bg-subtle"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <span className="min-w-[160px] text-sm font-semibold capitalize text-ink">{periodLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div data-tour="agenda-view" className="inline-flex rounded-xl border border-line p-0.5">
            {(["dia", "semana", "mes"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle")}>{v === "mes" ? "Mês" : v}</button>
            ))}
          </div>
          <button onClick={() => setShowRotina((r) => !r)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", showRotina ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")}>
            <Layers className="h-3.5 w-3.5" /> Rotina
          </button>
          <button onClick={() => setShowConfig(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"><Settings2 className="h-3.5 w-3.5" /> Configurar rotina</button>
          <button onClick={() => setShowLinks(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"><Link2 className="h-3.5 w-3.5" /> Links de agendamento</button>
          <button onClick={() => setNewAt(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 9))} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"><Plus className="h-4 w-4" /> Reunião</button>
          <button onClick={() => setSideOpen((s) => !s)} className="rounded-lg p-1.5 text-muted hover:bg-subtle" title="Painel de tarefas">
            {sideOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Link de agendamento — pronto pra enviar ao cliente */}
      {(nativeLink || !readOnly) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-400/40 bg-brand-500/5 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">Link de agendamento — envie ao cliente</p>
            {nativeLink ? (
              <p className="truncate text-[11px] text-muted">{bookingUrl}</p>
            ) : (
              <p className="inline-flex items-center gap-1 text-[11px] text-muted">
                <Loader2 className="h-3 w-3 animate-spin" /> Preparando seu link…
              </p>
            )}
          </div>
          {nativeLink && (
            <div className="flex items-center gap-2">
              <button
                onClick={copyBooking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
              >
                {copiedLink ? (
                  <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copiado</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Copiar</>
                )}
              </button>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              {!readOnly && (
                <button
                  onClick={() => setShowLinks(true)}
                  className="text-[11px] font-medium text-muted hover:text-ink hover:underline"
                >
                  configurar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Banner Google (casca) */}
      {!googleConnected && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-700">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {googleConfigured ? "Google Agenda não conectada — as reuniões do Google não aparecem. " : "Google não configurado. "}
          Ligue em <Link href="/gerencial/integracoes" className="font-semibold underline">Integrações</Link>. O calendário do sistema funciona normalmente.
        </div>
      )}

      <div className="flex gap-3">
        {/* Grid */}
        <div className="min-w-0 flex-1 rounded-2xl border border-line bg-surface">
          {view === "mes" ? (
            <MonthGrid anchor={anchor} now={now} meetings={meetings} onNew={(d) => setNewAt(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9))} onOpenMeeting={setEditMeeting} />
          ) : (
            <TimeGrid days={days} now={now} meetings={meetings} blocks={blocks} showRotina={showRotina} onSlot={(d) => setNewAt(d)} onOpenMeeting={setEditMeeting} />
          )}
        </div>

        {/* Painel lateral de tarefas */}
        {sideOpen && (
          <SidePanel tasks={tasks} currentUser={currentUser} now={now} typeFilter={typeFilter} setTypeFilter={setTypeFilter} onDone={() => router.refresh()} />
        )}
      </div>

      {showConfig && (
        <RoutineConfig blocks={blocks} templates={templates} onClose={() => setShowConfig(false)} onChanged={() => router.refresh()} />
      )}
      {showLinks && (
        <LinksPanel links={initialLinks} onClose={() => setShowLinks(false)} onChanged={() => router.refresh()} />
      )}
      {newAt && (
        <EventModal
          at={newAt}
          googleConnected={googleConnected}
          onClose={() => setNewAt(null)}
          onSaved={() => { setNewAt(null); router.refresh(); }}
        />
      )}
      {editMeeting && (
        <EventModal
          at={new Date(editMeeting.start)}
          edit={editMeeting}
          googleConnected={googleConnected}
          onClose={() => setEditMeeting(null)}
          onSaved={() => { setEditMeeting(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

/* ── Grid de horas (dia/semana) ────────────────────────── */

function TimeGrid({ days, now, meetings, blocks, showRotina, onSlot, onOpenMeeting }: {
  days: Date[];
  now: Date;
  meetings: Meeting[];
  blocks: RoutineBlock[];
  showRotina: boolean;
  onSlot: (d: Date) => void;
  onOpenMeeting: (m: Meeting) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Cabeçalho dos dias */}
        <div className="flex border-b border-line" style={{ paddingLeft: 48 }}>
          {days.map((d) => (
            <div key={iso(d)} className={cn("flex-1 py-2 text-center", sameDay(d, now) && "bg-brand-50/40")}>
              <p className="text-[11px] uppercase text-muted">{WEEKDAYS[d.getDay()]}</p>
              <p className={cn("text-sm font-semibold", sameDay(d, now) ? "text-brand-600" : "text-ink")}>{d.getDate()}</p>
            </div>
          ))}
        </div>
        {/* Corpo com horas */}
        <div className="relative flex" style={{ height: HOURS.length * ROW_H }}>
          {/* Coluna de horas */}
          <div className="w-12 shrink-0">
            {HOURS.map((h) => (
              <div key={h} className="relative text-right" style={{ height: ROW_H }}>
                <span className="absolute -top-1.5 right-1 text-[10px] text-muted">{h}h</span>
              </div>
            ))}
          </div>
          {/* Colunas de dias */}
          {days.map((d) => {
            const dayBlocks = showRotina ? blocks.filter((b) => b.weekday === d.getDay()) : [];
            const dayMeetings = meetings.filter((m) => sameDay(new Date(m.start), d));
            return (
              <div key={iso(d)} className="relative flex-1 border-l border-line">
                {/* Linhas de hora (clicáveis p/ criar) */}
                {HOURS.map((h) => (
                  <button
                    key={h}
                    onClick={() => onSlot(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))}
                    className="block w-full border-b border-line/60 hover:bg-brand-50/30"
                    style={{ height: ROW_H }}
                  />
                ))}
                {/* Blocos de rotina (fundo) */}
                {dayBlocks.map((b) => {
                  const top = ((minutesOf(b.startTime) - START_H * 60) / 60) * ROW_H;
                  const height = Math.max(16, ((minutesOf(b.endTime) - minutesOf(b.startTime)) / 60) * ROW_H);
                  return (
                    <div key={b.id} className="pointer-events-none absolute inset-x-1 rounded-md px-1.5 py-0.5" style={{ top, height, backgroundColor: `${b.color}18`, borderLeft: `2px solid ${b.color}` }}>
                      <span className="text-[9px] font-medium" style={{ color: b.color }}>{b.title}</span>
                    </div>
                  );
                })}
                {/* Reuniões */}
                {dayMeetings.map((m) => {
                  const s = new Date(m.start);
                  const e = m.end ? new Date(m.end) : new Date(s.getTime() + 30 * 60000);
                  const top = ((s.getHours() * 60 + s.getMinutes() - START_H * 60) / 60) * ROW_H;
                  const height = Math.max(22, ((e.getTime() - s.getTime()) / 3600000) * ROW_H);
                  return (
                    <div key={m.id} className="absolute inset-x-1 z-10" style={{ top, height }}>
                      <button
                        type="button"
                        onClick={() => onOpenMeeting(m)}
                        className="flex h-full w-full flex-col overflow-hidden rounded-md border-l-2 border-brand-500 bg-brand-500/15 px-1.5 py-0.5 text-left transition-colors hover:bg-brand-500/25"
                      >
                        <span className="truncate text-[10px] font-semibold text-brand-700">{m.title}</span>
                        <span className="text-[9px] text-brand-600">{clockLabel(m.start)}</span>
                      </button>
                    </div>
                  );
                })}
                {/* Linha do "agora" */}
                {sameDay(d, now) && (() => {
                  const top = ((now.getHours() * 60 + now.getMinutes() - START_H * 60) / 60) * ROW_H;
                  if (top < 0 || top > HOURS.length * ROW_H) return null;
                  return <div className="absolute inset-x-0 z-20 h-px bg-rose-500" style={{ top }} />;
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Grid mensal ───────────────────────────────────────── */

function MonthGrid({ anchor, now, meetings, onNew, onOpenMeeting }: { anchor: Date; now: Date; meetings: Meeting[]; onNew: (d: Date) => void; onOpenMeeting: (m: Meeting) => void }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startPad = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -startPad);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const byDay = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const d = new Date(m.start);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(m);
  }
  return (
    <div className="p-2">
      <div className="grid grid-cols-7 gap-1">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => <div key={d} className="px-1 py-1 text-center text-[10px] font-semibold uppercase text-muted">{d}</div>)}
        {cells.map((d) => {
          const list = (byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? []).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
          const inMonth = d.getMonth() === anchor.getMonth();
          return (
            <div key={iso(d)} className={cn("min-h-[84px] rounded-lg border p-1 align-top", sameDay(d, now) ? "border-brand-400 bg-brand-50/30" : "border-line", !inMonth && "opacity-40")}>
              <button type="button" onClick={() => onNew(d)} className="block w-full text-left text-[11px] font-semibold text-muted hover:text-brand-600" title="Nova reunião">
                {d.getDate()}
              </button>
              <div className="mt-0.5 space-y-0.5">
                {list.slice(0, 3).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onOpenMeeting(m)}
                    className="flex w-full items-center gap-1 truncate rounded bg-brand-500/15 px-1 text-left text-[10px] text-brand-700 hover:bg-brand-500/25"
                  >
                    <Clock className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{clockLabel(m.start)} {m.title}</span>
                  </button>
                ))}
                {list.length > 3 && <span className="text-[10px] text-muted">+{list.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Painel lateral: tarefas do dia ────────────────────── */

const TASK_TYPES = [
  { key: "ligacao", label: "Ligação" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "reuniao", label: "Reunião" },
  { key: "todo", label: "To-do" },
];

function SidePanel({ tasks, currentUser, now, typeFilter, setTypeFilter, onDone }: {
  tasks: Task[];
  currentUser: string;
  now: Date;
  typeFilter: string | null;
  setTypeFilter: (t: string | null) => void;
  onDone: () => void;
}) {
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());
  const today = tasks.filter((t) => {
    if (t.status !== "pending" || localDone.has(t.id)) return false;
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) && (!typeFilter || (t.type ?? "todo") === typeFilter);
  });
  async function conclude(id: string) {
    setLocalDone((s) => new Set(s).add(id));
    await fetch("/api/crm/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "done", taskId: id }) }).catch(() => {});
    onDone();
  }
  return (
    <aside className="hidden w-72 shrink-0 flex-col rounded-2xl border border-line bg-surface p-3 lg:flex">
      <h2 className="mb-2 text-sm font-semibold text-ink">Tarefas de hoje</h2>
      <div className="mb-2 flex flex-wrap gap-1">
        <button onClick={() => setTypeFilter(null)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", !typeFilter ? "bg-ink text-surface" : "bg-subtle text-muted")}>Tudo</button>
        {TASK_TYPES.map((t) => (
          <button key={t.key} onClick={() => setTypeFilter(typeFilter === t.key ? null : t.key)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", typeFilter === t.key ? "bg-brand-600 text-white" : "bg-subtle text-muted")}>{t.label}</button>
        ))}
      </div>
      {today.length === 0 ? (
        <p className="rounded-xl bg-subtle px-3 py-6 text-center text-xs text-muted">Dia livre. 🎯</p>
      ) : (
        <div className="space-y-1 overflow-y-auto">
          {today.map((t) => (
            <div key={t.id} className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 hover:bg-subtle">
              <button onClick={() => conclude(t.id)} className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line hover:border-brand-400" title="Concluir">
                <Check className="h-3 w-3 text-transparent hover:text-brand-500" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink">{t.title}</p>
                {t.leadId ? (
                  <Link href={`/gerencial/crm/${t.leadId}`} className="text-[11px] text-muted hover:text-ink hover:underline">{t.dealName}</Link>
                ) : <span className="text-[11px] text-muted">{t.dealName}</span>}
              </div>
              {t.dueDate && <span className="shrink-0 text-[10px] text-muted">{clockLabel(t.dueDate)}</span>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 border-t border-line pt-2 text-[10px] text-muted">Fonte: suas tarefas ({currentUser || "você"}).</p>
    </aside>
  );
}

/* ── Configurar rotina ─────────────────────────────────── */

const inputCls = "w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-brand-400";

function RoutineConfig({ blocks, templates, onClose, onChanged }: {
  blocks: RoutineBlock[];
  templates: RoutineTemplate[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [tplId, setTplId] = useState("");
  const [newBlock, setNewBlock] = useState({ title: "", weekday: 1, startTime: "09:00", endTime: "10:00", activityType: "prospeccao" });
  const [saveName, setSaveName] = useState("");
  const chart = useMemo(() => timeReserved(blocks), [blocks]);

  function post(body: unknown) {
    return fetch("/api/agenda/routine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async function apply() { if (!tplId) return; setBusy(true); await post({ action: "apply-template", templateId: tplId }).catch(() => {}); setBusy(false); onChanged(); }
  async function addBlock() {
    if (!newBlock.title.trim()) return;
    setBusy(true);
    const color = ROUTINE_ACTIVITIES.find((a) => a.key === newBlock.activityType)?.color ?? "#2a63c9";
    await post({ action: "add-block", ...newBlock, color }).catch(() => {});
    setBusy(false); setNewBlock({ ...newBlock, title: "" }); onChanged();
  }
  async function del(id: string) { setBusy(true); await post({ action: "delete-block", id }).catch(() => {}); setBusy(false); onChanged(); }
  async function saveTpl() { if (!saveName.trim()) return; setBusy(true); await post({ action: "save-template", name: saveName.trim() }).catch(() => {}); setBusy(false); setSaveName(""); onChanged(); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Configurar rotina</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle"><X className="h-4 w-4" /></button>
        </div>

        {/* Usar modelo */}
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-canvas p-3">
          <label className="flex-1">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">Usar modelo pronto</span>
            <select value={tplId} onChange={(e) => setTplId(e.target.value)} className={inputCls}>
              <option value="">Escolher modelo…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isBase ? " (base)" : ""}</option>)}
            </select>
          </label>
          <button onClick={apply} disabled={busy || !tplId} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Aplicar (substitui a sua)</button>
        </div>

        {/* Gráfico de tempo reservado */}
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Tempo reservado (semana útil ref.)</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-subtle">
            {chart.map((c) => <div key={c.key} style={{ width: `${c.pct}%`, backgroundColor: c.color }} title={`${c.label}: ${c.pct}%`} />)}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {chart.map((c) => <span key={c.key} className="inline-flex items-center gap-1 text-[11px] text-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} /> {c.label} {c.pct}%</span>)}
          </div>
        </div>

        {/* Blocos atuais */}
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Meus blocos</p>
        <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
          {blocks.length === 0 && <p className="py-3 text-center text-xs text-muted">Nenhum bloco. Aplique um modelo ou crie abaixo.</p>}
          {[...blocks].sort((a, b) => a.weekday - b.weekday || minutesOf(a.startTime) - minutesOf(b.startTime)).map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
              <span className="w-10 shrink-0 text-xs text-muted">{WEEKDAYS[b.weekday]}</span>
              <span className="flex-1 truncate text-ink">{b.title}</span>
              <span className="shrink-0 text-xs text-muted">{b.startTime}–{b.endTime}</span>
              <button onClick={() => del(b.id)} className="shrink-0 text-muted hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>

        {/* Novo bloco */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-canvas p-3 sm:grid-cols-6">
          <input value={newBlock.title} onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })} placeholder="Título" className={inputCls + " sm:col-span-2"} />
          <select value={newBlock.weekday} onChange={(e) => setNewBlock({ ...newBlock, weekday: Number(e.target.value) })} className={inputCls}>
            {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
          </select>
          <input type="time" value={newBlock.startTime} onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })} className={inputCls} />
          <input type="time" value={newBlock.endTime} onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })} className={inputCls} />
          <select value={newBlock.activityType} onChange={(e) => setNewBlock({ ...newBlock, activityType: e.target.value })} className={inputCls}>
            {ROUTINE_ACTIVITIES.filter((a) => a.key !== "livre").map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          <button onClick={addBlock} disabled={busy || !newBlock.title.trim()} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:col-span-6">
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "+ Adicionar bloco"}
          </button>
        </div>

        {/* Salvar como modelo */}
        <div className="mt-3 flex items-end gap-2 border-t border-line pt-3">
          <label className="flex-1">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">Salvar minha rotina como modelo</span>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Nome do modelo" className={inputCls} />
          </label>
          <button onClick={saveTpl} disabled={busy || !saveName.trim() || blocks.length === 0} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-50">Salvar modelo</button>
        </div>
      </div>
    </div>
  );
}

/* ── Links de agendamento ──────────────────────────────── */

const WDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function LinksPanel({ links, onClose, onChanged }: { links: SchedulingLink[]; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dur, setDur] = useState(30);
  const [ahead, setAhead] = useState(14);
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [url, setUrl] = useState("");
  const [extLabel, setExtLabel] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function post(body: unknown) {
    return fetch("/api/agenda/scheduling-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async function addNative() {
    if (!title.trim() || days.size === 0) return;
    setBusy(true);
    const availability = [...days].sort().map((day) => ({ day, start, end }));
    await post({ action: "create", native: true, label: title.trim(), durationMin: dur, daysAhead: ahead, availability }).catch(() => {});
    setBusy(false);
    setTitle("");
    onChanged();
  }
  async function addExternal() {
    if (!url.trim()) return;
    setBusy(true);
    await post({ action: "create", url: url.trim(), label: extLabel.trim() }).catch(() => {});
    setBusy(false);
    setUrl("");
    setExtLabel("");
    onChanged();
  }
  async function del(id: string) { setBusy(true); await post({ action: "delete", id }).catch(() => {}); setBusy(false); onChanged(); }
  function copyNative(l: SchedulingLink) {
    navigator.clipboard?.writeText(`${origin}/agendar/${l.slug}`).then(() => {
      setCopied(l.id);
      setTimeout(() => setCopied((c) => (c === l.id ? null : c)), 1500);
    });
  }
  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Links de agendamento</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-3 space-y-1.5">
          {links.length === 0 && <p className="py-3 text-center text-xs text-muted">Nenhum link ainda.</p>}
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{l.label}</p>
                <p className="truncate text-[11px] text-muted">
                  {l.slug ? `${origin}/agendar/${l.slug} · ${l.durationMin ?? 30}min` : l.url}
                </p>
              </div>
              {l.slug ? (
                <button onClick={() => copyNative(l)} className="shrink-0 text-xs font-medium text-brand-600 hover:underline">
                  {copied === l.id ? "copiado" : "copiar"}
                </button>
              ) : (
                <a href={l.url ?? "#"} target="_blank" rel="noreferrer" className="shrink-0 text-brand-600 hover:text-brand-700"><ExternalLink className="h-4 w-4" /></a>
              )}
              <button onClick={() => del(l.id)} className="shrink-0 text-muted hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>

        <div className="mb-3 space-y-2 rounded-xl border border-brand-400/40 bg-brand-500/5 p-3">
          <p className="text-xs font-semibold text-ink">Nova agenda (o lead marca sozinho aqui no painel)</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex.: Diagnóstico 30min)" className={inputCls} />
          <div className="flex gap-2">
            <label className="flex-1 text-[11px] text-muted">
              Duração
              <select value={dur} onChange={(e) => setDur(Number(e.target.value))} className={inputCls}>
                {[15, 30, 45, 60].map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </label>
            <label className="flex-1 text-[11px] text-muted">
              Janela (dias)
              <input type="number" min={1} max={90} value={ahead} onChange={(e) => setAhead(Number(e.target.value))} className={inputCls} />
            </label>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted">Dias disponíveis</p>
            <div className="flex flex-wrap gap-1">
              {WDAYS.map((w, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)} className={"rounded-md border px-2 py-1 text-xs font-medium " + (days.has(i) ? "border-brand-500 bg-brand-500 text-white" : "border-line text-muted hover:text-ink")}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            Das
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink" />
            às
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink" />
          </div>
          <button onClick={addNative} disabled={busy || !title.trim() || days.size === 0} className="w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            + Criar agenda
          </button>
        </div>

        <details className="rounded-xl border border-line bg-canvas p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted">Ou adicionar um link externo (Calendly, etc.)</summary>
          <div className="mt-2 space-y-2">
            <input value={extLabel} onChange={(e) => setExtLabel(e.target.value)} placeholder="Rótulo" className={inputCls} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendly.com/…" className={inputCls} />
            <button onClick={addExternal} disabled={busy || !url.trim()} className="w-full rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-subtle disabled:opacity-50">+ Adicionar link externo</button>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ── Nova reunião (evento próprio) ─────────────────────── */

function EventModal({
  at,
  edit,
  googleConnected,
  onClose,
  onSaved,
}: {
  at: Date;
  edit?: Meeting;
  googleConnected: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!edit;
  // Campos ricos (descrição/convidados/Meet): no novo, dependem da conexão;
  // na edição, dependem da origem do evento (só eventos do Google os têm).
  const canRich = isEdit ? edit!.source === "google" : googleConnected;
  const startD = new Date(edit?.start ?? at);
  const endD = edit?.end ? new Date(edit.end) : new Date(startD.getTime() + 60 * 60000);

  const [title, setTitle] = useState(edit?.title ?? "");
  const [type, setType] = useState(edit?.type ?? "meeting");
  const [date, setDate] = useState(`${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, "0")}-${String(startD.getDate()).padStart(2, "0")}`);
  const [start, setStart] = useState(`${String(startD.getHours()).padStart(2, "0")}:${String(startD.getMinutes()).padStart(2, "0")}`);
  const [end, setEnd] = useState(`${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`);
  const [description, setDescription] = useState(edit?.description ?? "");
  const [guests, setGuests] = useState((edit?.attendees ?? []).join(", "));
  const [addMeet, setAddMeet] = useState(isEdit ? !edit!.link : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ meetLink?: string; htmlLink?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const startAt = new Date(`${date}T${start}`).toISOString();
    const endAt = new Date(`${date}T${end}`).toISOString();
    const attendees = guests.split(/[\s,;]+/).map((g) => g.trim()).filter((g) => g.includes("@"));
    const body = isEdit
      ? {
          action: "update",
          id: edit!.id,
          source: edit!.source,
          calendarId: edit!.calendarId,
          title: title.trim(),
          type,
          startAt,
          endAt,
          description: canRich ? description.trim() : undefined,
          attendees: canRich ? attendees : undefined,
          addMeet: canRich ? addMeet : undefined,
        }
      : {
          action: "create",
          title: title.trim(),
          type,
          startAt,
          endAt,
          useGoogle: googleConnected,
          description: description.trim() || undefined,
          attendees,
          addMeet,
        };
    try {
      const res = await fetch("/api/agenda/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; google?: boolean; meetLink?: string; htmlLink?: string };
      if (!res.ok || out.error) {
        setError(out.error ?? "Falha ao salvar a reunião.");
        setBusy(false);
        return;
      }
      // Ao criar no Google, mostra o link do Meet antes de fechar.
      if (!isEdit && out.google && (out.meetLink || out.htmlLink)) {
        setCreated({ meetLink: out.meetLink, htmlLink: out.htmlLink });
        setBusy(false);
        return;
      }
      setBusy(false);
      onSaved();
    } catch {
      setError("Erro de rede.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!edit) return;
    if (!window.confirm("Excluir esta reunião? Os participantes serão avisados.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agenda/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: edit.id, source: edit.source, calendarId: edit.calendarId }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || out.error) {
        setError(out.error ?? "Falha ao excluir.");
        setBusy(false);
        return;
      }
      onSaved();
    } catch {
      setError("Erro de rede.");
      setBusy(false);
    }
  }

  function copyLink() {
    const link = created?.meetLink ?? created?.htmlLink;
    if (link) {
      navigator.clipboard?.writeText(link).catch(() => {});
      setCopied(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">{created ? "Reunião criada" : isEdit ? "Editar reunião" : "Nova reunião"}</h2>
          <button onClick={created ? onSaved : onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle"><X className="h-4 w-4" /></button>
        </div>

        {created ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              <Check className="h-4 w-4 shrink-0" /> Convites enviados aos participantes.
            </div>
            {created.meetLink && (
              <div className="rounded-xl border border-line bg-canvas p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted"><Video className="h-3.5 w-3.5" /> Link do Google Meet</p>
                <div className="flex items-center gap-2">
                  <a href={created.meetLink} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-brand-600 hover:underline">{created.meetLink}</a>
                  <button onClick={copyLink} className="shrink-0 rounded-lg border border-line p-1.5 text-muted hover:bg-subtle" title="Copiar">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onSaved} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Concluir</button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {isEdit && edit!.link && (
                <a href={edit!.link} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  <Video className="h-4 w-4" /> Entrar no Meet
                </a>
              )}
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex.: Diagnóstico — Padaria do João)" className={inputCls} />
              <div className="grid grid-cols-3 gap-2">
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                  <option value="meeting">Reunião</option>
                  <option value="call">Call</option>
                  <option value="other">Outro</option>
                </select>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
              </div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Descrição / pauta (opcional)" disabled={!canRich} className={inputCls + " resize-y" + (canRich ? "" : " opacity-60")} />
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted"><Users className="h-3.5 w-3.5" /> Convidados (e-mails separados por vírgula)</label>
              <input value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="fulano@empresa.com, ciclano@..." disabled={!canRich} className={inputCls + (canRich ? "" : " opacity-60")} />
              {canRich ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={addMeet} onChange={(e) => setAddMeet(e.target.checked)} />
                  <Video className="h-4 w-4 text-brand-500" /> {isEdit && edit!.link ? "Manter Google Meet" : "Adicionar Google Meet"}
                </label>
              ) : (
                <p className="text-[11px] text-amber-600">
                  {isEdit ? "Evento do calendário do sistema — descrição, convidados e Meet exigem Google." : "Conecte o Google em Integrações para Meet e convidados. Sem conexão, salva só no calendário do sistema."}
                </p>
              )}
              {error && <p className="text-[11px] text-red-600">{error}</p>}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              {isEdit ? (
                <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Excluir
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-subtle">Cancelar</button>
                <button onClick={save} disabled={busy || !title.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} {isEdit ? "Salvar" : googleConnected ? "Criar reunião" : "Criar"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
