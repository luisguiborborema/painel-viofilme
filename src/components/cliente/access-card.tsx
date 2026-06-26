import {
  AlertTriangle,
  Boxes,
  Building2,
  Check,
  ExternalLink,
  Globe,
  LayoutTemplate,
  Magnet,
  Plus,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccessItem, AccessStatus } from "@/lib/data/types";

const ICONS: Record<AccessItem["icon"], LucideIcon> = {
  meta: Building2,
  google: Globe,
  rd: Magnet,
  wordpress: LayoutTemplate,
  ecommerce: ShoppingBag,
  other: Boxes,
};

const STATUS: Record<
  AccessStatus,
  { label: string; cls: string; Icon?: LucideIcon }
> = {
  connected: { label: "Conectado", cls: "text-emerald-300", Icon: Check },
  review: { label: "Revisar", cls: "text-amber-300", Icon: AlertTriangle },
  setup: { label: "Configurar", cls: "text-muted" },
  soon: { label: "Em breve", cls: "text-muted" },
};

export function AccessCard({ item }: { item: AccessItem }) {
  const Icon = ICONS[item.icon];
  const st = STATUS[item.status];
  const isRequest = item.actionLabel.toLowerCase().includes("solicitar");

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
          <Icon className="h-5 w-5" />
        </span>
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", st.cls)}>
          {st.Icon && <st.Icon className="h-3.5 w-3.5" />}
          {st.label}
        </span>
      </div>

      <p className="mt-3 font-semibold text-ink">{item.name}</p>
      <p className="mt-0.5 text-xs text-muted">{item.description}</p>

      <p className="mt-3 text-xs text-muted">{item.note}</p>

      <button
        className={cn(
          "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
          isRequest
            ? "border border-line bg-subtle text-ink hover:bg-subtle-strong"
            : "bg-brand-500 text-white hover:bg-brand-600",
        )}
      >
        {isRequest ? <Plus className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
        {item.actionLabel}
      </button>
    </Card>
  );
}
