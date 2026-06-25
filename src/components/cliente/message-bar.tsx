"use client";

import { useState } from "react";
import { SendHorizontal } from "lucide-react";

export function MessageBar() {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    // TODO: integrar com chat agência↔cliente
    setValue("");
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-4 mt-2 flex items-center gap-2 rounded-2xl border border-line bg-surface/90 p-2 shadow-lg backdrop-blur"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          sent ? "Mensagem enviada! (em breve)" : "Escreva uma mensagem…"
        }
        className="h-10 flex-1 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
        aria-label="Enviar mensagem"
      >
        <SendHorizontal className="h-4 w-4" />
      </button>
    </form>
  );
}
