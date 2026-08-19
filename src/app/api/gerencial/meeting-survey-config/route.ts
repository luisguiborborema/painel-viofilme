import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { parseQuestions } from "@/lib/data/nps";
import { MEETING_DEFAULTS, toMeetingConfig } from "@/lib/data/meeting-survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ config: MEETING_DEFAULTS });
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_survey_config")
    .select("headline, intro, comment_label, thank_you, questions, auto_enabled, delay_hours")
    .eq("id", 1)
    .maybeSingle();
  return NextResponse.json({ config: toMeetingConfig(data) });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: { headline?: string; intro?: string; commentLabel?: string; thankYou?: string; questions?: unknown; autoEnabled?: boolean; delayHours?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const delay = Number(b.delayHours);
  const { error } = await supabase.from("meeting_survey_config").upsert({
    id: 1,
    headline: clean(b.headline),
    intro: clean(b.intro),
    comment_label: clean(b.commentLabel),
    thank_you: clean(b.thankYou),
    questions: parseQuestions(b.questions),
    auto_enabled: !!b.autoEnabled,
    delay_hours: Number.isFinite(delay) && delay >= 0 ? Math.min(Math.round(delay), 168) : 2,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (/meeting_survey_config.* does not exist|42P01/i.test(error.message)) {
      return NextResponse.json({ error: "Tabela ainda não existe. Rode a migração 0119_meeting_surveys.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
