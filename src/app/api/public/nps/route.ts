import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/audit/log";
import { withApiLog } from "@/lib/audit/api-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown) => (v == null ? "" : String(v).trim());

/** Resposta pública de NPS (link estilo Tally, sem login). */
async function postHandler(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }
  if (str(b.website)) return NextResponse.json({ ok: true }); // honeypot

  const token = str(b.token);
  const score = Number(b.score);
  const comment = str(b.comment);
  const respondent = str(b.respondent);
  const extra = Array.isArray(b.extra)
    ? (b.extra as unknown[])
        .map((a) => {
          const o = (a ?? {}) as Record<string, unknown>;
          return { id: str(o.id), label: str(o.label), value: str(o.value) };
        })
        .filter((a) => a.label && a.value)
        .slice(0, 20)
    : [];
  if (!token || !Number.isInteger(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "nota inválida" }, { status: 400 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const admin = createAdminClient();
  const { data: survey } = await admin
    .from("nps_surveys")
    .select("id, client_id, status")
    .eq("public_token", token)
    .maybeSingle();
  if (!survey) return NextResponse.json({ error: "link inválido" }, { status: 404 });
  if (survey.status === "answered") return NextResponse.json({ ok: true, already: true });

  const { error } = await admin
    .from("nps_surveys")
    .update({
      score,
      comment: comment || null,
      respondent: respondent || null,
      extra: extra.length ? extra : null,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", survey.id);
  if (error) return NextResponse.json({ error: "falha ao salvar" }, { status: 500 });

  const { data: client } = await admin.from("clients").select("name").eq("id", survey.client_id).maybeSingle();
  await logEvent({
    userName: String(client?.name ?? "Cliente"),
    panel: "cliente",
    action: "nps-response",
    area: "CS",
    target: String(survey.client_id),
    detail: `Respondeu NPS: nota ${score}${comment ? ` — "${comment}"` : ""}`,
    meta: { score },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

export const POST = withApiLog("public:nps", postHandler);
