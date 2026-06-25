import type { AdNetwork } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const STYLES: Record<AdNetwork, string> = {
  meta: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  google: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
};

const LABEL: Record<AdNetwork, string> = {
  meta: "Meta",
  google: "Google",
};

export function NetworkBadge({ network }: { network: AdNetwork }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[network],
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          network === "meta" ? "bg-sky-400" : "bg-emerald-400",
        )}
      />
      {LABEL[network]}
    </span>
  );
}
