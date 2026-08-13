import { Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SuggestionsBoard } from "@/components/gerencial/suggestions-board";
import { getSession } from "@/lib/auth/session";
import { getSuggestions } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function SugestoesPage() {
  const [user, suggestions] = await Promise.all([getSession(), getSuggestions()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sugestões de ajustes"
        subtitle="Suba melhorias e ajustes do painel — com texto, imagens e vídeos. O time acompanha o status."
        action={<Lightbulb className="h-5 w-5 text-brand-400" />}
      />
      <SuggestionsBoard
        initial={suggestions}
        meId={user?.id ?? ""}
        isAdmin={Boolean(user?.isAdmin)}
        readOnly={Boolean(user?.readOnly)}
      />
    </div>
  );
}
