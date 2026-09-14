import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { lerWebhook, segredoConfere } from "@/lib/data/zapsign";
import { zapsignSandbox } from "@/lib/data/zapsign-server";
import { logEvent } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de ENTRADA da ZapSign.
 *
 * A ZapSign não assina o corpo (não há HMAC). O que ela permite é enviar
 * headers que nós definimos ao registrar o webhook — então o segredo é nosso e
 * viaja no `Authorization`.
 *
 * Fecha quando o segredo não está configurado. Os outros webhooks do projeto
 * deixam passar com env vazio, o que é razoável para mensagem de chat; aqui
 * não: um POST anônimo aceito marcaria um documento como assinado, que é uma
 * afirmação jurídica sobre uma pessoa.
 */
export async function POST(req: Request) {
  const esperado = process.env.ZAPSIGN_WEBHOOK_SECRET ?? "";
  if (!esperado) {
    return NextResponse.json({ error: "webhook não configurado" }, { status: 503 });
  }
  // Qualquer um dos três serve. Em cadeia com `??`, um `Authorization` posto
  // por proxy no caminho venceria o `?secret=` da URL e derrubaria um webhook
  // que estava correto — e o painel da ZapSign só deixa configurar a URL.
  const candidatos = [
    req.headers.get("authorization"),
    req.headers.get("x-zapsign-secret"),
    new URL(req.url).searchParams.get("secret"),
  ];
  if (!candidatos.some((c) => segredoConfere(c, esperado))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const evento = lerWebhook(corpo);
  if (!evento) return NextResponse.json({ ok: true, ignorado: "sem token de documento" });
  if (!evento.status) return NextResponse.json({ ok: true, ignorado: "status irrelevante" });
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ error: "serviço indisponível" }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("crm_documents")
    .select("id, deal_id, status, title")
    .eq("external_id", evento.docToken)
    .maybeSingle();
  // Documento de outra conta ZapSign, ou já apagado aqui. Responder 200 evita
  // que a ZapSign fique reenviando um evento que nunca vamos conseguir tratar.
  if (!doc) return NextResponse.json({ ok: true, ignorado: "documento desconhecido" });

  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = { status: evento.status };
  if (evento.status === "signed") {
    patch.signed_at = evento.signedAt ?? agora;
    if (evento.signerName) patch.signed_by_name = evento.signerName;
    if (evento.signedFileUrl) patch.signed_file_url = evento.signedFileUrl;
  }
  if (evento.status === "refused") patch.refused_at = agora;

  const { error } = await admin.from("crm_documents").update(patch).eq("id", doc.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent({
    action: evento.status === "signed" ? "assinatura.concluida" : `assinatura.${evento.status}`,
    area: "comercial",
    target: String(doc.id),
    detail: String(doc.title ?? ""),
    meta: { provider: "zapsign", docToken: evento.docToken, signer: evento.signerName },
  }).catch(() => {});

  return NextResponse.json({ ok: true, status: evento.status });
}

/** A ZapSign testa a URL antes de salvar o webhook. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    servico: "webhook ZapSign",
    configurado: Boolean(process.env.ZAPSIGN_WEBHOOK_SECRET),
    ambiente: zapsignSandbox() ? "sandbox (sem validade jurídica)" : "produção",
  });
}
