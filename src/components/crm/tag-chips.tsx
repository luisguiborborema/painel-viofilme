import type { Tag } from "@/lib/data/crm";

/** Renderiza tags (por id) como chips coloridos. */
export function TagChips({
  ids,
  tags,
  size = "sm",
}: {
  ids?: string[];
  tags: Tag[];
  size?: "sm" | "xs";
}) {
  if (!ids?.length) return null;
  const resolved = ids
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));
  if (!resolved.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {resolved.map((t) => (
        <span
          key={t.id}
          className={
            size === "xs"
              ? "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              : "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
          }
          style={{ backgroundColor: `${t.color}22`, color: t.color }}
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}
