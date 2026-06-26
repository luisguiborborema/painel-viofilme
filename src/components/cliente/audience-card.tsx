import { Card } from "@/components/ui/card";
import type { AudienceProfile } from "@/lib/data/types";

const CELL = ["bg-subtle", "bg-emerald-500/45", "bg-emerald-400"];

export function AudienceCard({ audience }: { audience: AudienceProfile }) {
  const maxAge = Math.max(...audience.ageRanges.map((a) => a.pct), 1);

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">
        Perfil da audiência — Instagram
      </h2>

      {/* Faixa etária */}
      <p className="mb-2 text-xs font-medium text-muted">Faixa etária</p>
      <div className="space-y-1.5">
        {audience.ageRanges.map((a) => (
          <div key={a.label} className="flex items-center gap-2">
            <span className="w-12 text-xs text-muted">{a.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
              <div
                className="h-full rounded-full bg-brand-400"
                style={{ width: `${(a.pct / maxAge) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs font-medium text-ink">
              {a.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Melhores horários */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs font-medium text-muted">Melhores horários</p>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${CELL[0]}`} />
            Baixa
          </span>
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${CELL[1]}`} />
            Méd.
          </span>
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${CELL[2]}`} />
            Alta
          </span>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {audience.bestHours.rows.map((row, r) => (
          <div key={row} className="flex items-center gap-2">
            <span className="w-12 text-xs text-muted">{row}</span>
            <div className="flex flex-1 gap-1">
              {audience.bestHours.grid[r].map((level, c) => (
                <span
                  key={c}
                  className={`h-3.5 flex-1 rounded-sm ${CELL[level] ?? CELL[0]}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Localização */}
      <p className="mb-2 mt-5 text-xs font-medium text-muted">Localização</p>
      <ul className="space-y-1.5">
        {audience.topLocations.map((loc) => (
          <li
            key={loc.city}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-ink">{loc.city}</span>
            <span className="text-xs font-medium text-muted">{loc.pct}%</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
