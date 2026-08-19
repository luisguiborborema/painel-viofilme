import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  toTemplate,
  type Diagnostic,
  type DiagnosticAnswers,
  type DiagnosticListItem,
  type DiagnosticTemplate,
} from "./diagnostic";

const TPL_COLS = "id, name, area, questions, computed, position";

export async function getDiagnosticTemplates(): Promise<DiagnosticTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("diagnostic_templates")
    .select(TPL_COLS)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => toTemplate(r as Record<string, unknown>)).filter((t): t is DiagnosticTemplate => t !== null);
}

/** Modelo do diagnóstico: pelo template_id; senão o primeiro modelo. */
export async function getDiagnosticTemplate(id: string | null): Promise<DiagnosticTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  if (id) {
    const { data } = await supabase.from("diagnostic_templates").select(TPL_COLS).eq("id", id).maybeSingle();
    const t = toTemplate(data as Record<string, unknown> | null);
    if (t) return t;
  }
  const list = await getDiagnosticTemplates();
  return list[0] ?? null;
}

export async function getDiagnostics(): Promise<DiagnosticListItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("diagnostics")
    .select("id, subject, title, client_id, lead_id, created_at, diagnostic_templates(name)")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((r) => {
    const rel = (r as Record<string, unknown>).diagnostic_templates as { name?: string } | { name?: string }[] | null;
    const templateName = Array.isArray(rel) ? (rel[0]?.name ?? "") : (rel?.name ?? "");
    return {
      id: String(r.id),
      subject: String(r.subject ?? "—"),
      title: String(r.title ?? "Diagnóstico"),
      clientId: r.client_id ? String(r.client_id) : null,
      leadId: r.lead_id ? String(r.lead_id) : null,
      templateName: String(templateName || ""),
      createdAt: String(r.created_at ?? ""),
    };
  });
}

export async function getDiagnostic(id: string): Promise<Diagnostic | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("diagnostics")
    .select("id, template_id, client_id, lead_id, subject, title, answers, created_by, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const answers = (data.answers && typeof data.answers === "object" && !Array.isArray(data.answers)
    ? (data.answers as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const norm: DiagnosticAnswers = {};
  for (const [k, v] of Object.entries(answers)) norm[k] = v == null ? "" : String(v);
  return {
    id: String(data.id),
    templateId: data.template_id ? String(data.template_id) : null,
    clientId: data.client_id ? String(data.client_id) : null,
    leadId: data.lead_id ? String(data.lead_id) : null,
    subject: String(data.subject ?? "—"),
    title: String(data.title ?? "Diagnóstico"),
    answers: norm,
    createdBy: data.created_by ? String(data.created_by) : "",
    createdAt: String(data.created_at ?? ""),
    updatedAt: String(data.updated_at ?? ""),
  };
}
