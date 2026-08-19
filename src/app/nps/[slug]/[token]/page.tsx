import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { NpsForm } from "@/components/public/nps-form";
import { toNpsConfig } from "@/lib/data/nps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Página pública do NPS com o nome do cliente na URL (/nps/<slug>/<token>).
 * O `slug` é decorativo — a validação é sempre pelo token.
 */
export default async function NpsPageWithSlug({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { token } = await params;
  if (!isSupabaseConfigured() || !hasServiceRole()) notFound();

  const admin = createAdminClient();
  const { data: survey } = await admin
    .from("nps_surveys")
    .select("id, client_id, status")
    .eq("public_token", token)
    .maybeSingle();
  if (!survey) notFound();

  const [{ data: client }, { data: cfg }] = await Promise.all([
    admin.from("clients").select("name").eq("id", survey.client_id).maybeSingle(),
    admin.from("nps_config").select("headline, intro, comment_label, thank_you, questions").eq("id", 1).maybeSingle(),
  ]);

  return (
    <NpsForm
      token={token}
      clientName={String(client?.name ?? "")}
      alreadyAnswered={survey.status === "answered"}
      config={toNpsConfig(cfg)}
    />
  );
}
