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

export type ApprovalStatus = "pending" | "approved";

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
};

export type CplMonthPoint = { month: string; meta: number; google: number };

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
