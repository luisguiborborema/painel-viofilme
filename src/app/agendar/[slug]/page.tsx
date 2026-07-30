import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { BookingForm, type BookingLink } from "@/components/agenda/booking-form";
import type { AvailWindow } from "@/lib/data/agenda";

export const dynamic = "force-dynamic";

export default async function AgendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseConfigured() || !hasServiceRole()) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("scheduling_links")
    .select("owner_id, label, active, slug, duration_min, days_ahead, availability")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || !data.active || !data.slug) notFound();

  let ownerName = "nossa equipe";
  if (data.owner_id) {
    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", data.owner_id).maybeSingle();
    if (prof?.full_name) ownerName = String(prof.full_name);
  }

  const link: BookingLink = {
    slug: String(data.slug),
    label: String(data.label ?? "Agendar"),
    durationMin: Number(data.duration_min ?? 30),
    daysAhead: Number(data.days_ahead ?? 14),
    availability: (Array.isArray(data.availability) ? data.availability : []) as AvailWindow[],
    ownerName,
  };

  return (
    <main className="min-h-screen bg-canvas">
      <BookingForm link={link} />
    </main>
  );
}
