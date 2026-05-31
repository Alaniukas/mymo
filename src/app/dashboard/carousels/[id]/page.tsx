"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Send,
  AlertCircle,
  Trash2,
  Video as VideoIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SlideCard } from "@/components/dashboard/slide-card";
import { CarouselPreview } from "@/components/dashboard/carousel-preview";
import { VideoExportPanel } from "@/components/dashboard/video-export-panel";
import { PublishModal } from "@/components/dashboard/publish-modal";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { cn } from "@/lib/utils";

interface CarouselData {
  id: string;
  title: string;
  platform: string;
  status: string;
  slide_count: number;
  created_at: string;
  media_type?: string;
}

interface SlideData {
  id: string;
  position: number;
  caption: string;
  prompt: string;
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

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  both: "Both",
  linkedin: "LinkedIn",
  linkedin_pages: "LinkedIn Page",
  facebook: "Facebook",
  x: "X",
};

export default function CarouselDetailPage() {
  const params = useParams();
  const router = useRouter();
  const carouselId = params.id as string;
  const { activeProjectId } = useActiveProject();

  const [carousel, setCarousel] = useState<CarouselData | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingSlide, setRegeneratingSlide] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!activeProjectId) return;
    const supabase = createClient();

    const [carouselRow, connectionsRes] = await Promise.all([
      supabase
        .from("carousels")
        .select("id, title, platform, status, slide_count, created_at")
        .eq("id", carouselId)
        .eq("workspace_id", activeProjectId)
        .single(),
      supabase
        .from("social_connections")
        .select("id, platform, platform_username")
        .eq("workspace_id", activeProjectId),
    ]);

    if (carouselRow.data) {
      setCarousel(carouselRow.data);
    }
    setConnections(connectionsRes.data ?? []);

    // Load slides via the status API (handles task polling + image uploads)
    try {
      const statusRes = await fetch(`/api/carousel-status/${carouselId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setSlides(data.slides ?? []);
        if (carouselRow.data) {
          setCarousel((prev) =>
            prev
              ? { ...prev, status: data.status, media_type: data.media_type }
              : prev,
          );
        }
        if (data.status === "generating") {
          startPolling();
        }
      }
    } catch {
      // status API failed, load slides directly as fallback
      const { data: directSlides } = await supabase
        .from("carousel_slides")
        .select("id, position, prompt, image_url, status")
        .eq("carousel_id", carouselId)
        .order("position", { ascending: true });

      if (directSlides) {
        setSlides(
          directSlides.map((s) => ({
            ...s,
            caption: "",
            prompt: s.prompt ?? "",
            video_url: null,
            video_status: null,
          })),
        );
      }
    }

    setLoading(false);
  }, [carouselId, activeProjectId]);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/carousel-status/${carouselId}`);
        if (!res.ok) return;
        const data = await res.json();
        setSlides(data.slides ?? []);
        setCarousel((prev) =>
          prev
            ? { ...prev, status: data.status, media_type: data.media_type }
            : prev,
        );
        if (data.status !== "generating") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // retry on next interval
      }
    }, 4000);
  }

  async function handleDelete() {
    if (
      !confirm(
        "Delete this carousel and all its slides? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/carousel/${carouselId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete carousel");
        return;
      }

      router.push("/dashboard/carousels");
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    loadData();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]);

  async function handleRegenerate(slideId: string) {
    setRegeneratingSlide(slideId);
    setError(null);

    try {
      const res = await fetch(
        `/api/carousel/${carouselId}/regenerate-slide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slide_id: slideId }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Regeneration failed");
        return;
      }

      const isVideoCarousel = carousel?.media_type === "video";
      setSlides((prev) =>
        prev.map((s) =>
          s.id === slideId
            ? isVideoCarousel
              ? { ...s, video_status: "pending", video_url: null }
              : { ...s, status: "generating", image_url: null }
            : s,
        ),
      );
      // Carousel is working again — resume polling and the status label.
      setCarousel((prev) => (prev ? { ...prev, status: "generating" } : prev));
      startPolling();
    } catch {
      setError("Network error");
    } finally {
      setRegeneratingSlide(null);
    }
  }

  function handlePublished(platform: string) {
    setSuccess(`Published to ${platformLabels[platform] ?? platform}!`);
    setCarousel((prev) => (prev ? { ...prev, status: "published" } : prev));
  }

  if (!activeProjectId) {
    return <NoProjectNotice />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
      </div>
    );
  }

  if (!carousel) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold mb-2">Carousel not found</h2>
        <button
          type="button"
          onClick={() => router.push("/dashboard/carousels")}
          className="text-[var(--ember)] font-medium hover:underline"
        >
          Back to Carousels
        </button>
      </div>
    );
  }

  const isVideo = carousel.media_type === "video";
  // Video carousels export by concatenating the finished per-slide CLIPS into one
  // reel, so eligibility counts completed clips. Image carousels stitch the
  // completed slide IMAGES into a slideshow.
  const exportEligibleCount = isVideo
    ? slides.filter((s) => s.video_status === "completed" && s.video_url).length
    : slides.filter((s) => s.status === "completed" && s.image_url).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/carousels")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight line-clamp-1">
            {carousel.title}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-[#666]">
            <span>{platformLabels[carousel.platform]}</span>
            {isVideo && (
              <>
                <span>&middot;</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  <VideoIcon className="w-3 h-3" /> Video
                </span>
              </>
            )}
            <span>&middot;</span>
            <span>{slides.length} slides</span>
            <span>&middot;</span>
            <span
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                carousel.status === "ready"
                  ? "bg-green-100 text-green-700"
                  : carousel.status === "published"
                    ? "bg-blue-100 text-blue-700"
                    : carousel.status === "generating"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600",
              )}
            >
              {carousel.status}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPublish(true)}
          className="px-5 py-2 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white text-sm font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] flex items-center gap-2 shrink-0"
        >
          <Send className="w-4 h-4" />
          Post
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 rounded-lg border-2 border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Delete
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold mb-3">Preview</h2>
          <CarouselPreview slides={slides} mediaType={carousel.media_type} />

          <VideoExportPanel
            carouselId={carouselId}
            eligibleCount={exportEligibleCount}
            mode={isVideo ? "clips" : "slideshow"}
          />

          <button
            type="button"
            onClick={() => setShowPublish(true)}
            className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold border-2 border-black shadow-[2px_2px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] flex items-center justify-center gap-2 bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white"
          >
            <Send className="w-4 h-4" />
            Post carousel
          </button>
        </div>

        {/* Slides Grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Slides</h2>
            {carousel.status === "generating" && (
              <div className="flex items-center gap-2 text-sm text-yellow-700">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isVideo ? "Animating..." : "Generating..."}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {slides.map((s) => (
              <SlideCard
                key={s.id}
                position={s.position}
                caption={s.caption}
                prompt={s.prompt}
                imageUrl={s.image_url}
                status={s.status}
                mediaType={carousel.media_type}
                videoUrl={s.video_url}
                videoStatus={s.video_status}
                downloadUrl={isVideo ? s.video_url : undefined}
                onRegenerate={() => handleRegenerate(s.id)}
                regenerating={regeneratingSlide === s.id}
              />
            ))}
          </div>
        </div>
      </div>

      {showPublish && (
        <PublishModal
          carouselId={carouselId}
          mediaType={carousel.media_type}
          slides={slides}
          connections={connections}
          onClose={() => setShowPublish(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
