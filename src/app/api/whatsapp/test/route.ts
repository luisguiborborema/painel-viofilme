import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import {
  WHATSAPP_NOTIFY_NUMBERS,
  isWhatsappConfigured,
} from "@/lib/whatsapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Envia um WhatsApp de teste aos números internos (ou a um número informado). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isWhatsappConfigured()) {
    return NextResponse.json(
      { error: "Uazapi não configurado (UAZAPI_URL / UAZAPI_TOKEN)" },
      { status: 503 },
    );
  }

  let to: string | undefined;
  try {
    to = (await req.json())?.number;
  } catch {
    /* corpo opcional */
  }

  const numbers = to ? [to] : WHATSAPP_NOTIFY_NUMBERS;
  if (numbers.length === 0) {
    return NextResponse.json(
      { error: "sem número de destino (defina UAZAPI_NOTIFY_NUMBERS)" },
      { status: 400 },
    );
  }

  const text = "✅ Teste de notificação do Painel Viofilme (WhatsApp via Uazapi).";
  const results = await Promise.all(
    numbers.map((n) => sendWhatsappText(n, text)),
  );
  return NextResponse.json({ ok: true, sent: results.filter(Boolean).length });
}
