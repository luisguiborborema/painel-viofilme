/**
 * Módulo 6 — RH & Cultura (dados mock).
 *
 * Abas: Time, Banco de horas, PDIs, Avaliações, Mural, Documentos + perfil
 * individual. Banco de horas nasce do apontamento do M3 (Operação) — aqui é
 * apenas leitura. Mock-first; schema Supabase recomendado no spec.
 */

export type ContractType = "clt" | "pj";

export type Employee = {
  id: string;
  name: string;
  role: string;
  squad: string;
  contractType: ContractType;
  salary: number;
  admissionDate: string; // "jan/24"
  email: string;
  phone: string;
  vacationDue: string; // "jan/25"
  vacationSoon: boolean; // < 60 dias
  /** % da capacidade semanal (termômetro na aba Time). */
  weeklyLoadPct: number;
  /** Saldo acumulado no mês (banco de horas). */
  hourBalance: number;
  hourLimit: number; // padrão 8h/mês CLT
  pdiActive: boolean;
  reviewPending: boolean; // autoavaliação não preenchida
};

export const EMPLOYEES: Employee[] = [
  {
    id: "emp-robert", name: "Robert Oliveira", role: "Designer", squad: "Criação & Produção",
    contractType: "clt", salary: 3200, admissionDate: "jan/24",
    email: "robert@viofilme.com.br", phone: "(27) 99000-1234",
    vacationDue: "jan/25", vacationSoon: true,
    weeklyLoadPct: 108, hourBalance: 14, hourLimit: 8, pdiActive: true, reviewPending: true,
  },
  {
    id: "emp-ana", name: "Ana Lima", role: "Social Media", squad: "Atendimento & Conteúdo",
    contractType: "clt", salary: 3600, admissionDate: "mar/23",
    email: "ana@viofilme.com.br", phone: "(27) 99111-2233",
    vacationDue: "mar/25", vacationSoon: false,
    weeklyLoadPct: 95, hourBalance: 6, hourLimit: 8, pdiActive: true, reviewPending: false,
  },
  {
    id: "emp-gustavo", name: "Gustavo Ferreira", role: "Copywriter", squad: "Criação & Produção",
    contractType: "pj", salary: 3000, admissionDate: "jun/24",
    email: "gustavo@viofilme.com.br", phone: "(27) 99222-3344",
    vacationDue: "—", vacationSoon: false,
    weeklyLoadPct: 82, hourBalance: 2, hourLimit: 8, pdiActive: true, reviewPending: true,
  },
  {
    id: "emp-mariana", name: "Mariana Azevedo", role: "Gestora de Tráfego", squad: "Performance",
    contractType: "clt", salary: 4200, admissionDate: "ago/22",
    email: "mariana@viofilme.com.br", phone: "(27) 99333-4455",
    vacationDue: "ago/25", vacationSoon: false,
    weeklyLoadPct: 76, hourBalance: 2, hourLimit: 8, pdiActive: false, reviewPending: false,
  },
  {
    id: "emp-marcos", name: "Marcos Silva", role: "Editor de Vídeo", squad: "Criação & Produção",
    contractType: "pj", salary: 2800, admissionDate: "out/24",
    email: "marcos@viofilme.com.br", phone: "(27) 99444-5566",
    vacationDue: "—", vacationSoon: false,
    weeklyLoadPct: 64, hourBalance: 0, hourLimit: 8, pdiActive: false, reviewPending: false,
  },
];

export function getEmployees(): Employee[] {
  return EMPLOYEES;
}

export function getEmployee(id: string): Employee | undefined {
  return EMPLOYEES.find((e) => e.id === id);
}

// --- Alertas da aba Time -----------------------------------------------------
export type HrAlert = { id: string; tone: "warn" | "danger"; text: string };

export function getHrAlerts(): HrAlert[] {
  const alerts: HrAlert[] = [];
  for (const e of EMPLOYEES) {
    if (e.contractType === "clt" && e.hourBalance > 12) {
      alerts.push({
        id: `h-${e.id}`,
        tone: "danger",
        text: `${e.name} acumulou +${e.hourBalance}h no banco de horas — compensação imediata sugerida.`,
      });
    } else if (e.contractType === "clt" && e.hourBalance > 8) {
      alerts.push({
        id: `h-${e.id}`,
        tone: "warn",
        text: `${e.name} está acima do limite de banco de horas (+${e.hourBalance}h).`,
      });
    }
  }
  const pending = EMPLOYEES.filter((e) => e.reviewPending).length;
  if (pending > 0) {
    alerts.push({
      id: "rev",
      tone: "warn",
      text: `${pending} colaboradores ainda não preencheram a autoavaliação do ciclo atual.`,
    });
  }
  return alerts;
}

// --- Banco de horas ----------------------------------------------------------
export type HourRow = {
  id: string;
  name: string;
  contractType: ContractType;
  balance: number;
  limit: number;
  note: string;
  tone: "ok" | "warn" | "danger";
};

export function getHourBank(): { periodLabel: string; total: number; rows: HourRow[] } {
  const rows: HourRow[] = EMPLOYEES.map((e) => {
    const tone: HourRow["tone"] =
      e.contractType === "pj"
        ? "ok"
        : e.hourBalance > 12
          ? "danger"
          : e.hourBalance > 8
            ? "warn"
            : "ok";
    const note =
      e.contractType === "pj"
        ? e.hourBalance > 0
          ? "PJ · referência"
          : "PJ · horas via tarefas do M3"
        : e.hourBalance > 12
          ? `Limite ${e.hourLimit}h/mês`
          : "Dentro do limite";
    return {
      id: e.id,
      name: e.name,
      contractType: e.contractType,
      balance: e.hourBalance,
      limit: e.hourLimit,
      note,
      tone,
    };
  });
  return {
    periodLabel: "Junho 2025",
    total: EMPLOYEES.reduce((s, e) => s + e.hourBalance, 0),
    rows,
  };
}

// --- PDI ---------------------------------------------------------------------
export type PdiObjectiveStatus = "not_started" | "in_progress" | "done" | "missed";

export type PdiEmployee = {
  id: string;
  name: string;
  role: string;
  total: number;
  done: number;
  inProgress: number;
  progressPct: number;
  openObjective: { title: string; indicator: string; progress: string };
};

export function getPdiCycle(): {
  quarter: string;
  deadline: string;
  active: number;
  employees: PdiEmployee[];
} {
  const employees: PdiEmployee[] = [
    {
      id: "emp-robert", name: "Robert Oliveira", role: "Designer",
      total: 3, done: 1, inProgress: 1, progressPct: 67,
      openObjective: { title: "Dominar Motion Design para Reels", indicator: "4 Reels com motion até 30/06", progress: "2/4" },
    },
    {
      id: "emp-ana", name: "Ana Lima", role: "Social Media",
      total: 3, done: 2, inProgress: 1, progressPct: 83,
      openObjective: { title: "Certificação Meta Blueprint", indicator: "aprovação no exame até 30/06", progress: "80%" },
    },
    {
      id: "emp-gustavo", name: "Gustavo Ferreira", role: "Copywriter",
      total: 2, done: 0, inProgress: 2, progressPct: 40,
      openObjective: { title: "Storytelling para vídeo curto", indicator: "10 roteiros validados", progress: "4/10" },
    },
  ];
  return { quarter: "Q2 2025", deadline: "30/06/2025", active: employees.length, employees };
}

// --- Avaliações --------------------------------------------------------------
export function getReviewCycle() {
  return {
    cycle: "jul/25",
    label: "Avaliação semestral — ciclo jul/25",
    description:
      "Autoavaliação + avaliação da liderança. 2 colaboradores ainda não preencheram a autoavaliação.",
    pendingSelf: 2,
    started: false,
  };
}

// --- Mural -------------------------------------------------------------------
export type AnnouncementCategory = "operational" | "culture" | "career";

export type Announcement = {
  id: string;
  author: string;
  authorRole: string;
  category: AnnouncementCategory;
  content: string;
  when: string;
  readBy: number;
  total: number;
  note: string;
};

export function getAnnouncements(): Announcement[] {
  return [
    {
      id: "a1", author: "Iago", authorRole: "Diretoria", category: "operational",
      content: "A partir de julho, todos os apontamentos de horas devem ser registrados diariamente até 18h. O sistema irá gerar alertas automáticos para apontamentos em atraso. Conto com a disciplina de todos.",
      when: "Hoje, 09:00", readBy: 4, total: 5, note: "Robert ainda não confirmou",
    },
    {
      id: "a2", author: "Flávio", authorRole: "Diretoria", category: "culture",
      content: "Resultados do Q2: atingimos 8 clientes ativos e MRR de R$ 31k. Parabéns ao time inteiro pela entrega. Celebração na sexta, 27/06, às 18h no escritório. Confirmem presença aqui.",
      when: "22/06, 17:30", readBy: 5, total: 5, note: "3 confirmaram presença",
    },
    {
      id: "a3", author: "Iago", authorRole: "Diretoria", category: "career",
      content: "O ciclo de PDI do Q2 encerra em 30/06. Lembrem de atualizar o progresso dos objetivos. As avaliações semestrais começam em julho e o resultado do PDI será parte da conversa de carreira.",
      when: "15/06, 10:00", readBy: 5, total: 5, note: "",
    },
  ];
}

// --- Perfil individual -------------------------------------------------------
export type EmployeeProfile = {
  employee: Employee;
  weeks: { label: string; hours: number; extra: boolean }[];
  documents: { id: string; title: string; meta: string }[];
  pdiObjectives: {
    title: string;
    indicator: string;
    status: PdiObjectiveStatus;
    deadline: string;
  }[];
  review: {
    self: number;
    leader: number;
    criteria: { label: string; self: number; leader: number }[];
    note: string;
  };
  activity: { text: string; when: string }[];
};

export function getEmployeeProfile(id: string): EmployeeProfile | null {
  const employee = getEmployee(id);
  if (!employee) return null;
  return {
    employee,
    weeks: [
      { label: "Semana 08–14 jun", hours: 8, extra: true },
      { label: "Semana 15–21 jun", hours: 6, extra: true },
      { label: "Compensa mai/25", hours: 0, extra: false },
    ],
    documents: [
      { id: "dc1", title: "Contrato CLT", meta: "Assinado jan/24 · PDF" },
      { id: "dc2", title: "Holerite jun/25", meta: "Disponível" },
      { id: "dc3", title: "ASO — atestado", meta: "Válido até jan/26" },
    ],
    pdiObjectives: [
      { title: "Dominar Motion Design para Reels", indicator: "4 Reels com motion publicados até 30/06", status: "in_progress", deadline: "30/06/2025" },
      { title: "Reduzir taxa de refação abaixo de 15%", indicator: "taxa atual 18% · meta < 15%", status: "in_progress", deadline: "30/06/2025" },
      { title: "Dominar Figma Auto Layout para agilizar artes", indicator: "template de post aprovado pela liderança", status: "done", deadline: "20/06/2025" },
    ],
    review: {
      self: 4.2,
      leader: 3.8,
      criteria: [
        { label: "Qualidade técnica", self: 5, leader: 4 },
        { label: "Prazo & entrega", self: 4, leader: 3 },
        { label: "Comunicação", self: 4, leader: 5 },
      ],
      note: "Ponto de desenvolvimento prioritário: consistência de prazos, especialmente em semanas de alta demanda.",
    },
    activity: [
      { text: "Banco de horas atingiu +14h acumuladas — acima do limite de 8h", when: "Hoje" },
      { text: "Objetivo do PDI concluído: Dominar Figma Auto Layout", when: "20/06" },
      { text: "Avaliação semestral jan/25 concluída — nota liderança 3.8", when: "jan/25" },
    ],
  };
}
