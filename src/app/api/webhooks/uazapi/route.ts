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
 * Cada mensagem recebida é anexada à timeline do lead correspondente (casado
 * pelo telefone). Idempotência via índice único (channel, external_id).
 * O formato do payload do Uazapi varia por versão, então a extração é tolerante.
 */

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
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
  return raw.split("@")[0].replace(/\D/g, "");
}

export async function POST(req: NextRequest) {
  // Validação opcional de segredo por query string.
  if (UAZAPI_WEBHOOK_SECRET) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== UAZAPI_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "no-json" });
  }

  // A mensagem pode vir em `message`, `data` ou na raiz.
  const msg =
    (payload.message as Record<string, unknown>) ??
    (payload.data as Record<string, unknown>) ??
    payload;

  // Só processa mensagens recebidas (ignora as enviadas por nós e eventos de status).
  const fromMe = msg.fromMe === true || msg.fromMe === "true";
  if (fromMe) return NextResponse.json({ ok: true, ignored: "fromMe" });

  const text = firstString(msg, ["text", "content", "body", "caption", "message"]);
  const phone = digits(
    firstString(msg, ["sender", "chatid", "chatId", "from", "phone", "number"]),
  );
  const externalId = firstString(msg, ["id", "messageid", "messageId", "key"]);
  const senderName = firstString(msg, ["senderName", "pushName", "notifyName", "name"]);

  if (!text || !phone) {
    return NextResponse.json({ ok: true, ignored: "incomplete" });
  }

  if (!isSupabaseConfigured() || !hasServiceRole()) {
    // Sem banco/serviço: só confirma o recebimento (modo demo).
    return NextResponse.json({ ok: true, persisted: false });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const tail = phone.slice(-8);

  // 1) Casa (opcionalmente) um lead do CRM pelo telefone.
  const { data: leads } = await admin
    .from("crm_leads")
    .select("id,contact_phone")
    .not("contact_phone", "is", null)
    .limit(500);
  const lead = (leads ?? []).find((l) =>
    String(l.contact_phone ?? "").endsWith(tail),
  );

  // 2) Inbox: upsert da conversa (todo contato vira conversa) + mensagem.
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
    const { error: msgErr } = await admin.from("wa_messages").insert({
      conversation_id: conversationId,
      direction: "in",
      type: "text",
      body: text,
      external_id: externalId ?? null,
    });
    if (msgErr && !String(msgErr.message).includes("duplicate")) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }
  }

  // 3) Se houver lead, também registra na timeline dele (idempotente).
  if (lead) {
    const { error } = await admin.from("crm_interactions").insert({
      lead_id: lead.id,
      channel: "whatsapp",
      direction: "in",
      body: text,
      external_id: externalId ?? null,
      meta: { phone },
    });
    if (error && !String(error.message).includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await admin
      .from("crm_leads")
      .update({ last_interaction_at: now })
      .eq("id", lead.id);
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    conversationId,
    leadId: lead?.id ?? null,
  });
}
