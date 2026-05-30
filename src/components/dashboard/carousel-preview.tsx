"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Slide {
  id: string;
  position: number;
  caption?: string;
  image_url: string | null;
  video_url?: string | null;
  video_status?: string | null;
  status: string;
}

interface CarouselPreviewProps {
  slides: Slide[];
  mediaType?: string;
  className?: string;
}

export function CarouselPreview({
  slides,
  mediaType,
  className,
}: CarouselPreviewProps) {
  const [current, setCurrent] = useState(0);

  const isVideo = mediaType === "video";

  const completedSlides = isVideo
    ? slides.filter((s) => s.video_status === "completed" && s.video_url)
    : slides.filter((s) => s.status === "completed" && s.image_url);

  if (completedSlides.length === 0) {
    return (
      <div
        className={cn(
          "bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center aspect-square",
          className,
        )}
      >
        <span className="text-sm text-[#999]">
          {isVideo ? "No clips ready yet" : "No slides ready yet"}
        </span>
      </div>
    );
  }

  const slide = completedSlides[Math.min(current, completedSlides.length - 1)];

  return (
    <div className={cn("relative", className)}>
      <div className="aspect-square rounded-xl overflow-hidden border-2 border-black shadow-[4px_4px_0_0_#000] relative">
        {isVideo ? (
          <video
            key={slide.id}
            src={slide.video_url!}
            poster={slide.image_url ?? undefined}
            controls
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={slide.image_url!}
            alt={`Slide ${slide.position}`}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {completedSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() =>
              setCurrent((prev) =>
                prev === 0 ? completedSlides.length - 1 : prev - 1,
              )
            }
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border-2 border-black flex items-center justify-center shadow-sm hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrent((prev) =>
                prev === completedSlides.length - 1 ? 0 : prev + 1,
              )
            }
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border-2 border-black flex items-center justify-center shadow-sm hover:bg-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {completedSlides.map((_, i) => (
              <button
                key={completedSlides[i].id}
                type="button"
                onClick={() => setCurrent(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === current ? "bg-white" : "bg-white/50",
                )}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-2 text-center text-xs text-[#666]">
        {Math.min(current, completedSlides.length - 1) + 1} /{" "}
        {completedSlides.length}
      </div>
    </div>
  );
}
