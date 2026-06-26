import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CLevel } from "@/lib/data/queries";

export function ScaleGoalCard({ goal }: { goal: CLevel["scaleGoal"] }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Meta de escala — clientes ativos
        </h2>
        <button className="text-xs font-medium text-brand-300 hover:text-brand-200">
          simular
        </button>
      </div>

      <p className="text-3xl font-bold tracking-tight text-ink">
        {goal.active}
        <span className="text-lg font-normal text-muted">
          {" "}
          de {goal.target} clientes
        </span>
      </p>
      <p className="text-xs text-muted">meta {goal.metaDate}</p>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500"
          style={{ width: `${goal.pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {goal.pct}% · necessário +{goal.neededPace} clientes/mês para atingir a
        meta
      </p>

      <dl className="mt-4 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted">Ritmo atual</dt>
          <dd className="font-medium text-ink">
            {goal.currentPace.toLocaleString("pt-BR")} clientes/mês
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Necessário para meta</dt>
          <dd className="font-medium text-ink">
            {goal.neededPace.toLocaleString("pt-BR", {
              minimumFractionDigits: 1,
            })}{" "}
            fechamentos/mês
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Projeção no ritmo atual</dt>
          <dd className="font-medium text-ink">
            ~{goal.projection} clientes até {goal.metaDate}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {goal.gap}
      </div>
    </Card>
  );
}
