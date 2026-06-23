import { cn } from "@/lib/utils";

type Variant = "default" | "brand" | "lime" | "success" | "warning" | "danger" | "muted";

const variants: Record<Variant, string> = {
  default: "bg-brand-50 text-brand-700",
  brand: "bg-brand-500 text-white",
  lime: "bg-lime text-brand-900",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  muted: "bg-canvas text-muted",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
