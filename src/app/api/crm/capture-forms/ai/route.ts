import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const FIELD_TYPES = new Set(["text", "textarea", "number", "select", "date", "checkbox", "url", "email", "phone"]);
const FIELD_MAPS = new Set(["title", "contact_name", "contact_email", "contact_phone", "company", "custom"]);

const SYSTEM = `Você monta formulários (briefings) para uma agência. Dada uma lista de perguntas OU uma descrição, gere os campos do formulário.
Responda SOMENTE em JSON válido no formato:
{"fields":[{"label":"texto da pergunta","fieldType":"text|textarea|number|select|date|checkbox|url|email|phone","required":true,"mapTo":"title|contact_name|contact_email|contact_phone|company|custom","options":["op1","op2"]}]}
Regras:
- Cada pergunta vira UM campo; use o texto da pergunta como "label" (pode ajustar levemente para clareza, mantendo o sentido).
- fieldType adequado: resposta longa/aberta → "textarea"; e-mail → "email"; telefone/WhatsApp → "phone"; data → "date"; sim/não → "checkbox"; link/site/URL → "url"; número/quantidade → "number"; escolha entre alternativas fixas → "select" (preencha "options"); caso contrário → "text".
- required: true apenas para campos essenciais (ex.: nome, forma de contato). Demais false.
- mapTo: pergunta que pede o NOME da pessoa → "contact_name"; e-mail → "contact_email"; telefone/WhatsApp → "contact_phone"; nome da EMPRESA/marca → "company"; um campo curto que sirva de TÍTULO do card (ex.: nome do projeto/empresa) → "title" (no máximo UM no formulário); todo o resto → "custom".
- options: array de strings SÓ para fieldType "select"; senão [].
- Não invente perguntas além das solicitadas, a menos que o usuário peça explicitamente para "sugerir" ou "completar".
- Máximo de 40 campos.`;

type AiField = { label?: string; fieldType?: string; required?: boolean; mapTo?: string; options?: unknown };

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (user.readOnly) {
    return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  }

  let body: { prompt?: string; destination?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Descreva o formulário ou cole as perguntas." }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, enabled: false, reason: "OPENAI_API_KEY não configurada no servidor." });
  }

  const userMsg =
    `Destino do formulário: ${body.destination === "entregas" ? "criar tarefa (entregas)" : "criar negócio (comercial)"}.\n\n` +
    `Perguntas / descrição:\n${prompt}`;

  try {
    const client = new OpenAI();
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: { fields?: AiField[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, reason: "A IA retornou um formato inesperado. Tente de novo." }, { status: 502 });
    }

    let titleUsed = false;
    const fields = (Array.isArray(parsed.fields) ? parsed.fields : [])
      .slice(0, 40)
      .map((f) => {
        const label = String(f.label ?? "").trim();
        if (!label) return null;
        const fieldType = FIELD_TYPES.has(String(f.fieldType)) ? String(f.fieldType) : "text";
        let mapTo = FIELD_MAPS.has(String(f.mapTo)) ? String(f.mapTo) : "custom";
        // Garante no máximo um campo "title".
        if (mapTo === "title") {
          if (titleUsed) mapTo = "custom";
          else titleUsed = true;
        }
        const options =
          fieldType === "select" && Array.isArray(f.options)
            ? f.options
                .map((o) => String(o).trim())
                .filter(Boolean)
                .map((o) => ({ value: o, label: o }))
            : [];
        return { label, fieldType, required: Boolean(f.required), mapTo, options };
      })
      .filter(Boolean);

    if (!fields.length) {
      return NextResponse.json({ ok: false, reason: "A IA não gerou campos. Reformule as perguntas." });
    }
    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : "Falha na IA." }, { status: 502 });
  }
}
