import type {
  AccountMetricPoint,
  AdCampaign,
  AudienceProfile,
  Campaign,
  Client,
  ContentPost,
  EngagementPoint,
  FormatReach,
  MediaType,
  Meeting,
  OrganicScope,
  Platform,
  TopPost,
} from "./types";

/**
 * Dados de demonstração determinísticos (modo demo / sem Supabase).
 * Tudo ancorado a uma data fixa para evitar divergência de hidratação.
 */
const TODAY = new Date("2026-06-22T12:00:00.000Z");

/** Data de referência usada por todo o mock (evita uso de "now"). */
export const REFERENCE_DATE = TODAY;

/** PRNG determinístico (mulberry32). */
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysAgo(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function isoDaysAhead(days: number): string {
  return isoDaysAgo(-days);
}

function isoAt(daysAhead: number, hour: number, minute: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const CLIENTS: Client[] = [
  {
    id: "cli-001",
    name: "Restaurante Sabor do Mar",
    slug: "sabor-do-mar",
    segment: "Gastronomia",
    instagramUsername: "sabordomar",
    facebookPageName: "Restaurante Sabor do Mar",
    status: "ativo",
    metaConnected: true,
  },
  {
    id: "cli-002",
    name: "Studio Vértice",
    slug: "studio-vertice",
    segment: "Arquitetura",
    instagramUsername: "studiovertice",
    facebookPageName: "Studio Vértice Arquitetura",
    status: "ativo",
    metaConnected: true,
  },
  {
    id: "cli-003",
    name: "Lumina Estética",
    slug: "lumina-estetica",
    segment: "Beleza & Bem-estar",
    instagramUsername: "luminaestetica",
    facebookPageName: "Lumina Estética",
    status: "ativo",
    metaConnected: false,
  },
  {
    id: "cli-004",
    name: "Vértice Fit",
    slug: "vertice-fit",
    segment: "Academia",
    instagramUsername: "verticefit",
    facebookPageName: "Vértice Fit",
    status: "pausado",
    metaConnected: true,
  },
];

const CAMPAIGN_TEMPLATES: Record<
  string,
  { name: string; objective: string }[]
> = {
  "cli-001": [
    { name: "Rodízio de Frutos do Mar", objective: "Tráfego" },
    { name: "Combo Casal — Jantar", objective: "Conversões" },
    { name: "Reconhecimento Local", objective: "Alcance" },
  ],
  "cli-002": [
    { name: "Lançamento Portfólio 2026", objective: "Engajamento" },
    { name: "Captação de Leads — Reformas", objective: "Cadastros" },
  ],
  "cli-003": [
    { name: "Promo Limpeza de Pele", objective: "Conversões" },
    { name: "Dia da Beleza", objective: "Tráfego" },
    { name: "Remarketing Clientes", objective: "Conversões" },
  ],
  "cli-004": [
    { name: "Matrículas Junho", objective: "Cadastros" },
    { name: "Desafio 30 Dias", objective: "Engajamento" },
  ],
};

const CAPTIONS = [
  "Começa hoje a nossa nova campanha ☕✨ Vem com a gente!",
  "Bastidores do que estamos preparando pra você 👀",
  "Resultado de quem confia no processo. Obrigado! 💙",
  "Novidade chegando essa semana — fica de olho!",
  "O fim de semana pede aquele momento especial 🌿",
  "Dica rápida que todo mundo precisa saber 👇",
  "Antes e depois que fala por si só ✨",
  "Aquele detalhe que faz toda a diferença.",
  "Marca aquele amigo que precisa ver isso! 🔥",
];

function makeCampaigns(client: Client, seed: number): Campaign[] {
  const rand = rng(seed);
  const templates = CAMPAIGN_TEMPLATES[client.id] ?? [];
  return templates.map((t, i) => {
    const budget = Math.round((1500 + rand() * 6000) / 50) * 50;
    const spendPct = 0.45 + rand() * 0.5;
    const spend = Math.round(budget * spendPct);
    const impressions = Math.round(8000 + rand() * 90000);
    const reach = Math.round(impressions * (0.6 + rand() * 0.3));
    const clicks = Math.round(impressions * (0.01 + rand() * 0.04));
    const conversions = Math.round(clicks * (0.04 + rand() * 0.12));
    const status =
      client.status === "pausado"
        ? "paused"
        : i === templates.length - 1 && rand() > 0.6
          ? "ended"
          : "active";
    return {
      id: `cmp-${client.id}-${i + 1}`,
      clientId: client.id,
      name: t.name,
      objective: t.objective,
      platform: (rand() > 0.5 ? "instagram" : "facebook") as Platform,
      status,
      budget,
      spend,
      impressions,
      reach,
      clicks,
      conversions,
      startDate: isoDaysAgo(30 - i * 3).slice(0, 10),
      endDate: status === "ended" ? isoDaysAgo(2).slice(0, 10) : null,
    };
  });
}

type SchedSpec = {
  caption: string;
  day: number;
  hour: number;
  mediaType: MediaType;
  platform: Platform;
  approval: "pending" | "approved" | "changes_requested";
  author: string;
  waitingHours: number | null;
};

// Agendados/aguardando: 3 para aprovar + 1 em ajuste + 5 agendados (aprovados)
const SCHED_SPECS: SchedSpec[] = [
  { caption: "Fim de semana especial: menu degustação com harmonização de vinhos selecionados pelo nosso chef", day: 0, hour: 19, mediaType: "image", platform: "instagram", approval: "pending", author: "Ana (Social Media)", waitingHours: 48 },
  { caption: "Bastidores da nossa cozinha — um dia com o chef Eduardo preparando o prato do dia", day: 1, hour: 12, mediaType: "reel", platform: "instagram", approval: "pending", author: "Ana (Social Media)", waitingHours: 18 },
  { caption: "Novidade no cardápio desta semana: peixe do dia com redução de maracujá e risoto de aspargos", day: 4, hour: 18, mediaType: "image", platform: "facebook", approval: "pending", author: "Carlos (Design)", waitingHours: 6 },
  { caption: "Promoção de aniversário do restaurante: rodízio especial com 20% off", day: 6, hour: 20, mediaType: "carousel", platform: "instagram", approval: "changes_requested", author: "Ana (Social Media)", waitingHours: null },
  { caption: "Stories: enquete — você prefere mesa interna ou na varanda?", day: 2, hour: 11, mediaType: "story", platform: "instagram", approval: "approved", author: "Ana (Social Media)", waitingHours: null },
  { caption: "Carrossel: conheça nossos pescados frescos do dia", day: 3, hour: 13, mediaType: "carousel", platform: "instagram", approval: "approved", author: "Carlos (Design)", waitingHours: null },
  { caption: "Reels: harmonização de vinhos em 30 segundos", day: 5, hour: 19, mediaType: "reel", platform: "instagram", approval: "approved", author: "Ana (Social Media)", waitingHours: null },
  { caption: "Sugestão do chef: moqueca capixaba completa", day: 7, hour: 12, mediaType: "image", platform: "facebook", approval: "approved", author: "Carlos (Design)", waitingHours: null },
  { caption: "Stories: contagem regressiva para o fim de semana", day: 8, hour: 18, mediaType: "story", platform: "instagram", approval: "approved", author: "Ana (Social Media)", waitingHours: null },
];

const PUB_MEDIA: MediaType[] = ["reel", "image", "carousel", "image", "reel"];

function makeContent(client: Client, seed: number): ContentPost[] {
  const rand = rng(seed + 99);
  const posts: ContentPost[] = [];

  SCHED_SPECS.forEach((s, i) => {
    posts.push({
      id: `post-${client.id}-s${i + 1}`,
      clientId: client.id,
      platform: s.platform,
      mediaType: s.mediaType,
      status: "scheduled",
      caption: s.caption,
      thumbnailUrl: null,
      permalink: null,
      publishedAt: null,
      scheduledAt: isoAt(s.day, s.hour, 0),
      approval: s.approval,
      author: s.author,
      waitingHours: s.waitingHours,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      reach: 0,
      impressions: 0,
    });
  });

  for (let i = 0; i < 5; i++) {
    const reach = Math.round(1200 + rand() * 14000);
    const impressions = Math.round(reach * (1.1 + rand() * 0.6));
    const likes = Math.round(reach * (0.03 + rand() * 0.08));
    posts.push({
      id: `post-${client.id}-p${i + 1}`,
      clientId: client.id,
      platform: (rand() > 0.45 ? "instagram" : "facebook") as Platform,
      mediaType: PUB_MEDIA[i],
      status: "published",
      caption: CAPTIONS[i % CAPTIONS.length],
      thumbnailUrl: null,
      permalink: "#",
      publishedAt: isoDaysAgo(i * 2 + 1),
      scheduledAt: null,
      approval: null,
      author: i % 2 === 0 ? "Ana (Social Media)" : "Carlos (Design)",
      waitingHours: null,
      likes,
      comments: Math.round(likes * (0.05 + rand() * 0.2)),
      shares: Math.round(likes * (0.02 + rand() * 0.1)),
      saves: Math.round(likes * (0.05 + rand() * 0.25)),
      reach,
      impressions,
    });
  }
  return posts;
}

function makeAccountSeries(
  client: Client,
  platform: Platform,
  seed: number,
): AccountMetricPoint[] {
  const rand = rng(seed + (platform === "instagram" ? 7 : 13));
  const points: AccountMetricPoint[] = [];
  let followers = Math.round(3000 + rand() * 18000);
  for (let d = 29; d >= 0; d--) {
    followers += Math.round(rand() * 60 - 8);
    const reach = Math.round(800 + rand() * 9000);
    points.push({
      date: isoDaysAgo(d).slice(0, 10),
      followers,
      reach,
      impressions: Math.round(reach * (1.2 + rand() * 0.5)),
      profileViews: Math.round(reach * (0.05 + rand() * 0.1)),
    });
  }
  return points;
}

// Pré-computa tudo de forma determinística
export const CAMPAIGNS: Campaign[] = CLIENTS.flatMap((c, i) =>
  makeCampaigns(c, (i + 1) * 1000),
);

export const CONTENT: ContentPost[] = CLIENTS.flatMap((c, i) =>
  makeContent(c, (i + 1) * 2000),
);

export const ACCOUNT_SERIES: Record<string, AccountMetricPoint[]> =
  Object.fromEntries(
    CLIENTS.flatMap((c, i) => [
      [`${c.id}:instagram`, makeAccountSeries(c, "instagram", (i + 1) * 3000)],
      [`${c.id}:facebook`, makeAccountSeries(c, "facebook", (i + 1) * 3000)],
    ]),
  );

// Série de engajamento orgânico (% por dia, ~30 dias)
function makeEngagementSeries(seed: number): EngagementPoint[] {
  const rand = rng(seed + 555);
  const points: EngagementPoint[] = [];
  let base = 2.2 + rand() * 1.2;
  for (let d = 29; d >= 0; d--) {
    base += (rand() - 0.42) * 0.28;
    base = Math.max(1.5, Math.min(5.4, base));
    points.push({
      date: isoDaysAgo(d).slice(0, 10),
      value: Math.round(base * 10) / 10,
    });
  }
  return points;
}

export const ENGAGEMENT_SERIES: Record<string, EngagementPoint[]> =
  Object.fromEntries(
    CLIENTS.map((c, i) => [c.id, makeEngagementSeries((i + 1) * 4000)]),
  );

// ---------------------------------------------------------------------------
// Mídia paga (M3): orçamento, CPL mês a mês e campanhas ativas por cliente
// ---------------------------------------------------------------------------
type AdRow = Omit<AdCampaign, "id" | "clientId">;

export type MediaRaw = {
  budget: number;
  metaInvested: number;
  googleInvested: number;
  leads: number;
  leadsDelta: number; // %
  cpl: number;
  cplDelta: number; // R$
  conversions: number;
  convDelta: number; // abs
  cpa: number;
  dailyPace: number;
  insight: string;
  cplHistory: { meta: number[]; google: number[] }; // 4 meses (mais antigo -> atual)
  campaigns: AdRow[];
};

const CLI001_MEDIA: MediaRaw = {
  budget: 3000,
  metaInvested: 1500,
  googleInvested: 660,
  leads: 257,
  leadsDelta: 18,
  cpl: 8.41,
  cplDelta: 1.2,
  conversions: 31,
  convDelta: 5,
  cpa: 49,
  dailyPace: 270,
  insight:
    'A campanha "Display: branding local" está gerando muitos cliques com poucas conversões. Estamos revisando os criativos e o público-alvo para melhorar o CPA nas próximas semanas.',
  cplHistory: {
    meta: [9.2, 8.8, 7.2, 8.5],
    google: [8.1, 7.6, 6.6, 7.4],
  },
  campaigns: [
    { name: "Reservas fim de semana", objective: "Conversões", audience: "Público local", network: "meta", status: "active", invested: 620, clicks: 1840, leads: 74, cpl: 8.38, conversions: 12 },
    { name: "Almoço executivo", objective: "Tráfego", audience: "Profissionais 25–45", network: "meta", status: "active", invested: 480, clicks: 2210, leads: 61, cpl: 7.87, conversions: 8 },
    { name: "Promoção aniversário", objective: "Conversões", audience: "Remarketing", network: "meta", status: "paused", invested: 400, clicks: 980, leads: 38, cpl: 10.53, conversions: 4 },
    { name: 'Busca "restaurante frutos do mar"', objective: "Search", audience: "Palavras-chave", network: "google", status: "active", invested: 390, clicks: 1120, leads: 52, cpl: 7.5, conversions: 7 },
    { name: "Display: branding local", objective: "Display", audience: "Geolocalização", network: "google", status: "active", invested: 270, clicks: 3400, leads: 32, cpl: 8.44, conversions: 1 },
  ],
};

const GENERIC_NAMES = [
  "Campanha local",
  "Tráfego de marca",
  "Busca institucional",
  "Remarketing display",
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function makeMediaRaw(seed: number): MediaRaw {
  const rand = rng(seed + 7777);
  const templates: { network: AdCampaign["network"]; objective: string; audience: string }[] = [
    { network: "meta", objective: "Conversões", audience: "Público local" },
    { network: "meta", objective: "Tráfego", audience: "Interesses" },
    { network: "google", objective: "Search", audience: "Palavras-chave" },
    { network: "google", objective: "Display", audience: "Remarketing" },
  ];
  const campaigns: AdRow[] = templates.map((t, i) => {
    const invested = Math.round((200 + rand() * 480) / 10) * 10;
    const clicks = Math.round(700 + rand() * 2800);
    const leads = Math.round(22 + rand() * 55);
    const conversions = Math.round(leads * (0.06 + rand() * 0.16));
    return {
      name: GENERIC_NAMES[i],
      objective: t.objective,
      audience: t.audience,
      network: t.network,
      status: rand() > 0.82 ? "paused" : "active",
      invested,
      clicks,
      leads,
      cpl: round2(invested / leads),
      conversions,
    };
  });

  const metaInvested = campaigns
    .filter((c) => c.network === "meta")
    .reduce((s, c) => s + c.invested, 0);
  const googleInvested = campaigns
    .filter((c) => c.network === "google")
    .reduce((s, c) => s + c.invested, 0);
  const invested = metaInvested + googleInvested;
  const leads = campaigns.reduce((s, c) => s + c.leads, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const budget = Math.ceil(invested / (0.55 + rand() * 0.3) / 100) * 100;
  const cpl = round2(invested / leads);

  return {
    budget,
    metaInvested,
    googleInvested,
    leads,
    leadsDelta: Math.round(rand() * 28 - 5),
    cpl,
    cplDelta: round2(rand() * 2.4 - 1),
    conversions,
    convDelta: Math.round(rand() * 8 - 2),
    cpa: Math.round(invested / Math.max(1, conversions)),
    dailyPace: Math.round(invested / 22 / 10) * 10,
    insight:
      "Estamos realocando verba para as campanhas com melhor CPL e testando novos criativos para reduzir o custo por lead no próximo ciclo.",
    cplHistory: {
      meta: [0, 1, 2, 3].map(() => round2(6 + rand() * 4)),
      google: [0, 1, 2, 3].map(() => round2(5 + rand() * 4)),
    },
    campaigns,
  };
}

export const MEDIA: Record<string, MediaRaw> = Object.fromEntries(
  CLIENTS.map((c, i) => [
    c.id,
    c.id === "cli-001" ? CLI001_MEDIA : makeMediaRaw((i + 1) * 6000),
  ]),
);

// ---------------------------------------------------------------------------
// Resultados orgânicos (M4)
// ---------------------------------------------------------------------------
export type OrganicRaw = {
  instagram: OrganicScope;
  facebook: OrganicScope;
  engagementAboveAvg: boolean;
  followersHistory6: { instagram: number[]; facebook: number[] };
  reachByFormat: FormatReach;
  audience: AudienceProfile;
  topPosts: Omit<TopPost, "rank">[];
  teamPattern: string;
};

const CLI001_ORGANIC: OrganicRaw = {
  instagram: {
    followers: 14190,
    followersDelta: 328,
    followersDeltaPct: 2.4,
    reach: 16800,
    reachDelta: 11,
    impressions: 48000,
    impressionsDelta: 8,
    engagement: 4.4,
    engagementDelta: 0.5,
  },
  facebook: {
    followers: 640,
    followersDelta: 15,
    followersDeltaPct: 3.4,
    reach: 1600,
    reachDelta: 5,
    impressions: 4100,
    impressionsDelta: 6,
    engagement: 2.1,
    engagementDelta: 0.2,
  },
  engagementAboveAvg: true,
  followersHistory6: {
    instagram: [12900, 13300, 13600, 13900, 14050, 14190],
    facebook: [560, 580, 600, 615, 628, 640],
  },
  reachByFormat: { reels: 50, feed: 38, stories: 5, carousel: 7 },
  audience: {
    ageRanges: [
      { label: "18–24", pct: 22 },
      { label: "25–34", pct: 41 },
      { label: "35–44", pct: 24 },
      { label: "45+", pct: 13 },
    ],
    bestHours: {
      rows: ["Manhã", "Tarde", "Noite"],
      grid: [
        [0, 0, 1, 0, 1, 0, 0],
        [1, 1, 1, 2, 1, 2, 1],
        [2, 2, 2, 2, 1, 2, 2],
      ],
    },
    topLocations: [
      { city: "Vitória, ES", pct: 58 },
      { city: "Vila Velha, ES", pct: 19 },
      { city: "Serra, ES", pct: 12 },
    ],
  },
  topPosts: [
    { title: "Reels: bastidores da cozinha com o chef Eduardo", mediaType: "reel", platform: "instagram", publishedAt: "2026-06-15", reach: 5240, likes: 1326, comments: 94 },
    { title: "Menu degustação com harmonização de vinhos", mediaType: "carousel", platform: "instagram", publishedAt: "2026-06-23", reach: 3860, likes: 847, comments: 63 },
    { title: "Novidade no cardápio: peixe do dia com redução de maracujá", mediaType: "image", platform: "instagram", publishedAt: "2026-06-25", reach: 2930, likes: 601, comments: 48 },
  ],
  teamPattern:
    "Reels com bastidores são os que mais geram alcance — os 3 melhores posts do mês são bastidores e novidades do cardápio. Reels têm 2× mais alcance que posts no feed. Estamos priorizando esse formato no calendário de junho.",
};

function makeOrganicRaw(seed: number): OrganicRaw {
  const rand = rng(seed + 8888);
  const igFollowers = Math.round(4000 + rand() * 14000);
  const fbFollowers = Math.round(400 + rand() * 1500);
  const igHist: number[] = [];
  let v = Math.round(igFollowers * 0.9);
  for (let i = 0; i < 6; i++) {
    v += Math.round((igFollowers - v) * (0.25 + rand() * 0.2));
    igHist.push(i === 5 ? igFollowers : v);
  }
  const fbHist: number[] = [];
  let w = Math.round(fbFollowers * 0.9);
  for (let i = 0; i < 6; i++) {
    w += Math.round((fbFollowers - w) * (0.25 + rand() * 0.2));
    fbHist.push(i === 5 ? fbFollowers : w);
  }
  const igReach = Math.round(igFollowers * (0.9 + rand() * 0.5));
  const fbReach = Math.round(fbFollowers * (1.5 + rand()));
  return {
    instagram: {
      followers: igFollowers,
      followersDelta: Math.round(igFollowers * 0.02),
      followersDeltaPct: round2(1 + rand() * 2),
      reach: igReach,
      reachDelta: Math.round(rand() * 14),
      impressions: Math.round(igReach * (2.5 + rand())),
      impressionsDelta: Math.round(rand() * 12),
      engagement: round2(2.5 + rand() * 2.5),
      engagementDelta: round2(rand() * 0.8 - 0.2),
    },
    facebook: {
      followers: fbFollowers,
      followersDelta: Math.round(fbFollowers * 0.02),
      followersDeltaPct: round2(1 + rand() * 2.5),
      reach: fbReach,
      reachDelta: Math.round(rand() * 10),
      impressions: Math.round(fbReach * (2 + rand())),
      impressionsDelta: Math.round(rand() * 9),
      engagement: round2(1.5 + rand() * 1.5),
      engagementDelta: round2(rand() * 0.5 - 0.1),
    },
    engagementAboveAvg: rand() > 0.4,
    followersHistory6: { instagram: igHist, facebook: fbHist },
    reachByFormat: { reels: 46, feed: 34, stories: 9, carousel: 11 },
    audience: {
      ageRanges: [
        { label: "18–24", pct: 26 },
        { label: "25–34", pct: 38 },
        { label: "35–44", pct: 22 },
        { label: "45+", pct: 14 },
      ],
      bestHours: {
        rows: ["Manhã", "Tarde", "Noite"],
        grid: [
          [0, 1, 0, 1, 0, 1, 0],
          [1, 1, 2, 1, 2, 1, 1],
          [2, 1, 2, 2, 2, 1, 2],
        ],
      },
      topLocations: [
        { city: "São Paulo, SP", pct: 41 },
        { city: "Campinas, SP", pct: 16 },
        { city: "Santos, SP", pct: 10 },
      ],
    },
    topPosts: [
      { title: "Bastidores da equipe em ação", mediaType: "reel", platform: "instagram", publishedAt: "2026-06-12", reach: Math.round(igReach * 0.3), likes: 820, comments: 60 },
      { title: "Novidade da semana", mediaType: "carousel", platform: "instagram", publishedAt: "2026-06-19", reach: Math.round(igReach * 0.22), likes: 540, comments: 41 },
      { title: "Dica rápida que viralizou", mediaType: "image", platform: "facebook", publishedAt: "2026-06-24", reach: Math.round(igReach * 0.16), likes: 330, comments: 28 },
    ],
    teamPattern:
      "Conteúdos de bastidores e dicas práticas seguem com o melhor alcance orgânico. Vamos ampliar a frequência de Reels e reforçar os horários de pico identificados na audiência.",
  };
}

export const ORGANIC: Record<string, OrganicRaw> = Object.fromEntries(
  CLIENTS.map((c, i) => [
    c.id,
    c.id === "cli-001" ? CLI001_ORGANIC : makeOrganicRaw((i + 1) * 9000),
  ]),
);

// ---------------------------------------------------------------------------
// Financeiro & contratos (M5) — parâmetros por cliente
// ---------------------------------------------------------------------------
export const FINANCE_TUNING: {
  plan: string;
  amount: number;
  description: string;
  activeSince: string;
}[] = [
  { plan: "Social Pro", amount: 2800, description: "Gestão de redes + tráfego pago", activeSince: "2026-01-09" },
  { plan: "Performance", amount: 3500, description: "Gestão + mídia + relatórios mensais", activeSince: "2025-11-15" },
  { plan: "Essencial", amount: 1900, description: "Gestão de redes sociais", activeSince: "2026-02-01" },
  { plan: "Branding Plus", amount: 4200, description: "Branding + conteúdo + tráfego pago", activeSince: "2025-09-20" },
];

// Próximas reuniões por cliente
export const MEETINGS: Meeting[] = CLIENTS.flatMap((c) => [
  {
    id: `mtg-${c.id}-1`,
    clientId: c.id,
    title: "Alinhamento mensal de resultados",
    startsAt: isoAt(4, 10, 0),
    joinUrl: "https://meet.google.com/abc-defg-hij",
  },
  {
    id: `mtg-${c.id}-2`,
    clientId: c.id,
    title: "Briefing campanha 2º semestre",
    startsAt: isoAt(16, 14, 30),
    joinUrl: "https://meet.google.com/klm-nopq-rst",
  },
]);
