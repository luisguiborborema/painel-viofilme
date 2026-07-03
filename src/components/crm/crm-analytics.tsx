import { TrendingDown, Trophy, Target, Clock } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { FunnelAnalytics } from "@/lib/data/crm";

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function CrmAnalytics({ funnel }: { funnel: FunnelAnalytics }) {
  const maxReached = Math.max(1, ...funnel.stages.map((s) => s.reached));
  const maxLost = Math.max(1, ...funnel.lostReasons.map((r) => r.count));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<Target className="h-4 w-4" />}
          label="Em aberto"
          value={String(funnel.openCount)}
          hint={formatBRL(funnel.openValue) + "/mês"}
        />
        <Kpi
          icon={<Trophy className="h-4 w-4" />}
          label="Taxa de ganho"
          value={`${funnel.winRate}%`}
          hint={`${funnel.won} ganhos · ${funnel.lost} perdidos`}
        />
        <Kpi
          icon={<Trophy className="h-4 w-4" />}
          label="Ganhos"
          value={String(funnel.won)}
        />
        <Kpi
          icon={<TrendingDown className="h-4 w-4" />}
          label="Perdidos"
          value={String(funnel.lost)}
        />
      </div>

      {/* Funil */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink">Funil por estágio</h2>
        <p className="mb-4 text-xs text-muted">
          Alcançaram cada estágio e a conversão vinda do anterior. Barras proporcionais
          ao nº que chegou; a idade média mostra onde os negócios travam.
        </p>
        <div className="space-y-2.5">
          {funnel.stages.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3">
              <div className="w-36 shrink-0 text-right">
                <p className="truncate text-sm font-medium text-ink">{s.label}</p>
                <p className="text-[11px] text-muted">
                  {s.current} agora
                  {s.value > 0 ? ` · ${formatBRL(s.value)}` : ""}
                </p>
              </div>
              <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-canvas">
                <div
                  className="flex h-full items-center rounded-lg px-2"
                  style={{
                    width: `${Math.max(6, (s.reached / maxReached) * 100)}%`,
                    backgroundColor: `${s.color}33`,
                    borderLeft: `3px solid ${s.color}`,
                  }}
                >
                  <span className="text-xs font-semibold text-ink">{s.reached}</span>
                </div>
              </div>
              <div className="w-24 shrink-0 text-xs">
                {i > 0 && (
                  <p
                    className={
                      s.conversion >= 60
                        ? "font-semibold text-emerald-600"
                        : s.conversion >= 30
                          ? "font-semibold text-amber-600"
                          : "font-semibold text-rose-500"
                    }
                  >
                    {s.conversion}% conv.
                  </p>
                )}
                <p className="inline-flex items-center gap-1 text-muted">
                  <Clock className="h-3 w-3" /> {s.avgAgeDays}d méd.
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Motivos de perda */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Motivos de perda</h2>
        {funnel.lostReasons.length === 0 ? (
          <p className="text-sm text-muted">Nenhum negócio perdido registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {funnel.lostReasons.map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <div className="w-44 shrink-0 truncate text-sm text-ink" title={r.label}>
                  {r.label}
                </div>
                <div className="h-6 flex-1 overflow-hidden rounded-lg bg-canvas">
                  <div
                    className="h-full rounded-lg bg-rose-500/70"
                    style={{ width: `${Math.max(6, (r.count / maxLost) * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold text-ink">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
