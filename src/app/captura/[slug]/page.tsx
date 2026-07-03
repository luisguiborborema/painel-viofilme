import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { CaptureForm } from "@/components/crm/capture-form";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let title = "Fale com a gente";

  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("crm_capture_forms")
      .select("name, active")
      .eq("slug", slug)
      .maybeSingle();
    if (!data || !data.active) notFound();
    title = String(data.name);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <CaptureForm slug={slug} title={title} />
    </main>
  );
}
