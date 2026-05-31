"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Send,
  AlertCircle,
  Music,
  ExternalLink,
  CheckCircle2,
  Link2,
  CalendarClock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { CarouselPreview } from "@/components/dashboard/carousel-preview";
import {
  platformConfig,
  type ConnectPlatform,
} from "@/components/dashboard/social-connect-card";
import { cn } from "@/lib/utils";

interface SlideData {
  id: string;
  position: number;
  caption?: string;
  image_url: string | null;
  video_url: string | null;
  video_status: string | null;
  status: string;
}

interface SocialConnection {
  id: string;
  platform: string;
  platform_username: string | null;
}

interface PublishModalProps {
  carouselId: string;
  mediaType?: string;
  slides: SlideData[];
  connections: SocialConnection[];
  onClose: () => void;
  onPublished: (platform: string) => void;
}

function platformName(platform: string): string {
  return platformConfig[platform as ConnectPlatform]?.name ?? platform;
}

/** Small colored badge reusing the connect card's brand icon. */
function PlatformBadge({ platform }: { platform: string }) {
  const cfg = platformConfig[platform as ConnectPlatform];
  if (!cfg) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md [&>svg]:h-3 [&>svg]:w-3",
        cfg.color,
      )}
    >
      {cfg.icon}
    </span>
  );
}

export function PublishModal({
  carouselId,
  mediaType,
  slides,
  connections,
  onClose,
  onPublished,
}: PublishModalProps) {
  const router = useRouter();
  const isVideo = mediaType === "video";

  const completedSlides = isVideo
    ? slides.filter((s) => s.video_status === "completed" && s.video_url)
    : slides.filter((s) => s.status === "completed" && s.image_url);
  const total = slides.length;
  const readyCount = completedSlides.length;
  const allComplete = total > 0 && readyCount === total;

  // Only accounts we have publishing UI/icons for can be picked here.
  const publishable = connections.filter((c) => c.platform in platformConfig);

  const [platform, setPlatform] = useState<string | null>(
    publishable[0]?.platform ?? null,
  );
  const [caption, setCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(true);
  const [autoAddMusic, setAutoAddMusic] = useState(true);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    platform: string;
    url: string | null;
    scheduledFor: string | null;
  } | null>(null);

  // Prefill with the same caption publishing would use by default.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/publish/${carouselId}`);
        if (res.ok && active) {
          const data = await res.json();
          if (typeof data.caption === "string") setCaption(data.caption);
        }
      } catch {
        // leave the editor empty; the user can write their own caption
      } finally {
        if (active) setCaptionLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [carouselId]);

  async function handlePublish() {
    if (!platform) return;
    const connection = publishable.find((c) => c.platform === platform);
    if (!connection) {
      setError("That account is no longer connected.");
      return;
    }

    let scheduledForIso: string | undefined;
    if (scheduleMode) {
      if (!scheduledAt) {
        setError("Pick a date and time to schedule.");
        return;
      }
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        setError("Pick a valid date and time to schedule.");
        return;
      }
      // The server enforces the "at least a minute in the future" rule and
      // returns a clear error, so no clock read is needed here.
      scheduledForIso = when.toISOString();
    }

    setPublishing(true);
    setError(null);

    try {
      const res = await fetch(`/api/publish/${carouselId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          social_connection_id: connection.id,
          auto_add_music: autoAddMusic,
          caption: caption.trim(),
          ...(scheduledForIso ? { scheduled_for: scheduledForIso } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Publishing failed");
        return;
      }

      setResult({
        platform,
        url: data.post_url ?? null,
        scheduledFor: data.scheduled_for ?? null,
      });
      onPublished(platform);
    } catch {
      setError("Network error");
    } finally {
      setPublishing(false);
    }
  }

  const noneReady = readyCount === 0;
  const canPublish =
    !!platform && !noneReady && !captionLoading && !publishing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={publishing ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg bg-white border-2 border-black rounded-xl shadow-[6px_6px_0_0_#000] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black">
          <div>
            <h2 className="text-lg font-bold">
              {result ? (result.scheduledFor ? "Scheduled!" : "Posted!") : "Post carousel"}
            </h2>
            <p className="text-xs text-[#666] mt-0.5">
              {result
                ? result.scheduledFor
                  ? "Your carousel is queued to publish automatically."
                  : "Your carousel is on its way."
                : "Review and publish to a connected account."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="space-y-4 text-center py-2">
              {result.scheduledFor ? (
                <CalendarClock className="w-12 h-12 mx-auto text-[var(--ember)]" />
              ) : (
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
              )}
              <p className="text-sm text-[#444]">
                {result.scheduledFor ? (
                  <>
                    Scheduled for{" "}
                    <span className="font-semibold">
                      {new Date(result.scheduledFor).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>{" "}
                    on{" "}
                    <span className="font-semibold">
                      {platformName(result.platform)}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    Published to{" "}
                    <span className="font-semibold">
                      {platformName(result.platform)}
                    </span>
                    .
                  </>
                )}
              </p>
              {result.url && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ember)] hover:underline"
                >
                  <ExternalLink className="w-4 h-4" /> View post
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-black text-white text-sm font-semibold border-2 border-black shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000]"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <CarouselPreview
                slides={slides}
                mediaType={mediaType}
                className="max-w-[220px] mx-auto"
              />

              {!allComplete && !noneReady && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Only the {readyCount} finished {isVideo ? "clip" : "slide"}
                    {readyCount === 1 ? "" : "s"} of {total} will be posted.
                    Regenerate the rest first if you want them included.
                  </span>
                </div>
              )}

              {noneReady && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Nothing is ready to post yet — wait for the{" "}
                    {isVideo ? "clips" : "slides"} to finish generating.
                  </span>
                </div>
              )}

              {publishable.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 text-center">
                  <Link2 className="w-6 h-6 mx-auto text-[#999] mb-2" />
                  <p className="text-sm font-medium">No accounts connected</p>
                  <p className="text-xs text-[#666] mt-0.5 mb-3">
                    Connect a social account to publish your carousel.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/connections")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white text-sm font-semibold border-2 border-black shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000]"
                  >
                    Go to Connections
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#666] mb-1.5">
                      Post to
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {publishable.map((conn) => {
                        const selected = platform === conn.platform;
                        return (
                          <button
                            key={conn.id}
                            type="button"
                            onClick={() => setPlatform(conn.platform)}
                            className={cn(
                              "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors",
                              selected
                                ? "bg-black text-white border-black"
                                : "bg-white text-[#444] border-gray-200 hover:border-black",
                            )}
                          >
                            <PlatformBadge platform={conn.platform} />
                            <span className="truncate max-w-[140px]">
                              {platformName(conn.platform)}
                              {conn.platform_username
                                ? ` · ${conn.platform_username}`
                                : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#666] mb-1.5">
                      Caption
                    </label>
                    {captionLoading ? (
                      <div className="flex items-center gap-2 px-3 py-3 border-2 border-black rounded-lg text-sm text-[#666]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading caption…
                      </div>
                    ) : (
                      <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        rows={5}
                        placeholder="Write a caption…"
                        className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
                      />
                    )}
                  </div>

                  {platform === "tiktok" && !isVideo && (
                    <div className="flex items-start justify-between gap-3 rounded-lg border-2 border-black bg-white px-3 py-2.5 shadow-[2px_2px_0_0_#000]">
                      <div className="flex items-start gap-2">
                        <Music className="w-4 h-4 mt-0.5 shrink-0 text-[var(--ember)]" />
                        <div>
                          <p className="text-xs font-semibold leading-tight">
                            Auto-add music (TikTok)
                          </p>
                          <p className="text-[11px] text-[#666] leading-tight mt-0.5">
                            Let TikTok drop a trending track on the post.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoAddMusic}
                        aria-label="Auto-add music on TikTok"
                        onClick={() => setAutoAddMusic((v) => !v)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-black transition-colors",
                          autoAddMusic ? "bg-[var(--ember)]" : "bg-gray-200",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 rounded-full bg-white border border-black transition-transform",
                            autoAddMusic ? "translate-x-4" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </div>
                  )}

                  <div className="rounded-lg border-2 border-black bg-white px-3 py-2.5 shadow-[2px_2px_0_0_#000]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <CalendarClock className="w-4 h-4 mt-0.5 shrink-0 text-[var(--ember)]" />
                        <div>
                          <p className="text-xs font-semibold leading-tight">
                            Schedule for later
                          </p>
                          <p className="text-[11px] text-[#666] leading-tight mt-0.5">
                            Queue it to publish automatically at a set time.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={scheduleMode}
                        aria-label="Schedule for later"
                        onClick={() => setScheduleMode((v) => !v)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-black transition-colors",
                          scheduleMode ? "bg-[var(--ember)]" : "bg-gray-200",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 rounded-full bg-white border border-black transition-transform",
                            scheduleMode ? "translate-x-4" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </div>
                    {scheduleMode && (
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="mt-2.5 w-full rounded-lg border-2 border-black/15 px-3 py-2 text-sm focus:border-black focus:outline-none"
                      />
                    )}
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {publishable.length > 0 && (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!canPublish}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold border-2 border-black shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-2 bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white"
                >
                  {publishing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : scheduleMode ? (
                    <CalendarClock className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {publishing
                    ? scheduleMode
                      ? "Scheduling…"
                      : "Publishing…"
                    : `${scheduleMode ? "Schedule for" : "Publish to"} ${platform ? platformName(platform) : "…"}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
