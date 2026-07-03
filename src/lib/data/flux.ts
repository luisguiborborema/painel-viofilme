/**
 * VioFlux (FLX01-05) — visão de PUBLICAÇÃO sobre as tasks (client-safe, mock).
 *
 * Não tem base de conteúdo própria: é um recorte de publicação (rede +
 * agendamento) sobre a mesma fonte (tasks/LE). Modo MANUAL nesta fase — o
 * agendamento é espelho (não publica) e "Publicado" é marcado à mão.
 */
import { REFERENCE_DATE } from "./mock";
import type { EditorialFormat } from "./operacao";

export type FluxState =
  | "rascunho"
  | "aguardando"
  | "aprovado"
  | "ajuste"
  | "agendado"
  | "publicado"
  | "falha";

export const FLUX_STATES: { key: FluxState; label: string; chip: string; dot: string }[] = [
  { key: "rascunho", label: "Rascunho", chip: "bg-subtle text-muted", dot: "bg-muted" },
  { key: "aguardando", label: "Aguardando aprovação", chip: "bg-amber-500/15 text-amber-600", dot: "bg-amber-500" },
  { key: "aprovado", label: "Aprovado", chip: "bg-emerald-500/15 text-emerald-600", dot: "bg-emerald-500" },
  { key: "ajuste", label: "Em ajuste", chip: "bg-rose-500/15 text-rose-500", dot: "bg-rose-500" },
  { key: "agendado", label: "Agendado", chip: "bg-sky-500/15 text-sky-500", dot: "bg-sky-500" },
  { key: "publicado", label: "Publicado", chip: "bg-brand-500/15 text-brand-600", dot: "bg-brand-500" },
  { key: "falha", label: "Com falha", chip: "bg-rose-600/15 text-rose-600", dot: "bg-rose-600" },
];

export function stateMeta(s: FluxState) {
  return FLUX_STATES.find((x) => x.key === s)!;
}

export type FluxNetwork = "instagram" | "facebook";

export type FluxPost = {
  id: string;
  taskId: string; // vínculo com a task de origem (fonte única)
  clientId: string;
  client: string;
  title: string;
  caption: string;
  format: EditorialFormat;
  networks: FluxNetwork[];
  state: FluxState;
  date: string; // ISO — data planejada / no calendário
  scheduledAt?: string; // ISO — espelho do que o time combinou (não publica)
  mediaNote: string;
  clientComment?: string;
};

function iso(daysOffset: number, hour = 12): string {
  const d = new Date(REFERENCE_DATE);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const FLUX_POSTS: FluxPost[] = [
  { id: "fx1", taskId: "tk2", clientId: "cli-imob", client: "Restaurante Sabor do Mar", title: "Post feed — menu degustação", caption: "Chegou o menu degustação de inverno 🍷 Reserve sua mesa!", format: "Feed", networks: ["instagram", "facebook"], state: "aguardando", date: iso(0, 11), mediaNote: "Foto estúdio" },
  { id: "fx2", taskId: "tk3", clientId: "cli-imob", client: "Restaurante Sabor do Mar", title: "Reels — bastidores da cozinha", caption: "O segredo do camarão, direto da cozinha 👨‍🍳", format: "Reels", networks: ["instagram"], state: "aprovado", date: iso(1, 19), mediaNote: "Gravado no Media Day" },
  { id: "fx3", taskId: "tk7", clientId: "cli-imob", client: "Restaurante Sabor do Mar", title: "Carrossel — 5 motivos para a degustação", caption: "5 motivos para experimentar 👇", format: "Carrossel", networks: ["instagram"], state: "agendado", date: iso(2, 18), scheduledAt: iso(2, 18), mediaNote: "6 artes" },
  { id: "fx4", taskId: "tk8", clientId: "cli-farm", client: "Rede de Farmácias BH", title: "Post — promoção de aniversário", caption: "Aniversário BH: descontos em toda a loja 🎉", format: "Feed", networks: ["instagram", "facebook"], state: "ajuste", date: iso(0, 15), mediaNote: "Arte promo", clientComment: "Trocar a cor do fundo para o azul da marca e destacar o cupom." },
  { id: "fx5", taskId: "tk11", clientId: "cli-farm", client: "Rede de Farmácias BH", title: "Stories — enquete semanal", caption: "Qual produto você quer em oferta?", format: "Stories", networks: ["instagram"], state: "rascunho", date: iso(1, 12), mediaNote: "Template stories" },
  { id: "fx6", taskId: "tk14", clientId: "cli-adv", client: "Advocacia Menezes & Assis", title: "Post — calendário de julho", caption: "Direitos que você precisa conhecer neste mês.", format: "Feed", networks: ["instagram", "facebook"], state: "aguardando", date: iso(1, 10), mediaNote: "Arte institucional" },
  { id: "fx7", taskId: "tk5", clientId: "cli-adv", client: "Advocacia Menezes & Assis", title: "Stories institucionais (5)", caption: "Sequência sobre atuação do escritório.", format: "Stories", networks: ["instagram"], state: "publicado", date: iso(-2, 9), scheduledAt: iso(-2, 9), mediaNote: "Copy pronta" },
  { id: "fx8", taskId: "tk9", clientId: "cli-imob", client: "Restaurante Sabor do Mar", title: "Reels — harmonização com vinhos", caption: "Sommelier explica os pares perfeitos 🍇", format: "Reels", networks: ["instagram"], state: "rascunho", date: iso(3, 19), mediaNote: "Gravar no Media Day" },
];

export function fluxPostsFor(clientId?: string): FluxPost[] {
  return clientId ? FLUX_POSTS.filter((p) => p.clientId === clientId) : FLUX_POSTS;
}
