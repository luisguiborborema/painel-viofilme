"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderTree, Link2, Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Root = { id: string | null; name: string; source: "config" | "env" | "none" };
type Sugestao = { clientId: string; cliente: string; jaVinculado: boolean; folderId: string; pasta: string; confianca: string };
type Pasta = { id: string; name: string };
type Scan = { pastas: Pasta[]; sugestoes: Sugestao[]; resumo: { clientes: number; jaVinculados: number; sugeridos: number; semPasta: number } };

const inputCls = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400";

async function api(body: unknown) {
  const res = await fetch("/api/gerencial/drive-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => null);
  return { ok: res.ok, data: j as Record<string, unknown> | null };
}

export function DriveSettings() {
  const [root, setRoot] = useState<Root | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api({ action: "get" }).then(({ data }) => setRoot((data?.root as Root) ?? null));
  }, []);

  async function salvarRoot() {
    if (!folderInput.trim()) { toast("Cole o link da pasta do Drive.", "error"); return; }
    setBusy("root");
    const { ok, data } = await api({ action: "set-root", folder: folderInput.trim() });
    setBusy(null);
    if (!ok) { toast(String(data?.error ?? "Falha ao salvar."), "error"); return; }
    setRoot(data?.root as Root);
    setFolderInput("");
    setScan(null);
    toast("Pasta-mãe definida.", "success");
  }

  async function escanear() {
    setBusy("scan");
    const { ok, data } = await api({ action: "scan" });
    setBusy(null);
    if (!ok) { toast(String(data?.error ?? "Falha ao escanear."), "error"); return; }
    const s = data as unknown as Scan;
    setScan(s);
    // Pré-seleciona as sugestões encontradas.
    const pre: Record<string, string> = {};
    for (const g of s.sugestoes) if (!g.jaVinculado && g.folderId) pre[g.clientId] = g.folderId;
    setEscolhas(pre);
  }

  async function vincular() {
    const links = Object.entries(escolhas).filter(([, f]) => f).map(([clientId, folderId]) => ({ clientId, folderId }));
    if (links.length === 0) { toast("Nenhum vínculo selecionado.", "error"); return; }
    if (!window.confirm(`Vincular ${links.length} cliente(s) às pastas selecionadas?`)) return;
    setBusy("link");
    const { ok, data } = await api({ action: "link", links });
    setBusy(null);
    if (!ok) { toast(String(data?.error ?? "Falha ao vincular."), "error"); return; }
    toast(`${data?.vinculados} cliente(s) vinculados.`, "success");
    escanear();
  }

  const pendentes = scan?.sugestoes.filter((s) => !s.jaVinculado) ?? [];

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <FolderTree className="h-3.5 w-3.5" /> Pastas dos clientes no Drive
      </p>

      {/* Pasta-mãe */}
      <div className="rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted">Novas pastas de cliente serão criadas dentro de:</p>
            <p className="truncate text-sm font-semibold text-ink">
              {root ? root.name : "…"}
              {root?.source === "none" && <span className="ml-1 font-normal text-amber-600">(raiz do Meu Drive)</span>}
              {root?.source === "env" && <span className="ml-1 font-normal text-muted">(variável de ambiente)</span>}
            </p>
          </div>
          {root?.source === "none" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" /> Defina a pasta compartilhada da equipe
            </span>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            placeholder="Cole o link da pasta (ex.: https://drive.google.com/drive/folders/…)"
            className={inputCls + " min-w-0 flex-1"}
          />
          <button onClick={salvarRoot} disabled={busy === "root"} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy === "root" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Definir
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          Abra a pasta no Drive (ex.: <strong>Gerenciamento</strong>) e copie o link da barra de endereço. A conta conectada
          precisa ter permissão de edição nela.
        </p>
      </div>

      {/* Vincular pastas existentes */}
      <div className="mt-3 rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Vincular pastas que já existem</p>
            <p className="text-[11px] text-muted">Procura as pastas dentro da pasta-mãe e casa pelo nome com os clientes sem pasta.</p>
          </div>
          <button onClick={escanear} disabled={busy === "scan" || !root?.id} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-50">
            {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Escanear
          </button>
        </div>

        {scan && (
          <>
            <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-muted">
              <span>{scan.resumo.clientes} clientes</span>
              <span className="text-emerald-600">{scan.resumo.jaVinculados} já vinculados</span>
              <span className="text-brand-600">{scan.resumo.sugeridos} sugestões</span>
              <span>{scan.resumo.semPasta} sem pasta</span>
            </div>

            {pendentes.length === 0 ? (
              <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">Todos os clientes já têm pasta vinculada. 🎉</p>
            ) : (
              <>
                <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
                  {pendentes.map((s) => (
                    <div key={s.clientId} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.cliente}</span>
                      {s.confianca && (
                        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          s.confianca === "exata" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>
                          {s.confianca}
                        </span>
                      )}
                      <select
                        value={escolhas[s.clientId] ?? ""}
                        onChange={(e) => setEscolhas((p) => ({ ...p, [s.clientId]: e.target.value }))}
                        className="h-8 w-56 shrink-0 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-400"
                      >
                        <option value="">— não vincular —</option>
                        {scan.pastas.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={vincular} disabled={busy === "link"} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                    {busy === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Vincular selecionados
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
