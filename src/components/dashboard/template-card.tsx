"use client";

import {
  LayoutTemplate,
  Globe,
  Trash2,
  Loader2,
  Check,
  Sparkles,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TemplateCardItem =
  | {
      kind: "preset";
      id: string;
      title: string;
      description: string;
      slideCount: number;
      gradient: string;
      thumbnail?: string;
    }
  | {
      kind: "real";
      id: string;
      title: string;
      slideCount: number;
      thumbUrl: string | null;
      isGlobal: boolean;
      canDelete: boolean;
    };

interface TemplateCardProps {
  item: TemplateCardItem;
  selected: boolean;
  onSelect: () => void;
  /** Opens a full, uncropped preview of every slide. Only for real templates. */
  onPreview?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export function TemplateCard({
  item,
  selected,
  onSelect,
  onPreview,
  onDelete,
  deleting,
}: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative text-left bg-white border-2 rounded-xl overflow-hidden transition-[transform,box-shadow,border-color] duration-200",
        selected
          ? "border-[var(--ember)] ring-2 ring-[var(--ember)] shadow-[3px_3px_0_0_var(--ember)]"
          : "border-black shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]",
      )}
    >
      {selected && (
        <span className="absolute top-2 right-2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[var(--ember)] text-white border-2 border-black">
          <Check className="w-3.5 h-3.5" />
        </span>
      )}

      <div className="aspect-square relative bg-gray-50">
        {item.kind === "preset" ? (
          item.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.thumbnail}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "w-full h-full bg-gradient-to-br flex flex-col items-center justify-center gap-2 p-3 text-white text-center",
                item.gradient,
              )}
            >
              <LayoutTemplate className="w-8 h-8 opacity-90" />
              <span className="text-sm font-bold leading-tight drop-shadow-sm">
                {item.title}
              </span>
            </div>
          )
        ) : item.thumbUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.thumbUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <LayoutTemplate className="w-10 h-10 text-[#ccc]" />
          </div>
        )}

        {item.kind === "preset" && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-black border border-black/20">
            <Sparkles className="w-3 h-3 text-[var(--ember)]" />
            Starter
          </span>
        )}

        {item.kind === "real" && item.isGlobal && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/70 text-white">
            <Globe className="w-3 h-3" />
            Global
          </span>
        )}

        {item.kind === "real" && onPreview && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onPreview();
              }
            }}
            className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 border border-black/20 hover:bg-white hover:border-black transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Preview full carousel"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">Preview</span>
          </span>
        )}

        {item.kind === "real" && item.canDelete && onDelete && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onDelete();
              }
            }}
            className="absolute bottom-2 right-2 z-10 p-1.5 rounded-md bg-white/90 border border-black/20 hover:bg-red-50 hover:border-red-300 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Delete template"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            )}
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-1">{item.title}</h3>
        {item.kind === "preset" ? (
          <p className="text-xs text-[#666] mt-0.5 line-clamp-2">
            {item.description}
          </p>
        ) : null}
        <p className="text-xs text-[#666] mt-1">{item.slideCount} slides</p>
      </div>
    </button>
  );
}
