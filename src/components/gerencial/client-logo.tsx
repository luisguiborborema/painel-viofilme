"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";

function initials(name: string) {
  return name
    .replace(/[^A-Za-zÀ-ú ]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/**
 * Logo do cliente no cabeçalho da ficha. Mostra a imagem quando há; senão, as
 * iniciais. Clique → escolhe uma imagem, sobe pro storage (task-upload) e salva
 * a URL em clients.logo_url. Somente leitura desabilita a troca.
 */
export function ClientLogo({
  clientId,
  name,
  logoUrl,
  readOnly,
}: {
  clientId: string;
  name: string;
  logoUrl?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | undefined>(logoUrl);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Selecione um arquivo de imagem.", "error");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/gerencial/task-upload", { method: "POST", body: fd });
      const uj = await up.json().catch(() => null);
      if (!up.ok || !uj?.url) throw new Error();
      const res = await fetch("/api/gerencial/client-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, logoUrl: uj.url }),
      });
      if (!res.ok) throw new Error();
      setUrl(uj.url as string);
      router.refresh();
    } catch {
      toast("Não foi possível salvar a logo.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => !readOnly && inputRef.current?.click()}
      disabled={busy || readOnly}
      className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-500 text-sm font-bold text-white disabled:cursor-default"
      title={readOnly ? name : "Trocar logo do cliente"}
      aria-label={readOnly ? name : "Trocar logo do cliente"}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
      {!readOnly && (
        <span className="absolute inset-0 hidden items-center justify-center bg-black/45 group-hover:flex">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </span>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
    </button>
  );
}
