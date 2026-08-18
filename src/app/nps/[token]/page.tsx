import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { NpsForm } from "@/components/public/nps-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Página pública de resposta do NPS (link estilo Tally, sem login). */
export default async function NpsPage({
  params,
}: {
  params: Promise<{ token: string }>;
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

  const { data: client } = await admin.from("clients").select("name").eq("id", survey.client_id).maybeSingle();

  return (
    <NpsForm
      token={token}
      clientName={String(client?.name ?? "")}
      alreadyAnswered={survey.status === "answered"}
    />
  );
}
