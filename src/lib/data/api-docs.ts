/**
 * Conteúdo da aba Documentação (Conta → Documentação da API).
 *
 * Client-safe: só dados. A página monta a referência no formato de docs de API
 * (estilo Asaas): grupos na lateral, endpoint com método, parâmetros, exemplo
 * de requisição e de resposta.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiParam = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
};

export type ApiEndpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  auth: string;
  params?: ApiParam[];
  /** Exemplo de corpo/uso (curl ou JSON). */
  request?: string;
  response?: string;
  errors?: { code: string; description: string }[];
  notes?: string[];
};

export type ApiGroup = {
  id: string;
  title: string;
  summary: string;
  endpoints: ApiEndpoint[];
};

/** Endpoints internos: listados em tabela compacta (mesmo padrão de chamada). */
export type InternalRoute = { path: string; purpose: string; actions?: string };

export const API_INTERNAL: { area: string; routes: InternalRoute[] }[] = [
  {
    area: "Clientes e operação",
    routes: [
      { path: "/api/gerencial/clients", purpose: "Catálogo para o cadastro (GET) e criação de cliente (POST). DELETE apaga — só Gestor/Admin." },
      { path: "/api/gerencial/client-services", purpose: "Serviços contratados do cliente", actions: "add, delete" },
      { path: "/api/gerencial/client-profile", purpose: "Contatos, briefing e dados cadastrais" },
      { path: "/api/gerencial/client-operation", purpose: "Responsáveis por função, serviços e squad" },
      { path: "/api/gerencial/client-drive", purpose: "Navegador do Drive do cliente", actions: "list, mkdir, rename, delete, provision" },
      { path: "/api/gerencial/drive-config", purpose: "Pasta-mãe do Drive e vínculo de pastas existentes", actions: "get, set-root, clear-root, scan, link" },
      { path: "/api/gerencial/delivery-tasks", purpose: "Tarefas do painel de entregas" },
    ],
  },
  {
    area: "Comercial (CRM)",
    routes: [
      { path: "/api/crm/leads", purpose: "Negócios: criar, atualizar, mover etapa, ganhar/perder", actions: "create, update, delete, stage, …" },
      { path: "/api/crm/companies", purpose: "Empresas", actions: "create, update, delete" },
      { path: "/api/crm/contacts", purpose: "Contatos", actions: "create, update, delete" },
      { path: "/api/crm/tasks", purpose: "Tarefas do CRM" },
      { path: "/api/crm/interactions", purpose: "Interações (WhatsApp, e-mail, ligação, nota)" },
      { path: "/api/crm/pipelines", purpose: "Funis", actions: "create, rename, delete" },
      { path: "/api/crm/stages", purpose: "Etapas do funil" },
      { path: "/api/crm/properties", purpose: "Propriedades customizadas" },
      { path: "/api/crm/capture-forms", purpose: "Formulários de captura", actions: "create, update, delete, save-fields, duplicate" },
      { path: "/api/crm/workflows", purpose: "Automações do funil" },
    ],
  },
  {
    area: "Disparos e pesquisas",
    routes: [
      { path: "/api/gerencial/broadcasts", purpose: "Disparos em massa", actions: "create, send, schedule, pause, resume, cancel, retry-failed, delete" },
      { path: "/api/gerencial/broadcasts/stats", purpose: "Métricas de entrega (GET, ?days=)" },
      { path: "/api/gerencial/broadcasts/groups", purpose: "Grupos de WhatsApp da instância (GET)" },
      { path: "/api/gerencial/broadcasts/[id]/log", purpose: "Planilha .xlsx de contatos ou log (GET, ?type=log|contacts)" },
      { path: "/api/gerencial/nps", purpose: "Convites de NPS" },
      { path: "/api/gerencial/meeting-survey", purpose: "Pesquisa pós-reunião" },
    ],
  },
  {
    area: "Financeiro e gestão",
    routes: [
      { path: "/api/gerencial/expenses", purpose: "Contas a pagar, com recorrência em parcelas reais", actions: "create, update, delete, pay, unpay" },
      { path: "/api/gerencial/receivables", purpose: "Recebíveis manuais (fora do Asaas)", actions: "create, update, delete, receive, unreceive" },
      { path: "/api/gerencial/accounts", purpose: "Contas financeiras (Asaas, BTG, Inter, caixa…)", actions: "create, update, delete" },
      { path: "/api/gerencial/expense-categories", purpose: "Categorias de despesa personalizáveis (definem as linhas do DRE)", actions: "create, update, delete, reorder" },
      { path: "/api/gerencial/finance-settings", purpose: "Régua de cobrança, formas de recebimento, meta e alertas (GET lê, POST salva)" },
      { path: "/api/gerencial/transfers", purpose: "Transferência de saldo entre contas (não entra no DRE)", actions: "create, delete" },
      { path: "/api/gerencial/finance-movements", purpose: "Extrato, fluxo de caixa projetado e rentabilidade (GET ?view=extrato|fluxo|rentabilidade); POST concilia", actions: "reconciliar, desreconciliar" },
      { path: "/api/gerencial/finance-upload", purpose: "Anexa comprovante/nota a um lançamento (multipart)" },
      { path: "/api/gerencial/dre", purpose: "DRE por período com comparativo (GET, ?periodo=mes|trimestre|ano&offset=) e meta de margem (POST)" },
      { path: "/api/gerencial/asaas/subscription", purpose: "Assinatura do cliente no Asaas" },
      { path: "/api/gerencial/team", purpose: "Equipe e permissões" },
      { path: "/api/gerencial/service-catalog", purpose: "Catálogo de serviços e planos", actions: "add-service, update-service, delete-service, add-plan, update-plan, delete-plan" },
    ],
  },
];

export const API_GROUPS: ApiGroup[] = [
  // ── Captura pública ───────────────────────────────────────────────────────
  {
    id: "publico",
    title: "Endpoints públicos",
    summary:
      "Recebem dados de fora do painel sem login: formulários no seu site, respostas de pesquisa e captação de leads. Protegidos por token do registro (ou slug do formulário) e por honeypot anti-spam.",
    endpoints: [
      {
        id: "public-lead",
        method: "POST",
        path: "/api/public/lead",
        title: "Criar lead (captação)",
        description:
          "Cria um negócio no funil a partir de um formulário externo — por exemplo o formulário do seu site. Aceita CORS de qualquer origem por padrão; para restringir, defina CAPTURE_ALLOWED_ORIGIN.",
        auth: "Nenhuma — validado pelo slug do formulário + honeypot",
        params: [
          { name: "slug", type: "string", required: true, description: "Slug do formulário de captura que receberá o lead." },
          { name: "name", type: "string", required: true, description: "Nome do contato." },
          { name: "company", type: "string", description: "Nome da empresa (cria/associa a empresa no CRM)." },
          { name: "email", type: "string", description: "E-mail do contato." },
          { name: "phone", type: "string", description: "Telefone/WhatsApp com DDI e DDD." },
          { name: "segment", type: "string", description: "Segmento ou setor da empresa." },
          { name: "message", type: "string", description: "Mensagem livre — vira a primeira interação do negócio." },
          { name: "properties", type: "object", description: "Propriedades customizadas do negócio (chave: valor)." },
          { name: "website", type: "string", description: "Honeypot. Deve chegar VAZIO — se vier preenchido, a requisição é descartada como spam." },
        ],
        request: `curl -X POST https://SEU-APP/api/public/lead \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "fale-com-a-gente",
    "name": "Maria Silva",
    "company": "Loja da Maria",
    "email": "maria@loja.com.br",
    "phone": "5527999998888",
    "segment": "Varejo",
    "message": "Quero saber sobre gestão de redes sociais."
  }'`,
        response: `{
  "ok": true,
  "leadId": "8f3c1e5a-...",
  "persisted": true
}`,
        errors: [
          { code: "400", description: "Corpo inválido ou campos obrigatórios ausentes." },
          { code: "404", description: "Formulário (slug) não encontrado ou inativo." },
        ],
      },
      {
        id: "public-form",
        method: "POST",
        path: "/api/public/form",
        title: "Enviar formulário/briefing",
        description:
          "Recebe a resposta de um formulário criado em Comercial → Formulários. Cada campo é mapeado conforme a configuração do formulário (título do negócio, contato, empresa ou propriedade do briefing). Aceita JSON ou multipart.",
        auth: "Nenhuma — validado pelo slug do formulário + honeypot",
        params: [
          { name: "slug", type: "string", required: true, description: "Slug do formulário (aparece na URL /captura/<slug>)." },
          { name: "values", type: "object", required: true, description: "Respostas no formato { field_key: valor }. Em múltipla escolha, o valor é a lista separada por vírgula." },
          { name: "client", type: "string", description: "Id do cliente para vincular o registro criado (equivale a ?client= na URL)." },
          { name: "website", type: "string", description: "Honeypot — deve chegar vazio." },
        ],
        request: `curl -X POST https://SEU-APP/api/public/form \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "briefing-ui-ux",
    "values": {
      "nome": "João Pereira",
      "email": "joao@empresa.com",
      "q_11": "Loja / e-commerce",
      "q_22": "Busca, Carrinho e checkout"
    }
  }'`,
        response: `{
  "ok": true,
  "submissionId": "b21a...",
  "leadId": "5c7e..."
}`,
        errors: [
          { code: "400", description: "Corpo inválido ou campo obrigatório do formulário não preenchido." },
          { code: "404", description: "Formulário indisponível (slug inexistente ou inativo)." },
        ],
      },
      {
        id: "public-nps",
        method: "POST",
        path: "/api/public/nps",
        title: "Responder NPS",
        description:
          "Grava a resposta de uma pesquisa de NPS. O token vem no link enviado ao cliente (/nps/<slug>/<token>). Responder duas vezes é seguro: a segunda chamada retorna already: true sem sobrescrever.",
        auth: "Token público da pesquisa (no corpo)",
        params: [
          { name: "token", type: "string", required: true, description: "Token público da pesquisa (último segmento do link)." },
          { name: "score", type: "integer", required: true, description: "Nota de 0 a 10." },
          { name: "comment", type: "string", description: "Comentário aberto." },
          { name: "respondent", type: "string", description: "Quem respondeu." },
          { name: "extra", type: "array", description: "Perguntas extras: [{ id, label, value }] — até 20 itens." },
          { name: "website", type: "string", description: "Honeypot — deve chegar vazio." },
        ],
        request: `curl -X POST https://SEU-APP/api/public/nps \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "a1b2c3d4-...",
    "score": 9,
    "comment": "Time atencioso e entregas no prazo.",
    "respondent": "Camila Souza"
  }'`,
        response: `{ "ok": true }`,
        errors: [
          { code: "400", description: "Nota inválida (fora de 0–10) ou corpo malformado." },
          { code: "404", description: "Link inválido — token não encontrado." },
        ],
      },
      {
        id: "public-meeting-survey",
        method: "POST",
        path: "/api/public/meeting-survey",
        title: "Responder pesquisa pós-reunião",
        description:
          "Mesma mecânica do NPS, mas a nota é de 1 a 5 estrelas e o foco é a reunião. O link é /pesquisa/<slug>/<token>.",
        auth: "Token público da pesquisa (no corpo)",
        params: [
          { name: "token", type: "string", required: true, description: "Token público da pesquisa." },
          { name: "rating", type: "integer", required: true, description: "Avaliação de 1 a 5." },
          { name: "comment", type: "string", description: "Comentário aberto." },
          { name: "respondent", type: "string", description: "Quem respondeu." },
          { name: "extra", type: "array", description: "Perguntas extras: [{ id, label, value }]." },
          { name: "website", type: "string", description: "Honeypot — deve chegar vazio." },
        ],
        request: `curl -X POST https://SEU-APP/api/public/meeting-survey \\
  -H "Content-Type: application/json" \\
  -d '{ "token": "9f8e...", "rating": 5, "comment": "Reunião objetiva." }'`,
        response: `{ "ok": true }`,
        errors: [
          { code: "400", description: "Avaliação inválida (fora de 1–5)." },
          { code: "404", description: "Link inválido." },
        ],
      },
    ],
  },

  // ── MCP ───────────────────────────────────────────────────────────────────
  {
    id: "mcp",
    title: "MCP (dados para IA)",
    summary:
      "Endpoint que expõe os dados do painel para o Claude (claude.ai, Claude Code ou via API) usando o protocolo MCP. Somente leitura: nenhuma ferramenta cria, altera ou apaga. Fica desativado enquanto MCP_TOKEN não estiver definido.",
    endpoints: [
      {
        id: "mcp-endpoint",
        method: "POST",
        path: "/api/mcp",
        title: "Servidor MCP (JSON-RPC 2.0)",
        description:
          "Transporte Streamable HTTP. Métodos suportados: initialize, tools/list, tools/call, ping, resources/list e prompts/list. Stateless — cada requisição carrega o token.",
        auth: "Bearer MCP_TOKEN",
        params: [
          { name: "jsonrpc", type: "string", required: true, description: 'Sempre "2.0".' },
          { name: "id", type: "string | number", description: "Identificador da requisição. Ausente em notificações." },
          { name: "method", type: "string", required: true, description: "initialize | tools/list | tools/call | ping" },
          { name: "params", type: "object", description: "Parâmetros do método. Em tools/call: { name, arguments }." },
        ],
        request: `curl -X POST https://SEU-APP/api/mcp \\
  -H "Authorization: Bearer $MCP_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "pipeline_summary",
      "arguments": { "days": 30 }
    }
  }'`,
        response: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "{ … }" }],
    "structuredContent": {
      "abertos": { "negocios": 12, "valor": 48000 },
      "ganhos":  { "negocios": 3,  "valor": 9800 },
      "taxaConversao": 42.9
    },
    "isError": false
  }
}`,
        errors: [
          { code: "401", description: "Token ausente ou inválido." },
          { code: "-32601", description: "Método não suportado." },
          { code: "-32602", description: "Parâmetro obrigatório ausente (ex.: name em tools/call)." },
        ],
        notes: [
          "Ferramentas disponíveis: search, list_clients, get_client, list_deliveries, list_deals, get_deal, pipeline_summary, financial_summary, list_payments, campaign_results, nps_summary e list_broadcasts.",
          "Onde uma ferramenta pede `client`, aceita id, slug ou parte do nome.",
          "Conectar no Claude Code: claude mcp add --transport http painel https://SEU-APP/api/mcp --header \"Authorization: Bearer $MCP_TOKEN\"",
        ],
      },
      {
        id: "mcp-status",
        method: "GET",
        path: "/api/mcp",
        title: "Status do servidor MCP",
        description: "Verificação rápida: devolve nome, versão do protocolo e a lista de ferramentas quando o token é válido.",
        auth: "Bearer MCP_TOKEN",
        request: `curl https://SEU-APP/api/mcp -H "Authorization: Bearer $MCP_TOKEN"`,
        response: `{
  "server": { "name": "painel-viofilme", "version": "1.0.0" },
  "transport": "streamable-http (POST JSON-RPC)",
  "protocolVersion": "2025-06-18",
  "authenticated": true,
  "tools": ["search", "list_clients", "..."]
}`,
        errors: [{ code: "401", description: "Token ausente ou inválido." }],
      },
    ],
  },

  // ── Webhooks ──────────────────────────────────────────────────────────────
  {
    id: "webhooks",
    title: "Webhooks (entrada)",
    summary: "Endpoints que serviços externos chamam para avisar o painel de um evento. Configure a URL no painel do serviço.",
    endpoints: [
      {
        id: "webhook-asaas",
        method: "POST",
        path: "/api/webhooks/asaas",
        title: "Webhook do Asaas",
        description:
          "Recebe eventos de cobrança (pagamento recebido, vencido, estornado…) e atualiza os pagamentos e o financeiro do cliente.",
        auth: "Header asaas-access-token (deve bater com ASAAS_WEBHOOK_TOKEN)",
        params: [
          { name: "event", type: "string", required: true, description: "Nome do evento (ex.: PAYMENT_RECEIVED)." },
          { name: "payment", type: "object", required: true, description: "Objeto do pagamento enviado pelo Asaas." },
        ],
        request: `POST /api/webhooks/asaas
asaas-access-token: <ASAAS_WEBHOOK_TOKEN>
Content-Type: application/json

{ "event": "PAYMENT_RECEIVED", "payment": { "id": "pay_123", "value": 2500 } }`,
        response: `{ "ok": true }`,
        errors: [{ code: "401", description: "Token do webhook ausente ou incorreto." }],
        notes: ["Cadastre a URL em Asaas → Integrações → Webhooks e use o mesmo token do env ASAAS_WEBHOOK_TOKEN."],
      },
      {
        id: "webhook-uazapi",
        method: "POST",
        path: "/api/webhooks/uazapi",
        title: "Webhook do WhatsApp (Uazapi)",
        description:
          "Recebe as mensagens enviadas e recebidas e alimenta o inbox de Comunicações — uma conversa por telefone, espelhando os dois lados.",
        auth: "Token da instância no corpo (ou ?secret=) — comparado com UAZAPI_WEBHOOK_SECRET",
        params: [
          { name: "token", type: "string", description: "Token da instância, enviado pelo Uazapi no corpo." },
          { name: "message", type: "object", required: true, description: "Mensagem no formato Uazapi/Baileys." },
        ],
        request: `POST /api/webhooks/uazapi?secret=<UAZAPI_WEBHOOK_SECRET>
Content-Type: application/json

{ "token": "…", "message": { "chatid": "5527999998888@s.whatsapp.net", "text": "Olá!", "fromMe": false } }`,
        response: `{ "ok": true }`,
        errors: [{ code: "401", description: "Segredo do webhook não confere." }],
        notes: ["Deixe UAZAPI_WEBHOOK_SECRET vazio para não validar (não recomendado em produção)."],
      },
    ],
  },

  // ── Rotinas ───────────────────────────────────────────────────────────────
  {
    id: "rotinas",
    title: "Rotinas automáticas",
    summary:
      "Tarefas agendadas. O plano Hobby da Vercel limita crons, então as rotinas diárias saem por um despachante único e o que precisa de resolução por minuto é agendado no Supabase (pg_cron + pg_net).",
    endpoints: [
      {
        id: "cron-daily",
        method: "GET",
        path: "/api/cron/daily",
        title: "Despachante diário",
        description:
          "Dispara em sequência as rotinas do dia: notificações internas, convite de NPS trimestral e pesquisa pós-reunião. Agendado no vercel.json.",
        auth: "Bearer CRON_SECRET",
        request: `curl https://SEU-APP/api/cron/daily -H "Authorization: Bearer $CRON_SECRET"`,
        response: `{
  "ok": true,
  "ranAt": "2026-08-24T11:00:00.000Z",
  "results": {
    "notifications":  { "status": 200, "body": { "ok": true } },
    "nps":            { "status": 200, "body": { "ok": true, "created": 2 } },
    "meeting-survey": { "status": 200, "body": { "ok": true, "sent": 1 } }
  }
}`,
        errors: [{ code: "401", description: "CRON_SECRET ausente ou incorreto." }],
        notes: ["Para adicionar uma rotina diária, crie /api/cron/<nome> e inclua o nome no array JOBS do despachante — não adicione outro cron no vercel.json."],
      },
      {
        id: "broadcasts-process",
        method: "POST",
        path: "/api/broadcasts/process",
        title: "Processar disparos",
        description:
          "Envia as mensagens pendentes dos disparos em andamento e promove os agendados cuja hora chegou, respeitando o intervalo anti-ban. Aceita GET ou POST.",
        auth: "Bearer CRON_SECRET",
        request: `select cron.schedule(
  'process-broadcasts',
  '* * * * *',
  $$ select net.http_post(
       url     := 'https://SEU-APP/api/broadcasts/process',
       headers := jsonb_build_object('Authorization', 'Bearer SEU_CRON_SECRET')
     ); $$
);`,
        response: `{ "ok": true, "processed": 12, "sent": 11, "failed": 1 }`,
        errors: [{ code: "401", description: "CRON_SECRET ausente ou incorreto." }],
        notes: ["Agendado no Supabase (pg_cron + pg_net) para rodar de minuto em minuto — ver o rodapé da migração 0124."],
      },
      {
        id: "cron-backup",
        method: "GET",
        path: "/api/cron/backup",
        title: "Backup para o Google Drive",
        description:
          "Exporta as tabelas de dados em um JSON comprimido e sobe para a pasta \"Backups do Painel\" no Drive da agência. Mantém os últimos 30 dias. Tokens de integração (Google/Meta) são redigidos — reconecte após restaurar.",
        auth: "Bearer CRON_SECRET",
        request: `curl https://SEU-APP/api/cron/backup -H "Authorization: Bearer $CRON_SECRET"`,
        response: `{
  "ok": true,
  "arquivo": "painel-2026-08-25.json.gz",
  "url": "https://drive.google.com/file/d/...",
  "tabelas": 62,
  "linhas": 18432,
  "bytes": 1048576,
  "removidosPorRetencao": 1
}`,
        errors: [
          { code: "401", description: "CRON_SECRET ausente ou incorreto." },
          { code: "500", description: "Backup não concluído — o corpo traz o motivo (ex.: Google não conectado)." },
        ],
        notes: [
          "Roda junto do despachante diário; não precisa de cron próprio.",
          "Complementa o backup gerenciado do Supabase: fica em outra conta, então sobrevive à perda do projeto.",
        ],
      },
      {
        id: "meta-sync",
        method: "GET",
        path: "/api/meta/sync",
        title: "Sincronizar Meta (Instagram/Facebook)",
        description: "Puxa métricas de conta, publicações e campanhas da Graph API para os clientes conectados.",
        auth: "Bearer CRON_SECRET",
        request: `curl https://SEU-APP/api/meta/sync -H "Authorization: Bearer $CRON_SECRET"`,
        response: `{ "ok": true, "clients": 8, "updated": 8 }`,
        errors: [{ code: "401", description: "CRON_SECRET ausente ou incorreto." }],
      },
    ],
  },
];

/** Códigos de status usados em toda a API. */
export const API_STATUS_CODES: { code: string; label: string; description: string }[] = [
  { code: "200", label: "OK", description: "Requisição concluída." },
  { code: "202", label: "Accepted", description: "Aceita sem corpo de resposta (notificações do MCP)." },
  { code: "400", label: "Bad Request", description: "Corpo inválido ou parâmetro obrigatório ausente." },
  { code: "401", label: "Unauthorized", description: "Sem sessão válida ou token incorreto." },
  { code: "403", label: "Forbidden", description: "Sem permissão — perfil somente leitura ou ação restrita a Gestor/Admin." },
  { code: "404", label: "Not Found", description: "Registro não encontrado (token, slug ou id inválido)." },
  { code: "409", label: "Conflict", description: "Estrutura ausente no banco — normalmente falta rodar uma migração." },
  { code: "500", label: "Server Error", description: "Falha inesperada no servidor." },
];
