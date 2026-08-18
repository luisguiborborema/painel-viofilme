import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { NPS_DEFAULTS, toNpsConfig } from "@/lib/data/nps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

/** GET: textos atuais da pesquisa de NPS. */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ config: NPS_DEFAULTS });
  const supabase = await createClient();
  const { data } = await supabase
    .from("nps_config")
    .select("headline, intro, comment_label, thank_you")
    .eq("id", 1)
    .maybeSingle();
  return NextResponse.json({ config: toNpsConfig(data) });
}

/** POST: salva os textos (linha única id=1). */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: { headline?: string; intro?: string; commentLabel?: string; thankYou?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const { error } = await supabase.from("nps_config").upsert({
    id: 1,
    headline: clean(b.headline),
    intro: clean(b.intro),
    comment_label: clean(b.commentLabel),
    thank_you: clean(b.thankYou),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (/nps_config.* does not exist|42P01/i.test(error.message)) {
      return NextResponse.json(
        { error: "Tabela de configuração do NPS ainda não existe. Rode a migração 0117_nps_config.sql." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
