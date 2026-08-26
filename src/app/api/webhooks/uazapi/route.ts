import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { UAZAPI_WEBHOOK_SECRET } from "@/lib/whatsapp/config";
import { downloadUazapiMedia } from "@/lib/whatsapp/download";
import { withApiLog } from "@/lib/audit/api-log";

type MediaType = "image" | "audio" | "video" | "document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de ENTRADA do Uazapi (WhatsApp inbox ao vivo — espelho Kommo).
 *
 * O Uazapi NÃO preserva query string, mas envia o `token` da instância no
 * corpo. Autorizamos se o `token` do corpo (ou o ?secret= da URL) bater com
 * UAZAPI_WEBHOOK_SECRET. Deixe o env vazio para não validar.
 *
 * Espelha os dois lados: mensagens do dono (fromMe) entram como "out",
 * mensagens do contato como "in". Uma conversa por telefone (chatid).
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

function pickString(obj: Obj | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/** Só dígitos do telefone a partir de "5527...@s.whatsapp.net" / "…:sufixo". */
function digits(raw?: string): string {
  if (!raw) return "";
  return raw.split("@")[0].split(":")[0].replace(/\D/g, "");
}

/** Texto da mensagem, cobrindo formatos Uazapi/Baileys. */
function extractText(msg: Obj): string | undefined {
  const t = msg.text;
  if (typeof t === "string" && t.trim()) return t;
  const c = msg.content;
  if (typeof c === "string" && c.trim()) return c;
  const direct = pickString(msg, ["body", "caption", "message"]);
  if (direct) return direct;
  const m = msg.message;
  if (isObj(m)) {
    const nested = pickString(m, ["conversation", "text", "caption"]);
    if (nested) return nested;
    const ext = m.extendedTextMessage;
    if (isObj(ext) && typeof ext.text === "string") return ext.text;
  }
  return undefined;
}

type Envelope = { message: Obj; chat?: Obj };

function normalize(payload: unknown, chat?: Obj): Envelope[] {
  if (Array.isArray(payload)) return payload.flatMap((p) => normalize(p, chat));
  if (!isObj(payload)) return [];
  const ownChat = isObj(payload.chat) ? payload.chat : chat;
  if (isObj(payload.message)) return [{ message: payload.message, chat: ownChat }];
  if (Array.isArray(payload.messages))
    return (payload.messages.filter(isObj) as Obj[]).map((m) => ({ message: m, chat: ownChat }));
  if (isObj(payload.data)) return normalize(payload.data, ownChat);
  if ("text" in payload || "content" in payload || "chatid" in payload || "key" in payload)
    return [{ message: payload, chat: ownChat }];
  return [];
}

function authorized(req: NextRequest, payload: unknown): boolean {
  // Sem segredo configurado, RECUSA. Aceitar seria deixar qualquer um na
  // internet injetar mensagem no inbox — o endpoint é público por natureza e
  // grava no banco. Falhar fechado custa uma variável de ambiente; falhar
  // aberto custa a integridade do histórico de conversas.
  if (!UAZAPI_WEBHOOK_SECRET) return false;
  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret === UAZAPI_WEBHOOK_SECRET) return true;
  const token = isObj(payload) ? pickString(payload, ["token"]) : undefined;
  return token === UAZAPI_WEBHOOK_SECRET;
}

async function log(raw: unknown, note: string) {
  if (!isSupabaseConfigured() || !hasServiceRole()) return;
  try {
    await createAdminClient().from("wa_webhook_log").insert({ raw: raw as object, note });
  } catch {
    /* diagnóstico não deve derrubar o webhook */
  }
}

async function postHandler(req: NextRequest) {
  const body = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    await log({ body }, "json-invalido");
    return NextResponse.json({ ok: true, ignored: "no-json" });
  }

  if (!authorized(req, payload)) {
    const motivo = UAZAPI_WEBHOOK_SECRET ? "secret-invalido" : "secret-nao-configurado";
    await log(payload, motivo);
    return NextResponse.json(
      { error: "unauthorized", hint: UAZAPI_WEBHOOK_SECRET ? undefined : "defina UAZAPI_WEBHOOK_SECRET" },
      { status: 401 },
    );
  }

  const envelopes = normalize(payload);
  if (envelopes.length === 0) {
    await log(payload, "sem-mensagem");
    return NextResponse.json({ ok: true, ignored: "no-message" });
  }

  const results: string[] = [];
  for (const env of envelopes) results.push(await handle(env));
  await log(payload, `processado: ${results.join(",")}`);
  return NextResponse.json({ ok: true, results });
}

async function handle({ message: msg, chat }: Envelope): Promise<string> {
  // Grupos: fora de escopo por enquanto.
  const groupFlag =
    msg.isGroup === true ||
    (pickString(msg, ["chatid", "chatId", "remoteJid", "from"]) ?? "").includes("@g.us");
  if (groupFlag) return "grupo";

  // Mensagens enviadas pela nossa própria API já foram gravadas no envio.
  if (msg.wasSentByApi === true) return "api-echo";

  const fromMe = msg.fromMe === true || msg.fromMe === "true";

  // Telefone da conversa: chatid é o mais confiável (sender pode ser @lid).
  const phone = digits(
    pickString(msg, ["chatid", "chatId"]) ??
      pickString(chat, ["wa_chatid", "phone"]) ??
      pickString(msg, ["sender_pn", "from", "number"]) ??
      pickString(msg, ["sender"]),
  );

  const caption = extractText(msg);
  const media = detectMedia(msg);
  const externalId =
    pickString(msg, ["messageid", "id", "messageId"]) ??
    (isObj(msg.key) ? pickString(msg.key, ["id"]) : undefined);
  // Nome do contato (não do dono): vem do objeto chat.
  const contactName =
    pickString(chat, ["wa_name", "name", "wa_contactName"]) ??
    (!fromMe ? pickString(msg, ["senderName"]) : undefined);

  if (!phone) return "sem-telefone";
  if (!caption && !media) return "sem-texto";
  if (!isSupabaseConfigured() || !hasServiceRole()) return "sem-banco";

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const tail = phone.slice(-8);
  const direction = fromMe ? "out" : "in";

  // Resolve a mídia recebida: baixa via Uazapi e re-hospeda no nosso Storage.
  let msgType = "text";
  let body: string | null = caption ?? null;
  let mediaUrl: string | null = null;
  if (media) {
    const dl = await downloadUazapiMedia(externalId ?? "", { audio: media === "audio" });
    if (dl?.base64) {
      mediaUrl = await uploadIncoming(admin, phone, dl.base64, dl.mimetype, media);
    }
    if (mediaUrl) {
      msgType = media;
    } else {
      body = caption ?? placeholderFor(media);
    }
  }
  const preview = body ?? placeholderFor((msgType as MediaType) ?? "document");

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
        name: contactName ?? undefined,
        lead_id: lead?.id ?? undefined,
        last_message_at: now,
        last_message_preview: preview.slice(0, 120),
        last_direction: direction,
        unread_count: fromMe ? 0 : Number(existing?.unread_count ?? 0) + 1,
        updated_at: now,
      })
      .eq("id", conversationId);
  } else {
    const { data: created } = await admin
      .from("wa_conversations")
      .insert({
        phone,
        name: contactName ?? null,
        lead_id: lead?.id ?? null,
        status: "open",
        last_message_at: now,
        last_message_preview: preview.slice(0, 120),
        last_direction: direction,
        unread_count: fromMe ? 0 : 1,
      })
      .select("id")
      .single();
    conversationId = created?.id;
  }

  if (conversationId) {
    await admin.from("wa_messages").insert({
      conversation_id: conversationId,
      direction,
      type: msgType,
      body,
      media_url: mediaUrl,
      external_id: externalId ?? null,
    });
  }

  if (lead) {
    await admin.from("crm_interactions").insert({
      lead_id: lead.id,
      channel: "whatsapp",
      direction,
      body: preview,
      external_id: externalId ?? null,
      meta: { phone, mediaUrl },
    });
    await admin.from("crm_leads").update({ last_interaction_at: now }).eq("id", lead.id);
  }

  return lead ? `${direction}+lead` : direction;
}

/** Detecta o tipo de mídia da mensagem (ou null se for texto). */
function detectMedia(msg: Obj): MediaType | null {
  const raw = (pickString(msg, ["mediaType", "messageType", "type"]) ?? "").toLowerCase();
  if (!raw || raw === "text" || raw === "conversation" || raw === "extendedtextmessage")
    return null;
  if (raw.includes("image") || raw.includes("sticker")) return "image";
  if (raw.includes("audio") || raw === "ptt") return "audio";
  if (raw.includes("video") || raw.includes("gif")) return "video";
  if (raw.includes("document")) return "document";
  if (raw === "media") {
    const c = msg.content;
    const mt = isObj(c) ? String(c.mimetype ?? "") : "";
    if (mt.startsWith("image")) return "image";
    if (mt.startsWith("audio")) return "audio";
    if (mt.startsWith("video")) return "video";
    return "document";
  }
  return null;
}

function placeholderFor(type: MediaType): string {
  return { image: "[imagem]", audio: "[áudio]", video: "[vídeo]", document: "[documento]" }[type];
}

const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

/** Sobe a mídia recebida (base64) para o bucket público e devolve a URL. */
async function uploadIncoming(
  admin: ReturnType<typeof createAdminClient>,
  phone: string,
  base64: string,
  mimetype: string | undefined,
  type: MediaType,
): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > 20 * 1024 * 1024) return null;
    const mime = mimetype || defaultMime(type);
    const ext = EXT[mime] ?? (type === "audio" ? "mp3" : type === "image" ? "jpg" : "bin");
    const path = `incoming/${phone}/${Date.now()}-${buffer.length % 100000}.${ext}`;
    await admin.storage
      .createBucket("wa-media", { public: true, fileSizeLimit: "20MB" })
      .catch(() => {});
    const { error } = await admin.storage
      .from("wa-media")
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (error) return null;
    return admin.storage.from("wa-media").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

function defaultMime(type: MediaType): string {
  return { image: "image/jpeg", audio: "audio/mpeg", video: "video/mp4", document: "application/octet-stream" }[type];
}

export const POST = withApiLog("webhook:uazapi", postHandler);
