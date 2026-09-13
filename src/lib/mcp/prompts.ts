/**
 * Análises prontas do MCP.
 *
 * O protocolo permite publicar prompts que aparecem como sugestão no cliente.
 * Servem para quem sabe o que precisa saber mas não sabe o que perguntar — e
 * para que a resposta siga sempre o mesmo caminho, em vez de depender de o
 * Claude escolher bem as ferramentas a cada vez.
 *
 * Cada um diz explicitamente quais ferramentas usar e em que ordem.
 */
import { DOMINIOS, podeUsarFerramenta, type Dominio } from "../data/api-keys.ts";

export type McpPrompt = {
  name: string;
  title: string;
  description: string;
  /** Áreas necessárias — o prompt só aparece para chave que alcança todas. */
  requer: Dominio[];
  arguments?: { name: string; description: string; required?: boolean }[];
  /** O texto entregue ao modelo. `args` já vem preenchido. */
  montar: (args: Record<string, string>) => string;
};

const cliente = { name: "cliente", description: "Nome do cliente (opcional; sem isso, olha a carteira toda)." };

export const PROMPTS: McpPrompt[] = [
  {
    name: "fechamento_do_mes",
    title: "Fechamento do mês",
    description:
      "Fecha o mês financeiro: resultado, o que mudou em relação ao mês anterior, o que ficou pendente de receber e onde o orçamento estourou.",
    requer: ["financeiro"],
    montar: () =>
      [
        "Faça o fechamento financeiro do mês, nesta ordem:",
        "",
        "1. `dre` com periodo=mes — traga receita, custos, lucro e margem, e compare com o mês anterior.",
        "2. `budget_vs_actual` — aponte só as categorias com desvio relevante, não a lista inteira.",
        "3. `aging_receivables` — quanto ficou em aberto e qual a idade.",
        "4. `financial_indicators` — prazo médio de recebimento e inadimplência.",
        "",
        "Escreva como um resumo para sócio: comece pelo resultado, depois o que explica a variação,",
        "e termine com o que precisa de decisão. Números em reais, sem jargão.",
        "Se algum campo vier `incompleto: true`, diga isso antes de qualquer conclusão.",
      ].join("\n"),
  },
  {
    name: "quem_cobrar_hoje",
    title: "Quem cobrar hoje",
    description:
      "Lista priorizada de quem cobrar, com quanto, há quanto tempo e com que encargos — pronta para agir.",
    requer: ["financeiro"],
    montar: () =>
      [
        "Monte a lista de cobrança de hoje:",
        "",
        "1. `aging_receivables` — veja a distribuição por idade e os maiores devedores.",
        "2. `overdue_details` — pegue o detalhe título a título.",
        "",
        "Priorize por valor e por idade juntos: dívida antiga e grande primeiro, porque a chance",
        "de receber cai com o tempo. Para cada cliente, diga o valor, os dias de atraso e o valor",
        "atualizado com encargos, se houver regra configurada.",
        "Não invente tom de cobrança — só organize o que precisa ser feito.",
      ].join("\n"),
  },
  {
    name: "falta_na_linha_editorial",
    title: "O que falta na linha editorial",
    description:
      "O que trava o mês de conteúdo: postagens sem preencher, sem responsável, e semanas com entrega concentrada.",
    requer: ["conteudo"],
    arguments: [cliente],
    montar: (a) =>
      [
        a.cliente
          ? `Verifique a linha editorial de ${a.cliente}:`
          : "Verifique as linhas editoriais da carteira:",
        "",
        `1. \`editorial_pending\`${a.cliente ? ` com client="${a.cliente}"` : ""} — o que ainda não está pronto e o que falta em cada card.`,
        "2. `content_calendar` — o que vai ao ar e o que precisa ficar pronto nas próximas semanas.",
        "",
        "Agrupe por cliente e por tipo de pendência: é mais útil saber que faltam 6 roteiros",
        "do que ver 6 cards listados um a um.",
        "Se alguma semana concentrar 5 entregas ou mais, diga isso primeiro — é problema de",
        "capacidade, e resolver depois de a semana chegar não adianta.",
      ].join("\n"),
  },
  {
    name: "saude_da_carteira",
    title: "Saúde da carteira",
    description:
      "Visão de risco por cliente: quem está atrasado nas entregas, quem deve, quem não dá sinal e quem está perto de churn.",
    requer: ["clientes", "financeiro"],
    montar: () =>
      [
        "Avalie a saúde da carteira cruzando entregas e financeiro:",
        "",
        "1. `list_clients` — a carteira e a mensalidade de cada um.",
        "2. `list_deliveries` com overdue=true — quem está com entrega atrasada.",
        "3. `aging_receivables` — quem está devendo.",
        "4. `nps_summary` — quem reclamou.",
        "",
        "Para cada cliente com mais de um sinal ruim, junte os sinais numa linha só.",
        "Cliente que atrasa entrega E está devendo E reclamou no NPS é risco de saída —",
        "destaque esses primeiro, com o valor mensal em jogo.",
        "Não classifique como risco quem tem só um sinal isolado.",
      ].join("\n"),
  },
  {
    name: "semana_da_equipe",
    title: "A semana da equipe",
    description:
      "O que a equipe tem pela frente: entregas, reuniões e onde a carga está concentrada.",
    requer: ["equipe", "conteudo"],
    montar: () =>
      [
        "Monte o panorama da semana:",
        "",
        "1. `agenda` — reuniões com cliente e compromissos internos dos próximos 7 dias.",
        "2. `content_calendar` — o que precisa ficar pronto e o que vai ao ar.",
        "3. `hours_summary` — quem está com saldo alto no banco de horas.",
        "",
        "Organize por dia. Diga onde há choque — muita entrega no mesmo dia, ou alguém com",
        "várias entregas e reunião no mesmo período.",
        "Termine com uma frase sobre quem parece sobrecarregado, se for o caso.",
      ].join("\n"),
  },
];

/** Prompts que a chave alcança — se falta uma área, o prompt não aparece. */
export function promptsPermitidos(scopes: readonly string[] | null | undefined): McpPrompt[] {
  return PROMPTS.filter((p) =>
    p.requer.every((dominio) => {
      const area = DOMINIOS.find((d) => d.key === dominio);
      // Basta uma ferramenta da área estar acessível: o escopo é por área.
      return area ? area.tools.some((t) => podeUsarFerramenta(t, scopes)) : false;
    }),
  );
}
