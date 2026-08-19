/**
 * Ferramentas do MCP do Painel Viofilme — SOMENTE LEITURA.
 *
 * Server-only. Usa o cliente admin (service-role) porque a autenticação do MCP
 * é o token Bearer do endpoint, não uma sessão de usuário. Nenhuma ferramenta
 * grava, altera ou apaga dados.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

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
  handler: (args: Record<string, unknown>, db: SupabaseClient) => Promise<unknown>;
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
      const [{ data: clients }, { data: pays }, { data: exps }] = await Promise.all([
        db.from("clients").select("monthly_fee, status"),
        db.from("payments").select("status, value, net_value, due_date, payment_date").gte("due_date", sinceDate).limit(5000),
        db.from("expenses").select("amount, category, status, due_date, paid_date").gte("due_date", sinceDate).limit(5000),
      ]);
      const cli = (clients ?? []) as Record<string, unknown>[];
      const pagamentos = (pays ?? []) as Record<string, unknown>[];
      const despesas = (exps ?? []) as Record<string, unknown>[];
      const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
      const recebidos = pagamentos.filter((p) => PAGO.has(String(p.status)));
      const emAberto = pagamentos.filter((p) => !PAGO.has(String(p.status)));
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
    async handler(a, db) {
      const term = str(a.query);
      if (!term) throw new Error("Informe o termo de busca.");
      const like = `%${term}%`;
      const [clients, deals, companies, contacts] = await Promise.all([
        db.from("clients").select("id, name, slug, status, monthly_fee").ilike("name", like).limit(10),
        db.from("crm_leads").select("id, name, owner, monthly_value, stage, won_at, lost_at").ilike("name", like).limit(10),
        db.from("crm_companies").select("id, name, segment").ilike("name", like).limit(10),
        db.from("crm_contacts").select("id, name, email, phone").ilike("name", like).limit(10),
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
export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) throw new Error(`Ferramenta desconhecida: ${name}`);
  if (!hasServiceRole()) throw new Error("Servidor sem SUPABASE_SERVICE_ROLE_KEY — o MCP não consegue ler os dados.");
  return tool.handler(args ?? {}, createAdminClient());
}
