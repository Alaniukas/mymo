"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, Link2, ImagePlus } from "lucide-react";
import { AssetPicker } from "@/components/dashboard/asset-picker";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { cn } from "@/lib/utils";
import type { BrandStoryGoal } from "@/lib/stories/types";

const GOALS: { id: BrandStoryGoal; label: string; hint: string }[] = [
  { id: "story", label: "Brand story", hint: "Who you are & why it matters" },
  { id: "launch", label: "Launch", hint: "New product or feature" },
  { id: "event", label: "Event", hint: "Drop, meetup, conference" },
  { id: "recap", label: "Recap", hint: "Week in the life" },
  { id: "educate", label: "Educate", hint: "Tips for your audience" },
];

interface PreviewPost {
  id: string;
  caption: string;
  image_url: string;
}

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

function BrandStoryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source") === "social" ? "social" : "brand";
  const { activeProjectId } = useActiveProject();

  const [goal, setGoal] = useState<BrandStoryGoal>("story");
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [postLimit, setPostLimit] = useState(10);
  const [previewPosts, setPreviewPosts] = useState<PreviewPost[]>([]);
  const [scraping, setScraping] = useState(false);
  const [slideCount, setSlideCount] = useState(5);
  const [platform, setPlatform] = useState("instagram");
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeProjectId) return <NoProjectNotice />;

  async function handlePreviewScrape() {
    setError(null);
    setScraping(true);
    setPreviewPosts([]);
    try {
      const res = await fetch("/api/social/scrape-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_url: profileUrl, post_limit: postLimit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      setPreviewPosts(data.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      let res: Response;
      if (source === "social") {
        res = await fetch("/api/social/import-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile_url: profileUrl,
            post_limit: postLimit,
            topic,
            goal,
            platform,
            slide_count: slideCount,
            generate: true,
          }),
        });
      } else {
        res = await fetch("/api/stories/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal,
            topic,
            context,
            slide_count: slideCount,
            platform,
            asset_ids: assetIds,
          }),
        });
      }

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

  const canGenerate =
    source === "social"
      ? profileUrl.trim().length > 0
      : topic.trim().length > 0 || context.trim().length > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/dashboard/create"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#555] hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mb-6 flex gap-2">
        <Link
          href="/dashboard/stories/new?source=social"
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition",
            source === "social"
              ? "border-black bg-[#1a1a1a] text-white"
              : "border-black/15 bg-white hover:border-black/40",
          )}
        >
          <Link2 className="h-4 w-4" />
          Social link
        </Link>
        <Link
          href="/dashboard/stories/new?source=brand"
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition",
            source === "brand"
              ? "border-black bg-[#1a1a1a] text-white"
              : "border-black/15 bg-white hover:border-black/40",
          )}
        >
          <ImagePlus className="h-4 w-4" />
          Brand + photos
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">
        {source === "social" ? "Social → Story" : "Brand + Photos"}
      </h1>
      <p className="mt-1 text-sm text-[#555]">
        {source === "social"
          ? "Scrape recent posts, import photos, generate a marketing carousel from your real feed."
          : "Brand brain + your uploads + notes — on-brand storytelling without scraping."}
      </p>

      <div className="mt-8 space-y-6">
        {source === "social" ? (
          <>
            <div>
              <label className="text-sm font-semibold" htmlFor="profile">
                Profile link
              </label>
              <input
                id="profile"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://instagram.com/yourbrand or tiktok.com/@you"
                className="mt-2 w-full rounded-xl border-2 border-black/15 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-sm font-semibold">Posts to pull</label>
                <select
                  value={postLimit}
                  onChange={(e) => setPostLimit(Number(e.target.value))}
                  className="mt-2 block rounded-lg border-2 border-black/15 px-3 py-2 text-sm"
                >
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      Last {n}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={scraping || !profileUrl.trim()}
                onClick={handlePreviewScrape}
                className="rounded-lg border-2 border-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {scraping ? "Scanning…" : "Preview posts"}
              </button>
            </div>
            {previewPosts.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {previewPosts.slice(0, 10).map((p) => (
                  <div
                    key={p.id}
                    className="aspect-square overflow-hidden rounded-lg border border-black/10 bg-[#f5f5f5]"
                    title={p.caption}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="text-sm font-semibold" htmlFor="topic">
                Focus
              </label>
              <input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What should this carousel say?"
                className="mt-2 w-full rounded-xl border-2 border-black/15 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="context">
                Extra context
              </label>
              <textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={4}
                placeholder="Events, reel scripts, bullet points…"
                className="mt-2 w-full rounded-xl border-2 border-black/15 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Photos</label>
              <div className="mt-3">
                <AssetPicker
                  workspaceId={activeProjectId}
                  selected={assetIds}
                  onChange={setAssetIds}
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="text-sm font-semibold">Goal</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoal(g.id)}
                className={cn(
                  "rounded-full border-2 px-3 py-1.5 text-sm font-medium transition",
                  goal === g.id
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-white hover:border-black/40",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {source === "social" && (
          <div>
            <label className="text-sm font-semibold" htmlFor="topic-social">
              Story angle (optional)
            </label>
            <input
              id="topic-social"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Why we built this, Spring drop recap"
              className="mt-2 w-full rounded-xl border-2 border-black/15 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm font-semibold">Slides</label>
            <select
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="mt-2 block rounded-lg border-2 border-black/15 px-3 py-2 text-sm"
            >
              {[4, 5, 6, 7, 8].map((n) => (
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
              {source === "social"
                ? "Importing posts & generating…"
                : "Generating story…"}
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate carousel
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function NewBrandStoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#666]">Loading…</div>}>
      <BrandStoryForm />
    </Suspense>
  );
}
