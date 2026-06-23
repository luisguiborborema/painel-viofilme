import type {
  AccountMetricPoint,
  Campaign,
  Client,
  ContentPost,
  MediaType,
  Platform,
} from "./types";

/**
 * Dados de demonstração determinísticos (modo demo / sem Supabase).
 * Tudo ancorado a uma data fixa para evitar divergência de hidratação.
 */
const TODAY = new Date("2026-06-22T12:00:00.000Z");

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

export const CLIENTS: Client[] = [
  {
    id: "cli-001",
    name: "Café Aurora",
    slug: "cafe-aurora",
    segment: "Gastronomia",
    instagramUsername: "cafeaurora",
    facebookPageName: "Café Aurora",
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
    { name: "Brunch de Inverno", objective: "Tráfego" },
    { name: "Combo Café + Doce", objective: "Conversões" },
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

const MEDIA_TYPES: MediaType[] = ["reel", "image", "carousel", "video"];

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

function makeContent(client: Client, seed: number): ContentPost[] {
  const rand = rng(seed + 99);
  const posts: ContentPost[] = [];
  // 3 agendados (futuro) + 9 publicados (passado)
  for (let i = 0; i < 3; i++) {
    posts.push({
      id: `post-${client.id}-s${i + 1}`,
      clientId: client.id,
      platform: (rand() > 0.5 ? "instagram" : "facebook") as Platform,
      mediaType: MEDIA_TYPES[Math.floor(rand() * MEDIA_TYPES.length)],
      status: "scheduled",
      caption: CAPTIONS[(i + 3) % CAPTIONS.length],
      thumbnailUrl: null,
      permalink: null,
      publishedAt: null,
      scheduledAt: isoDaysAhead(i * 2 + 1),
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      reach: 0,
      impressions: 0,
    });
  }
  for (let i = 0; i < 9; i++) {
    const reach = Math.round(1200 + rand() * 14000);
    const impressions = Math.round(reach * (1.1 + rand() * 0.6));
    const likes = Math.round(reach * (0.03 + rand() * 0.08));
    posts.push({
      id: `post-${client.id}-p${i + 1}`,
      clientId: client.id,
      platform: (rand() > 0.45 ? "instagram" : "facebook") as Platform,
      mediaType: MEDIA_TYPES[Math.floor(rand() * MEDIA_TYPES.length)],
      status: "published",
      caption: CAPTIONS[i % CAPTIONS.length],
      thumbnailUrl: null,
      permalink: "#",
      publishedAt: isoDaysAgo(i * 2 + 1),
      scheduledAt: null,
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
