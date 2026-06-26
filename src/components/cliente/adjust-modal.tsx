"use client";

import { useState } from "react";
import {
  Calendar,
  ImageIcon,
  MoreHorizontal,
  SendHorizontal,
  Smartphone,
  Type,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "arte", label: "Arte / imagem", icon: ImageIcon },
  { id: "legenda", label: "Legenda / texto", icon: Type },
  { id: "data", label: "Data / horário", icon: Calendar },
  { id: "rede", label: "Rede social", icon: Smartphone },
  { id: "outro", label: "Outro", icon: MoreHorizontal },
];

const MAX = 300;

export type AdjustPayload = {
  categories: string[];
  text: string;
  urgency: "normal" | "urgent";
};

export function AdjustModal({
  postTitle,
  onClose,
  onSubmit,
}: {
  postTitle: string;
  onClose: () => void;
  onSubmit: (payload: AdjustPayload) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal");

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  const canSend = selected.length > 0 && text.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Pedir ajuste</h2>
            <p className="truncate text-xs text-muted">{postTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-2 text-sm font-medium text-ink">
          O que precisa ser ajustado?
        </p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-colors",
                  on
                    ? "border-brand-400 bg-brand-500/15 text-brand-100"
                    : "border-line bg-subtle text-muted hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.label}
              </button>
            );
          })}
        </div>

        <p className="mb-1.5 mt-4 text-sm font-medium text-ink">
          Descreva o ajuste necessário
        </p>
        <textarea
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Ex: A cor do fundo não está alinhada com nossa identidade visual. Usar o tom bege (#F5EDD6) que está no manual de marca…"
          className="w-full resize-none rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />
        <p className="mt-1 text-right text-xs text-muted">
          {text.length} / {MAX} caracteres
        </p>

        <p className="mb-1.5 mt-3 text-sm font-medium text-ink">Urgência</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setUrgency("normal")}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              urgency === "normal"
                ? "border-brand-400 bg-brand-500 text-white"
                : "border-line bg-subtle text-muted hover:text-ink",
            )}
          >
            Normal
          </button>
          <button
            onClick={() => setUrgency("urgent")}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              urgency === "urgent"
                ? "border-rose-400 bg-rose-500 text-white"
                : "border-line bg-subtle text-muted hover:text-ink",
            )}
          >
            Urgente
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            disabled={!canSend}
            onClick={() => onSubmit({ categories: selected, text, urgency })}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" /> Enviar pedido de ajuste
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm font-medium text-ink hover:bg-subtle-strong"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
