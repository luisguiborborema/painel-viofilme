// Acesso a dados das Listas (server-only). Dual-mode: Supabase ou vazio (demo).
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Condition, Lens, SavedView } from "./listas";

export async function getSavedViews(ownerId: string): Promise<SavedView[]> {
  if (!isSupabaseConfigured() || !ownerId) return [];
  const supabase = await createClient();
  const filter = `owner_id.eq.${ownerId},is_shared.eq.true`;
  // Tenta com `display` (coluna nova, migração 0102). Cai para o select básico
  // se a coluna ainda não existir — não quebra antes de rodar a migração.
  let rows = (
    await supabase
      .from("saved_views")
      .select("id,scope,name,conditions,lens,is_shared,display")
      .or(filter)
      .order("created_at", { ascending: true })
  ).data as Record<string, unknown>[] | null;
  if (!rows) {
    rows = (
      await supabase
        .from("saved_views")
        .select("id,scope,name,conditions,lens,is_shared")
        .or(filter)
        .order("created_at", { ascending: true })
    ).data as Record<string, unknown>[] | null;
  }
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    scope: r.scope === "empresas" ? "empresas" : r.scope === "negocios" ? "negocios" : "pessoas",
    name: String(r.name),
    conditions: Array.isArray(r.conditions) ? (r.conditions as Condition[]) : [],
    lens: (r.lens as Lens | null) ?? null,
    isShared: Boolean(r.is_shared),
    display:
      r.display && typeof r.display === "object" ? (r.display as SavedView["display"]) : undefined,
  })) as SavedView[];
}

// ── Casca Produtos: catálogo de serviços (serviço › plano) ───────────────────
export type ServiceCatalog = {
  id: string;
  name: string;
  category?: string;
  summary?: string;
  deliveryType: string;
  active: boolean;
  plans: { id: string; name: string; cadence: string; priceCents?: number; costCents?: number; billingType: string }[];
};

export async function getServiceCatalog(): Promise<ServiceCatalog[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const [{ data: svc }, { data: plans }] = await Promise.all([
    supabase.from("services").select("id,name,category,summary,delivery_type,active,position").order("position"),
    supabase.from("service_plans").select("id,service_id,name,cadence,price_cents,cost_cents,billing_type,position").order("position"),
  ]);
  const byService = new Map<string, ServiceCatalog["plans"]>();
  for (const p of plans ?? []) {
    const arr = byService.get(String(p.service_id)) ?? [];
    arr.push({
      id: String(p.id),
      name: String(p.name),
      cadence: String(p.cadence ?? "mensal"),
      priceCents: p.price_cents == null ? undefined : Number(p.price_cents),
      costCents: p.cost_cents == null ? undefined : Number(p.cost_cents),
      billingType: String(p.billing_type ?? "fixo"),
    });
    byService.set(String(p.service_id), arr);
  }
  return (svc ?? []).map((s) => ({
    id: String(s.id),
    name: String(s.name),
    category: s.category ? String(s.category) : undefined,
    summary: s.summary ? String(s.summary) : undefined,
    deliveryType: String(s.delivery_type ?? "recorrente"),
    active: Boolean(s.active),
    plans: byService.get(String(s.id)) ?? [],
  }));
}

// ── Casca Processos: base de conhecimento (mural) ────────────────────────────
export type KnowledgeCategory = { id: string; name: string; color: string; count: number };
export type KnowledgePageCard = {
  id: string;
  categoryId?: string;
  title: string;
  summary?: string;
  tags: string[];
  pinned: boolean;
  updatedAt: string;
};

export async function getKnowledge(): Promise<{ categories: KnowledgeCategory[]; pages: KnowledgePageCard[] }> {
  if (!isSupabaseConfigured()) return { categories: [], pages: [] };
  const supabase = await createClient();
  const [{ data: cats }, { data: pages }] = await Promise.all([
    supabase.from("knowledge_categories").select("id,name,color,position").order("position"),
    supabase.from("knowledge_pages").select("id,category_id,title,summary,tags,pinned,updated_at").order("updated_at", { ascending: false }),
  ]);
  const count = new Map<string, number>();
  for (const p of pages ?? []) if (p.category_id) count.set(String(p.category_id), (count.get(String(p.category_id)) ?? 0) + 1);
  return {
    categories: (cats ?? []).map((c) => ({
      id: String(c.id),
      name: String(c.name),
      color: String(c.color ?? "#2a63c9"),
      count: count.get(String(c.id)) ?? 0,
    })),
    pages: (pages ?? []).map((p) => ({
      id: String(p.id),
      categoryId: p.category_id ? String(p.category_id) : undefined,
      title: String(p.title),
      summary: p.summary ? String(p.summary) : undefined,
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
      pinned: Boolean(p.pinned),
      updatedAt: String(p.updated_at ?? p.id),
    })),
  };
}
