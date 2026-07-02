"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, ShieldCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SECTIONS,
  TEAM_TEMPLATES,
  type SectionKey,
} from "@/lib/access";
import type { TeamMemberRow } from "@/lib/auth/team";

function templateLabel(value: string | null) {
  return TEAM_TEMPLATES.find((t) => t.value === value)?.label ?? "Personalizado";
}

function sectionsSummary(allowed: string[] | null) {
  if (allowed == null) return "Todas as abas";
  if (allowed.length === 0) return "Nenhuma aba";
  return SECTIONS.filter((s) => allowed.includes(s.key))
    .map((s) => s.label)
    .join(", ");
}

/** Seletor de tipo + abas. Gestor = todas (checkboxes travados). */
function SectionPicker({
  teamRole,
  sections,
  onTemplate,
  onToggle,
}: {
  teamRole: string;
  sections: Set<SectionKey>;
  onTemplate: (value: string) => void;
  onToggle: (key: SectionKey) => void;
}) {
  const isGestor = teamRole === "gestor";
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Tipo</label>
        <select
          value={teamRole}
          onChange={(e) => onTemplate(e.target.value)}
          className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
        >
          {TEAM_TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Abas que este usuário vê
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {SECTIONS.map((s) => {
            const on = isGestor || sections.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                disabled={isGestor}
                onClick={() => onToggle(s.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  on
                    ? "border-brand-400 bg-brand-500/10 text-ink"
                    : "border-line bg-surface text-muted hover:text-ink",
                  isGestor && "opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    on ? "border-brand-400 bg-brand-500 text-white" : "border-line",
                  )}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
        {isGestor && (
          <p className="mt-1.5 text-xs text-muted">
            Gestor tem acesso a todas as abas.
          </p>
        )}
      </div>
    </div>
  );
}

function useEditorState(initialTeamRole: string, initialAllowed: string[] | null) {
  const [teamRole, setTeamRole] = useState(initialTeamRole);
  const [sections, setSections] = useState<Set<SectionKey>>(
    new Set((initialAllowed ?? []) as SectionKey[]),
  );
  function onTemplate(value: string) {
    setTeamRole(value);
    const tpl = TEAM_TEMPLATES.find((t) => t.value === value);
    if (value === "gestor") setSections(new Set(SECTIONS.map((s) => s.key)));
    else if (value !== "custom" && tpl?.sections)
      setSections(new Set(tpl.sections));
  }
  function onToggle(key: SectionKey) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const payload = () => ({
    teamRole,
    allowedSections: teamRole === "gestor" ? null : [...sections],
  });
  return { teamRole, sections, onTemplate, onToggle, payload };
}

export function TeamAccess({
  team,
  selfId,
}: {
  team: TeamMemberRow[];
  selfId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");

  async function post(body: unknown) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/gerencial/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      setEditing(null);
      setCreating(false);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-subtle text-muted">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Equipe &amp; acessos</h2>
            <p className="text-xs text-muted">
              Crie usuários e defina quais abas cada um vê.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setCreating((v) => !v);
            setEditing(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> Novo usuário
        </button>
      </div>

      {creating && <CreateForm busy={busy} onSubmit={post} />}

      <ul className="mt-2 divide-y divide-line">
        {team.length === 0 && (
          <li className="py-3 text-sm text-muted">
            Nenhum usuário gerencial listado (requer Supabase configurado).
          </li>
        )}
        {team.map((m) => (
          <li key={m.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {m.name || m.email}
                </p>
                <p className="truncate text-xs text-muted">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    m.active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300",
                  )}
                >
                  {m.active ? "Ativo" : "Inativo"}
                </span>
                <span className="rounded-full bg-subtle-strong px-2 py-0.5 text-[11px] font-medium text-ink">
                  {templateLabel(m.teamRole)}
                </span>
                <button
                  onClick={() =>
                    setEditing(editing === m.id ? null : m.id)
                  }
                  className="text-xs font-medium text-brand-300 hover:text-brand-200"
                >
                  {editing === m.id ? "Fechar" : "Editar acessos"}
                </button>
              </div>
            </div>
            {editing !== m.id && (
              <p className="mt-1 text-xs text-muted">
                {sectionsSummary(m.allowedSections)}
              </p>
            )}
            {editing === m.id && (
              <EditRow member={m} busy={busy} onSubmit={post} />
            )}

            {/* Ações: redefinir senha · ativar/desativar */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {pwFor === m.id ? (
                <span className="flex items-center gap-1.5">
                  <input
                    value={pwValue}
                    onChange={(e) => setPwValue(e.target.value)}
                    type="text"
                    placeholder="nova senha (mín. 6)"
                    className="h-8 w-44 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink outline-none focus:border-brand-400"
                  />
                  <button
                    disabled={busy || pwValue.length < 6}
                    onClick={() => {
                      post({ action: "reset_password", userId: m.id, password: pwValue });
                      setPwValue("");
                      setPwFor(null);
                    }}
                    className="rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                  >
                    Definir
                  </button>
                  <button
                    onClick={() => {
                      setPwFor(null);
                      setPwValue("");
                    }}
                    className="text-xs text-muted hover:text-ink"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => {
                    setPwFor(m.id);
                    setPwValue("");
                  }}
                  className="text-xs font-medium text-muted hover:text-ink"
                >
                  Redefinir senha
                </button>
              )}

              {m.id !== selfId && (
                <button
                  onClick={() =>
                    post({ action: "set_active", userId: m.id, active: !m.active })
                  }
                  className={cn(
                    "text-xs font-medium",
                    m.active
                      ? "text-rose-400 hover:text-rose-300"
                      : "text-emerald-400 hover:text-emerald-300",
                  )}
                >
                  {m.active ? "Desativar" : "Ativar"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {msg && <p className="mt-2 text-xs text-rose-400">{msg}</p>}
    </div>
  );
}

function EditRow({
  member,
  busy,
  onSubmit,
}: {
  member: TeamMemberRow;
  busy: boolean;
  onSubmit: (body: unknown) => void;
}) {
  const ed = useEditorState(
    member.teamRole ?? (member.allowedSections == null ? "gestor" : "custom"),
    member.allowedSections,
  );
  return (
    <div className="mt-3 rounded-xl border border-line bg-canvas p-3">
      <SectionPicker
        teamRole={ed.teamRole}
        sections={ed.sections}
        onTemplate={ed.onTemplate}
        onToggle={ed.onToggle}
      />
      <button
        onClick={() => onSubmit({ action: "update", userId: member.id, ...ed.payload() })}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Salvar acessos
      </button>
    </div>
  );
}

function CreateForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const ed = useEditorState("financeiro", ["financeiro"]);

  const valid = name.trim() && email.trim() && password.length >= 6;

  return (
    <div className="mb-3 rounded-xl border border-line bg-canvas p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <UserPlus className="h-4 w-4 text-brand-300" /> Novo usuário
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="e-mail"
          className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="text"
          placeholder="senha temporária (mín. 6)"
          className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
        />
      </div>
      <div className="mt-3">
        <SectionPicker
          teamRole={ed.teamRole}
          sections={ed.sections}
          onTemplate={ed.onTemplate}
          onToggle={ed.onToggle}
        />
      </div>
      <button
        onClick={() =>
          onSubmit({ action: "create", name, email, password, ...ed.payload() })
        }
        disabled={busy || !valid}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Criar usuário
      </button>
    </div>
  );
}
