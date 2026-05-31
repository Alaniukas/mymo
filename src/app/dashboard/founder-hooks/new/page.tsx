"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Film,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { AssetUpload } from "@/components/dashboard/asset-upload";
import { ImperfectCopyToggle } from "@/components/dashboard/imperfect-copy-toggle";
import {
  HookTemplatePicker,
  type HookTemplateOption,
} from "@/components/dashboard/hook-template-picker";
import {
  GenerationProgressPanel,
  type GenerationPhase,
} from "@/components/dashboard/generation-progress";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_CLIPS = 5;
const MAX_HOOKS = 5;
const HOOK_CHOICES = [1, 2, 3, 4, 5] as const;

type HookSource = "ai" | "premade" | "template";

const HOOK_SOURCE_OPTIONS: { id: HookSource; label: string; hint: string }[] = [
  {
    id: "ai",
    label: "AI hooks",
    hint: "Generate fresh UGC creator hooks from your topic & brand",
  },
  {
    id: "premade",
    label: "Our premade hooks",
    hint: "Curated A/B hooks we maintain — pick the ones you want to test",
  },
  {
    id: "template",
    label: "Hook templates",
    hint: "Reusable viral hooks from the template library",
  },
];

interface VideoAsset {
  id: string;
  name: string;
  public_url: string;
}

/**
 * Waits until every founder hook reel finishes the image->video pipeline.
 *
 * Unlike image carousels, a video carousel is only usable once its hook CLIP is
 * animated, so we poll the carousel STATUS (not image progress). Each poll also
 * advances the video phase server-side, so this both drives and awaits the work.
 */
async function pollReelsUntilReady(
  ids: string[],
  maxAttempts = 240,
  intervalMs = 3000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const states = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/carousel-status/${id}`);
          const data = await res.json();
          return (data.status as string) ?? "generating";
        } catch {
          return "generating";
        }
      }),
    );
    if (states.every((s) => s === "ready" || s === "draft")) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export default function FounderHookReelsPage() {
  const router = useRouter();
  const { activeProjectId } = useActiveProject();

  const [topic, setTopic] = useState("");
  const [hookCount, setHookCount] = useState(MAX_HOOKS);
  const [imperfect, setImperfect] = useState(false);
  const [hookSource, setHookSource] = useState<HookSource>("ai");
  const [selectedHookIds, setSelectedHookIds] = useState<string[]>([]);
  const [premadeHooks, setPremadeHooks] = useState<HookTemplateOption[]>([]);
  const [templateHooks, setTemplateHooks] = useState<HookTemplateOption[]>([]);
  const [hooksLoading, setHooksLoading] = useState(true);
  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState<GenerationPhase>("planning");
  const [genCarouselIds, setGenCarouselIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchVideoAssets = useCallback(async (): Promise<VideoAsset[]> => {
    if (!activeProjectId) return [];
    const supabase = createClient();
    const { data } = await supabase
      .from("assets")
      .select("id, name, public_url, mime_type, created_at")
      .eq("workspace_id", activeProjectId)
      .order("created_at", { ascending: false });
    return ((data ?? []) as (VideoAsset & { mime_type: string | null })[])
      .filter((a) => typeof a.mime_type === "string" && a.mime_type.startsWith("video/"))
      .map((a) => ({ id: a.id, name: a.name, public_url: a.public_url }));
  }, [activeProjectId]);

  useEffect(() => {
    fetchVideoAssets().then(setVideoAssets);
  }, [fetchVideoAssets]);

  useEffect(() => {
    async function loadHooks() {
      setHooksLoading(true);
      try {
        const [pRes, tRes] = await Promise.all([
          fetch("/api/hook-templates?kind=premade"),
          fetch("/api/hook-templates?kind=template"),
        ]);
        const pData = await pRes.json();
        const tData = await tRes.json();
        setPremadeHooks(pData.templates ?? []);
        setTemplateHooks(tData.templates ?? []);
      } finally {
        setHooksLoading(false);
      }
    }
    void loadHooks();
  }, []);

  useEffect(() => {
    setSelectedHookIds([]);
  }, [hookSource]);

  const handleUploaded = useCallback(async () => {
    const prevIds = new Set(videoAssets.map((a) => a.id));
    const next = await fetchVideoAssets();
    const newIds = next.filter((a) => !prevIds.has(a.id)).map((a) => a.id);
    setVideoAssets(next);
    if (newIds.length > 0) {
      setSelectedIds((prev) => [...prev, ...newIds].slice(0, MAX_CLIPS));
    }
  }, [videoAssets, fetchVideoAssets]);

  if (!activeProjectId) return <NoProjectNotice />;

  function toggleClip(id: string) {
    setError(null);
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id].slice(0, MAX_CLIPS),
    );
  }

  function moveClip(index: number, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const selectedClips = selectedIds
    .map((id) => videoAssets.find((a) => a.id === id))
    .filter((a): a is VideoAsset => Boolean(a));

  async function runGeneration() {
    if (selectedIds.length === 0) {
      setError("Upload and select at least one app demo video.");
      return;
    }
    if (hookSource !== "ai" && selectedHookIds.length === 0) {
      setError(
        hookSource === "premade"
          ? "Select at least one premade hook."
          : "Select at least one hook template.",
      );
      return;
    }
    setError(null);
    setGenerating(true);
    setGenPhase("planning");
    setGenCarouselIds([]);

    try {
      const res = await fetch("/api/founder-hooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          app_asset_ids: selectedIds,
          hook_count: hookSource === "ai" ? hookCount : selectedHookIds.length,
          imperfect,
          hook_source: hookSource,
          hook_template_ids: hookSource === "ai" ? [] : selectedHookIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const ids: string[] = data.carousel_ids ?? [];
      if (ids.length === 0) throw new Error("No reels were created");

      setGenCarouselIds(ids);
      setGenPhase("generating");

      await pollReelsUntilReady(ids);

      setGenPhase("done");
      await new Promise((r) => setTimeout(r, 600));
      router.push("/dashboard/carousels");
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
          label="Generating your hook reels"
          batchTotal={genCarouselIds.length}
        />
      )}

      <Link
        href="/dashboard/create"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#555] hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Founder Hook Reels</h1>
      <p className="mt-1 text-sm text-[#555]">
        Upload your app demo clips → AI generates ultra-realistic UGC creator
        hooks and stitches each one in front of your demo into one video with
        minimalist storyline captions. Post the winners.
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-black/20 bg-white/60 p-4 text-xs text-[#555]">
        <Film className="mb-1.5 h-4 w-4 text-[var(--ember)]" />
        Vertical 9:16 reels. Keep clips short (a few seconds each) — they play in
        the order you select, after the AI hook. Up to {MAX_CLIPS} clips.
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <label className="text-sm font-semibold">Hook source</label>
          <p className="mt-1 text-xs text-[#666]">
            Generate new hooks with AI, or use hooks we&apos;ve already built.
          </p>
          <div className="mt-3 space-y-2">
            {HOOK_SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setHookSource(opt.id)}
                className={cn(
                  "w-full rounded-xl border-2 px-4 py-3 text-left transition",
                  hookSource === opt.id
                    ? "border-black bg-[var(--ember)]/10 shadow-[2px_2px_0_0_#000]"
                    : "border-black/15 bg-white hover:border-black/40",
                )}
              >
                <p className="text-sm font-bold">{opt.label}</p>
                <p className="text-xs text-[#666]">{opt.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {hookSource === "premade" && (
          <div>
            <label className="text-sm font-semibold">Select premade hooks</label>
            <p className="mt-1 text-xs text-[#666]">
              Each selected hook becomes its own reel (up to {MAX_HOOKS}) — same
              app demo, different opener.
            </p>
            <div className="mt-3">
              <HookTemplatePicker
                templates={premadeHooks}
                selectedIds={selectedHookIds}
                onChange={setSelectedHookIds}
                loading={hooksLoading}
                maxSelect={MAX_HOOKS}
              />
            </div>
          </div>
        )}

        {hookSource === "template" && (
          <div>
            <label className="text-sm font-semibold">Select hook templates</label>
            <p className="mt-1 text-xs text-[#666]">
              Pick viral openers from the library (up to {MAX_HOOKS} at once).
            </p>
            <div className="mt-3">
              <HookTemplatePicker
                templates={templateHooks}
                selectedIds={selectedHookIds}
                onChange={setSelectedHookIds}
                loading={hooksLoading}
                maxSelect={MAX_HOOKS}
                autoPlay
                variant="gallery"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold" htmlFor="topic">
            {hookSource === "ai"
              ? "What should the hooks be about? (optional)"
              : "Story angle for demo captions (optional)"}
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="e.g. a girl crying tears of joy because our app finally fixed her sleep — angle it at burnt-out 20-somethings"
            className="mt-2 w-full resize-none rounded-xl border-2 border-black/15 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
          />
          <p className="mt-1 text-xs text-[#666]">
            You can direct the creator&apos;s vibe and emotion here (e.g. crying
            with joy, shocked, hyped). Leave blank and the AI picks the strongest
            emotional angle from your brand setup.
          </p>
        </div>

        {hookSource === "ai" && (
          <div>
            <label className="text-sm font-semibold">How many hooks?</label>
            <p className="mt-1 text-xs text-[#666]">
              Each is a separate reel with a different AI creator hook — same app
              demo and storyline — so you can A/B test what stops the scroll.
            </p>
            <div className="mt-3 flex gap-2">
              {HOOK_CHOICES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHookCount(n)}
                  aria-pressed={hookCount === n}
                  className={cn(
                    "h-11 flex-1 rounded-xl border-2 text-sm font-bold transition-colors",
                    hookCount === n
                      ? "border-black bg-[var(--ember)] text-white shadow-[2px_2px_0_0_#000]"
                      : "border-black/15 bg-white text-black hover:border-black/40",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold">Upload app demo videos</label>
          <p className="mt-1 text-xs text-[#666]">
            Screen recordings or clips of your app in action (max 50 MB each).
          </p>
          <div className="mt-3">
            <AssetUpload
              workspaceId={activeProjectId}
              media="video"
              type="demo"
              onUploadComplete={handleUploaded}
              compact
            />
          </div>
        </div>

        {(videoAssets.length > 0 || selectedIds.length > 0) && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-semibold">Your app clips</label>
              <span className="text-xs text-[#666]">
                {selectedIds.length} of {MAX_CLIPS} selected
              </span>
            </div>

            {selectedClips.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-[#666]">
                  Play order (after the AI hook)
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {selectedClips.map((a, i) => (
                    <div key={a.id} className="w-20">
                      <div className="relative aspect-[9/16] overflow-hidden rounded-lg border-2 border-[var(--ember)]">
                        <video
                          src={a.public_url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ember)] text-[10px] font-bold text-white">
                          {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleClip(a.id)}
                          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                          aria-label="Remove clip"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-1 flex justify-center gap-1">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveClip(i, -1)}
                          className="rounded border border-black/15 p-0.5 disabled:opacity-30"
                          aria-label="Move earlier"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={i === selectedClips.length - 1}
                          onClick={() => moveClip(i, 1)}
                          className="rounded border border-black/15 p-0.5 disabled:opacity-30"
                          aria-label="Move later"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-black/20 px-3 py-3 text-xs text-[#666]">
                No clips selected yet. Upload above, or tap from your videos below.
              </p>
            )}

            {videoAssets.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-[#666]">
                  Your videos — tap to add (newest first)
                </p>
                <div className="max-h-72 overflow-y-auto rounded-xl border-2 border-black/10 p-2">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {videoAssets.map((a) => {
                      const pos = selectedIds.indexOf(a.id);
                      const sel = pos >= 0;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleClip(a.id)}
                          title={a.name}
                          className={cn(
                            "relative aspect-[9/16] overflow-hidden rounded-lg border-2 transition-colors",
                            sel
                              ? "border-[var(--ember)] ring-2 ring-[var(--ember)]"
                              : "border-black/15 hover:border-black/40",
                          )}
                        >
                          <video
                            src={a.public_url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          {sel && (
                            <span className="absolute inset-0 flex items-center justify-center bg-[var(--ember)]/25">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ember)] text-xs font-bold text-white">
                                {pos + 1}
                              </span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <ImperfectCopyToggle
          enabled={imperfect}
          onChange={setImperfect}
          id="founder-hook-imperfect"
          description="Adds subtle typos and casual wording on hook lines and storyline captions so the reel sounds raw and human — not polished AI."
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={generating || selectedIds.length === 0}
          onClick={runGeneration}
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
              Generate{" "}
              {hookSource === "ai"
                ? `${hookCount} hook ${hookCount === 1 ? "reel" : "reels"}`
                : `${selectedHookIds.length || 0} hook ${selectedHookIds.length === 1 ? "reel" : "reels"}`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
