import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { CaptureForm, type PublicField } from "@/components/crm/capture-form";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let title = "Fale com a gente";
  let description: string | undefined;
  let fields: PublicField[] = [];

  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("crm_capture_forms")
      .select("id, name, active, description")
      .eq("slug", slug)
      .maybeSingle();
    if (!data || !data.active) notFound();
    title = String(data.name);
    description = data.description ? String(data.description) : undefined;

    const { data: rows } = await admin
      .from("crm_form_fields")
      .select("field_key,label,field_type,required,options")
      .eq("form_id", data.id)
      .eq("active", true)
      .order("position", { ascending: true });
    fields = (rows ?? []).map((r) => ({
      fieldKey: String(r.field_key),
      label: String(r.label),
      fieldType: String(r.field_type ?? "text"),
      required: Boolean(r.required),
      options: Array.isArray(r.options)
        ? (r.options as { value: string; label: string }[])
        : [],
    }));
  }

  return (
    <main className="min-h-screen bg-canvas">
      <CaptureForm slug={slug} title={title} description={description} fields={fields} />
    </main>
  );
}
