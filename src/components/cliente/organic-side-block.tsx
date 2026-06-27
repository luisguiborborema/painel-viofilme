import { Card } from "@/components/ui/card";
import { DonutChart } from "@/components/dashboard/charts";

export type FormatSlice = { name: string; value: number; color: string };

/** Bloco da coluna direita da Home para clientes sem tráfego pago (R05). */
export function OrganicSideBlock({ items }: { items: FormatSlice[] }) {
  const leader = [...items].sort((a, b) => b.value - a.value)[0];
  return (
    <Card className="p-5">
      <h2 className="mb-2 text-sm font-semibold text-ink">
        Alcance por tipo de conteúdo
      </h2>
      <DonutChart data={items} height={200} />
      <ul className="mt-2 space-y-1.5">
        {items.map((it) => (
          <li
            key={it.name}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2 text-muted">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: it.color }}
              />
              {it.name}
            </span>
            <span className="font-medium text-ink">{it.value}%</span>
          </li>
        ))}
      </ul>
      {leader && (
        <p className="mt-3 text-xs text-muted">
          {leader.name} lidera o alcance este mês — vale priorizar esse formato.
        </p>
      )}
    </Card>
  );
}
