/**
 * Ferramentas do MCP do Painel Viofilme — SOMENTE LEITURA.
 *
 * Server-only. Usa o cliente admin (service-role) porque a autenticação do MCP
 * é o token Bearer do endpoint, não uma sessão de usuário. Nenhuma ferramenta
 * grava, altera ou apaga dados.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { buscarTudo } from "@/lib/data/paginate-server";
import { calcularEncargos } from "@/lib/data/late-fees";
import { DRE_REGIMES } from "@/lib/data/dre";
import { liberaTudo, podeUsarFerramenta } from "@/lib/data/api-keys";
import { camposFaltando } from "@/lib/data/editorial-kanban";
import { hojeIso } from "@/lib/data/hoje";

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** `scopes` chega vazio quando a chave não tem restrição. */
  handler: (args: Record<string, unknown>, db: SupabaseClient, scopes: readonly string[]) => Promise<unknown>;
};

// ── helpers ─────────────────────────────────────────────────────────────────
const str = (v: unknown): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : undefined;
};
const int = (v: unknown, dflt: number, max = 200): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), max) : dflt;
};
const money = (v: unknown) => Number(v ?? 0) || 0;
const sum = (rows: Record<string, unknown>[], key: string) => rows.reduce((a, r) => a + money(r[key]), 0);
const PAGO_ASAAS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
/** Status que não representam dinheiro (cobrança cancelada/estornada). */
const IGNORAR = new Set(["DELETED", "REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"]);

/**
 * Lê uma tabela inteira, paginando.
 *
 * O MCP entrega número para uma IA raciocinar em cima. Um `.limit()` que corta
 * em silêncio produz uma resposta confiante e errada — pior que um erro.
 */
const tudo = (montar: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) =>
  buscarTudo<Record<string, unknown>>(montar);

/** Próximo mês de "AAAA-MM". */
function proximoMes(mes: string): string {
  const a = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

/** Formato do card de postagem nas respostas do MCP. */
function descreverPost(p: Record<string, unknown>) {
  const faltam = camposFaltando(paraValidacao(p));
  return {
    n: Number(p.n ?? 0),
    titulo: String(p.title ?? "") || "(sem título)",
    tipo: String(p.format ?? ""),
    roteiro: (p.description as string) ?? null,
    legenda: (p.legenda as string) ?? null,
    dataEntrega: (p.delivery_date as string) ?? null,
    dataPostagem: (p.post_date_iso as string) ?? null,
    responsavel: (p.assignee as string) ?? null,
    referencia: (p.reference_url as string) ?? null,
    aprovacaoDoCliente: (p.client_status as string) ?? null,
    pronta: faltam.length === 0,
    falta: faltam,
  };
}

/** Traduz a linha do banco para o formato que a validação do card espera. */
function paraValidacao(p: Record<string, unknown>) {
  return {
    title: p.title,
    description: p.description,
    legenda: p.legenda,
    deliveryDate: p.delivery_date,
    postDateIso: p.post_date_iso,
    assignee: p.assignee,
  };
}

/** Resolve um cliente por id, slug ou nome (parcial). */
async function findClient(db: SupabaseClient, ref: string) {
  const isUuid = /^[0-9a-f-]{32,36}$/i.test(ref);
  if (isUuid) {
    const { data } = await db.from("clients").select("*").eq("id", ref).maybeSingle();
    if (data) return data;
  }
  const { data: bySlug } = await db.from("clients").select("*").eq("slug", ref).maybeSingle();
  if (bySlug) return bySlug;
  const { data: byName } = await db.from("clients").select("*").ilike("name", `%${ref}%`).limit(1).maybeSingle();
  return byName ?? null;
}

const CLIENT_LIST_COLS =
  "id, name, slug, segment, status, monthly_fee, contract_model, city, client_type, has_paid_traffic, whatsapp, kickoff_date, created_at";

// ── ferramentas ─────────────────────────────────────────────────────────────
export const TOOLS: McpTool[] = [
  // ---------- Clientes e operação ----------
  {
    name: "list_clients",
    title: "Listar clientes",
    description:
      "Lista os clientes da agência com status, mensalidade, segmento e modelo de contrato. Use para visão geral da carteira ou para achar o id de um cliente.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtra por status (ex.: ativo, onboarding, churn)." },
        search: { type: "string", description: "Busca por parte do nome." },
        limit: { type: "number", description: "Máximo de registros (padrão 50, máx 200)." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      let q = db.from("clients").select(CLIENT_LIST_COLS).order("name").limit(int(a.limit, 50));
      const status = str(a.status);
      const search = str(a.search);
      if (status) q = q.eq("status", status);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return { total: rows.length, mrrSomado: sum(rows as Record<string, unknown>[], "monthly_fee"), clientes: rows };
    },
  },
  {
    name: "get_client",
    title: "Detalhe do cliente",
    description:
      "Ficha completa de um cliente: dados cadastrais, serviços contratados (recorrentes e pontuais com valores), responsáveis por função e contatos. Aceita id, slug ou nome.",
    inputSchema: {
      type: "object",
      properties: { client: { type: "string", description: "Id, slug ou nome do cliente." } },
      required: ["client"],
      additionalProperties: false,
    },
    async handler(a, db) {
      const ref = str(a.client);
      if (!ref) throw new Error("Informe o cliente (id, slug ou nome).");
      const c = await findClient(db, ref);
      if (!c) return { encontrado: false, mensagem: `Nenhum cliente para "${ref}".` };
      const id = String(c.id);
      const [services, contacts, deliverables] = await Promise.all([
        db.from("client_services").select("type, service_label, plan_label, base_value, discount, final_value").eq("client_id", id),
        db.from("client_contacts").select("name, role, whatsapp, email, is_primary").eq("client_id", id),
        db.from("client_deliverables").select("format, monthly_qty").eq("client_id", id),
      ]);
      const svc = (services.data ?? []) as Record<string, unknown>[];
      return {
        encontrado: true,
        cliente: c,
        servicos: {
          recorrentes: svc.filter((s) => s.type === "recorrente"),
          pontuais: svc.filter((s) => s.type === "pontual"),
          mrr: sum(svc.filter((s) => s.type === "recorrente"), "final_value"),
        },
        contatos: contacts.data ?? [],
        entregaveisMes: deliverables.data ?? [],
      };
    },
  },
  {
    name: "list_deliveries",
    title: "Listar entregas/tarefas",
    description:
      "Tarefas do painel de entregas: título, cliente, tipo, responsável, etapa e prazo. Permite filtrar atrasadas.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Id, slug ou nome do cliente." },
        stage: { type: "string", description: "Etapa da tarefa." },
        assignee: { type: "string", description: "Responsável." },
        overdue: { type: "boolean", description: "Somente tarefas com prazo vencido." },
        limit: { type: "number", description: "Máximo (padrão 50)." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      let q = db
        .from("delivery_tasks")
        .select("id, title, client_id, type, stage, assignee, due_date, urgent, estimate_h, logged_h, created_at")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(int(a.limit, 50));
      const ref = str(a.client);
      if (ref) {
        const c = await findClient(db, ref);
        if (!c) return { total: 0, tarefas: [], mensagem: `Cliente "${ref}" não encontrado.` };
        q = q.eq("client_id", String(c.id));
      }
      if (str(a.stage)) q = q.eq("stage", str(a.stage));
      if (str(a.assignee)) q = q.ilike("assignee", `%${str(a.assignee)}%`);
      if (a.overdue === true) q = q.lt("due_date", new Date().toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { total: (data ?? []).length, tarefas: data ?? [] };
    },
  },

  // ---------- Comercial (CRM) ----------
  {
    name: "list_deals",
    title: "Listar negócios (CRM)",
    description:
      "Negócios do funil comercial com valor, etapa, responsável e probabilidade. Filtre por funil, etapa, responsável ou situação (aberto/ganho/perdido).",
    inputSchema: {
      type: "object",
      properties: {
        pipeline: { type: "string", description: "Nome ou id do funil." },
        stage: { type: "string", description: "Etapa (key ou rótulo)." },
        owner: { type: "string", description: "Responsável pelo negócio." },
        situation: { type: "string", enum: ["aberto", "ganho", "perdido"], description: "Situação do negócio." },
        search: { type: "string", description: "Busca por parte do nome." },
        limit: { type: "number", description: "Máximo (padrão 50)." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      let q = db
        .from("crm_leads")
        .select("id, name, contact_name, contact_phone, contact_email, segment, monthly_value, probability, priority, source, owner, pipeline_id, stage_id, stage, expected_close_at, won_at, lost_at, lost_reason, last_interaction_at, created_at")
        .order("created_at", { ascending: false })
        .limit(int(a.limit, 50));

      const pipeRef = str(a.pipeline);
      if (pipeRef) {
        const { data: pipes } = await db.from("crm_pipelines").select("id, name");
        const p = (pipes ?? []).find((x) => String(x.id) === pipeRef || String(x.name).toLowerCase().includes(pipeRef.toLowerCase()));
        if (!p) return { total: 0, negocios: [], mensagem: `Funil "${pipeRef}" não encontrado.` };
        q = q.eq("pipeline_id", String(p.id));
      }
      if (str(a.stage)) q = q.eq("stage", str(a.stage));
      if (str(a.owner)) q = q.ilike("owner", `%${str(a.owner)}%`);
      if (str(a.search)) q = q.ilike("name", `%${str(a.search)}%`);
      const sit = str(a.situation);
      if (sit === "ganho") q = q.not("won_at", "is", null);
      else if (sit === "perdido") q = q.not("lost_at", "is", null);
      else if (sit === "aberto") q = q.is("won_at", null).is("lost_at", null);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      return { total: rows.length, valorTotal: sum(rows, "monthly_value"), negocios: rows };
    },
  },
  {
    name: "get_deal",
    title: "Detalhe do negócio",
    description: "Negócio completo com empresa, contatos associados, últimas interações e tarefas. Aceita id ou nome.",
    inputSchema: {
      type: "object",
      properties: { deal: { type: "string", description: "Id ou nome do negócio." } },
      required: ["deal"],
      additionalProperties: false,
    },
    async handler(a, db) {
      const ref = str(a.deal);
      if (!ref) throw new Error("Informe o negócio (id ou nome).");
      const isUuid = /^[0-9a-f-]{32,36}$/i.test(ref);
      const { data: lead } = isUuid
        ? await db.from("crm_leads").select("*").eq("id", ref).maybeSingle()
        : await db.from("crm_leads").select("*").ilike("name", `%${ref}%`).limit(1).maybeSingle();
      if (!lead) return { encontrado: false, mensagem: `Nenhum negócio para "${ref}".` };
      const id = String(lead.id);
      const [interactions, tasks, company] = await Promise.all([
        db.from("crm_interactions").select("channel, direction, author, body, created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(15),
        db.from("crm_tasks").select("title, due_date, status, done_at, priority, assignee").eq("lead_id", id).order("due_date", { ascending: true }).limit(20),
        lead.company_id ? db.from("crm_companies").select("*").eq("id", String(lead.company_id)).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { encontrado: true, negocio: lead, empresa: company.data ?? null, interacoes: interactions.data ?? [], tarefas: tasks.data ?? [] };
    },
  },
  {
    name: "pipeline_summary",
    title: "Resumo do funil",
    description:
      "Fotografia do funil comercial: por etapa, quantos negócios e quanto em valor. Inclui totais de ganhos e perdidos no período.",
    inputSchema: {
      type: "object",
      properties: {
        pipeline: { type: "string", description: "Nome ou id do funil (padrão: todos)." },
        days: { type: "number", description: "Janela em dias para ganhos/perdidos (padrão 90)." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      const days = int(a.days, 90, 1095);
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const [{ data: pipes }, { data: stages }] = await Promise.all([
        db.from("crm_pipelines").select("id, name, position").order("position"),
        db.from("crm_stages").select("id, pipeline_id, key, label, position, probability").order("position"),
      ]);
      let pipeIds = (pipes ?? []).map((p) => String(p.id));
      const pipeRef = str(a.pipeline);
      if (pipeRef) {
        const p = (pipes ?? []).find((x) => String(x.id) === pipeRef || String(x.name).toLowerCase().includes(pipeRef.toLowerCase()));
        if (!p) return { mensagem: `Funil "${pipeRef}" não encontrado.` };
        pipeIds = [String(p.id)];
      }
      const { data: leads } = await db
        .from("crm_leads")
        .select("id, name, monthly_value, stage, stage_id, pipeline_id, won_at, lost_at")
        .in("pipeline_id", pipeIds)
        .limit(5000);
      const rows = (leads ?? []) as Record<string, unknown>[];
      const abertos = rows.filter((l) => !l.won_at && !l.lost_at);
      const ganhos = rows.filter((l) => l.won_at && String(l.won_at) >= since);
      const perdidos = rows.filter((l) => l.lost_at && String(l.lost_at) >= since);

      const porEtapa = (stages ?? [])
        .filter((s) => pipeIds.includes(String(s.pipeline_id)))
        .map((s) => {
          const inStage = abertos.filter((l) => String(l.stage_id ?? "") === String(s.id) || String(l.stage ?? "") === String(s.key));
          return {
            funil: (pipes ?? []).find((p) => String(p.id) === String(s.pipeline_id))?.name ?? "",
            etapa: s.label,
            negocios: inStage.length,
            valor: sum(inStage, "monthly_value"),
          };
        })
        .filter((x) => x.negocios > 0);

      return {
        periodoDias: days,
        abertos: { negocios: abertos.length, valor: sum(abertos, "monthly_value") },
        ganhos: { negocios: ganhos.length, valor: sum(ganhos, "monthly_value") },
        perdidos: { negocios: perdidos.length, valor: sum(perdidos, "monthly_value") },
        taxaConversao: ganhos.length + perdidos.length > 0 ? Math.round((ganhos.length / (ganhos.length + perdidos.length)) * 1000) / 10 : null,
        porEtapa,
      };
    },
  },

  // ---------- Financeiro ----------
  {
    name: "financial_summary",
    title: "Resumo financeiro",
    description:
      "MRR da carteira, recebimentos (pagos, em aberto, vencidos) e despesas no período. Dados do Asaas e dos lançamentos internos.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", description: "Janela em dias (padrão 30)." } },
      additionalProperties: false,
    },
    async handler(a, db) {
      const days = int(a.days, 30, 730);
      const sinceDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      const hoje = new Date().toISOString().slice(0, 10);
      const [{ data: clients }, pays, exps] = await Promise.all([
        db.from("clients").select("monthly_fee, status"),
        tudo((de, ate) => db.from("payments").select("status, value, net_value, due_date, payment_date").gte("due_date", sinceDate).range(de, ate)),
        tudo((de, ate) => db.from("expenses").select("amount, category, status, due_date, paid_date").gte("due_date", sinceDate).range(de, ate)),
      ]);
      const cli = (clients ?? []) as Record<string, unknown>[];
      // Cobrança cancelada/estornada não é dinheiro: fica fora de todas as somas.
      const pagamentos = pays.linhas.filter((p) => !IGNORAR.has(String(p.status ?? "")));
      const despesas = exps.linhas;
      const recebidos = pagamentos.filter((p) => PAGO_ASAAS.has(String(p.status)));
      const emAberto = pagamentos.filter((p) => !PAGO_ASAAS.has(String(p.status)));
      const vencidos = emAberto.filter((p) => String(p.due_date ?? "") < hoje);

      const porCategoria: Record<string, number> = {};
      for (const e of despesas) porCategoria[String(e.category ?? "sem categoria")] = (porCategoria[String(e.category ?? "sem categoria")] ?? 0) + money(e.amount);

      return {
        periodoDias: days,
        mrr: sum(cli.filter((c) => String(c.status) !== "churn"), "monthly_fee"),
        clientesAtivos: cli.filter((c) => String(c.status) !== "churn").length,
        recebimentos: {
          recebido: sum(recebidos, "value"),
          emAberto: sum(emAberto, "value"),
          vencido: sum(vencidos, "value"),
          qtdVencidos: vencidos.length,
        },
        despesas: { total: sum(despesas, "amount"), porCategoria },
        // Verdade sobre a própria resposta: sem isto a IA somaria em cima de
        // um recorte parcial achando que é o total.
        incompleto: pays.truncado || exps.truncado,
      };
    },
  },
  {
    name: "list_payments",
    title: "Listar pagamentos",
    description: "Cobranças/pagamentos com status, valor e vencimento. Filtre por cliente, status ou período.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Id, slug ou nome do cliente." },
        status: { type: "string", description: "Status do Asaas (ex.: RECEIVED, PENDING, OVERDUE)." },
        overdue: { type: "boolean", description: "Somente vencidos e não pagos." },
        limit: { type: "number", description: "Máximo (padrão 50)." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      let q = db
        .from("payments")
        .select("id, client_id, status, billing_type, value, net_value, due_date, payment_date, description")
        .order("due_date", { ascending: false })
        .limit(int(a.limit, 50));
      const ref = str(a.client);
      if (ref) {
        const c = await findClient(db, ref);
        if (!c) return { total: 0, pagamentos: [], mensagem: `Cliente "${ref}" não encontrado.` };
        q = q.eq("client_id", String(c.id));
      }
      if (str(a.status)) q = q.eq("status", str(a.status));
      if (a.overdue === true) q = q.lt("due_date", new Date().toISOString().slice(0, 10)).not("status", "in", '("RECEIVED","CONFIRMED","RECEIVED_IN_CASH")');
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      return { total: rows.length, valorTotal: sum(rows, "value"), pagamentos: rows };
    },
  },

  // ---------- Resultados e pesquisas ----------
  {
    name: "dre",
    title: "DRE gerencial",
    description:
      "Demonstrativo do resultado do período: receita bruta, deduções, custos por categoria, lucro e margem — com o comparativo do período anterior. Escolha o regime: 'competencia' conta pelo vencimento (o resultado do período) e 'caixa' pelo pagamento (o dinheiro que circulou).",
    inputSchema: {
      type: "object",
      properties: {
        periodo: { type: "string", enum: ["mes", "trimestre", "ano"], description: "Padrão: mes." },
        regime: { type: "string", enum: ["competencia", "caixa"], description: "Padrão: competencia." },
        offset: { type: "number", description: "0 = período atual, -1 = anterior, e assim por diante." },
      },
      additionalProperties: false,
    },
    async handler(a) {
      const periodo = (["mes", "trimestre", "ano"] as const).includes(a.periodo as never)
        ? (a.periodo as "mes" | "trimestre" | "ano") : "mes";
      const regime = a.regime === "caixa" ? "caixa" : "competencia";
      const offset = Math.max(-36, Math.min(Math.round(Number(a.offset) || 0), 0));
      const ref = new Date();
      if (offset !== 0) {
        if (periodo === "ano") ref.setUTCFullYear(ref.getUTCFullYear() + offset);
        else if (periodo === "trimestre") ref.setUTCMonth(ref.getUTCMonth() + offset * 3);
        else ref.setUTCMonth(ref.getUTCMonth() + offset);
      }
      const { getDre } = await import("@/lib/data/dre-server");
      const d = await getDre(periodo, ref, regime);
      return {
        ...d,
        regimeExplicacao: DRE_REGIMES.find((r) => r.key === d.regime)?.hint,
      };
    },
  },
  {
    name: "aging_receivables",
    title: "Aging de recebíveis",
    description:
      "O que está vencido e há quanto tempo, em faixas (1–30, 31–60, 61–90, +90 dias), com os maiores devedores. Use para priorizar cobrança: quanto mais antigo, menor a chance de receber.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async handler() {
      const { getAging } = await import("@/lib/data/finance-reports-server");
      return getAging();
    },
  },
  {
    name: "financial_indicators",
    title: "Indicadores financeiros",
    description:
      "Prazo médio de recebimento (DSO), ticket médio, percentual de receita recorrente e inadimplência do período.",
    inputSchema: {
      type: "object",
      properties: { periodo: { type: "string", enum: ["mes", "trimestre", "ano"], description: "Padrão: mes." } },
      additionalProperties: false,
    },
    async handler(a) {
      const periodo = (["mes", "trimestre", "ano"] as const).includes(a.periodo as never)
        ? (a.periodo as "mes" | "trimestre" | "ano") : "mes";
      const { getIndicadores } = await import("@/lib/data/finance-reports-server");
      return getIndicadores(periodo);
    },
  },
  {
    name: "budget_vs_actual",
    title: "Orçado x realizado",
    description:
      "Comparação entre o que foi planejado gastar e o que foi gasto, por categoria, no mês. Desvio positivo significa gasto acima do previsto. Categoria com gasto e sem orçamento também aparece.",
    inputSchema: {
      type: "object",
      properties: { mes: { type: "string", description: "AAAA-MM. Padrão: mês corrente." } },
      additionalProperties: false,
    },
    async handler(a) {
      const { getOrcamento } = await import("@/lib/data/finance-reports-server");
      return getOrcamento(str(a.mes));
    },
  },
  {
    name: "cashflow_forecast",
    title: "Fluxo de caixa projetado",
    description:
      "Projeção semanal a partir do saldo real das contas: quanto entra, quanto sai e o saldo previsto. Indica a primeira semana em que o caixa fica negativo, se houver.",
    inputSchema: {
      type: "object",
      properties: { semanas: { type: "number", description: "Quantas semanas à frente (4 a 26, padrão 12)." } },
      additionalProperties: false,
    },
    async handler(a) {
      const { getCashflow } = await import("@/lib/data/cashflow-server");
      return getCashflow(int(a.semanas, 12, 26));
    },
  },
  {
    name: "overdue_details",
    title: "Vencidos em detalhe",
    description:
      "Cobranças vencidas e não pagas, uma a uma, com dias de atraso e os encargos (multa e juros) pela regra configurada. Use quando precisar do detalhe por título, não do agregado.",
    inputSchema: {
      type: "object",
      properties: {
        limite: { type: "number", description: "Máximo de títulos (padrão 50)." },
        clientId: { type: "string", description: "Filtrar por cliente." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      const limite = int(a.limite, 50, 500);
      const hoje = hojeIso();
      const cliente = str(a.clientId);
      const { linhas } = await tudo((de, ate) => {
        const q = db
          .from("payments")
          .select("id, description, value, due_date, status, client_id, clients(name)")
          .lt("due_date", hoje);
        return (cliente ? q.eq("client_id", cliente) : q).range(de, ate);
      });

      const { data: cfg } = await db
        .from("finance_settings")
        .select("late_fine, late_interest_month, late_grace_days")
        .eq("id", 1)
        .maybeSingle();
      const c = (cfg ?? {}) as Record<string, unknown>;
      const regra = {
        fine: Number(c.late_fine ?? 0),
        interestMonth: Number(c.late_interest_month ?? 0),
        graceDays: Number(c.late_grace_days ?? 0),
      };

      const abertos = linhas
        .filter((p) => !PAGO_ASAAS.has(String(p.status ?? "")) && !IGNORAR.has(String(p.status ?? "")) && p.due_date)
        .map((p) => {
          const valor = money(p.value);
          const e = calcularEncargos(valor, String(p.due_date));
          const comRegra = calcularEncargos(valor, String(p.due_date), regra);
          const nome = p.clients as { name?: string } | { name?: string }[] | null;
          return {
            id: String(p.id),
            descricao: String(p.description ?? "Cobrança"),
            cliente: (Array.isArray(nome) ? nome[0]?.name : nome?.name) ?? null,
            valor,
            vencimento: String(p.due_date),
            diasAtraso: e.diasAtraso,
            multa: comRegra.multa,
            juros: comRegra.juros,
            valorAtualizado: comRegra.atualizado,
          };
        })
        .sort((x, y) => y.diasAtraso - x.diasAtraso);

      return {
        regraDeEncargos: regra,
        total: abertos.length,
        somaValor: abertos.reduce((s2, x) => s2 + x.valor, 0),
        somaAtualizada: abertos.reduce((s2, x) => s2 + x.valorAtualizado, 0),
        titulos: abertos.slice(0, limite),
      };
    },
  },
  {
    name: "reconciliation_status",
    title: "Situação da conciliação",
    description:
      "Quanto do extrato bancário já foi conferido, por conta: linhas casadas, dispensadas e pendentes. Responde se o saldo do painel bate com o do banco.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async handler(_a, db) {
      const { data: contas } = await db.from("financial_accounts").select("id, name, active");
      const lista = ((contas ?? []) as Record<string, unknown>[]).filter((c) => c.active !== false);
      const { getConciliacao } = await import("@/lib/data/reconciliation-server");
      const out = [];
      for (const c of lista) {
        const p = await getConciliacao(String(c.id));
        out.push({
          conta: String(c.name),
          conferidoPct: p.resumo.pct,
          casadas: p.resumo.casados,
          dispensadas: p.resumo.ignorados,
          pendentes: p.resumo.pendentes,
          fechado: p.resumo.fechado,
          liquidadoSemExtrato: p.semExtrato.length,
          ultimaImportacao: p.ultimaImportacao,
        });
      }
      return { contas: out };
    },
  },
  // ---------- Conteúdo / linha editorial ----------
  {
    name: "list_editorial_lines",
    title: "Linhas editoriais do cliente",
    description:
      "Meses de linha editorial de um cliente, com a etapa em que cada uma está, quantas postagens tem e quantas já foram aprovadas pelo cliente.",
    inputSchema: {
      type: "object",
      properties: { client: { type: "string", description: "Id, slug ou parte do nome do cliente." } },
      required: ["client"],
      additionalProperties: false,
    },
    async handler(a, db) {
      const ref = str(a.client);
      if (!ref) throw new Error("Informe o cliente.");
      const cli = await findClient(db, ref);
      if (!cli) throw new Error(`Cliente não encontrado: ${ref}`);

      const { data } = await db
        .from("editorial_lines")
        .select("id, month, reference_month, stage, objetivo, built_by, updated_at")
        .eq("client_id", (cli as { id: string }).id)
        .order("reference_month", { ascending: false })
        .limit(24);

      const linhas = ((data ?? []) as Record<string, unknown>[]);
      const ids = linhas.map((l) => String(l.id));
      const contagem = new Map<string, number>();
      if (ids.length) {
        const { data: posts } = await db.from("editorial_posts").select("line_id").in("line_id", ids).limit(3000);
        for (const p of ((posts ?? []) as Record<string, unknown>[])) {
          const k = String(p.line_id);
          contagem.set(k, (contagem.get(k) ?? 0) + 1);
        }
      }

      return {
        cliente: (cli as { name: string }).name,
        linhas: linhas.map((l) => ({
          id: String(l.id),
          mes: String(l.month ?? ""),
          mesReferencia: (l.reference_month as string) ?? null,
          etapa: String(l.stage ?? ""),
          objetivo: (l.objetivo as string) ?? null,
          montadaPor: (l.built_by as string) ?? null,
          postagens: contagem.get(String(l.id)) ?? 0,
          atualizadaEm: (l.updated_at as string) ?? null,
        })),
      };
    },
  },
  {
    name: "get_editorial_line",
    title: "Linha editorial completa",
    description:
      "Uma linha editorial com o cabeçalho estratégico (objetivo, pilares, datas comemorativas) e todas as postagens planejadas — título, roteiro, legenda, datas de entrega e de postagem, responsável e o que ainda falta preencher.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Id, slug ou parte do nome do cliente." },
        mes: { type: "string", description: "AAAA-MM. Padrão: a linha mais recente." },
      },
      required: ["client"],
      additionalProperties: false,
    },
    async handler(a, db) {
      const ref = str(a.client);
      if (!ref) throw new Error("Informe o cliente.");
      const cli = await findClient(db, ref);
      if (!cli) throw new Error(`Cliente não encontrado: ${ref}`);
      const clientId = (cli as { id: string }).id;

      let q = db
        .from("editorial_lines")
        .select("id, month, reference_month, stage, objetivo, narrativa_central, datas_comemorativas, pillars, built_by")
        .eq("client_id", clientId);
      const mes = str(a.mes);
      if (mes) q = q.eq("reference_month", mes);
      const { data: linha } = await q.order("reference_month", { ascending: false }).limit(1).maybeSingle();
      if (!linha) throw new Error(mes ? `Sem linha editorial para ${mes}.` : "Este cliente não tem linha editorial.");

      const l = linha as Record<string, unknown>;
      const { data: posts } = await db
        .from("editorial_posts")
        .select("id, n, title, format, description, legenda, post_date_iso, delivery_date, assignee, reference_url, client_status")
        .eq("line_id", String(l.id))
        .order("n")
        .limit(500);

      return {
        cliente: (cli as { name: string }).name,
        mes: String(l.month ?? ""),
        mesReferencia: (l.reference_month as string) ?? null,
        etapa: String(l.stage ?? ""),
        objetivo: (l.objetivo as string) ?? null,
        narrativa: (l.narrativa_central as string) ?? null,
        datasComemorativas: (l.datas_comemorativas as string) ?? null,
        pilares: Array.isArray(l.pillars) ? l.pillars : [],
        postagens: ((posts ?? []) as Record<string, unknown>[]).map(descreverPost),
      };
    },
  },
  {
    name: "editorial_pending",
    title: "O que falta na linha editorial",
    description:
      "Postagens que ainda não estão prontas para produzir — faltando título, roteiro, legenda, data de entrega, data de postagem ou responsável. Use para saber o que trava o mês antes de cobrar a equipe.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Filtrar por cliente. Sem isso, varre a carteira." },
        mes: { type: "string", description: "AAAA-MM. Padrão: o mês corrente e o seguinte." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      const hoje = hojeIso();
      const mesRef = str(a.mes);
      const meses = mesRef
        ? [mesRef]
        : [hoje.slice(0, 7), proximoMes(hoje.slice(0, 7))];

      let ql = db
        .from("editorial_lines")
        .select("id, month, reference_month, stage, client_id, clients(name)")
        .in("reference_month", meses);
      const ref = str(a.client);
      if (ref) {
        const cli = await findClient(db, ref);
        if (!cli) throw new Error(`Cliente não encontrado: ${ref}`);
        ql = ql.eq("client_id", (cli as { id: string }).id);
      }
      const { data: linhas } = await ql.limit(200);
      const lista = (linhas ?? []) as Record<string, unknown>[];
      if (lista.length === 0) return { meses, linhas: [], totalPendentes: 0 };

      const { data: posts } = await db
        .from("editorial_posts")
        .select("id, n, line_id, title, format, description, legenda, post_date_iso, delivery_date, assignee")
        .in("line_id", lista.map((l) => String(l.id)))
        .limit(3000);

      const porLinha = new Map<string, Record<string, unknown>[]>();
      for (const p of ((posts ?? []) as Record<string, unknown>[])) {
        const k = String(p.line_id);
        if (!porLinha.has(k)) porLinha.set(k, []);
        porLinha.get(k)!.push(p);
      }

      let total = 0;
      const out = lista.map((l) => {
        const todos = porLinha.get(String(l.id)) ?? [];
        const pendentes = todos
          .map((p) => ({ post: p, faltam: camposFaltando(paraValidacao(p)) }))
          .filter((x) => x.faltam.length > 0);
        total += pendentes.length;
        const c = l.clients as { name?: string } | { name?: string }[] | null;
        return {
          cliente: (Array.isArray(c) ? c[0]?.name : c?.name) ?? "—",
          mes: String(l.month ?? ""),
          etapa: String(l.stage ?? ""),
          postagens: todos.length,
          prontas: todos.length - pendentes.length,
          pendentes: pendentes.map((x) => ({
            n: Number(x.post.n ?? 0),
            titulo: String(x.post.title ?? "") || "(sem título)",
            tipo: String(x.post.format ?? ""),
            falta: x.faltam,
          })),
        };
      }).filter((l) => l.pendentes.length > 0);

      return { meses, totalPendentes: total, linhas: out };
    },
  },
  {
    name: "content_calendar",
    title: "Calendário de conteúdo",
    description:
      "Postagens planejadas num período, por data. Traz o que vai ao ar e — separadamente — o que precisa estar PRONTO, já que entrega e postagem têm datas diferentes. Use para ver semana sobrecarregada antes que ela chegue.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "AAAA-MM-DD. Padrão: hoje." },
        to: { type: "string", description: "AAAA-MM-DD. Padrão: 30 dias à frente." },
        client: { type: "string", description: "Filtrar por cliente." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      const hoje = hojeIso();
      const de = str(a.from) ?? hoje;
      const ate = str(a.to) ?? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

      let clienteId: string | null = null;
      const ref = str(a.client);
      if (ref) {
        const cli = await findClient(db, ref);
        if (!cli) throw new Error(`Cliente não encontrado: ${ref}`);
        clienteId = (cli as { id: string }).id;
      }

      // Postagem e entrega são datas distintas: a janela precisa pegar as duas.
      const { linhas: posts } = await tudo((x, y) =>
        db.from("editorial_posts")
          .select("id, n, title, format, post_date_iso, delivery_date, assignee, line_id, editorial_lines(client_id, month, clients(name))")
          .or(`and(post_date_iso.gte.${de},post_date_iso.lte.${ate}),and(delivery_date.gte.${de},delivery_date.lte.${ate})`)
          .range(x, y));

      const nomeDoCliente = (p: Record<string, unknown>): string => {
        const le = p.editorial_lines as Record<string, unknown> | null;
        const c = le?.clients as { name?: string } | { name?: string }[] | null | undefined;
        return (Array.isArray(c) ? c[0]?.name : c?.name) ?? "—";
      };
      const idDoCliente = (p: Record<string, unknown>): string => {
        const le = p.editorial_lines as Record<string, unknown> | null;
        return String(le?.client_id ?? "");
      };

      const filtrados = clienteId ? posts.filter((p) => idDoCliente(p) === clienteId) : posts;

      const vaiAoAr = filtrados
        .filter((p) => p.post_date_iso && String(p.post_date_iso) >= de && String(p.post_date_iso) <= ate)
        .map((p) => ({ ...descreverPost(p), cliente: nomeDoCliente(p) }))
        .sort((x, y) => String(x.dataPostagem).localeCompare(String(y.dataPostagem)));

      const precisaFicarPronto = filtrados
        .filter((p) => p.delivery_date && String(p.delivery_date) >= de && String(p.delivery_date) <= ate)
        .map((p) => ({ ...descreverPost(p), cliente: nomeDoCliente(p) }))
        .sort((x, y) => String(x.dataEntrega).localeCompare(String(y.dataEntrega)));

      // Entregas por semana: é o número que revela sobrecarga antes dela chegar.
      const porSemana = new Map<string, number>();
      for (const p of precisaFicarPronto) {
        const d = new Date(`${p.dataEntrega}T00:00:00Z`);
        const segunda = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
        porSemana.set(segunda, (porSemana.get(segunda) ?? 0) + 1);
      }

      return {
        periodo: { de, ate },
        vaiAoAr,
        precisaFicarPronto,
        entregasPorSemana: [...porSemana.entries()]
          .sort((x, y) => x[0].localeCompare(y[0]))
          .map(([semana, entregas]) => ({ semana, entregas })),
      };
    },
  },

  // ---------- Equipe e agenda ----------
  {
    name: "hours_summary",
    title: "Horas da equipe",
    description:
      "Horas lançadas no período, com o total por pessoa e o saldo do banco de horas. Lançamento negativo é compensação — o saldo já considera isso.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Janela em dias (padrão 30)." },
        pessoa: { type: "string", description: "Filtrar por colaborador (nome)." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      const days = int(a.days, 30, 730);
      const desde = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      const pessoa = str(a.pessoa);

      const { linhas } = await tudo((de, ate) => {
        const q = db.from("hour_entries").select("employee, work_date, hours, note").gte("work_date", desde);
        return (pessoa ? q.ilike("employee", `%${pessoa}%`) : q).range(de, ate);
      });

      const porPessoa = new Map<string, { lancadas: number; compensadas: number; saldo: number; registros: number }>();
      for (const l of linhas) {
        const nome = String(l.employee ?? "—");
        const h = money(l.hours);
        const cur = porPessoa.get(nome) ?? { lancadas: 0, compensadas: 0, saldo: 0, registros: 0 };
        if (h >= 0) cur.lancadas += h; else cur.compensadas += Math.abs(h);
        cur.saldo += h;
        cur.registros += 1;
        porPessoa.set(nome, cur);
      }

      const pessoas = [...porPessoa.entries()]
        .map(([nome, v]) => ({
          pessoa: nome,
          horasLancadas: Math.round(v.lancadas * 10) / 10,
          horasCompensadas: Math.round(v.compensadas * 10) / 10,
          saldoBanco: Math.round(v.saldo * 10) / 10,
          registros: v.registros,
        }))
        .sort((x, y) => y.saldoBanco - x.saldoBanco);

      return {
        periodoDias: days,
        desde,
        totalLancado: Math.round(pessoas.reduce((s2, p) => s2 + p.horasLancadas, 0) * 10) / 10,
        saldoTotal: Math.round(pessoas.reduce((s2, p) => s2 + p.saldoBanco, 0) * 10) / 10,
        pessoas,
      };
    },
  },
  {
    name: "hours_by_person",
    title: "Lançamentos de horas de uma pessoa",
    description:
      "Cada lançamento de horas de um colaborador, com data e observação. Use quando o resumo levantar uma dúvida e for preciso ver o detalhe.",
    inputSchema: {
      type: "object",
      properties: {
        pessoa: { type: "string", description: "Nome do colaborador (parcial serve)." },
        days: { type: "number", description: "Janela em dias (padrão 60)." },
      },
      required: ["pessoa"],
      additionalProperties: false,
    },
    async handler(a, db) {
      const pessoa = str(a.pessoa);
      if (!pessoa) throw new Error("Informe a pessoa.");
      const days = int(a.days, 60, 730);
      const desde = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

      const { data } = await db
        .from("hour_entries")
        .select("employee, work_date, hours, note")
        .ilike("employee", `%${pessoa}%`)
        .gte("work_date", desde)
        .order("work_date", { ascending: false })
        .limit(500);

      const linhas = (data ?? []) as Record<string, unknown>[];
      if (linhas.length === 0) return { pessoa, desde, lancamentos: [], saldo: 0 };

      return {
        pessoa: String(linhas[0].employee ?? pessoa),
        desde,
        saldo: Math.round(linhas.reduce((s2, l) => s2 + money(l.hours), 0) * 10) / 10,
        lancamentos: linhas.map((l) => ({
          data: String(l.work_date ?? ""),
          horas: money(l.hours),
          tipo: money(l.hours) < 0 ? "compensação" : "lançamento",
          observacao: (l.note as string) ?? null,
        })),
      };
    },
  },
  {
    name: "agenda",
    title: "Agenda e reuniões",
    description:
      "Compromissos da equipe e reuniões com cliente num período. Traz os dois: eventos internos da agenda e reuniões marcadas com clientes, com pauta e próximos passos quando houver.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "AAAA-MM-DD. Padrão: hoje." },
        to: { type: "string", description: "AAAA-MM-DD. Padrão: 14 dias à frente." },
        client: { type: "string", description: "Filtrar reuniões por cliente." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      const hoje = hojeIso();
      const de = str(a.from) ?? hoje;
      const ate = str(a.to) ?? new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
      const fimDoDia = `${ate}T23:59:59Z`;

      let clienteId: string | null = null;
      const ref = str(a.client);
      if (ref) {
        const cli = await findClient(db, ref);
        if (!cli) throw new Error(`Cliente não encontrado: ${ref}`);
        clienteId = (cli as { id: string }).id;
      }

      // Duas origens distintas: agenda interna e reuniões com cliente.
      let qm = db
        .from("meetings")
        .select("id, title, starts_at, agenda, next_steps, participants, client_id, clients(name)")
        .gte("starts_at", `${de}T00:00:00Z`)
        .lte("starts_at", fimDoDia);
      if (clienteId) qm = qm.eq("client_id", clienteId);

      const [eventos, reunioes] = await Promise.all([
        clienteId
          ? Promise.resolve({ data: [] })
          : db.from("calendar_events")
              .select("id, title, type, start_at, end_at")
              .gte("start_at", `${de}T00:00:00Z`)
              .lte("start_at", fimDoDia)
              .order("start_at")
              .limit(300),
        qm.order("starts_at").limit(300),
      ]);

      const nomeCli = (r: Record<string, unknown>): string | null => {
        const c = r.clients as { name?: string } | { name?: string }[] | null;
        return (Array.isArray(c) ? c[0]?.name : c?.name) ?? null;
      };

      return {
        periodo: { de, ate },
        reunioesComCliente: ((reunioes.data ?? []) as Record<string, unknown>[]).map((m) => ({
          cliente: nomeCli(m),
          titulo: String(m.title ?? ""),
          quando: String(m.starts_at ?? ""),
          pauta: (m.agenda as string) ?? null,
          proximosPassos: (m.next_steps as string) ?? null,
          participantes: Array.isArray(m.participants) ? m.participants : [],
        })),
        compromissosInternos: ((eventos.data ?? []) as Record<string, unknown>[]).map((e) => ({
          titulo: String(e.title ?? ""),
          tipo: String(e.type ?? "meeting"),
          inicio: String(e.start_at ?? ""),
          fim: (e.end_at as string) ?? null,
        })),
      };
    },
  },

  {
    name: "campaign_results",
    title: "Resultados de campanhas",
    description:
      "Campanhas de tráfego pago com investimento e métricas agregadas (impressões, alcance, cliques, conversões, CPA).",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Id, slug ou nome do cliente." },
        days: { type: "number", description: "Janela em dias das métricas (padrão 30)." },
        limit: { type: "number", description: "Máximo de campanhas (padrão 30)." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      const days = int(a.days, 30, 730);
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      let q = db.from("campaigns").select("id, client_id, name, objective, platform, status, budget, spend, start_date, end_date").limit(int(a.limit, 30));
      const ref = str(a.client);
      if (ref) {
        const c = await findClient(db, ref);
        if (!c) return { total: 0, campanhas: [], mensagem: `Cliente "${ref}" não encontrado.` };
        q = q.eq("client_id", String(c.id));
      }
      const { data: camps, error } = await q;
      if (error) throw new Error(error.message);
      const ids = (camps ?? []).map((c) => String(c.id));
      const { data: mets } = ids.length
        ? await db.from("campaign_metrics").select("campaign_id, impressions, reach, clicks, spend, conversions, date").in("campaign_id", ids).gte("date", since).limit(20000)
        : { data: [] };
      const byCamp = new Map<string, { impressions: number; reach: number; clicks: number; spend: number; conversions: number }>();
      for (const m of (mets ?? []) as Record<string, unknown>[]) {
        const k = String(m.campaign_id);
        const acc = byCamp.get(k) ?? { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0 };
        acc.impressions += money(m.impressions);
        acc.reach += money(m.reach);
        acc.clicks += money(m.clicks);
        acc.spend += money(m.spend);
        acc.conversions += money(m.conversions);
        byCamp.set(k, acc);
      }
      const campanhas = (camps ?? []).map((c) => {
        const m = byCamp.get(String(c.id)) ?? { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0 };
        return {
          ...c,
          metricas: {
            ...m,
            ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : null,
            cpa: m.conversions > 0 ? Math.round((m.spend / m.conversions) * 100) / 100 : null,
          },
        };
      });
      return { periodoDias: days, total: campanhas.length, campanhas };
    },
  },
  {
    name: "nps_summary",
    title: "NPS",
    description:
      "NPS da carteira ou de um cliente: nota, promotores/neutros/detratores e comentários recentes.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Id, slug ou nome do cliente (padrão: todos)." },
        limit: { type: "number", description: "Comentários recentes (padrão 20)." },
      },
      additionalProperties: false,
    },
    async handler(a, db) {
      let q = db.from("nps_surveys").select("client_id, score, comment, respondent, created_at").not("score", "is", null).order("created_at", { ascending: false }).limit(2000);
      const ref = str(a.client);
      if (ref) {
        const c = await findClient(db, ref);
        if (!c) return { mensagem: `Cliente "${ref}" não encontrado.` };
        q = q.eq("client_id", String(c.id));
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      if (rows.length === 0) return { respostas: 0, nps: null, mensagem: "Ainda não há respostas de NPS." };
      const prom = rows.filter((r) => money(r.score) >= 9).length;
      const det = rows.filter((r) => money(r.score) <= 6).length;
      const neu = rows.length - prom - det;
      return {
        respostas: rows.length,
        nps: Math.round(((prom - det) / rows.length) * 100),
        media: Math.round((sum(rows, "score") / rows.length) * 10) / 10,
        promotores: prom,
        neutros: neu,
        detratores: det,
        comentariosRecentes: rows.filter((r) => str(r.comment)).slice(0, int(a.limit, 20)),
      };
    },
  },
  {
    name: "list_broadcasts",
    title: "Disparos em massa",
    description: "Campanhas de WhatsApp disparadas: status, destinatários, enviados, falhas e taxa de entrega.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Máximo (padrão 20)." } },
      additionalProperties: false,
    },
    async handler(a, db) {
      const { data, error } = await db
        .from("broadcasts")
        .select("id, title, message, status, instance_name, total, sent, failed, scheduled_for, created_by, created_at")
        .order("created_at", { ascending: false })
        .limit(int(a.limit, 20));
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      return {
        total: rows.length,
        disparos: rows.map((b) => {
          const tentados = money(b.sent) + money(b.failed);
          return { ...b, taxaEntrega: tentados > 0 ? Math.round((money(b.sent) / tentados) * 1000) / 10 : null };
        }),
      };
    },
  },
  {
    name: "search",
    title: "Busca geral",
    description:
      "Procura o termo em clientes, negócios, empresas e contatos de uma vez. Use quando não souber onde o registro está.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Termo a buscar." } },
      required: ["query"],
      additionalProperties: false,
    },
    async handler(a, db, scopes) {
      const term = str(a.query);
      if (!term) throw new Error("Informe o termo de busca.");
      const like = `%${term}%`;
      // A busca cruza áreas: precisa respeitar o escopo da chave, senão uma
      // chave só de marketing leria a mensalidade dos clientes por aqui.
      const tudo = liberaTudo(scopes);
      const podeClientes = tudo || scopes.includes("clientes");
      const podeComercial = tudo || scopes.includes("comercial");

      const [clients, deals, companies, contacts] = await Promise.all([
        podeClientes
          ? db.from("clients").select("id, name, slug, status, monthly_fee").ilike("name", like).limit(10)
          : Promise.resolve({ data: [] }),
        podeComercial
          ? db.from("crm_leads").select("id, name, owner, monthly_value, stage, won_at, lost_at").ilike("name", like).limit(10)
          : Promise.resolve({ data: [] }),
        podeComercial
          ? db.from("crm_companies").select("id, name, segment").ilike("name", like).limit(10)
          : Promise.resolve({ data: [] }),
        podeComercial
          ? db.from("crm_contacts").select("id, name, email, phone").ilike("name", like).limit(10)
          : Promise.resolve({ data: [] }),
      ]);
      return {
        termo: term,
        clientes: clients.data ?? [],
        negocios: deals.data ?? [],
        empresas: companies.data ?? [],
        contatos: contacts.data ?? [],
      };
    },
  },
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Executa uma ferramenta pelo nome. Lança Error com mensagem amigável. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  scopes: readonly string[] = [],
): Promise<unknown> {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) throw new Error(`Ferramenta desconhecida: ${name}`);
  // Checagem no ponto de execução, não só na listagem: um cliente pode chamar
  // uma ferramenta que não apareceu em `tools/list`.
  if (!podeUsarFerramenta(name, scopes)) {
    throw new Error(`Esta chave não tem acesso a ${name}. Ajuste o escopo em Conta → Chaves de API.`);
  }
  if (!hasServiceRole()) throw new Error("Servidor sem SUPABASE_SERVICE_ROLE_KEY — o MCP não consegue ler os dados.");
  return tool.handler(args ?? {}, createAdminClient(), scopes);
}
