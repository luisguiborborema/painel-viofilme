"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl",
          SIZES[size],
        )}
      >
        {(title || description) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              {title && (
                <h2 className="text-lg font-bold text-ink">{title}</h2>
              )}
              {description && (
                <p className="mt-0.5 text-sm text-muted">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {children}

        {footer && <div className="mt-5 flex items-center gap-2">{footer}</div>}
      </div>
    </div>
  );
}
