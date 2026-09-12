/**
 * Chaves de API — regras puras (client-safe).
 *
 * O token é mostrado UMA vez e só o hash é guardado. Isso não é burocracia:
 * significa que um vazamento do banco não entrega o acesso de ninguém, e que
 * nem quem administra o painel consegue ver a chave de outra pessoa.
 */

/** Prefixo que identifica a origem do token à primeira vista. */
export const PREFIXO = "vio_";

/** Tamanho mínimo aceito na validação (o gerado tem bem mais). */
export const MIN_TOKEN = 24;

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scope: string;
  /** Áreas que a chave lê. Vazio = todas. */
  scopes: string[];
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
};

/** Parte visível do token, para reconhecer a linha na lista. */
export function prefixoDe(token: string): string {
  return token.slice(0, PREFIXO.length + 6);
}

/** Nome da chave: obrigatório, porque chave sem nome ninguém ousa revogar. */
export function nomeValido(raw: unknown): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = String(raw ?? "").trim();
  if (nome.length < 3) return { ok: false, erro: "Dê um nome de ao menos 3 caracteres — é como você vai saber qual revogar." };
  if (nome.length > 60) return { ok: false, erro: "Nome muito longo (máximo 60 caracteres)." };
  return { ok: true, nome };
}

export type SituacaoChave = "ativa" | "revogada" | "nunca usada";

export function situacao(k: Pick<ApiKey, "revokedAt" | "lastUsedAt">): SituacaoChave {
  if (k.revokedAt) return "revogada";
  return k.lastUsedAt ? "ativa" : "nunca usada";
}

/** "há 3 dias", "agora há pouco" — para a coluna de último uso. */
export function desde(iso: string | null, agora = new Date()): string {
  if (!iso) return "nunca";
  const ms = agora.getTime() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  const meses = Math.floor(d / 30);
  return `há ${meses} ${meses > 1 ? "meses" : "mês"}`;
}

/* ------------------------------- Escopos ----------------------------------- */

/**
 * O que cada chave pode ler.
 *
 * Agrupado por área, não por ferramenta: quem cria a chave pensa "esta pessoa
 * acompanha campanhas", não "esta pessoa precisa de campaign_results e
 * nps_summary". A lista de ferramentas aparece na tela como consequência.
 */
export type Dominio = "clientes" | "comercial" | "financeiro" | "conteudo" | "equipe" | "marketing";

export const DOMINIOS: {
  key: Dominio;
  label: string;
  hint: string;
  /** Ferramentas do MCP liberadas por este domínio. */
  tools: string[];
}[] = [
  {
    key: "clientes",
    label: "Clientes e entregas",
    hint: "Carteira, ficha do cliente com valores contratados, tarefas de entrega",
    tools: ["list_clients", "get_client", "list_deliveries"],
  },
  {
    key: "comercial",
    label: "Comercial",
    hint: "Funil, negócios, interações e conversão",
    tools: ["list_deals", "get_deal", "pipeline_summary"],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    hint: "DRE, faturamento, inadimplência, fluxo de caixa, orçamento — a área mais sensível",
    tools: [
      "financial_summary", "list_payments", "dre", "aging_receivables",
      "financial_indicators", "budget_vs_actual", "cashflow_forecast",
      "overdue_details", "reconciliation_status",
    ],
  },
  {
    key: "conteudo",
    label: "Conteúdo",
    hint: "Linhas editoriais, postagens planejadas, o que falta preencher e entregar",
    tools: ["list_editorial_lines", "get_editorial_line", "editorial_pending", "content_calendar"],
  },
  {
    key: "equipe",
    label: "Equipe e agenda",
    hint: "Horas lançadas, banco de horas por pessoa, reuniões e compromissos",
    tools: ["hours_summary", "hours_by_person", "agenda"],
  },
  {
    key: "marketing",
    label: "Marketing",
    hint: "Campanhas e resultados, NPS, disparos de WhatsApp",
    tools: ["campaign_results", "nps_summary", "list_broadcasts"],
  },
];

/**
 * `search` cruza clientes, negócios, empresas e contatos. Fica disponível se a
 * chave puder ler ao menos uma dessas áreas — e a própria ferramenta limita o
 * que procura ao que a chave alcança.
 */
export const TOOL_BUSCA = "search";
const DOMINIOS_DA_BUSCA: Dominio[] = ["clientes", "comercial"];

const TODOS = DOMINIOS.map((d) => d.key);

/** Normaliza o que veio do banco ou do formulário. Vazio = acesso total. */
export function normalizarEscopos(raw: unknown): Dominio[] {
  if (!Array.isArray(raw)) return [];
  const validos = new Set<string>(TODOS);
  const out = [...new Set(raw.map(String).filter((k) => validos.has(k)))] as Dominio[];
  // Selecionar tudo é o mesmo que não restringir: guarda vazio para que a
  // chave siga valendo se um domínio novo for criado depois.
  return out.length === TODOS.length ? [] : out;
}

/** Um array vazio libera tudo — inclusive domínios criados no futuro. */
export function liberaTudo(scopes: readonly string[] | null | undefined): boolean {
  return !scopes || scopes.length === 0;
}

export function podeUsarFerramenta(tool: string, scopes: readonly string[] | null | undefined): boolean {
  if (liberaTudo(scopes)) return true;
  const permitidos = new Set(scopes as string[]);
  if (tool === TOOL_BUSCA) return DOMINIOS_DA_BUSCA.some((d) => permitidos.has(d));
  return DOMINIOS.some((d) => permitidos.has(d.key) && d.tools.includes(tool));
}

/** Ferramentas visíveis para a chave — é o que o `tools/list` devolve. */
export function ferramentasPermitidas(nomes: readonly string[], scopes: readonly string[] | null | undefined): string[] {
  return nomes.filter((n) => podeUsarFerramenta(n, scopes));
}

/** Rótulo curto das áreas, para a lista de chaves. */
export function rotuloEscopos(scopes: readonly string[] | null | undefined): string {
  if (liberaTudo(scopes)) return "tudo";
  const labels = DOMINIOS.filter((d) => (scopes as string[]).includes(d.key)).map((d) => d.label);
  return labels.length ? labels.join(", ") : "nada";
}
