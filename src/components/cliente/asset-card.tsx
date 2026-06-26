import { Download, FileText, Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LogoMark } from "@/components/brand/logo";
import type { AssetPreview, BrandAsset } from "@/lib/data/types";

function Preview({ kind }: { kind: AssetPreview }) {
  const base = "flex h-28 items-center justify-center rounded-xl";
  switch (kind) {
    case "logo-dark":
      return (
        <div className={`${base} bg-brand-900`}>
          <LogoMark className="h-8 text-lime" />
        </div>
      );
    case "logo-light":
      return (
        <div className={`${base} bg-[#f5f6f8]`}>
          <LogoMark className="h-8 text-brand-600" />
        </div>
      );
    case "palette":
      return (
        <div className={`${base} gap-2 bg-subtle`}>
          {["#2a63c9", "#e9fc89", "#f9e5d8", "#f2a4ad", "#14171f"].map((c) => (
            <span
              key={c}
              className="h-6 w-6 rounded-full ring-1 ring-line"
              style={{ background: c }}
            />
          ))}
        </div>
      );
    case "type":
      return (
        <div className={`${base} bg-subtle`}>
          <span className="font-serif text-4xl text-ink">Aa</span>
        </div>
      );
    case "pdf":
      return (
        <div className={`${base} bg-subtle text-brand-300`}>
          <FileText className="h-9 w-9" />
        </div>
      );
    case "photos":
      return (
        <div className={`${base} grid grid-cols-3 gap-1 bg-subtle p-3`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="flex items-center justify-center rounded bg-subtle-strong text-muted"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </span>
          ))}
        </div>
      );
  }
}

export function AssetCard({ asset }: { asset: BrandAsset }) {
  return (
    <Card className="flex flex-col p-3">
      <Preview kind={asset.preview} />
      <p className="mt-3 text-sm font-semibold text-ink">{asset.name}</p>
      <p className="mt-0.5 line-clamp-2 min-h-[2rem] text-xs text-muted">
        {asset.meta}
      </p>
      <div className="mt-3 flex gap-2">
        {asset.downloads.map((d) => (
          <button
            key={d}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-subtle px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-subtle-strong"
          >
            <Download className="h-3.5 w-3.5" /> {d}
          </button>
        ))}
      </div>
    </Card>
  );
}
