import type { PropertyDef } from "@/lib/data/crm";

/** Formata o valor de uma propriedade conforme o tipo do campo. */
function formatValue(def: PropertyDef, raw: unknown): string {
  if (raw == null || raw === "") return "—";
  switch (def.fieldType) {
    case "checkbox":
      return raw ? "Sim" : "Não";
    case "currency":
      return `R$ ${Number(raw).toLocaleString("pt-BR")}`;
    case "multiselect":
      if (Array.isArray(raw)) {
        return raw
          .map((v) => def.options.find((o) => o.value === v)?.label ?? String(v))
          .join(", ");
      }
      return String(raw);
    case "select":
      return def.options.find((o) => o.value === raw)?.label ?? String(raw);
    default:
      return String(raw);
  }
}

/**
 * Lista read-only de propriedades customizadas (Fase 1). Mostra todas as
 * definições do objeto, com "—" quando sem valor. A edição inline chega na
 * Fase 2 (propriedades customizadas).
 */
export function PropertyList({
  defs,
  values,
  title = "Propriedades",
}: {
  defs: PropertyDef[];
  values: Record<string, unknown>;
  title?: string;
}) {
  if (!defs.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      <div className="space-y-1.5">
        {defs.map((def) => (
          <div key={def.id} className="flex items-center justify-between gap-3 py-1 text-sm">
            <span className="text-muted">{def.label}</span>
            <span className="truncate text-right text-ink">
              {formatValue(def, values[def.key])}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
