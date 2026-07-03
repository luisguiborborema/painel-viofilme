"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { CrmObjectType, Tag } from "@/lib/data/crm";

/**
 * Aplica/remove tags de um objeto (empresa/contato/deal). Salva a lista completa
 * de ids via /api/crm/object (que sobrescreve tags).
 */
export function TagPicker({
  objectType,
  id,
  allTags,
  initialIds,
  title = "Tags",
}: {
  objectType: CrmObjectType;
  id: string;
  allTags: Tag[];
  initialIds: string[];
  title?: string;
}) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>(initialIds ?? []);
  const [open, setOpen] = useState(false);

  const applied = ids
    .map((tid) => allTags.find((t) => t.id === tid))
    .filter((t): t is Tag => Boolean(t));
  const available = allTags.filter((t) => !ids.includes(t.id));

  async function persist(next: string[]) {
    setIds(next);
    await fetch("/api/crm/object", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectType, id, tags: next }),
    }).catch(() => {});
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      <div className="flex flex-wrap items-center gap-1.5">
        {applied.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: `${t.color}22`, color: t.color }}
          >
            {t.name}
            <button
              onClick={() => persist(ids.filter((x) => x !== t.id))}
              className="rounded-full hover:bg-black/10"
              title="Remover tag"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-subtle"
          >
            <Plus className="h-3 w-3" /> tag
          </button>
          {open && (
            <div className="absolute left-0 top-full z-10 mt-1 max-h-56 w-48 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
              {available.length === 0 && (
                <p className="px-2 py-2 text-center text-xs text-muted">
                  Sem mais tags. Crie em Configurações.
                </p>
              )}
              {available.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    persist([...ids, t.id]);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
