"use client";

import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Download,
  Video as VideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideCardProps {
  position: number;
  caption?: string;
  prompt: string;
  imageUrl: string | null;
  status: string;
  mediaType?: string;
  videoUrl?: string | null;
  videoStatus?: string | null;
  downloadUrl?: string | null;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

const statusStyles: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  generating: "bg-yellow-100 text-yellow-700",
  animating: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
};

export function SlideCard({
  position,
  caption,
  prompt,
  imageUrl,
  status,
  mediaType,
  videoUrl,
  videoStatus,
  downloadUrl,
  onRegenerate,
  regenerating,
}: SlideCardProps) {
  const isVideo = mediaType === "video";
  const imageReady = status === "completed" && Boolean(imageUrl);
  const videoReady = isVideo && videoStatus === "completed" && Boolean(videoUrl);
  const videoFailed = isVideo && videoStatus === "failed";
  // Image is done but the clip is still pending/in-flight.
  const animating = isVideo && imageReady && !videoReady && !videoFailed;

  const displayStatus = videoReady
    ? "completed"
    : videoFailed
      ? "failed"
      : animating
        ? "animating"
        : status;

  // Caption text is now burned into the generated image/clip itself, so we no
  // longer draw a separate HTML overlay here (it would double the text).
  return (
    <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000] flex flex-col">
      <div className="aspect-square relative bg-gray-50">
        {videoReady ? (
          <>
            <video
              src={videoUrl!}
              poster={imageUrl ?? undefined}
              controls
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </>
        ) : animating ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl!}
              alt={`Slide ${position}`}
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
              <Loader2 className="w-7 h-7 animate-spin text-white" />
              <span className="text-xs font-semibold text-white drop-shadow">
                Animating…
              </span>
            </div>
          </>
        ) : videoFailed ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <span className="text-xs text-red-600">Clip failed</span>
          </div>
        ) : imageReady ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl!}
              alt={`Slide ${position}`}
              className="w-full h-full object-cover"
            />
          </>
        ) : status === "generating" ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--ember)]" />
            <span className="text-xs text-[#666]">Generating...</span>
          </div>
        ) : status === "failed" ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <span className="text-xs text-red-600">Failed</span>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-[#999]">Pending</span>
          </div>
        )}

        <span className="absolute top-2 left-2 text-xs font-bold bg-black/70 text-white px-2 py-0.5 rounded">
          {position}
        </span>
        {isVideo && (
          <span className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1">
            <VideoIcon className="w-3 h-3" />
          </span>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <p className="text-xs leading-relaxed text-[#666] line-clamp-3 flex-1">
          {caption || prompt}
        </p>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
          <span
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full",
              statusStyles[displayStatus] ?? statusStyles.pending,
            )}
          >
            {displayStatus}
          </span>

          <div className="flex items-center gap-1">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                title="Download"
              >
                <Download className="w-3.5 h-3.5 text-[#666]" />
              </a>
            )}

            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={regenerating}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                title={isVideo ? "Re-animate this slide" : "Regenerate this slide"}
              >
                {regenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#666]" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-[#666]" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
