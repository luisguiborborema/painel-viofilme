import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { CaptureForm, type PublicField } from "@/components/crm/capture-form";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { slug } = await params;
  const { client } = await searchParams;
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

    // Conta a visita (best-effort) para a taxa de conversão.
    await admin.rpc("increment_form_views", { p_slug: slug }).then(
      () => {},
      () => {},
    );

    const { data: rows } = await admin
      .from("crm_form_fields")
      .select("field_key,label,field_type,required,options,show_if_key,show_if_value")
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
      showIfKey: r.show_if_key == null ? null : String(r.show_if_key),
      showIfValue: r.show_if_value == null ? null : String(r.show_if_value),
    }));
  }

  return (
    <main className="min-h-screen bg-canvas">
      <CaptureForm slug={slug} title={title} description={description} fields={fields} client={client} />
    </main>
  );
}
