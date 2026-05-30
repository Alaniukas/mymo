"use client";

import type { LucideIcon } from "lucide-react";
import type { CommunityTemplate } from "@/lib/community/types";

interface CommunityHighlightCardProps {
  label: string;
  template: CommunityTemplate;
  metric: string;
  icon: LucideIcon;
  onSelect?: () => void;
}

export function CommunityHighlightCard({
  label,
  template,
  metric,
  icon: Icon,
  onSelect,
}: CommunityHighlightCardProps) {
  const thumb = template.slides?.[0]?.image_url;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_#000] w-full"
    >
      <div className="flex gap-0">
        <div className="w-[88px] shrink-0 aspect-square bg-gray-100">
          {thumb ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumb}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
          )}
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-xs font-medium text-[#666]">{label}</span>
            <div className="w-7 h-7 rounded-md bg-[var(--ember)]/10 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-[var(--ember)]" />
            </div>
          </div>
          <p className="text-sm font-bold leading-snug line-clamp-2">
            {template.title}
          </p>
          <p className="text-xs font-semibold text-[var(--ember)] mt-1">
            {metric}
          </p>
        </div>
      </div>
    </button>
  );
}
