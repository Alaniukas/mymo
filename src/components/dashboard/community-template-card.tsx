"use client";

import {
  ThumbsUp,
  ThumbsDown,
  Download,
  Eye,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { nicheLabel } from "@/lib/carousel/niches";
import {
  communityTrendScore,
  type CommunityTemplate,
} from "@/lib/community/types";

interface CommunityTemplateCardProps {
  template: CommunityTemplate;
  onVote: (id: string, vote: 1 | -1) => void;
  onDownload: (id: string) => void;
  onPreview: (template: CommunityTemplate) => void;
  voting?: boolean;
  downloading?: boolean;
}

export function CommunityTemplateCard({
  template,
  onVote,
  onDownload,
  onPreview,
  voting,
  downloading,
}: CommunityTemplateCardProps) {
  const thumbUrl = template.slides?.[0]?.image_url ?? null;
  const slideCount = template.slides?.length ?? 0;
  const score = communityTrendScore(template);
  const isTrending = score >= 500;

  return (
    <div className="group relative bg-white border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200">
      <div className="aspect-square relative bg-gray-50">
        {thumbUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbUrl}
            alt={template.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-sm font-semibold text-[#999]">No preview</span>
          </div>
        )}

        {isTrending && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--ember)] text-white border border-black">
            <TrendingUp className="w-3 h-3" />
            Trending
          </span>
        )}

        <button
          type="button"
          onClick={() => onPreview(template)}
          className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 border border-black/20 hover:bg-white hover:border-black transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Preview full carousel"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">Preview</span>
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div>
          <h3 className="font-semibold text-sm line-clamp-1">{template.title}</h3>
          <p className="text-xs text-[#666] mt-0.5">
            by {template.author_name} · {nicheLabel(template.niche)} ·{" "}
            {slideCount} slides
          </p>
        </div>

        {template.description && (
          <p className="text-xs text-[#666] line-clamp-2">{template.description}</p>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={voting}
            onClick={() => onVote(template.id, 1)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border-2 transition-colors disabled:opacity-50",
              template.user_vote === 1
                ? "bg-[var(--ember)] text-white border-black"
                : "bg-white text-[#666] border-gray-200 hover:border-black",
            )}
          >
            {voting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ThumbsUp className="w-3 h-3" />
            )}
            {template.upvote_count}
          </button>

          <button
            type="button"
            disabled={voting}
            onClick={() => onVote(template.id, -1)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border-2 transition-colors disabled:opacity-50",
              template.user_vote === -1
                ? "bg-black text-white border-black"
                : "bg-white text-[#666] border-gray-200 hover:border-black",
            )}
          >
            <ThumbsDown className="w-3 h-3" />
            {template.downvote_count}
          </button>

          <button
            type="button"
            disabled={downloading}
            onClick={() => onDownload(template.id)}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-black text-white border-2 border-black hover:bg-[#333] transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            {template.download_count}
          </button>
        </div>
      </div>
    </div>
  );
}
