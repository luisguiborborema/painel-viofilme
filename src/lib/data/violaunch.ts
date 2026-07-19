/**
 * VioLaunch™ (Produto Zero) — dados mock estruturados para a aba do Hub.
 * Três dimensões: Jornada (4 semanas / 12 passos), Gates (4 travas) e Roadmap
 * (7 blocos). Skeleton pronto para receber o produto real; conteúdo dos blocos
 * e recursos são placeholders que ligam depois (60% Playbook + 40% custom).
 */

export type VLStatus = "concluido" | "andamento" | "proximo" | "bloqueado";
export type VLResourceKind = "copiar" | "abrir" | "anexar";
/** ref = copy (texto p/ clipboard) quando kind='copiar', ou URL p/ abrir/anexar. */
export type VLResource = { kind: VLResourceKind; label: string; ref?: string };
export type VLConnection = "vioday" | "le" | "agenda";

export type VLStep = {
  n: number;
  label: string;
  owner: string;
  date: string;
  status: VLStatus;
  statusTag?: string;
  acoes: { label: string; done: boolean }[];
  recursos: VLResource[];
  sla: string;
  connection?: VLConnection;
  placeholder?: boolean;
};

export type VLGate = {
  label: string;
  state: "liberado" | "validando" | "bloqueado";
  rule: string;
  checklist: { label: string; done: boolean }[];
};

export type VLWeek = { n: number; title: string; steps: VLStep[]; gate: VLGate };
export type VLBlock = { id: string; label: string; pct: number; content?: string };

export type VioLaunchData = {
  scope: "completo" | "reduzido";
  stepDone: number;
  total: number;
  startDate: string;
  weeks: VLWeek[];
  roadmap: VLBlock[];
  roadmapPct: number;
};

export const VL_STATUS: Record<VLStatus, { label: string; chip: string }> = {
  concluido: { label: "concluído", chip: "bg-emerald-500/15 text-emerald-600" },
  andamento: { label: "em andamento", chip: "bg-sky-500/15 text-sky-500" },
  proximo: { label: "próximo", chip: "bg-subtle text-muted" },
  bloqueado: { label: "bloqueado", chip: "bg-rose-500/15 text-rose-500" },
};

const ph = (n: number, label: string, owner: string): VLStep => ({
  n,
  label,
  owner,
  date: "a definir",
  status: "proximo",
  acoes: [],
  recursos: [],
  sla: "definido no manual",
  placeholder: true,
});

export const VIOLAUNCH_WEEKS: VLWeek[] = [
  {
    n: 1,
    title: "Fundação",
    gate: {
      label: "Gate 1 · Fundação validada",
      state: "liberado",
      rule: "Contrato assinado + grupo criado + briefing enviado.",
      checklist: [
        { label: "Contrato assinado e recebimento", done: true },
        { label: "Grupo oficial no WhatsApp", done: true },
        { label: "Formulários de briefing enviados", done: true },
      ],
    },
    steps: [
      {
        n: 1,
        label: "Assinatura do contrato & Ativação",
        owner: "Closer",
        date: "01/07",
        status: "concluido",
        statusTag: "ONBOARDING — Aguardando Boas-Vindas",
        acoes: [
          { label: "Closer fecha o contrato e realiza o recebimento", done: true },
          { label: "Cria o grupo oficial no WhatsApp com o cliente", done: true },
          { label: "Abre ficha do cliente no ClickUp com briefing comercial", done: true },
        ],
        recursos: [
          { kind: "copiar", label: "Msg de ativação (grupo)" },
          { kind: "abrir", label: "Template de ficha ClickUp" },
        ],
        sla: "D0 — dia do fechamento",
      },
      {
        n: 2,
        label: "Boas-Vindas & Welcome Doc",
        owner: "Head SM",
        date: "01/07",
        status: "concluido",
        acoes: [
          { label: "Enviar Welcome Doc no grupo", done: true },
          { label: "Apresentar o squad responsável", done: true },
        ],
        recursos: [
          { kind: "copiar", label: "Mensagem de boas-vindas" },
          { kind: "abrir", label: "Welcome Doc (template)" },
        ],
        sla: "D+1",
      },
      {
        n: 3,
        label: "Envio dos Formulários de Briefing",
        owner: "Analista",
        date: "02/07",
        status: "concluido",
        acoes: [
          { label: "Enviar formulário de briefing estratégico", done: true },
          { label: "Enviar coleta de acessos e ativos", done: false },
        ],
        recursos: [
          { kind: "abrir", label: "Formulário de briefing" },
          { kind: "anexar", label: "Acessos & ativos recebidos" },
        ],
        sla: "D+2",
      },
    ],
  },
  {
    n: 2,
    title: "Estratégia",
    gate: {
      label: "Gate 2 · Estratégia aprovada",
      state: "validando",
      rule: "Estudo do negócio + narrativa/pilares definidos.",
      checklist: [
        { label: "Reunião de onboarding realizada", done: true },
        { label: "Estudo de negócio & concorrência", done: false },
        { label: "Narrativa e pilares aprovados", done: false },
      ],
    },
    steps: [
      { ...ph(4, "Reunião de Onboarding", "Head SM"), status: "andamento", date: "04/07", connection: "agenda" },
      ph(5, "Estudo do Negócio & Concorrência", "Analista"),
      ph(6, "Definição de Narrativa & Pilares", "Analista"),
    ],
  },
  {
    n: 3,
    title: "Produção",
    gate: {
      label: "Gate 3 · Regra de Ouro (LE + roteiros)",
      state: "bloqueado",
      rule: "Nenhum Media Day sem LE + roteiros aprovados.",
      checklist: [
        { label: "Setup de tráfego & pixels", done: false },
        { label: "Primeira Linha Editorial + roteiros", done: false },
        { label: "Aprovação editorial do cliente", done: false },
      ],
    },
    steps: [
      ph(7, "Setup de Tráfego & Pixels", "Tráfego"),
      { ...ph(8, "Primeira Linha Editorial & Roteiros", "Analista"), connection: "le" },
      ph(9, "Aprovação Editorial com o Cliente", "Head SM"),
    ],
  },
  {
    n: 4,
    title: "Launch",
    gate: {
      label: "Gate 4 · Prontidão de lançamento",
      state: "bloqueado",
      rule: "Media Day capturado + kickoff realizado.",
      checklist: [
        { label: "Media Day capturado", done: false },
        { label: "Kickoff de lançamento", done: false },
        { label: "Go-live da primeira entrega", done: false },
      ],
    },
    steps: [
      { ...ph(10, "Media Day", "Produção"), connection: "vioday" },
      { ...ph(11, "Kickoff / Reunião de Lançamento", "Head SM"), connection: "agenda" },
      ph(12, "Go-live & Primeira Entrega", "Squad"),
    ],
  },
];

export const VIOLAUNCH_ROADMAP: VLBlock[] = [
  { id: "B1", label: "Diagnóstico & Posicionamento", pct: 100 },
  { id: "B2", label: "Persona & Jornada", pct: 80 },
  { id: "B3", label: "Narrativa & Pilares", pct: 40 },
  { id: "B4", label: "Linha Editorial Mestre", pct: 10 },
  { id: "B5", label: "Plano de Tráfego", pct: 0 },
  { id: "B6", label: "Identidade Visual", pct: 0 },
  { id: "B7", label: "Metas & KPIs", pct: 0 },
];

/** Monta a VioLaunchData a partir de weeks/roadmap (template no mock, DB no real). */
export function buildVioLaunchData(
  weeks: VLWeek[],
  roadmap: VLBlock[],
  opts: { scope?: "completo" | "reduzido"; startDate?: string } = {},
): VioLaunchData {
  const steps = weeks.flatMap((w) => w.steps);
  const stepDone = steps.filter((s) => s.status === "concluido").length;
  const roadmapPct = roadmap.length
    ? Math.round(roadmap.reduce((a, b) => a + b.pct, 0) / roadmap.length)
    : 0;
  return {
    scope: opts.scope ?? "completo",
    stepDone,
    total: steps.length,
    startDate: opts.startDate ?? "01/07",
    weeks,
    roadmap,
    roadmapPct,
  };
}

export function getVioLaunchData(startDate = "01/07"): VioLaunchData {
  return buildVioLaunchData(VIOLAUNCH_WEEKS, VIOLAUNCH_ROADMAP, { startDate });
}
