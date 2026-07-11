import type { LucideIcon } from "lucide-react";

/** Estado-vazio padronizado dos painéis de Configurações do CRM. */
export function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center">
      {Icon && <Icon className="h-6 w-6 text-muted/60" />}
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}
