export type Platform = "instagram" | "facebook";
export type PostStatus = "published" | "scheduled" | "draft";
export type MediaType = "image" | "video" | "carousel" | "reel" | "story";
export type CampaignStatus = "active" | "paused" | "ended" | "draft";

export type Client = {
  id: string;
  name: string;
  slug: string;
  segment: string;
  instagramUsername: string | null;
  facebookPageName: string | null;
  status: string;
  /** Conexão Meta ativa? */
  metaConnected: boolean;
  /** Cliente tem tráfego pago? Controla a coluna direita da Home (R05). */
  hasPaidTraffic: boolean;
  /** Tipo de negócio — adapta blocos de campanhas (CAM04). */
  clientType: "lead_gen" | "ecommerce" | "local_business";
  /** Redes ativas — controla os cards de rede em Resultados (ORG06). */
  activeNetworks: Platform[];
};

export type Campaign = {
  id: string;
  clientId: string;
  name: string;
  objective: string;
  platform: Platform;
  status: CampaignStatus;
  budget: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  startDate: string;
  endDate: string | null;
};

export type ApprovalStatus = "pending" | "approved" | "changes_requested";

export type ContentPost = {
  id: string;
  clientId: string;
  platform: Platform;
  mediaType: MediaType;
  status: PostStatus;
  caption: string;
  thumbnailUrl: string | null;
  permalink: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  /** Aprovação do cliente (apenas para posts agendados). */
  approval: ApprovalStatus | null;
  /** Quem criou a peça (ex.: "Ana (Social Media)"). */
  author: string | null;
  /** Horas aguardando aprovação (para o badge de tempo). */
  waitingHours: number | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
};

export type Meeting = {
  id: string;
  clientId: string;
  title: string;
  /** ISO datetime do início. */
  startsAt: string;
  joinUrl: string;
  /** Pauta preparada pela equipe (R08). */
  agenda: string;
  participants: string[];
  nextSteps: string;
};

// --- Mídia paga (Meta Ads + Google Ads) ------------------------------------
export type AdNetwork = "meta" | "google";

export type AdCampaign = {
  id: string;
  clientId: string;
  name: string;
  objective: string;
  audience: string;
  network: AdNetwork;
  status: "active" | "paused";
  invested: number;
  clicks: number;
  leads: number;
  cpl: number;
  conversions: number;
  cpc: number;
  cpa: number;
};

export type CplMonthPoint = { month: string; meta: number; google: number };

// --- Resultados orgânicos (M4) ----------------------------------------------
export type FollowersMonthPoint = {
  month: string;
  instagram: number;
  facebook: number;
};

export type FormatReach = {
  reels: number;
  feed: number;
  stories: number;
  carousel: number;
};

export type AudienceProfile = {
  ageRanges: { label: string; pct: number }[];
  bestHours: { rows: string[]; grid: number[][] }; // intensidade 0..2
  topLocations: { city: string; pct: number }[];
};

export type TopPost = {
  rank: number;
  title: string;
  mediaType: MediaType;
  platform: Platform;
  publishedAt: string;
  reach: number;
  likes: number;
  comments: number;
};

// --- Hub de acessos & ativos de marca (M6) ----------------------------------
export type AccessStatus = "connected" | "review" | "soon" | "setup";

export type AccessItem = {
  id: string;
  name: string;
  description: string;
  icon: "meta" | "google" | "rd" | "wordpress" | "ecommerce" | "other";
  status: AccessStatus;
  note: string;
  actionLabel: string;
};

export type AssetCategory = "logos" | "manual" | "fotos";
export type AssetPreview =
  | "logo-dark"
  | "logo-light"
  | "palette"
  | "type"
  | "pdf"
  | "photos";

export type BrandAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  meta: string;
  preview: AssetPreview;
  downloads: string[];
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  area: string;
  initials: string;
  whatsapp: string;
};

export type ActivityKind =
  | "approve"
  | "send"
  | "adjust"
  | "update"
  | "payment"
  | "login";

export type ActivityItem = {
  id: string;
  text: string;
  when: string;
  kind: ActivityKind;
};

// --- Customer Success / Gestão de clientes (gerencial) ----------------------
export type CSTone = "ok" | "warn" | "danger";
export type CSStatus = { label: string; tone: CSTone };

export type CSClient = {
  id: string;
  name: string;
  segment: string;
  city: string;
  mrr: number;
  healthScore: number;
  nps: number;
  financial: CSStatus;
  contract: CSStatus;
  cs: string;
  lastContactDays: number;
  atRisk: boolean;
  healthy: boolean;
  renewingSoon: boolean;
};

export type CSTimelineEvent = {
  id: string;
  date: string; // "09/06"
  text: string;
  kind: "nps" | "meeting" | "refund" | "payment" | "onboarding" | "note";
};

export type CSClientDetail = {
  client: CSClient;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  clientSince: string;
  plan: string;
  tenure: string;
  ltv: number;
  invoicesNote: string;
  npsClassification: string;
  npsLastSurvey: string;
  npsQuote: string;
  timeline: CSTimelineEvent[];
  nextMeeting: { title: string; whenLabel: string } | null;
  nextContact: string;
  briefing: {
    objetivo: string;
    tomDeVoz: string;
    publico: string;
    concorrentes: string;
    restricoes: string;
  };
  campaigns: { name: string; cpl: number; tone: CSTone }[];
  campaignsInvested: number;
};

export type CSPortfolio = {
  periodLabel: string;
  npsAvg: number;
  promoters: number;
  neutrals: number;
  detractors: number;
  churnRisk: number;
  renewals: number;
  renewalsValue: number;
  retentionRate: number;
  churnNote: string;
  mrrTotal: number;
  alertText: string;
  clients: CSClient[];
};

// --- Financeiro & contratos (M5) --------------------------------------------
export type InvoiceStatus = "paid" | "open";

export type Invoice = {
  id: string;
  competence: string; // "Jul / 2026"
  description: string;
  amount: number;
  dueDate: string; // ISO date
  status: InvoiceStatus;
  method: string | null; // "PIX"
  paidDate: string | null; // ISO date
};

export type FinanceDocument = {
  id: string;
  title: string;
  meta: string; // "Assinado em 09/01/2026"
  sizeLabel: string; // "340 KB"
};

export type OrganicScope = {
  followers: number;
  followersDelta: number; // abs
  followersDeltaPct: number; // %
  reach: number;
  reachDelta: number; // %
  impressions: number;
  impressionsDelta: number; // %
  engagement: number; // %
  engagementDelta: number; // pp
};

export type AccountMetricPoint = {
  date: string;
  followers: number;
  reach: number;
  impressions: number;
  profileViews: number;
};

export type EngagementPoint = {
  date: string;
  value: number;
};
