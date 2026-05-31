"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Download,
  Music,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Video as VideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoExportPanelProps {
  carouselId: string;
  /** Completed slides/clips available to stitch into the video. */
  eligibleCount: number;
  /**
   * "clips" → concatenate finished per-slide video clips into one reel (their
   * lengths are fixed, so no duration control). "slideshow" → still-image
   * slideshow with an adjustable per-slide duration. Defaults to "slideshow".
   */
  mode?: "clips" | "slideshow";
}

interface MusicSummary {
  title: string | null;
  author: string | null;
}

const MIN_SECONDS = 5;
const MAX_SECONDS = 60;

const clampLength = (n: number) =>
  Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(n)));

export function VideoExportPanel({
  carouselId,
  eligibleCount,
  mode = "slideshow",
}: VideoExportPanelProps) {
  const isClips = mode === "clips";
  const [music, setMusic] = useState<MusicSummary | null>(null);
  const [includeMusic, setIncludeMusic] = useState(false);
  const [totalLength, setTotalLength] = useState(() =>
    clampLength(eligibleCount * 3),
  );
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load any music attached to the carousel + a previously exported video.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/carousel/${carouselId}/export-video`);
        if (!res.ok || !active) return;
        const data = await res.json();
        if (!active) return;
        if (data.music?.available) {
          setMusic({ title: data.music.title, author: data.music.author });
          setIncludeMusic(true);
        }
        const opts = data.export?.options;
        if (typeof opts?.total_length_seconds === "number") {
          setTotalLength(clampLength(opts.total_length_seconds));
        }
        if (data.export?.status === "ready" && data.export?.url) {
          setVideoUrl(data.export.url);
        }
      } catch {
        // keep defaults; the user can still render
      }
    })();
    return () => {
      active = false;
    };
  }, [carouselId]);

  async function handleCreate() {
    setRendering(true);
    setError(null);
    try {
      const res = await fetch(`/api/carousel/${carouselId}/export-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_length_seconds: totalLength,
          include_music: includeMusic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create video");
        return;
      }
      setVideoUrl(`${data.url}?t=${Date.now()}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setRendering(false);
    }
  }

  const perSlide = (totalLength / Math.max(eligibleCount, 1)).toFixed(1);

  return (
    <div className="mt-4 bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0_0_#000]">
      <div className="flex items-start gap-2">
        <VideoIcon className="w-4 h-4 mt-0.5 shrink-0 text-[var(--ember)]" />
        <div>
          <p className="text-sm font-semibold leading-tight">Export as video</p>
          <p className="text-[11px] text-[#666] leading-tight mt-0.5">
            {isClips
              ? "Stitch the hook + your clips into one downloadable MP4."
              : "Combine the slides into one downloadable MP4."}
          </p>
        </div>
      </div>

      {eligibleCount === 0 ? (
        <p className="mt-3 text-xs text-[#666]">
          {isClips
            ? "Finish generating the reel — then you can export it as one video."
            : "Generate slides first — then you can export them as a video."}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {videoUrl && (
            <div className="space-y-2">
              <div className="rounded-lg overflow-hidden border-2 border-black bg-black">
                <video
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  loop
                  playsInline
                  className="w-full max-h-[380px] object-contain"
                />
              </div>
              <a
                href={videoUrl}
                download={`carousel-${carouselId}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 rounded-lg text-sm font-semibold border-2 border-black shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] flex items-center justify-center gap-2 bg-white"
              >
                <Download className="w-4 h-4" />
                Download MP4
              </a>
            </div>
          )}

          {isClips ? (
            <p className="text-[11px] text-[#666] leading-snug">
              Plays your AI hook clip first, then each app clip in order — one
              continuous reel at its natural length.
            </p>
          ) : (
            <div>
              <label
                htmlFor="export-length"
                className="flex items-center justify-between text-xs font-semibold"
              >
                <span>Video length</span>
                <span className="text-[#666] font-normal">
                  {totalLength}s · ~{perSlide}s / slide
                </span>
              </label>
              <input
                id="export-length"
                type="range"
                min={MIN_SECONDS}
                max={MAX_SECONDS}
                value={totalLength}
                onChange={(e) => setTotalLength(Number(e.target.value))}
                disabled={rendering}
                className="w-full mt-2 accent-[var(--ember)]"
              />
              <div className="flex justify-between text-[10px] text-[#999] mt-0.5">
                <span>{MIN_SECONDS}s</span>
                <span>{MAX_SECONDS}s</span>
              </div>
            </div>
          )}

          {music && (
            <div className="flex items-start justify-between gap-3 rounded-lg border-2 border-black bg-white px-3 py-2.5 shadow-[2px_2px_0_0_#000]">
              <div className="flex items-start gap-2 min-w-0">
                <Music className="w-4 h-4 mt-0.5 shrink-0 text-[var(--ember)]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">Add sound</p>
                  <p className="text-[11px] text-[#666] leading-tight mt-0.5 truncate">
                    {music.title ?? "Trending sound"}
                    {music.author ? ` · ${music.author}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={includeMusic}
                aria-label="Add sound to the video"
                onClick={() => setIncludeMusic((v) => !v)}
                disabled={rendering}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-black transition-colors disabled:opacity-50",
                  includeMusic ? "bg-[var(--ember)]" : "bg-gray-200",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3 w-3 rounded-full bg-white border border-black transition-transform",
                    includeMusic ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={rendering}
            className="w-full py-2.5 rounded-lg text-sm font-semibold border-2 border-black shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] disabled:opacity-50 flex items-center justify-center gap-2 bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white"
          >
            {rendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering… (up to a minute)
              </>
            ) : videoUrl ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Re-create video
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Create video
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
