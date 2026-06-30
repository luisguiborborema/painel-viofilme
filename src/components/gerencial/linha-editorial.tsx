"use client";

import { useState } from "react";
import {
  Check,
  FileDown,
  Pencil,
  Presentation,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  EDITORIAL_STAGES,
  type EditorialFormat,
  type EditorialLine,
} from "@/lib/data/operacao";

const FORMAT_FILTERS: ("Todos" | EditorialFormat)[] = [
  "Todos",
  "Feed",
  "Reels",
  "Stories",
  "Carrossel",
];

const FORMAT_COLOR: Record<EditorialFormat, string> = {
  Feed: "bg-sky-500/15 text-sky-300",
  Reels: "bg-rose-500/15 text-rose-300",
  Stories: "bg-violet-500/15 text-violet-300",
  Carrossel: "bg-emerald-500/15 text-emerald-300",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export function LinhaEditorial({ data }: { data: EditorialLine }) {
  const [filter, setFilter] = useState<"Todos" | EditorialFormat>("Todos");
  const currentStageIdx = EDITORIAL_STAGES.findIndex((s) => s.key === data.stage);

  const posts =
    filter === "Todos"
      ? data.posts
      : data.posts.filter((p) => p.format === filter);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">
            Linha editorial — {data.month}
          </h2>
          <p className="text-sm text-muted">
            {data.clientName} · criada por {data.createdBy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <FileDown className="h-4 w-4" /> Exportar PDF
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Presentation className="h-4 w-4" /> Apresentar ao cliente
          </button>
        </div>
      </div>

      {/* Stepper de estágios */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        {EDITORIAL_STAGES.map((s, i) => {
          const done = i < currentStageIdx;
          const active = i === currentStageIdx;
          return (
            <div key={s.key} className="flex items-center">
              <span
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-brand-500 text-white"
                    : done
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-surface text-muted",
                )}
              >
                {done && <Check className="h-3 w-3" />}
                {s.label}
              </span>
              {i < EDITORIAL_STAGES.length - 1 && (
                <span className="mx-0.5 h-px w-4 bg-line" />
              )}
            </div>
          );
        })}
      </div>

      {/* Dados da LE + Pilares */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold text-ink">Dados da LE</h3>
          <div className="divide-y divide-line">
            <Field label="Cliente" value={data.clientName} />
            <Field label="Mês de referência" value={data.month} />
            <Field label="Frequência" value={data.frequency} />
            <Field label="Redes" value={data.networks} />
            <Field label="Responsáveis" value={data.responsibles} />
            <Field label="Reunião de aprovação" value={data.approvalMeeting} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Pilares de conteúdo</h3>
            <button className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
              <Pencil className="h-3.5 w-3.5" /> editar
            </button>
          </div>
          <ul className="space-y-2.5">
            {data.pillars.map((p) => (
              <li key={p.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: p.color }}
                  />
                  {p.name}
                </span>
                <span className="text-xs font-medium text-muted">
                  {p.posts} posts
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Ativos planejados */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            Ativos planejados — {data.posts.length} posts
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {FORMAT_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === f
                    ? "bg-ink text-surface"
                    : "bg-surface text-muted hover:text-ink",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Card key={p.n} className="flex flex-col p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-xs font-bold text-ink">
                  {String(p.n).padStart(2, "0")}
                </span>
                <span className="text-xs text-muted">
                  {p.date} ({p.weekday})
                </span>
              </div>
              <p className="text-sm font-medium text-ink">{p.title}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    FORMAT_COLOR[p.format],
                  )}
                >
                  {p.format}
                </span>
                <span className="rounded-full bg-subtle-strong px-2 py-0.5 text-[11px] font-medium text-muted">
                  {p.pillar}
                </span>
              </div>
              <p className="mt-2 flex-1 text-xs text-muted">{p.description}</p>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-[11px] text-muted">{p.assetNote}</span>
                <button className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
                  <Pencil className="h-3 w-3" /> Editar
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Alerta de validação */}
      <Card className="flex items-start gap-3 border-amber-500/30 bg-amber-500/[0.06] p-4">
        <span className="mt-0.5 text-amber-300">
          <TriangleAlert className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">
            Aguardando validação para gerar tarefas de produção
          </p>
          <p className="text-xs text-muted">
            Quando esta Linha Editorial for aprovada (reunião de {data.approvalMeeting}),
            a Social Media valida e o sistema quebra os ativos em tarefas de
            produção, distribuídas no Painel de Entregas para Robert (Design) e
            Gustavo (Copy).
          </p>
        </div>
      </Card>
    </div>
  );
}
