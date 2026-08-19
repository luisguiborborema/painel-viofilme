import { NextResponse, type NextRequest } from "next/server";
import { TOOLS, runTool } from "@/lib/mcp/tools";

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

type RpcId = string | number | null;
type RpcRequest = { jsonrpc?: string; id?: RpcId; method?: string; params?: Record<string, unknown> };

const ok = (id: RpcId, result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: RpcId, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

/** Compara o token sem vazar tamanho por curto-circuito. */
function tokenOk(header: string | null): boolean {
  const expected = process.env.MCP_TOKEN ?? "";
  if (expected.length < 16) return false; // não configurado → endpoint fechado
  const got = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function handleRpc(req: RpcRequest): Promise<object | null> {
  const id = req.id ?? null;
  const method = String(req.method ?? "");

  // Notificações (sem id) não recebem resposta.
  if (method.startsWith("notifications/")) return null;

  switch (method) {
    case "initialize": {
      const asked = String((req.params?.protocolVersion as string) ?? "");
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.has(asked) ? asked : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Dados do Painel Viofilme (agência de marketing): clientes, comercial/CRM, financeiro, entregas, campanhas, NPS e disparos. Todas as ferramentas são somente leitura. Comece por `search` ou `list_clients` quando não souber o id de um registro.",
      });
    }

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        })),
      });

    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      if (!name) return err(id, -32602, "Parâmetro 'name' ausente.");
      try {
        const data = await runTool(name, args);
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
      return ok(id, { prompts: [] });

    default:
      return err(id, -32601, `Método não suportado: ${method}`);
  }
}

export async function POST(request: NextRequest) {
  if (!tokenOk(request.headers.get("authorization"))) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "não autorizado" } },
      { status: 401, headers: { ...CORS, "WWW-Authenticate": "Bearer" } },
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
    const results = (await Promise.all(body.map((r) => handleRpc(r as RpcRequest)))).filter(Boolean);
    if (results.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
    return NextResponse.json(results, { headers: CORS });
  }

  const result = await handleRpc(body as RpcRequest);
  if (result === null) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(result, { headers: CORS });
}

/** GET serve só para checar se o endpoint está de pé (o MCP usa POST). */
export async function GET(request: NextRequest) {
  const authed = tokenOk(request.headers.get("authorization"));
  return NextResponse.json(
    {
      server: SERVER_INFO,
      transport: "streamable-http (POST JSON-RPC)",
      protocolVersion: PROTOCOL_VERSION,
      authenticated: authed,
      tools: authed ? TOOLS.map((t) => t.name) : undefined,
      hint: authed ? undefined : "Envie o header Authorization: Bearer <MCP_TOKEN>.",
    },
    { status: authed ? 200 : 401, headers: CORS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
