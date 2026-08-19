import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { MeetingSurveyForm } from "@/components/public/meeting-survey-form";
import { toMeetingConfig } from "@/lib/data/meeting-survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Página pública da pesquisa pós-reunião (fallback sem slug). */
export default async function MeetingSurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isSupabaseConfigured() || !hasServiceRole()) notFound();

  const admin = createAdminClient();
  const { data: survey } = await admin
    .from("meeting_surveys")
    .select("id, client_id, status")
    .eq("public_token", token)
    .maybeSingle();
  if (!survey) notFound();

  const [{ data: client }, { data: cfg }] = await Promise.all([
    admin.from("clients").select("name").eq("id", survey.client_id).maybeSingle(),
    admin.from("meeting_survey_config").select("headline, intro, comment_label, thank_you, questions").eq("id", 1).maybeSingle(),
  ]);

  return (
    <MeetingSurveyForm
      token={token}
      clientName={String(client?.name ?? "")}
      alreadyAnswered={survey.status === "answered"}
      config={toMeetingConfig(cfg)}
    />
  );
}
