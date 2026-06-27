"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PlatformIcon } from "@/components/dashboard/platform";
import { clockLabel } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { ContentPost, Platform } from "@/lib/data/types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Status = "pending" | "scheduled" | "published";

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  scheduled: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  published: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

function statusOf(p: ContentPost): Status {
  if (p.status === "published") return "published";
  if (p.approval === "approved") return "scheduled";
  return "pending"; // pending ou changes_requested
}

function whenOf(p: ContentPost): string | null {
  return p.scheduledAt ?? p.publishedAt;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  return addDays(d, -d.getUTCDay());
}

function formatLabel(m: ContentPost["mediaType"]): string {
  if (m === "reel" || m === "video") return "Reels";
  if (m === "story") return "Stories";
  return "Feed";
}

export function CalendarView({
  posts,
  refIso,
  network,
  onSelectPost,
  onRequestDate,
}: {
  posts: ContentPost[];
  refIso: string;
  network: "todas" | "instagram" | "facebook";
  onSelectPost: (id: string) => void;
  onRequestDate: (date: string) => void;
}) {
  const today = new Date(refIso);
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState<Date>(today);
  const todayKey = dayKey(today);

  const filtered = posts.filter(
    (p) => network === "todas" || p.platform === (network as Platform),
  );
  const byDay = new Map<string, ContentPost[]>();
  for (const p of filtered) {
    const w = whenOf(p);
    if (!w) continue;
    const k = w.slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(p);
  }

  function shift(dir: number) {
    setCursor((c) => addDays(c, dir * (view === "week" ? 7 : 30)));
  }

  const periodLabel =
    view === "week"
      ? (() => {
          const s = startOfWeek(cursor);
          const e = addDays(s, 6);
          return `${s.getUTCDate()}–${e.getUTCDate()} de ${MONTHS[e.getUTCMonth()]}`;
        })()
      : `${MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                view === v ? "bg-brand-500 text-white" : "text-muted hover:text-ink",
              )}
            >
              {v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            className="rounded-lg border border-line bg-surface p-2 text-muted hover:text-ink"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-ink">
            {periodLabel}
          </span>
          <button
            onClick={() => shift(1)}
            className="rounded-lg border border-line bg-surface p-2 text-muted hover:text-ink"
            aria-label="Próximo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(today)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle"
          >
            Hoje
          </button>
        </div>
      </div>

      {view === "week" ? (
        <WeekGrid
          cursor={cursor}
          byDay={byDay}
          todayKey={todayKey}
          onSelectPost={onSelectPost}
          onRequestDate={onRequestDate}
        />
      ) : (
        <MonthGrid
          cursor={cursor}
          byDay={byDay}
          todayKey={todayKey}
          onSelectPost={onSelectPost}
          onRequestDate={onRequestDate}
        />
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <Legend cls="bg-amber-400" label="Aguardando aprovação" />
        <Legend cls="bg-sky-400" label="Agendado" />
        <Legend cls="bg-emerald-400" label="Publicado" />
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", cls)} /> {label}
    </span>
  );
}

function WeekGrid({
  cursor,
  byDay,
  todayKey,
  onSelectPost,
  onRequestDate,
}: {
  cursor: Date;
  byDay: Map<string, ContentPost[]>;
  todayKey: string;
  onSelectPost: (id: string) => void;
  onRequestDate: (date: string) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const k = dayKey(d);
        const list = byDay.get(k) ?? [];
        const isToday = k === todayKey;
        return (
          <div key={k} className="rounded-xl border border-line bg-surface p-2">
            <div className={cn("mb-2 text-xs font-medium", isToday ? "text-brand-300" : "text-muted")}>
              {WEEKDAYS[d.getUTCDay()]} {d.getUTCDate()}
            </div>
            <div className="space-y-2">
              {list.map((p) => {
                const st = statusOf(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectPost(p.id)}
                    className="w-full overflow-hidden rounded-lg border border-line bg-subtle text-left transition-colors hover:bg-subtle-strong"
                  >
                    <div className="flex items-center justify-between px-2 pt-1.5 text-[11px]">
                      <span className="font-medium text-muted">{formatLabel(p.mediaType)}</span>
                      <span className="text-muted">
                        {whenOf(p) ? clockLabel(whenOf(p)!) : ""}
                      </span>
                    </div>
                    <p className="line-clamp-2 px-2 text-xs text-ink">{p.caption}</p>
                    <span className={cn("mt-1 block h-1", st === "pending" ? "bg-amber-400" : st === "scheduled" ? "bg-sky-400" : "bg-emerald-400")} />
                  </button>
                );
              })}
              {list.length === 0 && (
                <button
                  onClick={() => onRequestDate(k)}
                  className="flex w-full items-center justify-center rounded-lg border border-dashed border-line py-3 text-muted transition-colors hover:border-brand-400 hover:text-ink"
                  aria-label="Solicitar conteúdo neste dia"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({
  cursor,
  byDay,
  todayKey,
  onSelectPost,
  onRequestDate,
}: {
  cursor: Date;
  byDay: Map<string, ContentPost[]>;
  todayKey: string;
  onSelectPost: (id: string) => void;
  onRequestDate: (date: string) => void;
}) {
  const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const month = cursor.getUTCMonth();

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-surface text-center text-xs font-medium text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const k = dayKey(d);
          const list = byDay.get(k) ?? [];
          const inMonth = d.getUTCMonth() === month;
          const isToday = k === todayKey;
          return (
            <div
              key={k}
              className={cn(
                "min-h-[88px] border-b border-r border-line p-1.5 last:border-r-0",
                !inMonth && "bg-subtle/40",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn("text-xs", isToday ? "font-bold text-brand-300" : "text-muted")}>
                  {d.getUTCDate()}
                </span>
                {inMonth && list.length === 0 && (
                  <button
                    onClick={() => onRequestDate(k)}
                    className="text-muted hover:text-ink"
                    aria-label="Solicitar"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {list.slice(0, 2).map((p) => {
                  const st = statusOf(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectPost(p.id)}
                      className={cn(
                        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                        STATUS_STYLE[st],
                      )}
                    >
                      <PlatformIcon platform={p.platform} className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">
                        {whenOf(p) ? clockLabel(whenOf(p)!) : ""} {formatLabel(p.mediaType)}
                      </span>
                    </button>
                  );
                })}
                {list.length > 2 && (
                  <button
                    onClick={() => onSelectPost(list[2].id)}
                    className="text-[10px] font-medium text-brand-300 hover:text-brand-200"
                  >
                    + {list.length - 2} posts
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
