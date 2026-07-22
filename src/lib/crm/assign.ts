import type { createClient } from "@/lib/supabase/server";
import { toAssignmentConfig, type AssignmentConfig } from "@/lib/data/crm";

type SB = Awaited<ReturnType<typeof createClient>>;

/** Lê a config de atribuição (crm_settings.key='assignment') via client RLS. */
export async function fetchAssignmentConfig(supabase: SB): Promise<AssignmentConfig> {
  const { data } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", "assignment")
    .maybeSingle();
  return toAssignmentConfig(data?.value);
}

/**
 * Resolve o responsável de um novo negócio conforme a atribuição automática:
 *   • `requested` explícito (≠ "__auto__") vence sempre;
 *   • manual  → fallback (quem criou);
 *   • origem  → responsável fixo por inbound/outbound (sem mapa, cai na carga);
 *   • carga   → menos negócios ABERTOS agora;
 *   • rodizio → menos negócios no TOTAL (distribui parelho).
 * O pool elegível é config.pool ou, se vazio, todos os gerenciais.
 */
export async function resolveAssignee(
  supabase: SB,
  opts: { requested?: string; fallback: string; originKind?: string; config?: AssignmentConfig },
): Promise<string> {
  const { requested, fallback, originKind } = opts;
  if (requested && requested !== "__auto__") return requested;

  const config = opts.config ?? (await fetchAssignmentConfig(supabase));
  if (config.mode === "manual") return fallback;

  if (config.mode === "origem") {
    const pick = originKind === "inbound" ? config.byOrigin.inbound : config.byOrigin.outbound;
    if (pick) return pick;
  }

  let names = config.pool.filter(Boolean);
  if (names.length === 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("role", "gerencial");
    names = (profiles ?? []).map((p) => (p.full_name ? String(p.full_name) : "")).filter(Boolean);
  }
  if (names.length === 0) return fallback;

  const base = supabase.from("crm_leads").select("owner");
  const { data: deals } =
    config.mode === "rodizio" ? await base : await base.not("stage", "in", '("ganho","perdido")');
  const count = new Map<string, number>(names.map((n) => [n, 0]));
  for (const d of deals ?? []) {
    const o = d.owner ? String(d.owner) : "";
    if (count.has(o)) count.set(o, (count.get(o) ?? 0) + 1);
  }
  // menor carga primeiro (ordem estável pela lista de nomes)
  return names.reduce((best, n) => ((count.get(n) ?? 0) < (count.get(best) ?? 0) ? n : best), names[0]);
}
