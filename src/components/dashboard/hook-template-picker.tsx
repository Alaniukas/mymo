"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { HookTemplateKind } from "@/lib/hook-templates/types";

export interface HookTemplateOption {
  id: string;
  title: string;
  hook_line: string;
  preview_image_url: string | null;
  preview_video_url: string | null;
  kind: HookTemplateKind;
}

interface HookTemplatePickerProps {
  templates: HookTemplateOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxSelect?: number;
  loading?: boolean;
  readOnly?: boolean;
  /** Autoplay preview videos (muted, looped). Defaults to true in read-only gallery mode. */
  autoPlay?: boolean;
  /** Larger cards for the template library gallery. */
  variant?: "compact" | "gallery";
}

function HookPreviewVideo({
  src,
  autoPlay,
  poster,
}: {
  src: string;
  autoPlay: boolean;
  poster?: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !autoPlay) return;
    el.muted = true;
    void el.play().catch(() => {
      // Autoplay may be blocked until user interaction; keep muted poster frame.
    });
  }, [src, autoPlay]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      className="h-full w-full object-cover"
      muted
      loop
      playsInline
      autoPlay={autoPlay}
      preload="auto"
    />
  );
}

function isOptimizableImageUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".supabase.co") || host.endsWith(".evolink.ai");
  } catch {
    return false;
  }
}

export function HookTemplatePicker({
  templates,
  selectedIds,
  onChange,
  maxSelect = 5,
  loading = false,
  readOnly = false,
  autoPlay,
  variant = "compact",
}: HookTemplatePickerProps) {
  const playVideos = autoPlay ?? readOnly;
  const gallery = variant === "gallery";

  function toggle(id: string) {
    if (readOnly) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= maxSelect) return;
    onChange([...selectedIds, id]);
  }

  if (loading) {
    return (
      <p className="text-sm text-[#666] py-4 text-center">Loading hooks…</p>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/20 bg-white/60 px-4 py-6 text-center text-sm text-[#666]">
        No hooks in this library yet. Ask an admin to add them in Admin → Hook
        library.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3",
        gallery ? "sm:grid-cols-2 sm:gap-5" : "sm:grid-cols-2",
      )}
    >
      {templates.map((t) => {
        const selected = selectedIds.includes(t.id);
        const thumb = t.preview_video_url || t.preview_image_url;
        return (
          <button
            key={t.id}
            type="button"
            disabled={readOnly}
            onClick={() => toggle(t.id)}
            className={cn(
              "flex gap-3 rounded-xl border-2 text-left transition",
              gallery ? "gap-4 p-4 sm:gap-5 sm:p-5" : "gap-3 p-3",
              selected
                ? "border-[var(--ember)] bg-[var(--ember)]/5 shadow-[2px_2px_0_0_#000]"
                : "border-black/15 bg-white hover:border-black/40",
              readOnly && "cursor-default hover:border-black/15",
            )}
          >
            <div
              className={cn(
                "relative shrink-0 overflow-hidden rounded-lg bg-black/5",
                gallery ? "h-36 w-24 sm:h-44 sm:w-[7.5rem]" : "h-20 w-14",
              )}
            >
              {thumb ? (
                t.preview_video_url ? (
                  <HookPreviewVideo
                    src={t.preview_video_url}
                    autoPlay={playVideos}
                    poster={t.preview_image_url}
                  />
                ) : t.preview_image_url &&
                  isOptimizableImageUrl(t.preview_image_url) ? (
                  <Image
                    src={t.preview_image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes={gallery ? "(max-width: 640px) 96px, 120px" : "56px"}
                  />
                ) : t.preview_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.preview_image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null
              ) : (
                <div
                  className={cn(
                    "flex h-full items-center justify-center text-[#999]",
                    gallery ? "text-xs" : "text-[10px]",
                  )}
                >
                  Hook
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-bold truncate",
                  gallery ? "text-base sm:text-lg" : "text-sm",
                )}
              >
                {t.title}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[#555] line-clamp-2",
                  gallery ? "mt-1 text-sm sm:text-base" : "text-xs",
                )}
              >
                &ldquo;{t.hook_line}&rdquo;
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
