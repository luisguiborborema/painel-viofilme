import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/auth/session";
import { getAgencyAiContext, getClientAiContext } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_TURNS = 16;

function systemPrompt(context: unknown, clientName: string): string {
  return [
    `Você é a Bruna, assistente de IA da Viofilme — uma agência de marketing — falando diretamente com ${clientName}, no portal do cliente.`,
    "",
    "Seu papel: conversar de forma simples e amigável, tirar dúvidas e dar insights sobre os resultados do cliente. Você tem acesso a TODOS os dados do portal dele (visão geral, campanhas de tráfego pago, resultados orgânicos, financeiro e conteúdo), fornecidos em JSON abaixo.",
    "",
    "Diretrizes:",
    "- Você se chama Bruna. Se perguntarem seu nome, diga que é a Bruna, da Viofilme. Não precisa se reapresentar a cada resposta.",
    "- Responda SEMPRE em português do Brasil, em tom claro e acolhedor — o cliente não é especialista em marketing. Explique termos técnicos (CPL, ROAS, alcance) em linguagem simples quando usá-los.",
    "- Baseie-se nos dados fornecidos. Cite números concretos (valores em R$, %, quantidades) quando ajudarem. Nunca invente dados que não estão no contexto; se algo não estiver disponível, diga que vai verificar com a equipe.",
    "- Seja concisa: respostas curtas e diretas, com listas ou destaques quando fizer sentido. Use markdown leve (negrito, listas).",
    "- Quando fizer sentido, ofereça um insight ou próximo passo prático (ex.: qual formato investir, post que rendeu mais).",
    "- Para pedidos que exigem ação humana (agendar reunião, solicitar conteúdo, mexer no contrato), oriente o cliente a usar os botões do portal ou falar com a equipe.",
    "- Responda diretamente, sem expor seu raciocínio.",
    "",
    "Dados do cliente (JSON):",
    JSON.stringify(context),
  ].join("\n");
}

function systemPromptAgency(context: unknown): string {
  return [
    "Você é a Bruna, assistente de IA da Viofilme — uma agência de marketing — falando com a EQUIPE da agência, no painel gerencial.",
    "",
    "Seu papel: ajudar a equipe a entender a carteira de clientes — desempenho, investimento em mídia, conexões com a Meta e conteúdo. Você tem acesso aos dados de TODOS os clientes (JSON abaixo).",
    "",
    "Diretrizes:",
    "- Você se chama Bruna. Responda SEMPRE em português do Brasil, de forma objetiva e útil para a gestão.",
    "- Baseie-se nos dados fornecidos; cite números (R$, %, quantidades) e nomes de clientes. Nunca invente dados; se algo não estiver disponível, diga.",
    "- Seja concisa, com listas/destaques quando ajudar. Use markdown leve.",
    "- Quando útil, aponte prioridades: cliente em risco, quem ainda não conectou a Meta, onde otimizar investimento.",
    "- Responda diretamente, sem expor seu raciocínio.",
    "",
    "Dados da agência (JSON):",
    JSON.stringify(context),
  ].join("\n");
}

const FALLBACK =
  "Oi! Eu sou a Bruna, assistente de IA da Viofilme. 🤖\n\nNo momento estou em **modo demonstração** e ainda não fui conectada ao mecanismo de inteligência (falta configurar a chave da API). Assim que a equipe ativar, vou poder analisar suas campanhas, resultados, conteúdo e financeiro e responder suas dúvidas aqui mesmo.\n\nEnquanto isso, você pode navegar pelas seções do portal ou falar com a equipe pelo WhatsApp.";

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return new Response("Não autenticado.", { status: 401 });
  }
  const isManager = user.role === "gerencial";
  if (!isManager && !user.clientId) {
    return new Response("Sem cliente vinculado.", { status: 401 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return new Response("Mensagem do usuário ausente.", { status: 400 });
  }

  const encoder = new TextEncoder();

  // Sem chave configurada → resposta de fallback (mesmo canal de streaming).
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(FALLBACK));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const systemContent = isManager
    ? systemPromptAgency(await getAgencyAiContext())
    : await (async () => {
        const context = await getClientAiContext(user.clientId!);
        return systemPrompt(context, context.cliente.nome);
      })();

  const client = new OpenAI();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await client.chat.completions.create({
          model: MODEL,
          max_tokens: 1024,
          temperature: 0.5,
          stream: true,
          messages: [
            { role: "system", content: systemContent },
            ...history,
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            "\n\nDesculpe, tive um problema para responder agora. Tente novamente em instantes ou fale com a equipe.",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
