"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, Copy, KeyRound, Loader2, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DOMINIOS, desde, rotuloEscopos, situacao, type ApiKey, type Dominio } from "@/lib/data/api-keys";

const btn = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:text-ink disabled:opacity-60";

/** Seleção das áreas — usada ao criar e ao ajustar uma chave existente. */
function SeletorDeAreas({
  areas, onChange, compacto = false,
}: {
  areas: Dominio[];
  onChange: (v: Dominio[]) => void;
  compacto?: boolean;
}) {
  return (
    <div className={cn("grid gap-2", compacto ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
      {DOMINIOS.map((d) => {
        const marcado = areas.includes(d.key);
        return (
          <label
            key={d.key}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
              marcado ? "border-brand-400/60 bg-brand-50/40" : "border-line hover:bg-subtle",
            )}
          >
            <input
              type="checkbox"
              checked={marcado}
              onChange={() => onChange(marcado ? areas.filter((k) => k !== d.key) : [...areas, d.key])}
              className="mt-0.5 h-4 w-4 shrink-0 accent-current text-brand-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{d.label}</span>
              {!compacto && <span className="block text-[11px] leading-snug text-muted">{d.hint}</span>}
              <span className="mt-1 block text-[10px] text-muted">{d.tools.length} ferramenta(s)</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Criação e revogação das chaves de API.
 *
 * O token aparece UMA vez, logo depois de criado. Não é limitação de
 * implementação: só o hash fica guardado, então nem o banco sabe o valor. Por
 * isso a tela insiste tanto no momento da cópia.
 */
export function ApiKeysManager({ chaves, semMigracao }: { chaves: ApiKey[]; semMigracao: boolean }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  // Começa com tudo marcado: o padrão é o comportamento de antes, e quem quer
  // restringir desmarca conscientemente.
  const [areas, setAreas] = useState<Dominio[]>(() => DOMINIOS.map((d) => d.key));
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ token: string; nome: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function acao(body: Record<string, unknown>, chave: string) {
    setBusy(chave); setErro(null);
    const res = await fetch("/api/gerencial/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível concluir."); return null; }
    router.refresh();
    return j;
  }

  async function criar() {
    const j = await acao({ action: "create", name: nome, scopes: areas }, "criar");
    if (j?.token) { setNovo({ token: j.token, nome: nome.trim() }); setNome(""); setCopiado(false); }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não consegui copiar — selecione o texto e copie manualmente.");
    }
  }

  const [editando, setEditando] = useState<string | null>(null);
  const [areasEdit, setAreasEdit] = useState<Dominio[]>([]);

  async function salvarEscopo(k: ApiKey) {
    const j = await acao({ action: "scopes", id: k.id, scopes: areasEdit }, k.id);
    if (j) setEditando(null);
  }

  const ativas = chaves.filter((k) => !k.revokedAt);
  const revogadas = chaves.filter((k) => k.revokedAt);

  return (
    <div className="space-y-4">
      {semMigracao && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Rode a migração <code>0139_api_keys.sql</code> para criar chaves por aqui.
        </p>
      )}

      {/* Token recém-criado — some ao fechar e não volta */}
      {novo && (
        <Card className="border-brand-400/50 bg-brand-50/40 p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Chave criada: {novo.nome}</h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                <strong>Copie agora.</strong> Guardamos só o hash — depois que você fechar,
                nem o sistema consegue mostrar este valor de novo. Perdeu, é só criar outra.
              </p>
            </div>
            <button onClick={() => setNovo(null)} className="rounded-lg p-1 text-muted hover:bg-subtle" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-ink">
              {novo.token}
            </code>
            <button
              onClick={() => copiar(novo.token)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            No aplicativo do Claude: Configurações → Conectores → Adicionar conector personalizado,
            URL <code>https://www.viofilme.com.br/api/mcp</code> e cabeçalho{" "}
            <code>Authorization: Bearer {novo.token.slice(0, 10)}…</code>
          </p>
        </Card>
      )}

      {/* Criar */}
      <Card className="p-5">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-muted" /> Nova chave
        </h2>
        <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
          Uma chave por pessoa ou por uso. Assim dá para revogar o acesso de quem saiu sem
          derrubar o de todo mundo — que é o que acontece quando existe uma chave só.
        </p>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && nome.trim().length >= 3 && areas.length) criar(); }}
          placeholder="Ex.: Claude do Guilherme"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        />

        <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wide text-muted">
          O que esta chave pode ler
        </p>
        <SeletorDeAreas areas={areas} onChange={setAreas} />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted">
            {areas.length === DOMINIOS.length
              ? "Acesso total — inclusive DRE e inadimplência."
              : areas.length === 0
                ? "Nenhuma área marcada: a chave não leria nada."
                : `Lê apenas: ${rotuloEscopos(areas)}.`}
          </span>
          <button
            onClick={criar}
            disabled={nome.trim().length < 3 || areas.length === 0 || busy === "criar"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy === "criar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar
          </button>
        </div>
        {erro && <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-500"><AlertTriangle className="h-3.5 w-3.5" /> {erro}</p>}
      </Card>

      {/* Ativas */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Chaves ativas</h2>
        </div>
        {ativas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Nenhuma chave ativa.</p>
        ) : (
          <ul className="divide-y divide-line">
            {ativas.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{k.name}</span>
                  <span className="block text-[11px] text-muted">
                    <code>{k.prefix}…</code> · lê {rotuloEscopos(k.scopes)} · criada por {k.createdBy ?? "—"} · último uso {desde(k.lastUsedAt)}
                  </span>
                </span>
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  situacao(k) === "ativa" ? "bg-emerald-500/15 text-emerald-600" : "bg-subtle text-muted",
                )}>
                  {situacao(k)}
                </span>
                <button
                  onClick={() => {
                    // Começa do escopo atual; "tudo" (vazio) abre com todas marcadas.
                    setAreasEdit(k.scopes.length ? (k.scopes as Dominio[]) : DOMINIOS.map((d) => d.key));
                    setEditando(editando === k.id ? null : k.id);
                  }}
                  className={btn + " shrink-0"}
                  title="Mudar o que esta chave pode ler"
                >
                  <Pencil className="h-3.5 w-3.5" /> Escopo
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Revogar "${k.name}"? Quem estiver usando esta chave perde o acesso imediatamente.`)) {
                      acao({ action: "revoke", id: k.id }, k.id);
                    }
                  }}
                  disabled={busy === k.id}
                  className={btn + " shrink-0 hover:text-rose-500"}
                >
                  {busy === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Revogar
                </button>

                {editando === k.id && (
                  <div className="w-full border-t border-line pt-3">
                    <p className="mb-2 text-[11px] text-muted">
                      O token continua o mesmo — quem já configurou não precisa mexer em nada.
                    </p>
                    <SeletorDeAreas areas={areasEdit} onChange={setAreasEdit} compacto />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-muted">
                        {areasEdit.length === DOMINIOS.length
                          ? "Acesso total — inclusive DRE e inadimplência."
                          : areasEdit.length === 0
                            ? "Nenhuma área marcada: a chave não leria nada."
                            : `Passará a ler apenas: ${rotuloEscopos(areasEdit)}.`}
                      </span>
                      <span className="flex gap-2">
                        <button onClick={() => setEditando(null)} className={btn}>Cancelar</button>
                        <button
                          onClick={() => salvarEscopo(k)}
                          disabled={areasEdit.length === 0 || busy === k.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                          {busy === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
                        </button>
                      </span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Revogadas */}
      {revogadas.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Revogadas</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Ficam na lista como histórico — mostram que o acesso existiu e quando acabou.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {revogadas.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 opacity-70">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink line-through">{k.name}</span>
                  <span className="block text-[11px] text-muted">
                    <code>{k.prefix}…</code> · revogada por {k.revokedBy ?? "—"} {desde(k.revokedAt)}
                  </span>
                </span>
                <button
                  onClick={() => { if (window.confirm(`Remover "${k.name}" do histórico?`)) acao({ action: "delete", id: k.id }, k.id); }}
                  disabled={busy === k.id}
                  className={btn + " shrink-0"}
                  title="Remover do histórico"
                >
                  {busy === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
