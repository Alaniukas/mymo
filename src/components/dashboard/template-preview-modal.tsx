"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TemplatePreviewSlide {
  position: number;
  image_url: string;
  /** Present when this slide was a video in the original post. */
  video_url?: string | null;
}

export interface TemplatePreviewData {
  title: string;
  caption?: string | null;
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
  slides: TemplatePreviewSlide[];
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

/**
 * Full-screen lightbox that plays back an imported carousel exactly as it
 * appeared in the source post: every slide, uncropped (object-contain),
 * swipeable, alongside the original caption and a link back to the post.
 */
export function TemplatePreviewModal({
  title,
  caption,
  sourceUrl,
  sourcePlatform,
  slides,
  onClose,
}: TemplatePreviewData & { onClose: () => void }) {
  // Defend against unordered slide arrays so playback always matches the post.
  const ordered = [...slides].sort((a, b) => a.position - b.position);
  const count = ordered.length;
  const [current, setCurrent] = useState(0);

  const go = useCallback(
    (dir: 1 | -1) => setCurrent((prev) => (prev + dir + count) % count),
    [count],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (count === 0) return null;

  const slide = ordered[Math.min(current, count - 1)];
  const platformLabel = sourcePlatform
    ? PLATFORM_LABELS[sourcePlatform] ?? sourcePlatform
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border-2 border-black rounded-xl shadow-[6px_6px_0_0_#000] max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-black">
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">{title}</h2>
            <p className="text-xs text-[#666] mt-0.5">
              Original post · {count} slide{count === 1 ? "" : "s"}
              {platformLabel ? ` · ${platformLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Slide stage — media shown fully (uncropped), as in the source post.
              Video slides play back the original clip; image slides show the
              full still. */}
          <div className="relative bg-black flex items-center justify-center">
            {slide.video_url ? (
              <video
                key={slide.position}
                src={slide.video_url}
                poster={slide.image_url}
                controls
                loop
                playsInline
                className="max-h-[64vh] max-w-full w-auto object-contain bg-black"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={slide.position}
                src={slide.image_url}
                alt={`Slide ${slide.position}`}
                className="max-h-[64vh] max-w-full w-auto object-contain"
              />
            )}

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border-2 border-black flex items-center justify-center hover:bg-white transition-colors"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border-2 border-black flex items-center justify-center hover:bg-white transition-colors"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-black/70 text-white">
                  {current + 1} / {count}
                </span>
              </>
            )}
          </div>

          {count > 1 && (
            <div className="flex flex-wrap justify-center gap-1.5 px-4 py-3 border-b border-gray-100">
              {ordered.map((s, i) => (
                <button
                  key={s.position}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === current ? "bg-black" : "bg-gray-300 hover:bg-gray-400",
                  )}
                />
              ))}
            </div>
          )}

          {(caption || sourceUrl) && (
            <div className="px-5 py-4 space-y-3">
              {caption && (
                <p className="text-sm text-[#444] whitespace-pre-wrap break-words">
                  {caption}
                </p>
              )}
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ember)] hover:underline"
                >
                  <ExternalLink className="w-4 h-4" /> View original post
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
