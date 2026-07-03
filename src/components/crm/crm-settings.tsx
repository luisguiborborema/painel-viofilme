import type {
  Company,
  Contact,
  CrmLead,
  Pipeline,
  PropertyDef,
  Tag,
  TaskFlow,
} from "@/lib/data/crm";
import { PropertyManager } from "./property-manager";
import { StageManager } from "./stage-manager";
import { TagManager } from "./tag-manager";
import { CrmImportExport } from "./crm-import-export";
import { FlowManager } from "./flow-manager";

/**
 * Central de personalização do CRM: estágios do pipeline, propriedades
 * customizadas e tags (com cor).
 */
export function CrmSettings({
  properties,
  pipeline,
  tags,
  leads,
  companies,
  contacts,
  flows,
}: {
  properties: PropertyDef[];
  pipeline: Pipeline;
  tags: Tag[];
  leads: CrmLead[];
  companies: Company[];
  contacts: Contact[];
  flows: TaskFlow[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-ink">Estágios do pipeline</h2>
        <p className="mb-3 text-xs text-muted">
          Adicione, renomeie, reordene e escolha a cor e a probabilidade de cada estágio.
          Estágios do tipo <strong>Ganho</strong>/<strong>Perdido</strong> fecham o negócio.
        </p>
        <StageManager
          pipeline={pipeline}
          dealProperties={properties.filter((p) => p.objectType === "deal")}
        />
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

      <section>
        <h2 className="text-sm font-semibold text-ink">Fluxos de tarefas</h2>
        <p className="mb-3 text-xs text-muted">
          Playbooks: conjuntos ordenados de tarefas (com prazo relativo) que você
          aplica de uma vez a um negócio.
        </p>
        <FlowManager flows={flows} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Importar / Exportar</h2>
        <p className="mb-3 text-xs text-muted">
          Baixe seus dados em CSV ou importe negócios em massa por planilha.
        </p>
        <CrmImportExport leads={leads} companies={companies} contacts={contacts} />
      </section>
    </div>
  );
}
