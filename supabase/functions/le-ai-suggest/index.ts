// le-ai-suggest — Edge Function (CASCA / stub).
//
// IA da Linha Editorial: gera sugestões (narrativa central, tensão narrativa,
// pilares, temas de post) a partir do briefing do cliente. Fica DESLIGADA até o
// secret do Claude ser configurado. Quando ligar: definir ANTHROPIC_API_KEY no
// Supabase e LE_AI_ENABLED=true. A chave nunca vai ao cliente (padrão Viofilme).
//
// Deploy: supabase functions deploy le-ai-suggest

const CLAUDE_MODEL = "claude-opus-4-8"; // fixado num único ponto
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

interface SuggestRequest {
  kind: "narrativa" | "tensao" | "pilares" | "temas";
  clientBrief?: string; // objetivo/tom/público/concorrentes/restrições
  extra?: string;
}

const PROMPTS: Record<SuggestRequest["kind"], string> = {
  narrativa: "Proponha uma narrativa central de conteúdo para o mês, curta e específica.",
  tensao: "Descreva a tensão narrativa (o conflito/desejo do público) em 1–2 frases.",
  pilares: "Liste 4 pilares de conteúdo com uma linha cada.",
  temas: "Sugira 6 temas de post alinhados ao briefing, um por linha.",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não permitido" }), { status: 405 });
  }

  const enabled = Deno.env.get("LE_AI_ENABLED") === "true";
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY"); // secret no Supabase

  if (!enabled || !apiKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        enabled: false,
        reason: "IA da Linha Editorial desligada — configure ANTHROPIC_API_KEY e LE_AI_ENABLED.",
      }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: SuggestRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  const instruction = PROMPTS[body.kind];
  if (!instruction) return new Response(JSON.stringify({ error: "kind inválido" }), { status: 400 });

  const prompt = `${instruction}\n\nBriefing do cliente:\n${body.clientBrief ?? "(sem briefing)"}\n${body.extra ?? ""}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return new Response(JSON.stringify({ ok: false, error: data }), { status: 502 });
  }
  const text = Array.isArray(data.content) ? data.content.map((c: { text?: string }) => c.text ?? "").join("") : "";
  return new Response(JSON.stringify({ ok: true, kind: body.kind, suggestion: text }), {
    headers: { "Content-Type": "application/json" },
  });
});
