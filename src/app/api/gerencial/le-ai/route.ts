import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const KINDS = new Set(["narrativa", "tensao", "pilares", "temas"]);

const INSTRUCTION: Record<string, string> = {
  narrativa: "Proponha UMA narrativa central de conteúdo para o mês — curta (1–2 frases), específica e acionável. Responda só com a narrativa, sem título nem aspas.",
  tensao: "Descreva a tensão narrativa (o conflito/desejo do público que sustenta o mês) em 1–2 frases. Responda só com o texto.",
  pilares: "Liste 4 pilares de conteúdo, um por linha, no formato 'Nome do pilar'. Sem numeração, sem descrição, só o nome de cada pilar por linha.",
  temas: "Sugira 6 temas de post alinhados ao briefing, um por linha, curtos. Sem numeração.",
};

type Body = { kind?: string; clientId?: string; extra?: string };

/** Sugestões da Linha Editorial via OpenAI (chave no servidor). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.kind || !KINDS.has(b.kind)) {
    return NextResponse.json({ error: "kind inválido" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, enabled: false, reason: "OPENAI_API_KEY não configurada." });
  }

  // Briefing real do cliente (quando houver) para dar contexto.
  let clientBrief = "";
  if (b.clientId && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients")
      .select("name, segment, brief_objetivo, brief_tom, brief_publico, brief_concorrentes, brief_restricoes")
      .eq("id", b.clientId)
      .maybeSingle();
    const c = data as Record<string, string | null> | null;
    if (c) {
      clientBrief = [
        `Cliente: ${c.name ?? "—"}`,
        `Segmento: ${c.segment ?? "—"}`,
        c.brief_objetivo && `Objetivo: ${c.brief_objetivo}`,
        c.brief_tom && `Tom de voz: ${c.brief_tom}`,
        c.brief_publico && `Público: ${c.brief_publico}`,
        c.brief_concorrentes && `Concorrentes: ${c.brief_concorrentes}`,
        c.brief_restricoes && `Restrições: ${c.brief_restricoes}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const prompt = `${INSTRUCTION[b.kind]}\n\nBriefing do cliente:\n${clientBrief || "(sem briefing)"}\n${b.extra ?? ""}`;

  try {
    const client = new OpenAI();
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        { role: "system", content: "Você é estrategista de conteúdo de uma agência. Responda em português, direto, sem preâmbulo." },
        { role: "user", content: prompt },
      ],
    });
    const suggestion = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!suggestion) {
      return NextResponse.json({ ok: false, reason: "A IA não retornou sugestão." });
    }
    return NextResponse.json({ ok: true, kind: b.kind, suggestion });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : "Falha na IA." }, { status: 502 });
  }
}
