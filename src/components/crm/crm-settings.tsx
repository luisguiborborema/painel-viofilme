import type { PropertyDef } from "@/lib/data/crm";
import { PropertyManager } from "./property-manager";

/**
 * Central de personalização do CRM. Fase 2: propriedades customizadas.
 * (Fase 3 adiciona o editor de pipeline; Fase 4, gerenciamento de tags.)
 */
export function CrmSettings({ properties }: { properties: PropertyDef[] }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-ink">Propriedades customizadas</h2>
        <p className="mb-3 text-xs text-muted">
          Campos extras para Empresas, Contatos e Negócios — como no HubSpot. Aparecem
          na ficha de cada objeto para preenchimento.
        </p>
        <PropertyManager properties={properties} />
      </section>
    </div>
  );
}
