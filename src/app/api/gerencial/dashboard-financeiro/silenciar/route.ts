import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { hojeSP, silencioAte } from "@/lib/data/dashboard-financeiro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Silencia um aviso ⚪ por 7 dias, para QUEM pediu (spec §5.3 regra 4).
 *
 * Só aviso entra aqui. Crítico e atenção não têm rota de dispensa porque não
 * devem ter: eles saem quando o problema é resolvido, e um botão de esconder
 * transformaria a lista em caixa de entrada de coisa ignorada.
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (user.readOnly) {
    return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "banco não configurado" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { chave?: unknown } | null;
  const chave = String(body?.chave ?? "").trim();
  // A chave é `tipo` ou `tipo:escopo`. Só os informativos I1–I4 são ⚪, e é a
  // lista fechada que impede um crítico de ser silenciado por chamada direta.
  if (!/^I[1-4](:[\w-]{1,80})?$/.test(chave)) {
    return NextResponse.json({ error: "este aviso não pode ser silenciado" }, { status: 400 });
  }

  const db = await createClient();
  const { error } = await db.from("dashboard_silences").upsert(
    {
      user_id: user.id,
      exception_key: chave,
      silenced_until: silencioAte(hojeSP()),
    },
    { onConflict: "user_id,exception_key" },
  );
  if (error) {
    return NextResponse.json({ error: "não foi possível silenciar o aviso" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
