import type { Pipeline, PropertyDef } from "@/lib/data/crm";
import { PropertyManager } from "./property-manager";
import { StageManager } from "./stage-manager";

/**
 * Central de personalização do CRM. Fase 2: propriedades customizadas.
 * Fase 3: editor de pipeline/estágios. (Fase 4: gerenciamento de tags.)
 */
export function CrmSettings({
  properties,
  pipeline,
}: {
  properties: PropertyDef[];
  pipeline: Pipeline;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-ink">Estágios do pipeline</h2>
        <p className="mb-3 text-xs text-muted">
          Adicione, renomeie, reordene e escolha a cor e a probabilidade de cada estágio.
          Estágios do tipo <strong>Ganho</strong>/<strong>Perdido</strong> fecham o negócio.
        </p>
        <StageManager pipeline={pipeline} />
      </section>

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
