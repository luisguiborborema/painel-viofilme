"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlatformIcon } from "@/components/dashboard/platform";
import { cn, formatCompact, formatNumber } from "@/lib/utils";
import type { FormatReach, Platform } from "@/lib/data/types";

type Scope = {
  followers: number;
  followersDelta: number;
  reach: number;
  impressions: number;
  engagement: number;
};

const COLOR: Record<Platform, string> = {
  instagram: "#D4537E",
  facebook: "#38bdf8",
};

const NAME: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

function Row({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-2.5 text-left"
      >
        <span className="text-sm text-muted">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{value}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      {open && <div className="pb-3 text-xs text-muted">{children}</div>}
    </div>
  );
}

export function NetworkCard({
  network,
  handle,
  role,
  scope,
  reachByFormat,
}: {
  network: Platform;
  handle: string;
  role: string;
  scope: Scope;
  reachByFormat: FormatReach;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k));
  const color = COLOR[network];

  const newThisWeek = Math.round(scope.followersDelta * 0.3);
  const fromAds = Math.round(scope.followersDelta * 0.25);
  const unfollows = Math.round(scope.followersDelta * 0.15);
  const likes = Math.round(scope.reach * 0.05);
  const comments = Math.round(scope.reach * 0.008);
  const saves = Math.round(scope.reach * 0.02);
  const shares = Math.round(scope.reach * 0.006);

  const fmtRow = (label: string, value: string) => (
    <div className="flex justify-between py-0.5">
      <span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-l-4 p-5" style={{ borderColor: color }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
              style={{ background: color }}
            >
              <PlatformIcon platform={network} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{NAME[network]}</p>
              <p className="text-xs text-muted">@{handle} · {role}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
          </span>
        </div>

        <div>
          <Row
            label="Seguidores"
            value={formatNumber(scope.followers)}
            open={open === "followers"}
            onToggle={() => toggle("followers")}
          >
            {fmtRow("Novos na semana", `+${formatNumber(newThisWeek)}`)}
            {fmtRow("Via anúncios", `${formatNumber(fromAds)}`)}
            {fmtRow("Descadastros", `-${formatNumber(unfollows)}`)}
          </Row>
          <Row
            label="Alcance"
            value={formatCompact(scope.reach)}
            open={open === "reach"}
            onToggle={() => toggle("reach")}
          >
            {(["reels", "feed", "stories", "carousel"] as const).map((f) =>
              fmtRow(
                f.charAt(0).toUpperCase() + f.slice(1),
                `${formatCompact(Math.round((scope.reach * reachByFormat[f]) / 100))} · ${reachByFormat[f]}%`,
              ),
            )}
          </Row>
          <Row
            label="Engajamento"
            value={`${scope.engagement.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
            open={open === "engagement"}
            onToggle={() => toggle("engagement")}
          >
            {fmtRow("Curtidas", formatCompact(likes))}
            {fmtRow("Comentários", formatCompact(comments))}
            {fmtRow("Salvamentos", formatCompact(saves))}
            {fmtRow("Compartilhamentos", formatCompact(shares))}
          </Row>
        </div>

        <p className="mt-3 text-xs text-muted">
          Engajamento acima da média do setor de gastronomia (~2,8%).
        </p>
      </div>
    </Card>
  );
}
