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

// ── Produtos: catálogo de serviços (serviço › plano) ─────────────────────────
//
// Estas colunas vêm da 0065 (`label`, `type`, `area`, `default_price`), não da
// 0081: aquela migração usou `create table if not exists` sobre tabelas que já
// existiam, virou no-op, e a leitura pedia colunas inexistentes — o catálogo
// devolvia lista vazia desde sempre. A ficha rica (summary/description/cost/
// cadence) entrou pela 0144 e é lida com fallback.
export type ServiceCatalog = {
  id: string;
  name: string;
  category?: string;
  summary?: string;
  description?: string;
  deliveryType: string;
  active: boolean;
  plans: {
    id: string;
    name: string;
    cadence: string;
    price: number;
    cost: number;
    billingType: string;
    active: boolean;
  }[];
};

export async function getServiceCatalog(): Promise<ServiceCatalog[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  async function ler(tabela: string, base: string, ricas: string): Promise<Record<string, unknown>[]> {
    const comRicas = await supabase.from(tabela).select(`${base}, ${ricas}`).order("sort");
    if (!comRicas.error) return (comRicas.data ?? []) as unknown as Record<string, unknown>[];
    const basico = await supabase.from(tabela).select(base).order("sort");
    return (basico.data ?? []) as unknown as Record<string, unknown>[];
  }

  const [svc, plans] = await Promise.all([
    ler("services", "id,label,type,area,sort,active", "summary,description"),
    ler("service_plans", "id,service_id,label,default_price,sort", "cadence,cost,billing_type,active"),
  ]);

  const byService = new Map<string, ServiceCatalog["plans"]>();
  for (const p of plans) {
    const sid = String(p.service_id);
    const arr = byService.get(sid) ?? [];
    arr.push({
      id: String(p.id),
      name: String(p.label ?? ""),
      cadence: String(p.cadence ?? "mensal"),
      price: Number(p.default_price ?? 0),
      cost: Number(p.cost ?? 0),
      billingType: String(p.billing_type ?? "fixo"),
      active: p.active === undefined ? true : Boolean(p.active),
    });
    byService.set(sid, arr);
  }

  return svc.map((s) => ({
    id: String(s.id),
    name: String(s.label ?? ""),
    category: s.area ? String(s.area) : undefined,
    summary: s.summary ? String(s.summary) : undefined,
    description: s.description ? String(s.description) : undefined,
    deliveryType: String(s.type ?? "recorrente"),
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
