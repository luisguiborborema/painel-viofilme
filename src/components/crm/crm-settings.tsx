import type { Pipeline, PropertyDef, Tag } from "@/lib/data/crm";
import { PropertyManager } from "./property-manager";
import { StageManager } from "./stage-manager";
import { TagManager } from "./tag-manager";

/**
 * Central de personalização do CRM: estágios do pipeline, propriedades
 * customizadas e tags (com cor).
 */
export function CrmSettings({
  properties,
  pipeline,
  tags,
}: {
  properties: PropertyDef[];
  pipeline: Pipeline;
  tags: Tag[];
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
        <h2 className="text-sm font-semibold text-ink">Tags</h2>
        <p className="mb-3 text-xs text-muted">
          Etiquetas coloridas para classificar Empresas, Contatos e Negócios. Aplique
          na ficha de cada objeto e filtre no pipeline.
        </p>
        <TagManager tags={tags} />
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
