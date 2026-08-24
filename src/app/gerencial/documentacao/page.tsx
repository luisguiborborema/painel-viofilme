import { PageHeader } from "@/components/dashboard/page-header";
import { ApiDocs } from "@/components/gerencial/api-docs";

export const metadata = { title: "Documentação da API" };

export default function DocumentacaoPage() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://seu-app.vercel.app").replace(/\/$/, "");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documentação da API"
        subtitle="Referência dos endpoints do painel: captação pública, MCP, webhooks, rotinas automáticas e as rotas internas."
      />
      <ApiDocs baseUrl={baseUrl} />
    </div>
  );
}
