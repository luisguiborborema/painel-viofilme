import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { UAZAPI_WEBHOOK_SECRET } from "@/lib/whatsapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de ENTRADA do Uazapi (WhatsApp inbox ao vivo).
 *
 * Configure no painel Uazapi apontando para:
 *   https://painel-viofilme.vercel.app/api/webhooks/uazapi?secret=SEU_SEGREDO
 *
 * Toda chamada é registrada em wa_webhook_log (diagnóstico). Cada mensagem
 * recebida vira/atualiza uma conversa no inbox (wa_conversations/wa_messages) e,
 * quando casa por telefone, também entra na timeline do lead. O formato do
 * payload do Uazapi varia por versão, então a extração é bem tolerante.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

function pickString(obj: Obj, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/** Extrai só os dígitos do telefone a partir de "5527...@s.whatsapp.net" etc. */
function digits(raw?: string): string {
  if (!raw) return "";
  return raw.split("@")[0].split(":")[0].replace(/\D/g, "");
}

/** Texto da mensagem, cobrindo formatos Baileys/Uazapi aninhados. */
function extractText(msg: Obj): string | undefined {
  const direct = pickString(msg, ["text", "content", "body", "caption", "message"]);
  if (direct) return direct;
  const m = msg.message;
  if (isObj(m)) {
    const nested = pickString(m, ["conversation", "text", "caption"]);
    if (nested) return nested;
    const ext = m.extendedTextMessage;
    if (isObj(ext) && typeof ext.text === "string") return ext.text;
    for (const key of ["imageMessage", "videoMessage", "documentMessage"]) {
      const mm = m[key];
      if (isObj(mm) && typeof mm.caption === "string" && mm.caption.trim())
        return mm.caption;
    }
  }
  return undefined;
}

function extractPhone(msg: Obj): string {
  let raw = pickString(msg, ["sender", "chatid", "chatId", "from", "phone", "number", "jid"]);
  if (!raw && isObj(msg.key)) raw = pickString(msg.key, ["remoteJid", "participant"]);
  return digits(raw);
}

function isFromMe(msg: Obj): boolean {
  if (msg.fromMe === true || msg.fromMe === "true") return true;
  if (isObj(msg.key) && (msg.key.fromMe === true || msg.key.fromMe === "true")) return true;
  return false;
}

function isGroup(msg: Obj): boolean {
  const jid =
    pickString(msg, ["chatid", "chatId", "remoteJid", "from"]) ??
    (isObj(msg.key) ? pickString(msg.key, ["remoteJid"]) : undefined) ??
    "";
  return jid.includes("@g.us") || msg.isGroup === true;
}

/** Localiza o(s) objeto(s) de mensagem dentro do envelope do webhook. */
function findMessages(payload: unknown): Obj[] {
  if (Array.isArray(payload)) return payload.flatMap(findMessages);
  if (!isObj(payload)) return [];
  if (isObj(payload.message)) return [payload.message];
  if (Array.isArray(payload.messages)) return payload.messages.filter(isObj) as Obj[];
  if (isObj(payload.data)) {
    if (isObj(payload.data.message)) return [payload.data.message];
    if (Array.isArray(payload.data.messages))
      return payload.data.messages.filter(isObj) as Obj[];
    return [payload.data];
  }
  // Talvez a própria raiz seja a mensagem.
  if ("text" in payload || "body" in payload || "key" in payload || "content" in payload)
    return [payload];
  return [];
}

async function log(raw: unknown, note: string) {
  if (!isSupabaseConfigured() || !hasServiceRole()) return;
  try {
    await createAdminClient().from("wa_webhook_log").insert({ raw: raw as object, note });
  } catch {
    /* diagnóstico não deve derrubar o webhook */
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    await log({ raw }, "json-invalido");
    return NextResponse.json({ ok: true, ignored: "no-json" });
  }

  // Secret opcional por query string (registra tentativa inválida).
  if (UAZAPI_WEBHOOK_SECRET) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== UAZAPI_WEBHOOK_SECRET) {
      await log(payload, "secret-invalido");
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const messages = findMessages(payload);
  if (messages.length === 0) {
    await log(payload, "sem-mensagem");
    return NextResponse.json({ ok: true, ignored: "no-message" });
  }

  const results: string[] = [];
  for (const msg of messages) {
    results.push(await handleMessage(msg));
  }
  await log(payload, `processado: ${results.join(",")}`);
  return NextResponse.json({ ok: true, results });
}

async function handleMessage(msg: Obj): Promise<string> {
  if (isFromMe(msg)) return "fromMe";
  if (isGroup(msg)) return "grupo";

  const text = extractText(msg);
  const phone = extractPhone(msg);
  const externalId = pickString(msg, ["id", "messageid", "messageId"]) ??
    (isObj(msg.key) ? pickString(msg.key, ["id"]) : undefined);
  const senderName = pickString(msg, [
    "senderName", "pushName", "notifyName", "sender_pushName", "name",
  ]);

  if (!text || !phone) return "incompleto";
  if (!isSupabaseConfigured() || !hasServiceRole()) return "sem-banco";

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const tail = phone.slice(-8);

  const { data: leads } = await admin
    .from("crm_leads")
    .select("id,contact_phone")
    .not("contact_phone", "is", null)
    .limit(500);
  const lead = (leads ?? []).find((l) =>
    String(l.contact_phone ?? "").endsWith(tail),
  );

  const { data: existing } = await admin
    .from("wa_conversations")
    .select("id,unread_count")
    .eq("phone", phone)
    .maybeSingle();

  let conversationId = existing?.id as string | undefined;
  if (conversationId) {
    await admin
      .from("wa_conversations")
      .update({
        name: senderName ?? undefined,
        lead_id: lead?.id ?? undefined,
        last_message_at: now,
        last_message_preview: text.slice(0, 120),
        last_direction: "in",
        unread_count: Number(existing?.unread_count ?? 0) + 1,
        updated_at: now,
      })
      .eq("id", conversationId);
  } else {
    const { data: created } = await admin
      .from("wa_conversations")
      .insert({
        phone,
        name: senderName ?? null,
        lead_id: lead?.id ?? null,
        status: "open",
        last_message_at: now,
        last_message_preview: text.slice(0, 120),
        last_direction: "in",
        unread_count: 1,
      })
      .select("id")
      .single();
    conversationId = created?.id;
  }

  if (conversationId) {
    await admin.from("wa_messages").insert({
      conversation_id: conversationId,
      direction: "in",
      type: "text",
      body: text,
      external_id: externalId ?? null,
    });
  }

  if (lead) {
    await admin.from("crm_interactions").insert({
      lead_id: lead.id,
      channel: "whatsapp",
      direction: "in",
      body: text,
      external_id: externalId ?? null,
      meta: { phone },
    });
    await admin.from("crm_leads").update({ last_interaction_at: now }).eq("id", lead.id);
  }

  return lead ? "ok+lead" : "ok";
}
