import {
  DEFAULT_ASSIGNMENT,
  type AssignmentConfig,
  type CardFieldSetting,
  type Company,
  type Contact,
  type CrmLead,
  type DealScript,
  type FreezeReason,
  type LostReason,
  type Pipeline,
  type PropertyDef,
  type PropertyGroup,
  type Workflow,
  type Tag,
  type TaskFlow,
  type CaptureForm,
} from "@/lib/data/crm";
import { CardLayoutManager } from "./card-layout-manager";
import { PropertyManager } from "./property-manager";
import { WorkflowManager } from "./workflow-manager";
import { StageManager } from "./stage-manager";
import { TagManager } from "./tag-manager";
import { CrmImportExport } from "./crm-import-export";
import { FlowManager } from "./flow-manager";
import { ScriptsManager } from "./scripts-manager";
import { AssignmentManager } from "./assignment-manager";
import { CaptureFormsManager } from "./capture-forms-manager";
import { DuplicatesManager } from "./duplicates-manager";
import { ReasonsManager, ShortcutPanel, LeadScorePanel } from "./settings-extras";
import { CrmSettingsNav, type SettingsSection } from "./crm-settings-nav";

/** Seções estruturais: escondidas de quem não é gestor/C-level (§4 RBAC). */
const STRUCTURAL_HIDDEN = new Set(["pipelines", "flows", "scripts", "automation", "routines"]);

/**
 * Central de personalização do CRM, organizada em categorias (nav lateral):
 * personalização do card, funil, aquisição e dados.
 */
export function CrmSettings({
  properties,
  pipelines,
  tags,
  leads,
  companies,
  contacts,
  flows,
  scripts = [],
  assignment = DEFAULT_ASSIGNMENT,
  captureForms,
  team = [],
  clients = [],
  cardLayout = [],
  canEditCardLayout = false,
  lostReasons = [],
  freezeReasons = [],
  canEditStructural = false,
  propertyGroups = [],
  workflows = [],
  workflowStats = {},
}: {
  properties: PropertyDef[];
  propertyGroups?: PropertyGroup[];
  workflows?: Workflow[];
  workflowStats?: Record<string, { active: number; done: number; canceled: number }>;
  pipelines: Pipeline[];
  tags: Tag[];
  leads: CrmLead[];
  companies: Company[];
  contacts: Contact[];
  flows: TaskFlow[];
  scripts?: DealScript[];
  assignment?: AssignmentConfig;
  captureForms: CaptureForm[];
  team?: string[];
  clients?: { id: string; name: string }[];
  cardLayout?: CardFieldSetting[];
  canEditCardLayout?: boolean;
  lostReasons?: LostReason[];
  freezeReasons?: FreezeReason[];
  canEditStructural?: boolean;
}) {
  // Estágios de todos os funis (para o seletor "etapa sugerida" dos scripts).
  const stageOptions = (() => {
    const seen = new Set<string>();
    const out: { key: string; label: string }[] = [];
    for (const p of pipelines) {
      for (const s of p.stages) {
        if (seen.has(s.key)) continue;
        seen.add(s.key);
        out.push({ key: s.key, label: `${p.name}: ${s.label}` });
      }
    }
    return out;
  })();
  const sections: SettingsSection[] = [
    {
      key: "layout",
      label: "Layout do card",
      description:
        "Escolha quais itens aparecem no card/modal do negócio e em que ordem — inclusive suas propriedades customizadas. Arraste para reordenar e use o interruptor para mostrar/ocultar.",
      node: (
        <CardLayoutManager
          initial={cardLayout}
          canEdit={canEditCardLayout}
          dealProps={properties
            .filter((p) => p.objectType === "deal")
            .map((p) => ({ key: p.key, label: p.label }))}
        />
      ),
    },
    {
      key: "properties",
      label: "Propriedades customizadas",
      description:
        "Campos extras para Empresas, Contatos e Negócios — como no HubSpot. Aparecem na ficha de cada objeto (e no bloco “Campos” do card).",
      node: <PropertyManager properties={properties} groups={propertyGroups} />,
    },
    {
      key: "workflows",
      label: "Fluxos de automação",
      description:
        "Workflows estilo HubSpot: quando um negócio entra numa etapa (ou é criado), rode uma sequência de ações — criar tarefa, WhatsApp, espera, definir propriedade, notificar.",
      node: (
        <WorkflowManager
          workflows={workflows}
          stats={workflowStats}
          stageOptions={stageOptions}
          team={team}
          dealProps={properties
            .filter((p) => p.objectType === "deal")
            .map((p) => ({ key: p.key, label: p.label }))}
        />
      ),
    },
    {
      key: "tags",
      label: "Tags",
      description:
        "Etiquetas coloridas para classificar Empresas, Contatos e Negócios. Aplique na ficha de cada objeto e filtre no pipeline.",
      node: <TagManager tags={tags} />,
    },
    {
      key: "pipelines",
      label: "Pipelines & estágios",
      description:
        "Crie funis (ex.: Novos negócios, Upsell) e edite os estágios de cada um — nome, cor, probabilidade, regras e automações.",
      node: (
        <StageManager
          pipelines={pipelines}
          dealProperties={properties.filter((p) => p.objectType === "deal")}
          flows={flows}
        />
      ),
    },
    {
      key: "flows",
      label: "Cadências & fluxos",
      description:
        "Playbooks/cadências: conjuntos ordenados de tarefas (com prazo relativo) que você aplica de uma vez a um negócio.",
      node: <FlowManager flows={flows} />,
    },
    {
      key: "scripts",
      label: "Scripts & roteiros",
      description:
        "Biblioteca editável de roteiros injetáveis na ficha do lead (comando /). O time cria os seus e sugere um por etapa do funil.",
      node: <ScriptsManager scripts={scripts} stageOptions={stageOptions} />,
    },
    {
      key: "automation",
      label: "Automações & atribuição",
      description:
        "Como novos negócios ganham responsável (rodízio, carga, origem) e o resumo das automações disparadas por etapa.",
      node: <AssignmentManager config={assignment} team={team} pipelines={pipelines} />,
    },
    {
      key: "forms",
      label: "Formulários e briefings",
      description:
        "Links públicos que, ao preencher, criam um card no destino escolhido — negócio no Comercial ou tarefa no Painel de Entregas. Campos personalizáveis por formulário.",
      node: <CaptureFormsManager forms={captureForms} team={team} pipelines={pipelines} clients={clients} />,
    },
    {
      key: "duplicates",
      label: "Duplicados",
      description:
        "Empresas/contatos repetidos (mesmo nome, telefone ou e-mail). Escolha qual manter e mescle — negócios e associações migram para o primário.",
      node: <DuplicatesManager companies={companies} contacts={contacts} />,
    },
    {
      key: "loss-reasons",
      label: "Motivos de perda",
      description: "Lista usada ao marcar um negócio como Perdido (insumo de qualificação do funil).",
      node: <ReasonsManager kind="loss" reasons={lostReasons} canEdit={canEditStructural} />,
    },
    {
      key: "freeze-reasons",
      label: "Motivos de congelamento",
      description: "Lista usada ao arquivar/congelar um negócio para reengajar em ciclos futuros.",
      node: <ReasonsManager kind="freeze" reasons={freezeReasons} canEdit={canEditStructural} />,
    },
    {
      key: "routines",
      label: "Rotinas (modelos)",
      description: "Modelos de rotina por cargo/squad (blocos de tempo padrão) usados na Agenda.",
      node: (
        <ShortcutPanel
          description="Os modelos de rotina são criados e aplicados na Agenda, onde ficam ao lado dos blocos de tempo do time."
          href="/gerencial/agenda"
          cta="Abrir Agenda"
        />
      ),
    },
    {
      key: "scheduling",
      label: "Links de agendamento",
      description: "Links tipo Calendly usados para marcar reuniões (vivem na Agenda).",
      node: (
        <ShortcutPanel
          description="Os links de agendamento são gerenciados na Agenda, junto do calendário e da rotina."
          href="/gerencial/agenda"
          cta="Abrir Agenda"
        />
      ),
    },
    {
      key: "goals",
      label: "Metas & distribuição",
      description: "Metas do time e distribuição por liderado. A operação vive em Insights › Metas.",
      node: (
        <ShortcutPanel
          description="As metas e a distribuição por responsável são definidas em Insights › Metas, ao lado do forecast."
          href="/gerencial/comercial/insights"
          cta="Abrir Insights"
        />
      ),
    },
    {
      key: "products",
      label: "Produtos / Serviços",
      description: "Catálogo de serviços, planos e pacotes — vive em Listas › Produtos.",
      node: (
        <ShortcutPanel
          description="O catálogo de serviços e planos é cadastrado em Listas › Produtos."
          href="/gerencial/comercial/listas"
          cta="Abrir Listas"
        />
      ),
    },
    {
      key: "channels",
      label: "Canais de comunicação",
      description: "Conexão de WhatsApp, Instagram e e-mail — vive em Integrações.",
      node: (
        <ShortcutPanel
          description="As conexões de canais (WhatsApp, Instagram, e-mail, Google Calendar) ficam em Integrações."
          href="/gerencial/integracoes"
          cta="Abrir Integrações"
        />
      ),
    },
    {
      key: "leadscore",
      label: "Regras de lead score",
      description: "Como o score é calculado (pesos e gatilhos).",
      node: <LeadScorePanel />,
    },
    {
      key: "import",
      label: "Importar / Exportar",
      description: "Baixe seus dados em CSV ou importe negócios em massa por planilha.",
      node: <CrmImportExport leads={leads} companies={companies} contacts={contacts} />,
    },
  ];

  // RBAC (§4): esconde as seções estruturais de quem não é gestor/C-level.
  const visible = canEditStructural ? sections : sections.filter((s) => !STRUCTURAL_HIDDEN.has(s.key));

  return <CrmSettingsNav sections={visible} />;
}
