"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2, Sparkles } from "lucide-react";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { cn } from "@/lib/utils";
import type {
  StoryCarouselMediaMode,
  StoryNarrativeAngle,
} from "@/lib/stories/types";

const MEDIA_MODES: {
  id: StoryCarouselMediaMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "text_only",
    label: "Text only",
    hint: "Black/white slides — typography carries the story",
  },
  {
    id: "with_images",
    label: "With AI images",
    hint: "Generated photos that follow the same story line",
  },
];

const NARRATIVE_ANGLES: {
  id: StoryNarrativeAngle;
  label: string;
  hint: string;
}[] = [
  {
    id: "follower_growth",
    label: "Story series",
    hint: "Serial narrative built to grow followers through saves & shares",
  },
  {
    id: "brand_experience",
    label: "Brand experience",
    hint: "Dramatized client moment — on-brand, scroll-stopping, fictionalized",
  },
];

async function pollUntilReady(carouselId: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`/api/carousel-status/${carouselId}`);
    const data = await res.json();
    if (data.status === "ready" || data.status === "draft") return;
    if (data.completed >= data.total && data.total > 0) return;
    await new Promise((r) => setTimeout(r, 2500));
  }
}

async function finalizeCarousel(
  carouselId: string,
  postCaption?: string,
): Promise<void> {
  const supabase = (await import("@/lib/supabase/client")).createClient();
  const { data: slideRows } = await supabase
    .from("carousel_slides")
    .select("id, caption")
    .eq("carousel_id", carouselId)
    .order("position");

  if (!slideRows?.length) return;

  await fetch(`/api/carousel/${carouselId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slides: slideRows.map((s) => ({ id: s.id, caption: s.caption || "" })),
      post_caption: postCaption,
    }),
  });
}

export default function StoryCarouselPage() {
  const router = useRouter();
  const { activeProjectId } = useActiveProject();

  const [mediaMode, setMediaMode] = useState<StoryCarouselMediaMode>("text_only");
  const [narrativeAngle, setNarrativeAngle] =
    useState<StoryNarrativeAngle>("follower_growth");
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [platform, setPlatform] = useState("instagram");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeProjectId) return <NoProjectNotice />;

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/stories/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_mode: mediaMode,
          narrative_angle: narrativeAngle,
          topic,
          context,
          slide_count: slideCount,
          platform,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const carouselId = data.carousel_id as string;
      await pollUntilReady(carouselId);
      await finalizeCarousel(carouselId, data.plan?.postCaption);

      router.push(`/dashboard/carousels/${carouselId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = topic.trim().length > 0 || context.trim().length > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/dashboard/create"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#555] hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mb-2 flex items-center gap-2">
        <BookOpen className="h-6 w-6" />
        <h1 className="text-2xl font-bold tracking-tight">Story Carousel</h1>
      </div>
      <p className="text-sm text-[#555]">
        Build a follower base with serial swipe stories — simple text slides or
        AI imagery that keeps one story line from hook to CTA.
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <label className="text-sm font-semibold">Visual style</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MEDIA_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMediaMode(m.id)}
                className={cn(
                  "rounded-xl border-2 px-4 py-3 text-left transition",
                  mediaMode === m.id
                    ? "border-black bg-[#1a1a1a] text-white"
                    : "border-black/15 bg-white hover:border-black/40",
                )}
              >
                <span className="block text-sm font-semibold">{m.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-xs",
                    mediaMode === m.id ? "text-white/70" : "text-[#666]",
                  )}
                >
                  {m.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">Story angle</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {NARRATIVE_ANGLES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setNarrativeAngle(a.id)}
                className={cn(
                  "rounded-xl border-2 px-4 py-3 text-left transition",
                  narrativeAngle === a.id
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-white hover:border-black/40",
                )}
              >
                <span className="block text-sm font-semibold">{a.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-xs",
                    narrativeAngle === a.id ? "text-white/70" : "text-[#666]",
                  )}
                >
                  {a.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold" htmlFor="topic">
            Story topic
          </label>
          <input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              narrativeAngle === "brand_experience"
                ? "e.g. The client who almost quit — then this happened"
                : "e.g. How I went from 0 to 10k without ads"
            }
            className="mt-2 w-full rounded-xl border-2 border-black/15 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-semibold" htmlFor="context">
            Extra context (optional)
          </label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            placeholder="Plot beats, brand details, tone notes…"
            className="mt-2 w-full rounded-xl border-2 border-black/15 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm font-semibold">Slides</label>
            <select
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="mt-2 block rounded-lg border-2 border-black/15 px-3 py-2 text-sm"
            >
              {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="mt-2 block rounded-lg border-2 border-black/15 px-3 py-2 text-sm"
            >
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={generating || !canGenerate}
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-[var(--ember)] py-3 font-semibold text-white shadow-[3px_3px_0_0_#000] disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Writing your story…
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate story carousel
            </>
          )}
        </button>
      </div>
    </div>
  );
}
