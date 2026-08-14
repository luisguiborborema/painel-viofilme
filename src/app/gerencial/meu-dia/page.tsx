import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Inbox,
  KanbanSquare,
  ListChecks,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getSession } from "@/lib/auth/session";
import {
  getClientRequests,
  getCrmLeads,
  getCrmTasks,
  getDeliveryTasks,
} from "@/lib/data/queries";
import { getCalendarEvents } from "@/lib/data/agenda-server";
import { getGoogleStatus } from "@/lib/google/client";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { buildTaskItems } from "@/lib/data/crm";
import { OPS_TEAM } from "@/lib/data/operacao";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";

// Fora do componente (evita a regra de pureza com Date no render).
function todayContext() {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const startIso = new Date(`${todayStr}T00:00:00-03:00`).toISOString();
  const endIso = new Date(`${todayStr}T23:59:59-03:00`).toISOString();
  const hour = Number(now.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).slice(0, 2));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const dateLabel = now.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
  return { startIso, endIso, greeting, dateLabel, todayStr };
}
function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}
function dateShort(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}

type Bucket = "overdue" | "today" | "upcoming" | "none";
const BUCKET_ORDER: Record<Bucket, number> = { overdue: 0, today: 1, upcoming: 2, none: 3 };
const BUCKET_TONE: Record<Bucket, string> = {
  overdue: "text-rose-500",
  today: "text-amber-600",
  upcoming: "text-muted",
  none: "text-muted",
};

type DayTask = {
  key: string;
  title: string;
  sub: string;
  dueLabel: string;
  bucket: Bucket;
  urgent?: boolean;
  href: string;
  tag: string;
};

export default async function MeuDia() {
  const { startIso, endIso, greeting, dateLabel, todayStr } = todayContext();
  const user = await getSession();
  const me = user?.name ?? "";
  const first = me.split(" ")[0] || "você";

  const gstatus = await getGoogleStatus();
  const [deliveries, leads, crmTasks, ownEvents, googleEvents, requests] = await Promise.all([
    getDeliveryTasks(),
    getCrmLeads(),
    getCrmTasks(),
    getCalendarEvents(user?.id ?? "", startIso, endIso),
    gstatus.connected
      ? listUpcomingEvents(20, { timeMin: startIso, timeMax: endIso })
      : Promise.resolve([]),
    getClientRequests(),
  ]);

  // Identidade do usuário nas tarefas de entrega (assignee pode ser id OU nome).
  const meMember = OPS_TEAM.find(
    (m) => me && me.toLowerCase().includes(m.name.split(" ")[0].toLowerCase()),
  );
  const meKeys = new Set([me, meMember?.id, meMember?.name].filter(Boolean) as string[]);

  // Agenda de hoje: eventos próprios (calendar_events) + Google, ordenados.
  const events = [
    ...ownEvents.map((e) => ({ id: `o-${e.id}`, title: e.title, start: e.startAt, link: e.meetLink })),
    ...googleEvents.map((e, i) => ({
      id: `g-${e.id ?? i}`,
      title: e.summary || "(sem título)",
      start: e.start ?? "",
      link: e.hangoutLink ?? e.htmlLink,
    })),
  ]
    .filter((e) => e.start)
    .sort((a, b) => a.start.localeCompare(b.start));

  // Minhas tarefas de entrega (mine + não concluídas).
  const deliveryItems: DayTask[] = deliveries
    .filter((t) => {
      const ids = t.assignees?.length ? t.assignees : t.assignee ? [t.assignee] : [];
      return t.stage !== "done" && ids.some((x) => meKeys.has(x));
    })
    .map((t) => {
      const d = t.dueDate ? t.dueDate.slice(0, 10) : "";
      const bucket: Bucket = t.late ? "overdue" : d === todayStr ? "today" : d && d > todayStr ? "upcoming" : "none";
      return {
        key: `d-${t.id}`,
        title: t.title,
        sub: t.client || "—",
        dueLabel: t.dueLabel || (t.dueDate ? dateShort(t.dueDate) : "sem prazo"),
        bucket,
        urgent: t.priority === "urgente",
        href: "/gerencial/entregas",
        tag: t.type,
      };
    });

  // Minhas atividades do comercial (pendentes + minhas).
  const crmItems: DayTask[] = buildTaskItems(crmTasks, leads)
    .filter((t) => {
      if (t.status !== "pending") return false;
      const a = t.assignees?.length ? t.assignees : t.assignee ? [t.assignee] : [];
      return a.length ? a.includes(me) : t.owner === me;
    })
    .map((t) => {
      const d = t.dueDate ? t.dueDate.slice(0, 10) : "";
      const bucket: Bucket = d && d < todayStr ? "overdue" : d === todayStr ? "today" : d ? "upcoming" : "none";
      return {
        key: `c-${t.id}`,
        title: t.title,
        sub: t.dealName || "Comercial",
        dueLabel: t.dueDate ? dateShort(t.dueDate) : "sem prazo",
        bucket,
        href: "/gerencial/comercial/atividades",
        tag: "Comercial",
      };
    });

  const tasks = [...deliveryItems, ...crmItems].sort(
    (a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket],
  );
  const overdue = tasks.filter((t) => t.bucket === "overdue").length;
  const dueToday = tasks.filter((t) => t.bucket === "today").length;
  const openRequests = (requests.meetings?.length ?? 0) + (requests.content?.length ?? 0);
  const shownTasks = tasks.slice(0, 12);

  return (
    <div className="space-y-4">
      {/* Saudação */}
      <div className="rounded-2xl bg-brand-700 p-5 text-white sm:p-6">
        <p className="text-sm capitalize text-white/70">{dateLabel}</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting}, {first} 👋
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {overdue > 0
            ? `Você tem ${overdue} tarefa${overdue > 1 ? "s" : ""} atrasada${overdue > 1 ? "s" : ""} — comece por elas.`
            : dueToday > 0
              ? `${dueToday} tarefa${dueToday > 1 ? "s" : ""} para hoje. Bom trabalho!`
              : "Nada atrasado. Dia sob controle. ✨"}
        </p>
      </div>

      {/* Métricas */}
      <div data-tour="md-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Atrasadas" value={String(overdue)} icon={AlertTriangle} />
        <StatCard label="Para hoje" value={String(dueToday)} icon={ListChecks} />
        <StatCard label="Reuniões hoje" value={String(events.length)} icon={CalendarDays} />
        <StatCard label="Solicitações" value={String(openRequests)} icon={Inbox} hint="Portal do cliente" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Agenda de hoje */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarDays className="h-4 w-4 text-brand-500" /> Agenda de hoje
            </h2>
            <Link href="/gerencial/agenda" className="text-xs font-medium text-brand-600 hover:underline">
              abrir agenda
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="rounded-lg bg-subtle px-3 py-3 text-sm text-muted">Nenhuma reunião hoje. Agenda livre. ✅</p>
          ) : (
            <ul className="space-y-1.5">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="shrink-0 font-semibold text-ink tabular-nums">{hhmm(e.start)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{e.title}</span>
                  {e.link && (
                    <a
                      href={e.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                    >
                      <Video className="h-3 w-3" /> Entrar
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Minhas tarefas */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <ListChecks className="h-4 w-4 text-brand-500" /> Minhas tarefas
            </h2>
            <span className="text-xs text-muted">{tasks.length} no total</span>
          </div>
          {shownTasks.length === 0 ? (
            <p className="rounded-lg bg-subtle px-3 py-3 text-sm text-muted">Tudo em dia. Nada pendente pra você. 🎉</p>
          ) : (
            <ul className="space-y-1.5">
              {shownTasks.map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-subtle"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-ink">{t.title}</span>
                        {t.urgent && (
                          <span className="shrink-0 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-500">
                            urgente
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {t.tag} · {t.sub}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-xs font-medium", BUCKET_TONE[t.bucket])}>
                      {t.bucket === "overdue" ? `⚠ ${t.dueLabel}` : t.dueLabel}
                    </span>
                  </Link>
                </li>
              ))}
              {tasks.length > shownTasks.length && (
                <li className="pt-1 text-center text-[11px] text-muted">
                  +{tasks.length - shownTasks.length} outras
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>

      {/* Atalhos */}
      <div data-tour="md-atalhos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/gerencial/entregas", label: "Painel de Entregas", icon: ListChecks },
          { href: "/gerencial/agenda", label: "Agenda", icon: CalendarCheck },
          { href: "/gerencial/comercial/pipeline", label: "Pipeline", icon: KanbanSquare },
          { href: "/gerencial/solicitacoes", label: "Solicitações", icon: Inbox },
        ].map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink transition-shadow hover:shadow-md"
          >
            <span className="inline-flex items-center gap-2">
              <s.icon className="h-4 w-4 text-brand-500" /> {s.label}
            </span>
            <ArrowRight className="h-4 w-4 text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
