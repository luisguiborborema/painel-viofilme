import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { EditorialApproval, type ApprovalPost } from "@/components/editorial/editorial-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fora do componente (evita a regra de pureza com Date no render).
const nowIso = () => new Date().toISOString();

/** Primeira referência de imagem do post (moodboard/refs). */
function firstImage(refs: unknown): string | undefined {
  if (!Array.isArray(refs)) return undefined;
  const img = refs.find(
    (r) =>
      r &&
      typeof r === "object" &&
      (r as { kind?: string }).kind === "image" &&
      (r as { url?: string }).url,
  );
  return img ? String((img as { url?: string }).url) : undefined;
}

export default async function AprovarLE({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isSupabaseConfigured() || !hasServiceRole()) notFound();

  const admin = createAdminClient();
  const { data: line } = await admin
    .from("editorial_lines")
    .select("id, client_id, month, objetivo, narrativa_central, client_shared_at")
    .eq("public_approval_token", token)
    .maybeSingle();
  if (!line) notFound();

  const [{ data: client }, { data: posts }] = await Promise.all([
    admin.from("clients").select("name").eq("id", line.client_id).maybeSingle(),
    admin
      .from("editorial_posts")
      .select("id, n, title, tema, format, pillar, description, legenda, refs, post_date, weekday, client_status, client_feedback")
      .eq("line_id", line.id)
      .order("n"),
  ]);

  // Marca a primeira visualização do cliente (best-effort).
  if (!line.client_shared_at) {
    await admin
      .from("editorial_lines")
      .update({ client_shared_at: nowIso() })
      .eq("id", line.id);
  }

  const items: ApprovalPost[] = (posts ?? []).map((p) => ({
    id: String(p.id),
    n: Number(p.n ?? 0),
    title: String(p.title || p.tema || "Post"),
    format: String(p.format ?? "Feed"),
    pillar: p.pillar ? String(p.pillar) : "",
    description: p.description ? String(p.description) : "",
    legenda: p.legenda ? String(p.legenda) : "",
    date: p.post_date ? String(p.post_date) : "",
    weekday: p.weekday ? String(p.weekday) : "",
    image: firstImage(p.refs),
    status:
      p.client_status === "approved" || p.client_status === "changes"
        ? p.client_status
        : "pending",
    feedback: p.client_feedback ? String(p.client_feedback) : "",
  }));

  return (
    <EditorialApproval
      token={token}
      clientName={String(client?.name ?? "Cliente")}
      month={String(line.month ?? "")}
      objetivo={line.objetivo ? String(line.objetivo) : ""}
      narrativa={line.narrativa_central ? String(line.narrativa_central) : ""}
      posts={items}
    />
  );
}
