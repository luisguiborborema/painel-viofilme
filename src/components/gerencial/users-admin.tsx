"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROFILE_TIERS, SECTIONS, type ProfileTier, type SectionKey } from "@/lib/access";
import type { SquadRow, TeamMemberRow } from "@/lib/auth/team";
import { TabNav } from "@/components/ui/tab-nav";
import { toast } from "@/components/ui/toast";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400";

function tierLabel(tier: string | null) {
  return PROFILE_TIERS.find((t) => t.value === tier)?.label ?? "Colaborador";
}
function tierChip(tier: string | null) {
  switch (tier) {
    case "admin":
      return "bg-brand-500/15 text-brand-600";
    case "gestor":
      return "bg-violet-500/15 text-violet-600";
    case "viewer":
      return "bg-amber-500/15 text-amber-600";
    default:
      return "bg-subtle text-muted";
  }
}
function fmtPhone(w: string | null) {
  if (!w) return "—";
  const d = w.replace(/\D/g, "");
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return w;
}

export function UsersAdmin({
  team,
  squads,
  selfId,
}: {
  team: TeamMemberRow[];
  squads: SquadRow[];
  selfId: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<"usuarios" | "times">("usuarios");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; user: TeamMemberRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [delFor, setDelFor] = useState<string | null>(null);

  async function post(body: unknown, okMsg?: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "falha");
      if (okMsg) toast(okMsg, "success");
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "erro", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <TabNav
        tabs={[
          { key: "usuarios", label: "Usuários", count: team.length },
          { key: "times", label: "Times", count: squads.length },
        ]}
        active={view}
        onChange={(k) => setView(k as "usuarios" | "times")}
      />

      {view === "times" ? (
        <TeamsManager squads={squads} post={post} busy={busy} />
      ) : (
        <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-subtle text-muted">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Usuários & acessos</h2>
            <p className="text-xs text-muted">Nome, contato, perfil de acesso e time de cada pessoa.</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Novo usuário
        </button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="px-4 py-2.5 font-medium">E-mail</th>
              <th className="px-4 py-2.5 font-medium">WhatsApp</th>
              <th className="px-4 py-2.5 font-medium">Perfil</th>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {team.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Nenhum usuário gerencial (requer Supabase + service-role configurados).
                </td>
              </tr>
            )}
            {team.map((m) => (
              <tr key={m.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{m.name || "—"}</td>
                <td className="px-4 py-3 text-muted">{m.email}</td>
                <td className="px-4 py-3 text-muted">{fmtPhone(m.whatsapp)}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tierChip(m.tier))}>
                    {tierLabel(m.tier)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{m.squadName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      m.active ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-500",
                    )}
                  >
                    {m.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <button onClick={() => setModal({ mode: "edit", user: m })} className="text-xs font-medium text-brand-600 hover:underline">
                      Editar
                    </button>
                    {pwFor === m.id ? (
                      <span className="flex items-center gap-1.5">
                        <input
                          value={pwValue}
                          onChange={(e) => setPwValue(e.target.value)}
                          placeholder="nova senha (mín. 6)"
                          className="h-8 w-40 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-400"
                        />
                        <button
                          disabled={busy || pwValue.length < 6}
                          onClick={async () => {
                            const ok = await post({ action: "reset_password", userId: m.id, password: pwValue }, "Senha redefinida.");
                            if (ok) { setPwFor(null); setPwValue(""); }
                          }}
                          className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                        >
                          Definir
                        </button>
                        <button onClick={() => { setPwFor(null); setPwValue(""); }} className="text-xs text-muted hover:text-ink">
                          ✕
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => { setPwFor(m.id); setPwValue(""); }} className="text-xs font-medium text-muted hover:text-ink">
                        Redefinir senha
                      </button>
                    )}
                    {m.email && (
                      <button disabled={busy} onClick={() => post({ action: "send_reset_email", email: m.email }, `Link enviado para ${m.email}.`)} className="text-xs font-medium text-muted hover:text-ink disabled:opacity-60">
                        Enviar link
                      </button>
                    )}
                    {m.id !== selfId && (
                      <button
                        onClick={() => post({ action: "set_active", userId: m.id, active: !m.active }, m.active ? "Usuário desativado." : "Usuário ativado.")}
                        className={cn("text-xs font-medium", m.active ? "text-amber-600 hover:text-amber-500" : "text-emerald-600 hover:text-emerald-500")}
                      >
                        {m.active ? "Desativar" : "Ativar"}
                      </button>
                    )}
                    {m.id !== selfId &&
                      (delFor === m.id ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-muted">Excluir?</span>
                          <button
                            disabled={busy}
                            onClick={async () => {
                              const ok = await post({ action: "delete", userId: m.id }, "Usuário excluído.");
                              if (ok) setDelFor(null);
                            }}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-400 disabled:opacity-60"
                          >
                            Sim, excluir
                          </button>
                          <button onClick={() => setDelFor(null)} className="text-xs text-muted hover:text-ink">
                            Não
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setDelFor(m.id)} className="text-xs font-medium text-rose-500 hover:text-rose-400">
                          Excluir
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}

      {modal && (
        <UserModal
          key={modal.mode === "edit" ? modal.user.id : "create"}
          initial={modal.mode === "edit" ? modal.user : null}
          squads={squads}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={async (body) => {
            const ok = await post(body, modal.mode === "edit" ? "Usuário atualizado." : "Usuário criado.");
            if (ok) setModal(null);
          }}
        />
      )}
    </div>
  );
}

function UserModal({
  initial,
  squads,
  busy,
  onClose,
  onSubmit,
}: {
  initial: TeamMemberRow | null;
  squads: SquadRow[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: unknown) => void;
}) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [mode, setMode] = useState<"password" | "invite">("password");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? "");
  const [tier, setTier] = useState<ProfileTier>((initial?.tier as ProfileTier) ?? "colaborador");
  const [squadId, setSquadId] = useState(initial?.squadId ?? "");
  const [sections, setSections] = useState<Set<SectionKey>>(
    new Set((initial?.allowedSections ?? []) as SectionKey[]),
  );

  const needsSections = tier === "colaborador" || tier === "viewer";
  const teamSections = squads.find((s) => s.id === squadId)?.defaultSections ?? [];
  const valid =
    name.trim() && (isEdit || (email.trim() && (mode === "invite" || password.length >= 6)));

  function toggle(key: SectionKey) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submit() {
    const base = {
      name,
      tier,
      allowedSections: needsSections ? [...sections] : null,
      whatsapp,
      squadId: squadId || null,
    };
    if (isEdit) onSubmit({ action: "update", userId: initial!.id, ...base });
    else onSubmit({ action: "create", mode, email, password, ...base });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <UserPlus className="h-4 w-4 text-brand-500" /> {isEdit ? "Editar usuário" : "Novo usuário"}
          </h3>
          <button onClick={onClose} title="Fechar" aria-label="Fechar" className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nome completo" />
          </label>

          {isEdit ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">E-mail</span>
              <input value={email} disabled className={inputCls + " opacity-60"} />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">E-mail</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} placeholder="email@empresa.com" />
              </label>
              <div className="inline-flex rounded-xl border border-line bg-surface p-0.5 text-xs font-medium">
                {(["password", "invite"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={cn("rounded-lg px-3 py-1.5", mode === m ? "bg-subtle text-ink" : "text-muted")}>
                    {m === "password" ? "Senha temporária" : "Convidar por e-mail"}
                  </button>
                ))}
              </div>
              {mode === "password" ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Senha temporária (mín. 6)</span>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="senha inicial" />
                </label>
              ) : (
                <p className="text-xs text-muted">O usuário recebe um e-mail e define a própria senha (requer SMTP no Supabase).</p>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">WhatsApp</span>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" className={inputCls} placeholder="5527999998888" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Time</span>
              <select value={squadId} onChange={(e) => setSquadId(e.target.value)} className={inputCls}>
                <option value="">— sem time</option>
                {squads.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Perfil</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PROFILE_TIERS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTier(t.value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                    tier === t.value ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line bg-surface text-muted hover:text-ink",
                  )}
                >
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block text-[11px] text-muted">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {needsSections ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Abas que este usuário vê</span>
                {teamSections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSections(new Set(teamSections as SectionKey[]))}
                    className="text-[11px] font-medium text-brand-600 hover:underline"
                  >
                    Usar telas do time ({teamSections.length})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SECTIONS.map((s) => {
                  const on = sections.has(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggle(s.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                        on ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line bg-surface text-muted hover:text-ink",
                      )}
                    >
                      <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-brand-400 bg-brand-500 text-white" : "border-line")}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {tier === "viewer" && (
                <p className="mt-1.5 text-[11px] text-amber-600">Viewer só visualiza — as ações de criar/editar/excluir ficam bloqueadas.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted">
              {tier === "admin" ? "Admin vê todas as abas e gerencia usuários." : "Gestor vê e edita todas as abas."}
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-subtle">Cancelar</button>
          <button
            onClick={submit}
            disabled={busy || !valid}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEdit ? "Salvar" : "Criar usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamsManager({
  squads,
  post,
  busy,
}: {
  squads: SquadRow[];
  post: (body: unknown, okMsg?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [newName, setNewName] = useState("");

  async function create() {
    const name = newName.trim();
    if (!name) return;
    const ok = await post({ action: "create_team", name, defaultSections: [] }, "Time criado.");
    if (ok) setNewName("");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3">
        <label className="flex-1">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Novo time</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Ex.: Social, Tráfego, Design"
            className={inputCls}
          />
        </label>
        <button
          onClick={create}
          disabled={busy || !newName.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Criar time
        </button>
      </div>

      {squads.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">
          Nenhum time ainda. Crie o primeiro acima.
        </p>
      )}
      {squads.map((s) => (
        <TeamRow key={s.id} squad={s} post={post} busy={busy} />
      ))}
    </div>
  );
}

function TeamRow({
  squad,
  post,
  busy,
}: {
  squad: SquadRow;
  post: (body: unknown, okMsg?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [name, setName] = useState(squad.name);
  const [sections, setSections] = useState<Set<SectionKey>>(
    new Set((squad.defaultSections ?? []) as SectionKey[]),
  );
  const [confirmDel, setConfirmDel] = useState(false);

  function toggle(key: SectionKey) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls + " max-w-xs"} />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => post({ action: "update_team", teamId: squad.id, name: name.trim() || squad.name, defaultSections: [...sections] }, "Time salvo.")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Check className="h-4 w-4" /> Salvar
          </button>
          {confirmDel ? (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-muted">Excluir?</span>
              <button
                disabled={busy}
                onClick={async () => {
                  const ok = await post({ action: "delete_team", teamId: squad.id }, "Time excluído.");
                  if (ok) setConfirmDel(false);
                }}
                className="font-semibold text-rose-500 hover:text-rose-400 disabled:opacity-60"
              >
                Sim
              </button>
              <button onClick={() => setConfirmDel(false)} className="text-muted hover:text-ink">Não</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500"
              title="Excluir time"
              aria-label="Excluir time"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">
          Telas padrão — abas de visualização deste time
        </span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {SECTIONS.map((sec) => {
            const on = sections.has(sec.key);
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => toggle(sec.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  on ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line bg-surface text-muted hover:text-ink",
                )}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-brand-400 bg-brand-500 text-white" : "border-line")}>
                  {on && <Check className="h-3 w-3" />}
                </span>
                {sec.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          Preset aplicado ao criar/editar um usuário deste time (botão “Usar telas do time”).
        </p>
      </div>
    </div>
  );
}
