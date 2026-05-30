"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Sparkles, Link2 } from "lucide-react";
import { AssetPicker } from "@/components/dashboard/asset-picker";
import {
  GenerationProgressPanel,
  pollCarouselsUntilReady,
  type GenerationPhase,
} from "@/components/dashboard/generation-progress";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { cn } from "@/lib/utils";
import type { MemeFormat } from "@/lib/viral/formats";
import type { ViralGoal } from "@/lib/viral/formats";

const GOALS: { id: ViralGoal; label: string }[] = [
  { id: "awareness", label: "Brand awareness" },
  { id: "product", label: "Sell product" },
  { id: "followers", label: "Grow followers" },
  { id: "engagement", label: "Max engagement" },
];

type MemeTemplatePreview = {
  id: string;
  name: string;
  preview_url: string;
};

type VibeSnapshot = {
  id: string;
  title: string;
  source_type: string;
  vibe: { summary?: string; visualTheme?: string; captionVoice?: string };
  is_active: boolean;
};

async function finalizeViralCarousel(carouselId: string, postCaption?: string) {
  const supabase = (await import("@/lib/supabase/client")).createClient();
  const { data: slideRows } = await supabase
    .from("carousel_slides")
    .select("id, caption, prompt")
    .eq("carousel_id", carouselId)
    .order("position");
  if (!slideRows?.length) return;

  await fetch(`/api/carousel/${carouselId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slides: slideRows.map((s) => ({
        id: s.id,
        caption: s.prompt?.startsWith("[meme:") ? "" : (s.caption || ""),
      })),
      post_caption: postCaption,
    }),
  });
}

export default function NewViralPage() {
  const router = useRouter();
  const { activeProjectId } = useActiveProject();
  const [formats, setFormats] = useState<MemeFormat[]>([]);
  const [formatId, setFormatId] = useState("pov_relate");
  const [goal, setGoal] = useState<ViralGoal>("awareness");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [batchCount, setBatchCount] = useState(1);
  const [selectedMemeIds, setSelectedMemeIds] = useState<string[]>([]);
  const [memeTemplates, setMemeTemplates] = useState<MemeTemplatePreview[]>([]);
  const [memeSearch, setMemeSearch] = useState("");
  const [memeLoading, setMemeLoading] = useState(false);
  const [vibeUrl, setVibeUrl] = useState("");
  const [activeVibe, setActiveVibe] = useState<VibeSnapshot | null>(null);
  const [vibeSnapshots, setVibeSnapshots] = useState<VibeSnapshot[]>([]);
  const [scrapingVibe, setScrapingVibe] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState<GenerationPhase>("planning");
  const [genCarouselIds, setGenCarouselIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadVibeLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/vibe/library");
      const data = await res.json();
      setActiveVibe(data.active ?? null);
      setVibeSnapshots(data.snapshots ?? []);
    } catch {
      setActiveVibe(null);
      setVibeSnapshots([]);
    }
  }, []);

  useEffect(() => {
    fetch("/api/viral/generate")
      .then((r) => r.json())
      .then((d) => setFormats(d.formats ?? []))
      .catch(() => setFormats([]));
    loadVibeLibrary();
  }, [loadVibeLibrary]);

  useEffect(() => {
    let cancelled = false;
    setMemeLoading(true);
    const q = memeSearch.trim();
    const url = q
      ? `/api/meme/templates?q=${encodeURIComponent(q)}&limit=12`
      : "/api/meme/templates?limit=12";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMemeTemplates(d.templates ?? []);
      })
      .catch(() => {
        if (!cancelled) setMemeTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setMemeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memeSearch]);

  if (!activeProjectId) return <NoProjectNotice />;

  function toggleMeme(id: string) {
    setSelectedMemeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 4),
    );
  }

  async function handleScrapeVibe() {
    setError(null);
    setScrapingVibe(true);
    try {
      const res = await fetch("/api/vibe/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: vibeUrl,
          import_photos: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vibe scrape failed");
      await loadVibeLibrary();
      setVibeUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vibe scrape failed");
    } finally {
      setScrapingVibe(false);
    }
  }

  async function runGeneration(opts: {
    format_id: string;
    goal: ViralGoal;
    topic: string;
  }) {
    setError(null);
    setGenerating(true);
    setGenPhase("planning");
    setGenCarouselIds([]);

    try {
      const res = await fetch("/api/viral/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format_id: opts.format_id,
          goal: opts.goal,
          topic: opts.topic,
          platform,
          asset_ids: assetIds,
          use_meme_library: true,
          meme_template_ids:
            selectedMemeIds.length > 0 ? selectedMemeIds : undefined,
          vibe_id: activeVibe?.id,
          batch_count: batchCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const carouselIds: string[] = data.carousel_ids
        ? data.carousel_ids
        : [data.carousel_id as string];
      const results = data.results ?? [data];

      setGenCarouselIds(carouselIds);
      setGenPhase("generating");

      await pollCarouselsUntilReady(carouselIds);

      setGenPhase("finalizing");
      for (let i = 0; i < carouselIds.length; i++) {
        await finalizeViralCarousel(
          carouselIds[i],
          results[i]?.plan?.postCaption,
        );
      }

      setGenPhase("done");
      await new Promise((r) => setTimeout(r, 600));

      if (carouselIds.length === 1) {
        router.push(`/dashboard/carousels/${carouselIds[0]}`);
      } else {
        router.push("/dashboard/carousels");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
      setGenCarouselIds([]);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {generating && genCarouselIds.length > 0 && (
        <GenerationProgressPanel
          carouselIds={genCarouselIds}
          phase={genPhase}
          label={
            batchCount > 1
              ? `Generating ${batchCount} viral carousels`
              : "Cooking your meme carousel"
          }
          batchTotal={batchCount}
        />
      )}

      <Link
        href="/dashboard/create"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#555] hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Brainrot Meme Pump</h1>
      <p className="mt-1 text-sm text-[#555]">
        Scan their IG/TikTok vibe once → upload fresh photos → pick trending memes →
        pump volume.
      </p>

      {/* Vibe library */}
      <div className="mt-6 rounded-xl border-2 border-black/10 bg-white p-4">
        <p className="text-sm font-semibold">Social vibe library</p>
        <p className="mt-0.5 text-xs text-[#666]">
          Scrape profile or video/reel link — saves fonts, colors, caption voice. Reused
          on every new upload.
        </p>

        {activeVibe && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
            <span className="font-semibold">Active vibe:</span> {activeVibe.title}
            {activeVibe.vibe.summary && (
              <span className="block mt-0.5 text-green-800/80">
                {activeVibe.vibe.summary.slice(0, 140)}
                {activeVibe.vibe.summary.length > 140 ? "…" : ""}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={vibeUrl}
            onChange={(e) => setVibeUrl(e.target.value)}
            placeholder="IG/TikTok profile or reel/video link"
            className="flex-1 rounded-lg border-2 border-black/15 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <button
            type="button"
            disabled={scrapingVibe || !vibeUrl.trim()}
            onClick={handleScrapeVibe}
            className="shrink-0 rounded-lg border-2 border-black px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {scrapingVibe ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Link2 className="mr-1 inline h-4 w-4" />
                Save vibe
              </>
            )}
          </button>
        </div>

        {vibeSnapshots.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vibeSnapshots.slice(0, 4).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={async () => {
                  await fetch("/api/vibe/library", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ vibe_id: v.id }),
                  });
                  loadVibeLibrary();
                }}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  v.is_active
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-black/15 bg-white hover:border-black/40",
                )}
              >
                {v.title.slice(0, 28)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Meme picker */}
      <div className="mt-6 rounded-xl border-2 border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Pick trending memes</p>
            <p className="mt-0.5 text-xs text-[#666]">
              AI adapts captions to your theme. Select up to 4 (optional).
            </p>
          </div>
          <input
            value={memeSearch}
            onChange={(e) => setMemeSearch(e.target.value)}
            placeholder="Search memes…"
            className="w-full max-w-xs rounded-lg border-2 border-black/15 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {memeLoading && memeTemplates.length === 0 ? (
            <p className="col-span-full py-6 text-center text-sm text-[#666]">
              Loading templates…
            </p>
          ) : (
            memeTemplates.map((t) => {
              const sel = selectedMemeIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleMeme(t.id)}
                  className={cn(
                    "relative overflow-hidden rounded-lg border-2 text-left transition",
                    sel
                      ? "border-[var(--ember)] ring-2 ring-[var(--ember)]"
                      : "border-black/10 hover:border-black/40",
                  )}
                  title={t.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.preview_url}
                    alt={t.name}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                  {sel && (
                    <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ember)] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                  <p className="truncate px-1.5 py-1 text-[10px] font-medium text-[#444]">
                    {t.name}
                  </p>
                </button>
              );
            })
          )}
        </div>
        {selectedMemeIds.length > 0 && (
          <p className="mt-2 text-xs text-[#666]">
            {selectedMemeIds.length} meme{selectedMemeIds.length === 1 ? "" : "s"}{" "}
            selected — AI will match your angle
          </p>
        )}
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <label className="text-sm font-semibold">Meme format</label>
          <div className="mt-2 space-y-2">
            {(formats.length
              ? formats
              : [
                  {
                    id: "pov_relate",
                    title: "POV / Relatable",
                    description: "",
                    structure: "setup_punchline" as const,
                    slideCount: 4,
                    hookStyle: "",
                  },
                ]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormatId(f.id)}
                className={cn(
                  "w-full rounded-xl border-2 px-4 py-3 text-left transition",
                  formatId === f.id
                    ? "border-black bg-[var(--ember)] text-white shadow-[2px_2px_0_0_#000]"
                    : "border-black/15 bg-white hover:border-black/40",
                )}
              >
                <span className="font-semibold">{f.title}</span>
                {f.description && (
                  <span
                    className={cn(
                      "mt-0.5 block text-xs",
                      formatId === f.id ? "text-white/80" : "text-[#666]",
                    )}
                  >
                    {f.description} · {f.slideCount} slides
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">Viral goal</label>
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

        <div>
          <label className="text-sm font-semibold" htmlFor="topic">
            Angle (optional)
          </label>
          <input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. founders who ship too slow"
            className="mt-2 w-full rounded-xl border-2 border-black/15 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-4">
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
          <div>
            <label className="text-sm font-semibold">Carousels to generate</label>
            <select
              value={batchCount}
              onChange={(e) => setBatchCount(Number(e.target.value))}
              className="mt-2 block rounded-lg border-2 border-black/15 px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} variant{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">Fresh photos (not old library)</label>
          <p className="mt-1 text-xs text-[#666]">
            Upload new shots — saved social vibe styles captions & product slides.
          </p>
          <div className="mt-3">
            <AssetPicker
              workspaceId={activeProjectId}
              selected={assetIds}
              onChange={setAssetIds}
              uploadOnly
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="button"
          disabled={generating}
          onClick={() =>
            runGeneration({ format_id: "pov_relate", goal: "awareness", topic: "" })
          }
          className="w-full rounded-xl border-2 border-dashed border-black/30 py-2.5 text-sm font-medium text-[#555] hover:border-black hover:text-black disabled:opacity-50"
        >
          Quick pump — POV meme, zero config
        </button>

        <button
          type="button"
          disabled={generating}
          onClick={() => runGeneration({ format_id: formatId, goal, topic })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-[var(--ember)] py-3 font-semibold text-white shadow-[3px_3px_0_0_#000] disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate{batchCount > 1 ? ` ${batchCount} carousels` : " viral carousel"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
