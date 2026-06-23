import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Plug,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getClients } from "@/lib/data/queries";
import {
  isMetaConfigured,
  META_REDIRECT_URI,
  META_SCOPES,
} from "@/lib/meta/config";

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
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const clients = await getClients();
  const configured = isMetaConfigured();

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
