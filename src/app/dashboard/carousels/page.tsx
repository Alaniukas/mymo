"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Image as ImageIcon,
  Trash2,
  Video as VideoIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";

interface Carousel {
  id: string;
  title: string;
  platform: string;
  status: string;
  slide_count: number;
  created_at: string;
  media_type: string;
  first_slide_url: string | null;
}

const statusStyles: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  generating: "bg-yellow-100 text-yellow-700",
  ready: "bg-green-100 text-green-700",
  published: "bg-blue-100 text-blue-700",
};

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  both: "Both",
};

export default function CarouselsPage() {
  const { activeProjectId } = useActiveProject();
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCarousels = useCallback(async () => {
    if (!activeProjectId) return;
    const supabase = createClient();

    // media_type was added in migration 005; fall back gracefully if absent.
    const baseCols = "id, title, platform, status, slide_count, created_at";
    let rows: Record<string, unknown>[] | null = null;

    const withMedia = await supabase
      .from("carousels")
      .select(`${baseCols}, media_type`)
      .eq("workspace_id", activeProjectId)
      .order("created_at", { ascending: false });

    if (withMedia.error) {
      const basic = await supabase
        .from("carousels")
        .select(baseCols)
        .eq("workspace_id", activeProjectId)
        .order("created_at", { ascending: false });
      rows = basic.data as Record<string, unknown>[] | null;
    } else {
      rows = withMedia.data as Record<string, unknown>[] | null;
    }

    if (!rows) {
      setLoading(false);
      return;
    }

    const withThumbs: Carousel[] = await Promise.all(
      rows.map(async (c) => {
        const { data: firstSlide } = await supabase
          .from("carousel_slides")
          .select("image_url")
          .eq("carousel_id", c.id as string)
          .eq("status", "completed")
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();

        return {
          id: c.id as string,
          title: c.title as string,
          platform: c.platform as string,
          status: c.status as string,
          slide_count: (c.slide_count as number) ?? 0,
          created_at: c.created_at as string,
          media_type: (c.media_type as string) ?? "image",
          first_slide_url: firstSlide?.image_url ?? null,
        };
      }),
    );

    setCarousels(withThumbs);
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    loadCarousels();
  }, [loadCarousels]);

  async function handleDelete(e: React.MouseEvent, carouselId: string) {
    e.preventDefault();
    e.stopPropagation();

    if (
      !confirm(
        "Delete this carousel and all its slides? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(carouselId);

    try {
      const res = await fetch(`/api/carousel/${carouselId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete carousel");
        return;
      }

      setCarousels((prev) => prev.filter((c) => c.id !== carouselId));
    } catch {
      alert("Network error");
    } finally {
      setDeletingId(null);
    }
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carousels</h1>
          <p className="text-[#666] mt-1">
            AI-generated carousel posts ready for social media.
          </p>
        </div>
        <Link
        href="/dashboard/create"
        className="px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Carousel
        </Link>
      </div>

      {carousels.length === 0 ? (
        <div className="text-center py-16">
          <ImageIcon className="w-12 h-12 mx-auto text-[#999] mb-4" />
          <h2 className="text-xl font-bold mb-2">No carousels yet</h2>
          <p className="text-[#666] mb-6">
            Create your first AI-generated carousel from a template.
          </p>
          <Link
            href="/dashboard/create"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-[var(--ember)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
          >
            Create Carousel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {carousels.map((c) => (
            <div
              key={c.id}
              className="relative bg-white border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
            >
              <button
                type="button"
                onClick={(e) => handleDelete(e, c.id)}
                disabled={deletingId === c.id}
                className="absolute top-2 left-2 z-10 p-1.5 rounded-md bg-white/90 border border-black/20 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                title="Delete carousel"
              >
                {deletingId === c.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                )}
              </button>

              <Link href={`/dashboard/carousels/${c.id}`} className="block">
                <div className="aspect-square relative bg-gray-50">
                  {c.first_slide_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.first_slide_url}
                      alt={c.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="w-10 h-10 text-[#ccc]" />
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      statusStyles[c.status] ?? statusStyles.draft,
                    )}
                  >
                    {c.status}
                  </span>
                  {c.media_type === "video" && (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/70 text-white">
                      <VideoIcon className="w-3 h-3" />
                      Video
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm line-clamp-1">
                    {c.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[#666]">
                    <span>{platformLabels[c.platform] ?? c.platform}</span>
                    <span>&middot;</span>
                    <span>{c.slide_count} slides</span>
                    <span>&middot;</span>
                    <span>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
