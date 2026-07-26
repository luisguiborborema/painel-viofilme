import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";
import { firstAllowedHref, isAdminTier } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isoDaysAgo } from "@/lib/audit/labels";
import { MonitoringView, type AuditRow, type Analytics } from "@/components/gerencial/monitoring-view";

export const dynamic = "force-dynamic";

export default async function MonitoramentoPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!isAdminTier(user.tier)) redirect(firstAllowedHref(user.allowedSections));

  let events: AuditRow[] = [];
  let analytics: Analytics = { pageviews: 0, activeUsers: 0, byArea: [], byUser: [], byHour: new Array(24).fill(0) };

  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const since = isoDaysAgo(30);

    const [timelineRes, pvRes] = await Promise.all([
      admin
        .from("audit_events")
        .select("id, created_at, user_name, user_email, panel, action, area, target, detail")
        .neq("action", "pageview")
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("audit_events")
        .select("area, user_name, panel, created_at")
        .eq("action", "pageview")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(8000),
    ]);

    events = (timelineRes.data ?? []).map((r) => ({
      id: String(r.id),
      createdAt: String(r.created_at),
      userName: (r.user_name as string | null) ?? null,
      userEmail: (r.user_email as string | null) ?? null,
      panel: String(r.panel ?? "gerencial"),
      action: String(r.action),
      area: (r.area as string | null) ?? null,
      target: (r.target as string | null) ?? null,
      detail: (r.detail as string | null) ?? null,
    }));

    const pv = pvRes.data ?? [];
    const byArea = new Map<string, number>();
    const byUser = new Map<string, number>();
    const byHour = new Array(24).fill(0);
    const users = new Set<string>();
    for (const r of pv) {
      const area = (r.area as string | null) ?? "—";
      const name = (r.user_name as string | null) ?? "—";
      byArea.set(area, (byArea.get(area) ?? 0) + 1);
      byUser.set(name, (byUser.get(name) ?? 0) + 1);
      users.add(name);
      const h = new Date(String(r.created_at)).getHours();
      if (h >= 0 && h < 24) byHour[h] += 1;
    }
    const rank = (m: Map<string, number>) =>
      [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    analytics = {
      pageviews: pv.length,
      activeUsers: users.size,
      byArea: rank(byArea).slice(0, 12),
      byUser: rank(byUser).slice(0, 12),
      byHour,
    };
  }

  const configured = isSupabaseConfigured() && hasServiceRole();

  return (
    <div>
      <PageHeader
        title="Monitoramento"
        subtitle="Auditoria de eventos e uso do painel (gerencial e cliente) — visível apenas para admin."
      />
      {!configured ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          Requer Supabase + service-role configurados para registrar e ler eventos.
        </p>
      ) : (
        <MonitoringView events={events} analytics={analytics} />
      )}
    </div>
  );
}
