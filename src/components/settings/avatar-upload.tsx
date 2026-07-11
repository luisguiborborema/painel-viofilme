"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";

function initials(name?: string) {
  if (!name) return "•";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/** Foto de perfil do usuário: preview + trocar (upload) + remover. */
export function AvatarUpload({
  name,
  initialUrl,
}: {
  name: string;
  initialUrl?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Envie um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Imagem acima de 5MB.");
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (res?.url) {
      setUrl(res.url);
      router.refresh();
    } else {
      setError(res?.error ?? "Não foi possível enviar a foto.");
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile/avatar", { method: "DELETE" })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setUrl(null);
      router.refresh();
    } else {
      setError(res?.error ?? "Não foi possível remover.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Trocar foto"
        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
            {initials(name)}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </span>
      </button>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60"
          >
            <Camera className="h-4 w-4" /> {url ? "Trocar foto" : "Enviar foto"}
          </button>
          {url && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> Remover
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">JPG ou PNG, até 5MB.</p>
        {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
