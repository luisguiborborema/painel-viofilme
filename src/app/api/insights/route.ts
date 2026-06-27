import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "campaigns" | "organic" | "common-posts";

const ENUMS: Record<Mode, string[]> = {
  campaigns: ["positivo", "atencao", "oportunidade", "orcamento"],
  organic: ["destaque", "oportunidade", "otimizacao", "atencao"],
  "common-posts": ["padrao"],
};

function buildPrompt(mode: Mode, businessType: string, data: unknown): string {
  const dados = JSON.stringify(data, null, 2);
  if (mode === "campaigns") {
    return `Você é um especialista em tráfego pago analisando os resultados de um cliente de ${businessType}. Com base nos dados abaixo, gere entre 2 e 4 insights em português, em linguagem simples e direta para o cliente (não para um especialista em marketing). Cada insight: type (positivo, atencao, oportunidade, orcamento), title (1 linha), text (2 a 4 linhas explicando o que está acontecendo e por que importa) e action (texto curto de botão, opcional). Dados: ${dados}`;
  }
  if (mode === "organic") {
    return `Você é um especialista em social media orgânico analisando os resultados de um cliente do segmento ${businessType}. Com base nos dados abaixo (KPIs do mês, variação vs. mês anterior, dados por formato, top posts, horários de pico da audiência e o slide ativo do painel), gere entre 2 e 4 insights em português, em linguagem simples e direta para o cliente. Cada insight: type (destaque, oportunidade, otimizacao, atencao), title (1 linha), text (2 a 4 linhas) e action (opcional). Se um formato concentra muito engajamento mas pouco volume de posts, capture essa desproporção. Dados: ${dados}`;
  }
  return `Você analisou os 3 melhores posts do mês de um cliente de ${businessType} (legendas, retenção, horários de pico e paleta de cores). Identifique exatamente 3 padrões que eles têm em comum — em conteúdo, linguagem, visual e timing. Retorne 3 itens, cada um com type "padrao", title (1 linha em negrito) e text (2 a 4 linhas). Dados: ${dados}`;
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada" },
      { status: 503 },
    );
  }

  let body: { mode?: Mode; businessType?: string; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const mode = body.mode;
  if (!mode || !(mode in ENUMS)) {
    return NextResponse.json({ error: "mode inválido" }, { status: 400 });
  }

  const schema = {
    type: "object",
    properties: {
      insights: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ENUMS[mode] },
            title: { type: "string" },
            text: { type: "string" },
            action: { type: "string" },
          },
          required: ["type", "title", "text"],
          additionalProperties: false,
        },
      },
    },
    required: ["insights"],
    additionalProperties: false,
  };

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema },
      },
      messages: [
        {
          role: "user",
          content: buildPrompt(
            mode,
            body.businessType ?? "negócio local",
            body.data ?? {},
          ),
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const text =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (message as any).content?.find((b: any) => b.type === "text")?.text ?? "{}";
    const parsed = JSON.parse(text);
    return NextResponse.json({ insights: parsed.insights ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
