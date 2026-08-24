"use client";

import { useState } from "react";
import { Check, ChevronRight, Copy, Lock, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  API_GROUPS,
  API_INTERNAL,
  API_STATUS_CODES,
  type ApiEndpoint,
  type HttpMethod,
} from "@/lib/data/api-docs";

const METHOD_TONE: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/15 text-emerald-700",
  POST: "bg-blue-500/15 text-blue-700",
  PUT: "bg-amber-500/15 text-amber-700",
  PATCH: "bg-amber-500/15 text-amber-700",
  DELETE: "bg-rose-500/15 text-rose-700",
};

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={cn("shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold", METHOD_TONE[method])}>
      {method}
    </span>
  );
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between border-b border-line bg-subtle px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Terminal className="h-3 w-3" /> {label}
        </span>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted hover:text-ink"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? "copiado" : "copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function EndpointCard({ ep }: { ep: ApiEndpoint }) {
  return (
    <article id={ep.id} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={ep.method} />
        <code className="text-sm font-semibold text-ink">{ep.path}</code>
      </div>
      <h3 className="mt-2 text-base font-bold text-ink">{ep.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{ep.description}</p>

      <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-subtle px-2.5 py-1 text-xs text-ink">
        <Lock className="h-3 w-3 text-muted" /> <span className="text-muted">Autenticação:</span> {ep.auth}
      </p>

      {ep.params && ep.params.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Parâmetros</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-subtle text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nome</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Obrig.</th>
                  <th className="px-3 py-2 font-semibold">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ep.params.map((p) => (
                  <tr key={p.name}>
                    <td className="px-3 py-2"><code className="text-xs font-semibold text-ink">{p.name}</code></td>
                    <td className="px-3 py-2 text-xs text-muted">{p.type}</td>
                    <td className="px-3 py-2">
                      {p.required ? (
                        <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">sim</span>
                      ) : (
                        <span className="text-[10px] text-muted">não</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs leading-relaxed text-muted">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {ep.request && <CodeBlock code={ep.request} label="Requisição" />}
        {ep.response && <CodeBlock code={ep.response} label="Resposta" />}
      </div>

      {ep.errors && ep.errors.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Erros possíveis</p>
          <ul className="space-y-1">
            {ep.errors.map((e) => (
              <li key={e.code} className="flex gap-2 text-xs">
                <code className="shrink-0 rounded bg-rose-500/10 px-1.5 py-0.5 font-semibold text-rose-600">{e.code}</code>
                <span className="text-muted">{e.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ep.notes && ep.notes.length > 0 && (
        <ul className="mt-4 space-y-1.5 rounded-xl bg-subtle px-3 py-2.5">
          {ep.notes.map((n, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted">
              <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ApiDocs({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="flex gap-6">
      {/* Navegação lateral */}
      <nav className="sticky top-20 hidden h-fit w-52 shrink-0 lg:block">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Referência</p>
        <ul className="space-y-0.5 text-sm">
          <li><a href="#introducao" className="block rounded-lg px-2 py-1.5 text-muted hover:bg-subtle hover:text-ink">Introdução</a></li>
          <li><a href="#autenticacao" className="block rounded-lg px-2 py-1.5 text-muted hover:bg-subtle hover:text-ink">Autenticação</a></li>
          {API_GROUPS.map((g) => (
            <li key={g.id}>
              <a href={`#${g.id}`} className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-subtle">{g.title}</a>
              <ul className="ml-2 space-y-0.5 border-l border-line pl-2">
                {g.endpoints.map((ep) => (
                  <li key={ep.id}>
                    <a href={`#${ep.id}`} className="block truncate rounded px-1.5 py-1 text-xs text-muted hover:text-ink" title={ep.title}>
                      {ep.title}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          <li><a href="#internos" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-subtle">Endpoints internos</a></li>
        </ul>
      </nav>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1 space-y-10">
        {/* Introdução */}
        <section id="introducao" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-ink">Introdução</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            A API do painel usa <strong>HTTP + JSON</strong>. Todo corpo de requisição e de resposta é
            <code className="mx-1 rounded bg-subtle px-1 text-xs">application/json</code>
            (a única exceção é o envio de formulário, que também aceita multipart). Erros vêm sempre no formato
            <code className="mx-1 rounded bg-subtle px-1 text-xs">{'{ "error": "mensagem" }'}</code>
            com o status HTTP correspondente.
          </p>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">URL base</p>
            <code className="mt-1 block text-sm font-semibold text-ink">{baseUrl}</code>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Códigos de status</p>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-subtle text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Código</th>
                    <th className="px-3 py-2 font-semibold">Significado</th>
                    <th className="px-3 py-2 font-semibold">Quando acontece</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {API_STATUS_CODES.map((s) => (
                    <tr key={s.code}>
                      <td className="px-3 py-2"><code className="text-xs font-bold text-ink">{s.code}</code></td>
                      <td className="px-3 py-2 text-xs text-ink">{s.label}</td>
                      <td className="px-3 py-2 text-xs text-muted">{s.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Autenticação */}
        <section id="autenticacao" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-ink">Autenticação</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Existem três formas de autenticar, conforme o tipo de endpoint:
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              {
                t: "Sessão do painel",
                d: "Endpoints internos (/api/gerencial/*, /api/crm/*). Usam o cookie de sessão de quem está logado e respeitam o perfil (Gestor, Admin, somente leitura).",
                c: "Cookie de sessão",
              },
              {
                t: "Token de integração",
                d: "MCP e rotinas. Enviado no header Authorization. Cada um tem o seu: MCP_TOKEN para o MCP, CRON_SECRET para as rotinas.",
                c: "Authorization: Bearer <token>",
              },
              {
                t: "Token do registro",
                d: "Endpoints públicos. A própria pesquisa/formulário carrega um token ou slug que identifica e valida o destino — sem login.",
                c: "token no corpo / slug na URL",
              },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm font-bold text-ink">{x.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{x.d}</p>
                <code className="mt-2 block rounded-lg bg-subtle px-2 py-1 text-[11px] text-ink">{x.c}</code>
              </div>
            ))}
          </div>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
            Os tokens são variáveis de ambiente na Vercel. Para revogar um acesso, troque o valor e refaça o deploy.
          </p>
        </section>

        {/* Grupos de endpoints */}
        {API_GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-24">
            <h2 className="text-xl font-bold text-ink">{g.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{g.summary}</p>
            <div className="mt-4 space-y-4">
              {g.endpoints.map((ep) => <EndpointCard key={ep.id} ep={ep} />)}
            </div>
          </section>
        ))}

        {/* Internos */}
        <section id="internos" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-ink">Endpoints internos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Usados pelas telas do painel. Seguem sempre o mesmo padrão: <strong>POST</strong> com um campo
            <code className="mx-1 rounded bg-subtle px-1 text-xs">action</code> no corpo dizendo o que fazer, e
            <strong> GET</strong> quando só leem. Exigem sessão de usuário gerencial — perfis somente leitura
            recebem <code className="rounded bg-subtle px-1 text-xs">403</code>.
          </p>
          <div className="mt-4 space-y-4">
            {API_INTERNAL.map((area) => (
              <div key={area.area}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{area.area}</p>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-subtle text-[11px] uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Endpoint</th>
                        <th className="px-3 py-2 font-semibold">Para que serve</th>
                        <th className="px-3 py-2 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {area.routes.map((r) => (
                        <tr key={r.path}>
                          <td className="px-3 py-2"><code className="text-xs font-semibold text-ink">{r.path}</code></td>
                          <td className="px-3 py-2 text-xs text-muted">{r.purpose}</td>
                          <td className="px-3 py-2 text-xs text-muted">{r.actions ? <code className="text-[11px]">{r.actions}</code> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
