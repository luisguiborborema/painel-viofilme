import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Plug,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getClients } from "@/lib/data/queries";
import { SyncButton } from "@/components/gerencial/sync-button";
import {
  isMetaConfigured,
  META_REDIRECT_URI,
  META_SCOPES,
} from "@/lib/meta/config";
import {
  GOOGLE_REDIRECT_URI,
  isGoogleConfigured,
} from "@/lib/google/config";
import { getGoogleStatus } from "@/lib/google/client";

const GERROS: Record<string, string> = {
  config: "Google ainda não configurado (defina GOOGLE_CLIENT_ID/SECRET).",
  negado: "Conexão cancelada.",
  invalido: "Resposta inválida do Google.",
  state: "Falha de validação de segurança (state). Tente novamente.",
};

const ERROS: Record<string, string> = {
  cliente: "Selecione um cliente para conectar.",
  config: "Meta API ainda não configurada (veja o guia abaixo).",
  negado: "Conexão cancelada pelo usuário.",
  invalido: "Resposta inválida da Meta.",
  state: "Falha de validação de segurança (state). Tente novamente.",
  sem_pagina: "Nenhuma página do Facebook encontrada nessa conta.",
};

export default async function GerencialIntegracoes({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; gok?: string; gerro?: string }>;
}) {
  const { ok, erro, gok, gerro } = await searchParams;
  const clients = await getClients();
  const configured = isMetaConfigured();
  const googleConfigured = isGoogleConfigured();
  const google = await getGoogleStatus();

  return (
    <div>
      <PageHeader
        title="Integrações"
        subtitle="Conecte as contas de Instagram e Facebook de cada cliente via Meta."
      />

      {ok && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Conta <strong>{ok}</strong> conectada com sucesso.
        </div>
      )}
      {erro && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          {ERROS[erro] ?? erro}
        </div>
      )}
      {gok && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Google conectado como <strong>{gok}</strong>.
        </div>
      )}
      {gerro && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          {GERROS[gerro] ?? gerro}
        </div>
      )}

      {/* Google Calendar (conta única da agência) */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-ink">Google Agenda</p>
            <p className="text-xs text-muted">
              {google.connected
                ? `Conectada${google.email ? ` — ${google.email}` : ""}`
                : "Agenda compartilhada da agência (reuniões + Meet)."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {google.connected ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3" /> Conectada
            </Badge>
          ) : (
            <Badge variant="muted">Não conectada</Badge>
          )}
          {googleConfigured ? (
            <Link href="/api/google/connect">
              <Button variant={google.connected ? "outline" : "primary"} size="sm">
                {google.connected ? "Reconectar" : "Conectar Google"}
              </Button>
            </Link>
          ) : (
            <span className="text-xs text-muted">Configuração pendente</span>
          )}
        </div>
      </Card>

      {!googleConfigured && (
        <Card className="mb-6 border-blue-200 bg-blue-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" /> Como ativar o Google Agenda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-ink/80">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Em{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                >
                  console.cloud.google.com <ExternalLink className="h-3 w-3" />
                </a>{" "}
                crie um <strong>OAuth client ID</strong> (Web application) e habilite a{" "}
                <strong>Google Calendar API</strong>.
              </li>
              <li>
                Registre a <strong>redirect URI</strong> autorizada:
                <code className="mt-1 block rounded-lg bg-white px-3 py-2 text-xs text-blue-700">
                  {GOOGLE_REDIRECT_URI}
                </code>
              </li>
              <li>
                Defina <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> e (opcional){" "}
                <code>GOOGLE_CALENDAR_ID</code> na Vercel e faça redeploy.
              </li>
            </ol>
          </CardContent>
        </Card>
      )}

      {!configured && (
        <Card className="mb-6 border-brand-200 bg-brand-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-brand-600" />
              Como ativar a Meta Graph API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-ink/80">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Crie um app <strong>Business</strong> em{" "}
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                >
                  developers.facebook.com <ExternalLink className="h-3 w-3" />
                </a>
                .
              </li>
              <li>
                Adicione os produtos <strong>Facebook Login</strong> e{" "}
                <strong>Instagram Graph API</strong>.
              </li>
              <li>
                Em Facebook Login → Settings, registre a URL de redirecionamento
                OAuth:
                <code className="mt-1 block rounded-lg bg-white px-3 py-2 text-xs text-brand-700">
                  {META_REDIRECT_URI}
                </code>
              </li>
              <li>
                Solicite as permissões em App Review:
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {META_SCOPES.map((s) => (
                    <Badge key={s} variant="default">
                      {s}
                    </Badge>
                  ))}
                </span>
              </li>
              <li>
                Preencha <code>NEXT_PUBLIC_META_APP_ID</code> e{" "}
                <code>META_APP_SECRET</code> no <code>.env.local</code> e
                reinicie o servidor.
              </li>
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {clients.map((client) => (
          <Card
            key={client.id}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
                {client.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="font-medium text-ink">{client.name}</p>
                <p className="text-xs text-muted">
                  {client.instagramUsername
                    ? `@${client.instagramUsername}`
                    : "sem Instagram"}{" "}
                  · {client.facebookPageName ?? "sem página"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {client.metaConnected ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" /> Conectada
                </Badge>
              ) : (
                <Badge variant="muted">Não conectada</Badge>
              )}
              {client.metaConnected && <SyncButton clientId={client.id} />}
              <Link href={`/api/meta/connect?client=${client.id}`}>
                <Button variant={client.metaConnected ? "outline" : "primary"} size="sm">
                  {client.metaConnected ? "Reconectar" : "Conectar"}
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
