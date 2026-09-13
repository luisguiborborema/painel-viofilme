import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { CONFIG_PADRAO, normalizarConfig } from "@/lib/data/lead-score";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAVE = "lead_score";

/**
 * Pesos do lead score.
 *
 * Antes esta rota gravava uma lista de regras genéricas (campo/operador/valor)
 * que NINGUÉM lia: o score continuava fixo no código. Agora grava os pesos dos
 * fatores que o cálculo de fato usa.
 */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ config: CONFIG_PADRAO });

  const supabase = await createClient();
  const { data } = await supabase.from("crm_settings").select("value").eq("key", CHAVE).maybeSingle();
  const valor = (data as { value?: unknown } | null)?.value;
  // Formato antigo (`{ rules: [...] }`) nunca chegou a ser usado pelo cálculo —
  // normalizar devolve o padrão, que é o comportamento que já estava valendo.
  return NextResponse.json({ config: normalizarConfig((valor as Record<string, unknown>)?.config ?? valor) });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let body: { config?: unknown; restaurarPadrao?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const config = body.restaurarPadrao ? CONFIG_PADRAO : normalizarConfig(body.config);

  const supabase = await createClient();
  await logFromUser(user, {
    action: "update",
    area: "Lead score",
    target: body.restaurarPadrao ? "restaurado ao padrão" : null,
  });
  const { error } = await supabase
    .from("crm_settings")
    .upsert({ key: CHAVE, value: { config }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, config });
}
