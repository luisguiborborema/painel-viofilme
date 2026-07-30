import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { SignDocument, type SignDoc } from "@/components/crm/sign-document";

export const dynamic = "force-dynamic";

// Helpers fora do componente (evitam a regra de pureza com Date.now/new Date).
function nowIso(): string {
  return new Date().toISOString();
}
function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export default async function PropostaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isSupabaseConfigured() || !hasServiceRole()) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("crm_documents")
    .select("id, title, content, value, kind, status, signed_by_name, signed_at, expires_at")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) notFound();

  // Marca como visto (best-effort) se ainda estava "enviado".
  if (data.status === "sent") {
    await admin
      .from("crm_documents")
      .update({ status: "viewed", viewed_at: nowIso() })
      .eq("id", data.id)
      .then(
        () => {},
        () => {},
      );
  }

  const doc: SignDoc = {
    token,
    title: String(data.title),
    content: data.content ? String(data.content) : undefined,
    kind: String(data.kind ?? "documento"),
    value: data.value != null ? Number(data.value) : null,
    status: String(data.status ?? "sent"),
    signedByName: data.signed_by_name ? String(data.signed_by_name) : null,
    signedAt: data.signed_at ? String(data.signed_at) : null,
    expired: isExpired(data.expires_at ? String(data.expires_at) : null),
  };

  return (
    <main className="min-h-screen bg-canvas">
      <SignDocument doc={doc} />
    </main>
  );
}
