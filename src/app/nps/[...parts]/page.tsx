import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { NpsForm } from "@/components/public/nps-form";
import { toNpsConfig } from "@/lib/data/nps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "Pesquisa NPS" };

/**
 * Página pública de resposta do NPS (link estilo Tally, sem login).
 *
 * Aceita as duas formas de link — /nps/<token> (antigo) e /nps/<slug>/<token>
 * (com o nome do cliente na URL). O slug é decorativo: a validação é sempre
 * pelo token, que é o ÚLTIMO segmento.
 */
export default async function NpsPage({
  params,
}: {
  params: Promise<{ parts: string[] }>;
}) {
  const { parts } = await params;
  const token = parts?.[parts.length - 1] ?? "";
  if (!token || !isSupabaseConfigured() || !hasServiceRole()) notFound();

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
