import { NextResponse, type NextRequest } from "next/server";
import { TOOLS, TOOLS_BY_NAME, runTool } from "@/lib/mcp/tools";
import { hasServiceRole } from "@/lib/supabase/admin";
import { validarToken } from "@/lib/data/api-keys-server";
import { ferramentasPermitidas, rotuloEscopos } from "@/lib/data/api-keys";
import { PROMPTS, promptsPermitidos } from "@/lib/mcp/prompts";
import { anotarChamada, withApiLog } from "@/lib/audit/api-log";
import { LIMITE_POR_MINUTO, novoEstado, registrarChamada } from "@/lib/mcp/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Servidor MCP do Painel Viofilme (Streamable HTTP, somente leitura).
 *
 * Fala JSON-RPC 2.0 por POST — o transporte "Streamable HTTP" do MCP aceita
 * resposta simples em application/json quando o servidor não precisa de stream.
 * É stateless: cada requisição traz o token e se basta.
 *
 * Autenticação: header `Authorization: Bearer <MCP_TOKEN>`.
 */
const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_VERSIONS = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);
const SERVER_INFO = { name: "painel-viofilme", title: "Painel Viofilme", version: "1.0.0" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

/**
 * Contagem de chamadas por chave. Vive na instância: em serverless o teto é por
 * instância, o que basta para o caso provável (cliente em laço caindo sempre na
 * instância quente) e não pretende cobrir ataque distribuído.
 */
const chamadas = novoEstado();

type RpcId = string | number | null;
type RpcRequest = { jsonrpc?: string; id?: RpcId; method?: string; params?: Record<string, unknown> };

const ok = (id: RpcId, result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: RpcId, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

/** Compara em tempo constante — não encurta na primeira diferença. */
function mesmoToken(got: string, expected: string): boolean {
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * Autenticação: header `Authorization: Bearer <token>` — ou `?token=` na URL.
 *
 * O header é o caminho certo. O parâmetro existe porque nem todo cliente MCP
 * permite header fixo (conectores gerenciados, principalmente), e sem ele o
 * endpoint ficaria inutilizável nesses clientes. É menos seguro: URL aparece em
 * log de servidor e histórico. Os logs do painel guardam só o caminho, sem
 * query string, mas o do provedor de hospedagem pode guardar tudo.
 */
function tokenApresentado(request: NextRequest): string {
  const doHeader = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return doHeader || (request.nextUrl.searchParams.get("token") ?? "").trim();
}

/**
 * Duas origens de credencial, nesta ordem:
 *
 *  1. Chaves criadas no painel (tabela `api_keys`) — nomeadas, revogáveis uma a
 *     uma, com registro de último uso. É o caminho a usar.
 *  2. `MCP_TOKEN` do ambiente — a chave única original. Mantida para não
 *     derrubar quem já conectou; some no dia em que a variável for removida.
 */
/** Identidade de quem chamou. `scopes` vazio = sem restrição. */
type Identidade = { nome: string; scopes: string[]; podeEscrever: boolean };

async function autenticar(request: NextRequest): Promise<Identidade | null> {
  const token = tokenApresentado(request);
  if (!token) return null;

  const chave = await validarToken(token);
  if (chave) {
    // Sem isto o log fica anônimo: com várias chaves ativas, não haveria como
    // saber qual delas fez a chamada — que é metade do motivo de existirem
    // chaves nomeadas.
    anotarChamada({
      actor: `chave: ${chave.name}`,
      meta: { keyId: chave.id, escopo: rotuloEscopos(chave.scopes) },
    });
    return { nome: chave.name, scopes: chave.scopes, podeEscrever: chave.canWrite === true };
  }

  const doAmbiente = process.env.MCP_TOKEN ?? "";
  if (doAmbiente.length >= 16 && mesmoToken(token, doAmbiente)) {
    // A chave única do ambiente não tem escopo — lê tudo, como sempre leu.
    anotarChamada({ actor: "MCP_TOKEN (ambiente)" });
    // A chave única do ambiente lê tudo, mas NÃO escreve: escrita se concede
    // nomeadamente, para haver a quem perguntar depois.
    return { nome: "MCP_TOKEN", scopes: [], podeEscrever: false };
  }
  return null;
}

async function handleRpc(req: RpcRequest, identidade: Identidade): Promise<object | null> {
  const id = req.id ?? null;
  const method = String(req.method ?? "");

  // Notificações (sem id) não recebem resposta.
  if (method.startsWith("notifications/")) return null;

  switch (method) {
    case "initialize": {
      const asked = String((req.params?.protocolVersion as string) ?? "");
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.has(asked) ? asked : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Dados do Painel Viofilme (agência de marketing): clientes, comercial/CRM, financeiro, entregas, campanhas, NPS e disparos. Todas as ferramentas são somente leitura. Comece por `search` ou `list_clients` quando não souber o id de um registro.",
      });
    }

    case "ping":
      return ok(id, {});

    case "tools/list": {
      // Só o que a chave alcança. Ferramenta fora do escopo não aparece — e,
      // se for chamada assim mesmo, `runTool` recusa.
      // Ferramenta de escrita só aparece para chave que pode escrever — não
      // adianta listar o que a chave não consegue usar.
      const visiveis = new Set(
        ferramentasPermitidas(TOOLS.map((t) => t.name), identidade.scopes),
      );
      for (const t of TOOLS) if (t.escreve && !identidade.podeEscrever) visiveis.delete(t.name);
      return ok(id, {
        tools: TOOLS.filter((t) => visiveis.has(t.name)).map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        })),
      });
    }

    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      if (!name) return err(id, -32602, "Parâmetro 'name' ausente.");
      // Qual ferramenta foi pedida — sem isso o log mostra só "POST /api/mcp",
      // igual para as 19, e não dá para ver o que está sendo consultado.
      const ferramenta = TOOLS_BY_NAME.get(name);
      anotarChamada({ meta: { tool: name, ...(ferramenta?.escreve ? { escrita: true } : {}) } });
      try {
        const data = await runTool(name, args, identidade.scopes, identidade.podeEscrever);
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          isError: false,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "erro ao executar a ferramenta";
        // Erro da ferramenta volta como resultado (isError), não como erro de protocolo.
        return ok(id, { content: [{ type: "text", text: `Erro: ${msg}` }], isError: true });
      }
    }

    // Métodos opcionais que alguns clientes sondam.
    case "resources/list":
      return ok(id, { resources: [] });
    case "prompts/list":
      // Só o que a chave alcança — prompt que depende de uma área fechada
      // falharia no meio, depois de já ter começado a responder.
      return ok(id, {
        prompts: promptsPermitidos(identidade.scopes).map((p) => ({
          name: p.name,
          title: p.title,
          description: p.description,
          arguments: p.arguments ?? [],
        })),
      });

    case "prompts/get": {
      const nome = String(req.params?.name ?? "");
      const prompt = PROMPTS.find((p) => p.name === nome);
      if (!prompt) return err(id, -32602, `Prompt desconhecido: ${nome}`);
      if (!promptsPermitidos(identidade.scopes).some((p) => p.name === nome)) {
        return err(id, -32002, `Esta chave não alcança as áreas necessárias para "${nome}".`);
      }
      const args = (req.params?.arguments ?? {}) as Record<string, string>;
      anotarChamada({ meta: { prompt: nome } });
      return ok(id, {
        description: prompt.description,
        messages: [
          { role: "user", content: { type: "text", text: prompt.montar(args) } },
        ],
      });
    }

    default:
      return err(id, -32601, `Método não suportado: ${method}`);
  }
}

async function postHandler(request: NextRequest) {
  const identidade = await autenticar(request);
  if (identidade) {
    const veredito = registrarChamada(chamadas, identidade.nome, Date.now());
    if (!veredito.permitido) {
      anotarChamada({ meta: { limite: "excedido" } });
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32029,
            message: `Limite de ${LIMITE_POR_MINUTO} chamadas por minuto atingido nesta chave. Tente de novo em ${veredito.esperarSegundos}s.`,
          },
        },
        {
          status: 429,
          headers: { ...CORS, "Retry-After": String(veredito.esperarSegundos) },
        },
      );
    }
  }
  if (!identidade) {
    // Sem `WWW-Authenticate` de propósito. O cabeçalho é o correto para uma API
    // com token (RFC 6750), mas o formulário de conector personalizado do Claude
    // lê a presença dele como "este servidor faz OAuth" e pré-seleciona um fluxo
    // de login que aqui não existe — levando a pessoa a configurar errado. Este
    // servidor autentica só por chave, então o cabeçalho não ajudaria ninguém.
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: "não autorizado — envie Authorization: Bearer <MCP_TOKEN> ou ?token=<MCP_TOKEN>",
        },
      },
      { status: 401, headers: CORS },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(err(null, -32700, "JSON inválido"), { status: 400, headers: CORS });
  }

  // Lote (array) ou requisição única.
  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map((r) => handleRpc(r as RpcRequest, identidade)))).filter(Boolean);
    if (results.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
    return NextResponse.json(results, { headers: CORS });
  }

  const result = await handleRpc(body as RpcRequest, identidade);
  if (result === null) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(result, { headers: CORS });
}

/**
 * GET serve só para diagnóstico (o MCP em si usa POST).
 *
 * Mesmo sem token, informa se as DUAS variáveis necessárias estão presentes —
 * booleanos, nunca os valores. São as duas causas de "conectei e não funciona",
 * e sem esta resposta a única pista seria um 401 idêntico nos dois casos.
 */
async function getHandler(request: NextRequest) {
  const bancoConfigurado = hasServiceRole();
  const doAmbiente = (process.env.MCP_TOKEN ?? "").length >= 16;
  // Com o banco de pé, as chaves criadas no painel já bastam — MCP_TOKEN vira
  // opcional. Sem banco, não há como validar chave nenhuma.
  const tokenConfigurado = doAmbiente || bancoConfigurado;
  const identidade = await autenticar(request);
  const authed = Boolean(identidade);

  const pendencias: string[] = [];
  if (!bancoConfigurado) {
    pendencias.push("Defina SUPABASE_SERVICE_ROLE_KEY — sem ela não há leitura de dados nem validação de chave.");
    if (!doAmbiente) pendencias.push("Sem banco, só MCP_TOKEN autentica — defina-o e refaça o deploy.");
  } else if (!authed) {
    pendencias.push("Crie uma chave em Conta → Chaves de API e use-a como Bearer.");
  }

  return NextResponse.json(
    {
      server: SERVER_INFO,
      transport: "streamable-http (POST JSON-RPC)",
      protocolVersion: PROTOCOL_VERSION,
      configuracao: { token: tokenConfigurado, banco: bancoConfigurado, chavesDoPainel: bancoConfigurado },
      pronto: tokenConfigurado && bancoConfigurado,
      authenticated: authed,
      escopo: identidade ? rotuloEscopos(identidade.scopes) : undefined,
      podeEscrever: identidade ? identidade.podeEscrever : undefined,
      tools: identidade
        ? ferramentasPermitidas(TOOLS.map((t) => t.name), identidade.scopes)
            .filter((n) => identidade.podeEscrever || !TOOLS_BY_NAME.get(n)?.escreve)
        : undefined,
      pendencias: pendencias.length ? pendencias : undefined,
      hint:
        authed || !tokenConfigurado
          ? undefined
          : bancoConfigurado
            ? "Envie Authorization: Bearer <sua chave> — ou ?token=<sua chave> na URL, se o seu cliente não permitir header. Crie a chave em Conta → Chaves de API."
            : "Envie Authorization: Bearer <MCP_TOKEN>.",
    },
    { status: authed ? 200 : 401, headers: CORS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export const POST = withApiLog("mcp", postHandler);

export const GET = withApiLog("mcp", getHandler);
