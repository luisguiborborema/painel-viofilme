import { SECTIONS, pathToSection } from "@/lib/access";

/** Rótulos legíveis das ações registradas (client-safe). */
export const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  pageview: "Acesso",
  status_change: "Mudou status",
  edit: "Editou",
  create: "Criou",
  move: "Moveu",
  delete: "Excluiu",
  update: "Atualizou",
  comment: "Comentou",
  freeze: "Congelou",
  unfreeze: "Reativou",
  handoff: "Passou o bastão",
  done: "Concluiu",
  sign: "Assinou",
  pay: "Baixou pagamento",
  unpay: "Estornou",
  create_team: "Criou time",
  update_team: "Editou time",
  delete_team: "Excluiu time",
  reset_password: "Redefiniu senha",
  set_active: "Ativou/desativou",
  send_reset_email: "Enviou link de senha",
  "save-fields": "Editou campos",
};

export function actionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

/** ISO de N dias atrás (fora do corpo de componentes — evita a regra de pureza). */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const CLIENTE_LABELS: Record<string, string> = {
  "/cliente": "Visão geral",
  "/cliente/conteudo": "Conteúdo",
  "/cliente/campanhas": "Campanhas",
  "/cliente/resultados": "Resultados",
  "/cliente/financeiro": "Financeiro",
  "/cliente/central": "Marca & acessos",
};

/** Rótulo da "aba" a partir do pathname (para page-views e agregações). */
export function areaForPath(path: string): string {
  const clean = path.split("?")[0];
  if (clean.startsWith("/cliente")) {
    const keys = Object.keys(CLIENTE_LABELS).sort((a, b) => b.length - a.length);
    const m = keys.find((k) => clean === k || clean.startsWith(k + "/"));
    return m ? CLIENTE_LABELS[m] : "Cliente";
  }
  if (clean === "/configuracoes") return "Configurações";
  if (clean.startsWith("/gerencial/usuarios")) return "Usuários";
  if (clean.startsWith("/gerencial/monitoramento")) return "Monitoramento";
  if (clean.startsWith("/gerencial/comercial/pipeline")) return "Pipeline";
  if (clean.startsWith("/gerencial/comercial")) return "Comercial";
  if (clean.startsWith("/gerencial/agenda")) return "Agenda";
  const sec = pathToSection(clean);
  if (sec) return SECTIONS.find((s) => s.key === sec)?.label ?? sec;
  return "Painel";
}
