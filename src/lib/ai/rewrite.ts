/**
 * Reescrita anti-ban: gera uma variação natural da mensagem para cada envio,
 * preservando o sentido, o idioma e a formatação do WhatsApp. Best-effort —
 * em qualquer falha (sem chave, timeout, erro) devolve o texto original.
 */
import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function rewriteAntiBan(text: string): Promise<string> {
  const clean = (text ?? "").trim();
  if (!clean || !process.env.OPENAI_API_KEY) return text;
  try {
    const client = new OpenAI();
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 1,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "Você reescreve mensagens de WhatsApp para evitar envios idênticos em massa (anti-ban). Regras: mantenha EXATAMENTE o mesmo idioma, sentido, tom e chamada para ação; varie apenas palavras/ordem levemente; preserve emojis e a formatação do WhatsApp (*negrito*, _itálico_, ~tachado~); NÃO adicione explicações, aspas ou rótulos. Responda somente com a mensagem reescrita.",
        },
        { role: "user", content: clean },
      ],
    });
    const out = res.choices[0]?.message?.content?.trim();
    return out && out.length > 0 ? out : text;
  } catch {
    return text;
  }
}
