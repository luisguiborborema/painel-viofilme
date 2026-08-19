import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  DIAGNOSTIC_DEFAULTS,
  toDiagnosticConfig,
  type Diagnostic,
  type DiagnosticAnswers,
  type DiagnosticConfig,
  type DiagnosticListItem,
} from "./diagnostic";

export async function getDiagnosticConfig(): Promise<DiagnosticConfig> {
  if (!isSupabaseConfigured()) return { questions: DIAGNOSTIC_DEFAULTS };
  const supabase = await createClient();
  const { data } = await supabase.from("diagnostic_config").select("questions").eq("id", 1).maybeSingle();
  return toDiagnosticConfig(data);
}

export async function getDiagnostics(): Promise<DiagnosticListItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("diagnostics")
    .select("id, subject, title, client_id, lead_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    subject: String(r.subject ?? "—"),
    title: String(r.title ?? "Diagnóstico"),
    clientId: r.client_id ? String(r.client_id) : null,
    leadId: r.lead_id ? String(r.lead_id) : null,
    createdAt: String(r.created_at ?? ""),
  }));
}

export async function getDiagnostic(id: string): Promise<Diagnostic | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("diagnostics")
    .select("id, client_id, lead_id, subject, title, answers, created_by, created_at, updated_at")
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
