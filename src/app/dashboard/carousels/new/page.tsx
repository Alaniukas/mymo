"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  LayoutTemplate,
  Eye,
  ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SlideCard } from "@/components/dashboard/slide-card";
import {
  TemplatePreviewModal,
  type TemplatePreviewData,
} from "@/components/dashboard/template-preview-modal";
import { TrendingSoundPicker } from "@/components/dashboard/trending-sound-picker";
import { AssetPicker } from "@/components/dashboard/asset-picker";
import { SlideCaptionEditor } from "@/components/dashboard/slide-caption-editor";
import { createClient } from "@/lib/supabase/client";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";
import { NICHES, nicheLabel, isNiche, type NicheSlug } from "@/lib/carousel/niches";
import type { TrendingSound } from "@/lib/trends/types";

interface TemplateSlide {
  position: number;
  image_url: string;
  storage_path: string;
  media_type?: "image" | "video";
  video_url?: string | null;
  video_storage_path?: string | null;
}

interface CarouselTemplate {
  id: string;
  workspace_id: string | null;
  niche: string;
  title: string;
  source_url: string | null;
  source_platform: string | null;
  caption: string | null;
  slides: TemplateSlide[];
}

interface SlideStatus {
  id: string;
  position: number;
  caption: string;
  prompt: string;
  image_url: string | null;
  status: string;
}

interface ProgressCounts {
  completed: number;
  failed: number;
  generating: number;
  total: number;
}

type Step = "template" | "configure" | "generating" | "captions" | "done";

function clampSlides(n: number): number {
  return Math.min(Math.max(n, 3), 10);
}

export default function NewCarouselPage() {
  const router = useRouter();
  const { activeProjectId } = useActiveProject();
  const [step, setStep] = useState<Step>("template");
  const [loading, setLoading] = useState(true);

  // Source: a required template the carousel replicates with the user's assets.
  const [templates, setTemplates] = useState<CarouselTemplate[]>([]);
  const [remixNiche, setRemixNiche] = useState<NicheSlug>(NICHES[0].slug);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<TemplatePreviewData | null>(null);

  // Configure
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [slideCount, setSlideCount] = useState(5);
  const [imperfect, setImperfect] = useState(false);
  const [selectedSound, setSelectedSound] = useState<TrendingSound | null>(null);

  // Generation + captions
  const [generating, setGenerating] = useState(false);
  const [captioning, setCaptioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carouselId, setCarouselId] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideStatus[]>([]);
  const [fitCaptions, setFitCaptions] = useState<
    { position: number; caption: string }[]
  >([]);
  const [progress, setProgress] = useState<ProgressCounts>({
    completed: 0,
    failed: 0,
    generating: 0,
    total: 0,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ensures caption suggestions are requested exactly once per generation.
  // Without it, overlapping poll ticks can each fire /api/generate-slide-captions
  // before clearInterval takes effect, rate-limiting the request against itself.
  const captionsStartedRef = useRef(false);

  const loadTemplates = useCallback(async () => {
    const supabase = createClient();

    // Templates are universal: every user sees global templates plus all of
    // their own imports across every project. RLS already scopes rows to
    // "global + owned", so no per-project filter is needed here.
    const { data } = await supabase
      .from("carousel_templates")
      .select(
        "id, workspace_id, niche, title, source_url, source_platform, caption, slides",
      )
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as CarouselTemplate[];
    setTemplates(rows);

    // Seed the flow from query params once templates are available (the loading
    // spinner hides this until ready): ?niche / ?topic / ?slides pre-fill the
    // configuration, and ?template=<id> preselects a template.
    const params = new URLSearchParams(window.location.search);
    const nicheParam = params.get("niche");
    const topicParam = params.get("topic");
    const slidesParam = params.get("slides");
    const templateParam = params.get("template");

    if (nicheParam && isNiche(nicheParam)) setRemixNiche(nicheParam);
    if (topicParam) setTopic(topicParam);
    if (slidesParam && Number.isFinite(Number(slidesParam))) {
      setSlideCount(clampSlides(Number(slidesParam)));
    }
    if (templateParam) {
      const tpl = rows.find((t) => t.id === templateParam);
      if (tpl) {
        setRemixNiche(tpl.niche as NicheSlug);
        setSelectedTemplate(tpl.id);
        setSlideCount(clampSlides(tpl.slides?.length ?? 5));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadTemplates();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadTemplates]);

  function pollStatus(id: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/carousel-status/${id}`);
        const data = await res.json();
        if (!res.ok) return;

        setSlides(data.slides ?? []);
        setProgress(
          data.progress ?? { completed: 0, failed: 0, generating: 0, total: 0 },
        );

        if (data.status === "ready" || data.status === "draft") {
          if (pollRef.current) clearInterval(pollRef.current);
          // Guard against concurrent in-flight ticks both reaching this branch.
          if (captionsStartedRef.current) return;
          captionsStartedRef.current = true;
          const completed = (data.slides ?? []).filter(
            (s: SlideStatus) => s.status === "completed",
          ).length;
          if (completed > 0) {
            await loadFitCaptions(id, data.slides ?? []);
          } else {
            setError("Generation failed — no slides completed. Please try again.");
            setStep("done");
          }
        }
      } catch {
        // retry on next interval
      }
    }, 4000);
  }

  // Captions are the LAST step: the slide IMAGES are generated first (clean,
  // text-free), then we write captions that fit each actual slide and the user
  // edits + finalizes them (which burns them onto the images).
  async function loadFitCaptions(id: string, generatedSlides: SlideStatus[]) {
    setCaptioning(true);
    try {
      const res = await fetch("/api/generate-slide-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carousel_id: id, imperfect }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.captions)) {
        setFitCaptions(
          data.captions.map((c: { position: number; caption: string }) => ({
            position: c.position,
            caption: c.caption,
          })),
        );
      } else {
        setFitCaptions([]);
        if (!res.ok) setError(data.error || "Could not suggest captions");
      }
    } catch {
      setFitCaptions([]);
    } finally {
      setCaptioning(false);
      if (generatedSlides.length > 0) setSlides(generatedSlides);
      setStep("captions");
    }
  }

  async function handleGenerate() {
    if (!activeProjectId || !selectedTemplate) return;
    setGenerating(true);
    setError(null);
    captionsStartedRef.current = false;

    try {
      const res = await fetch("/api/generate-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate,
          asset_ids: selectedAssetIds,
          custom_topic: topic || undefined,
          platform,
          slide_count: slideCount,
          media_type: "image",
          music: selectedSound
            ? {
                id: selectedSound.id,
                title: selectedSound.title,
                author: selectedSound.author,
                coverUrl: selectedSound.coverUrl,
                playUrl: selectedSound.playUrl,
                tiktokUrl: selectedSound.tiktokUrl,
              }
            : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        setGenerating(false);
        return;
      }

      setCarouselId(data.carousel_id);
      setProgress({
        completed: 0,
        failed: 0,
        generating: slideCount,
        total: slideCount,
      });
      setStep("generating");
      pollStatus(data.carousel_id);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Refresh slides so the done step shows the finalized (captioned) images.
  async function handleFinalized() {
    // Finalize succeeded — drop any non-fatal error from caption suggestion
    // (e.g. a transient rate limit) so it doesn't leak into the done screen.
    setError(null);
    if (carouselId) {
      try {
        const res = await fetch(`/api/carousel-status/${carouselId}`);
        if (res.ok) {
          const data = await res.json();
          setSlides(data.slides ?? []);
        }
      } catch {
        // keep the slides we already have
      }
    }
    setStep("done");
  }

  function resetFlow() {
    setStep("template");
    setSelectedTemplate(null);
    setSelectedAssetIds([]);
    setTopic("");
    setSlideCount(5);
    setImperfect(false);
    setSelectedSound(null);
    setCarouselId(null);
    setSlides([]);
    setFitCaptions([]);
    setError(null);
    setProgress({ completed: 0, failed: 0, generating: 0, total: 0 });
    captionsStartedRef.current = false;
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

  const nicheTemplates = templates.filter((t) => t.niche === remixNiche);
  const selectedTpl = templates.find((t) => t.id === selectedTemplate) ?? null;
  const completedSlides = slides.filter(
    (s) => s.status === "completed" && s.image_url,
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/carousels")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Carousel</h1>
          <p className="text-[#666] mt-0.5 text-sm">
            {step === "template" && "Pick a template to use as your style"}
            {step === "configure" &&
              "Add your assets and tell us what it's about"}
            {step === "generating" && "Generating your slides..."}
            {step === "captions" &&
              "Edit the captions written to fit your slides, then finalize"}
            {step === "done" && "Your carousel is ready!"}
          </p>
        </div>
      </div>

      {/* Step 1: Template (required source) */}
      {step === "template" && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-black rounded-xl p-5 shadow-[4px_4px_0_0_#000] space-y-4">
            <p className="text-sm text-[#666]">
              Your carousel replicates a template&apos;s look and layout
              slide-by-slide, using your brand and the assets you choose. Pick a
              niche, then a template.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {NICHES.map((n) => (
                <button
                  key={n.slug}
                  type="button"
                  onClick={() => setRemixNiche(n.slug)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors",
                    remixNiche === n.slug
                      ? "bg-[var(--ember)] text-white border-black"
                      : "bg-white text-[#666] border-gray-200 hover:border-black",
                  )}
                >
                  {n.label}
                </button>
              ))}
            </div>

            {nicheTemplates.length === 0 ? (
              <div className="text-sm text-[#666] border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                No {nicheLabel(remixNiche)} templates yet.{" "}
                <a
                  href="/dashboard/templates"
                  className="text-[var(--ember)] font-medium underline"
                >
                  Add one
                </a>{" "}
                to use it here.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {nicheTemplates.map((t) => {
                  const thumb = t.slides?.[0]?.image_url ?? null;
                  const isSel = selectedTemplate === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(t.id);
                        setSlideCount(clampSlides(t.slides?.length ?? 5));
                      }}
                      title={t.title}
                      className={cn(
                        "relative rounded-lg overflow-hidden border-2 transition-colors aspect-square bg-gray-50",
                        isSel
                          ? "border-[var(--ember)] ring-2 ring-[var(--ember)]"
                          : "border-black",
                      )}
                    >
                      {thumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={thumb}
                          alt={t.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <LayoutTemplate className="w-6 h-6 text-[#ccc]" />
                        </div>
                      )}
                      {(t.slides?.length ?? 0) > 0 && (
                        <span
                          role="button"
                          tabIndex={0}
                          title="Preview full carousel"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate({
                              title: t.title,
                              caption: t.caption,
                              sourceUrl: t.source_url,
                              sourcePlatform: t.source_platform,
                              slides: t.slides ?? [],
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              e.preventDefault();
                              setPreviewTemplate({
                                title: t.title,
                                caption: t.caption,
                                sourceUrl: t.source_url,
                                sourcePlatform: t.source_platform,
                                slides: t.slides ?? [],
                              });
                            }
                          }}
                          className="absolute top-1 left-1 inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/90 border border-black/20 hover:bg-white hover:border-black transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="absolute bottom-1 right-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
                        {t.slides?.length ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep("configure")}
              disabled={!selectedTemplate}
              className="px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure (assets + topic + settings) */}
      {step === "configure" && (
        <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000] space-y-6">
          {selectedTpl && (
            <div className="flex items-start gap-2 bg-[var(--ember)]/5 border-2 border-[var(--ember)] rounded-lg px-4 py-3 text-sm">
              <LayoutTemplate className="w-4 h-4 mt-0.5 shrink-0 text-[var(--ember)]" />
              <span>
                Replicating{" "}
                <span className="font-semibold">{selectedTpl.title}</span> —
                generated slides echo its style and layout while using your
                brand and assets.
              </span>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <ImagePlus className="w-4 h-4 text-[var(--ember)]" />
              Assets <span className="text-[#999] font-normal">(optional)</span>
            </label>
            <AssetPicker
              workspaceId={activeProjectId}
              selected={selectedAssetIds}
              onChange={setSelectedAssetIds}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Topic</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should this carousel be about?"
              rows={2}
              className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember)] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Platform</label>
            <div className="flex gap-2">
              {(["instagram", "tiktok", "both"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors capitalize",
                    platform === p
                      ? "bg-[var(--ember)] text-white border-black"
                      : "bg-white text-[#666] border-gray-200 hover:border-black",
                  )}
                >
                  {p === "both" ? "Both" : p}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#666] mt-1">
              {platform === "instagram" && "Square (1:1) slides"}
              {platform === "tiktok" && "Vertical (9:16) slides"}
              {platform === "both" && "Portrait (4:5) slides"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Number of slides
            </label>
            <div className="flex flex-wrap gap-2">
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSlideCount(n)}
                  className={cn(
                    "w-10 h-10 rounded-lg text-sm font-semibold border-2 transition-colors",
                    slideCount === n
                      ? "bg-[var(--ember)] text-white border-black"
                      : "bg-white text-[#666] border-gray-200 hover:border-black",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#666] mt-2">
              Independent of how many assets you picked — we build a coherent
              story across this many slides.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <label className="block text-sm font-semibold mb-1">
              Trending sound{" "}
              <span className="text-[#999] font-normal">(optional)</span>
            </label>
            <p className="text-xs text-[#666] mb-3">
              Attach a trending TikTok sound now — it&apos;s saved with the
              carousel so it&apos;s ready to ride the trend when you publish.
            </p>
            <TrendingSoundPicker
              selected={selectedSound}
              onSelect={setSelectedSound}
            />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-gray-100 pt-5">
            <div>
              <label
                htmlFor="imperfect-toggle"
                className="block text-sm font-semibold"
              >
                Imperfect copy
              </label>
              <p className="text-xs text-[#666] mt-0.5 max-w-sm">
                Adds subtle typos &amp; casual styling so the captions read like
                a real person wrote them — not too polished or obviously AI.
              </p>
            </div>
            <button
              id="imperfect-toggle"
              type="button"
              role="switch"
              aria-checked={imperfect}
              onClick={() => setImperfect((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-black transition-colors",
                imperfect ? "bg-[var(--ember)]" : "bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white border border-black transition-transform",
                  imperfect ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("template")}
              className="px-5 py-2.5 rounded-lg bg-gray-100 text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? "Starting..." : "Generate Slides"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Generation Progress */}
      {step === "generating" && (
        <div className="space-y-6">
          {captioning && (
            <div className="flex items-center gap-2 bg-amber-50 border-2 border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Writing captions to fit your slides...
            </div>
          )}
          <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--ember)]" />
              <span className="font-semibold">
                Generating slides... {progress.completed} of {progress.total}{" "}
                complete
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-[var(--ember)] h-2 rounded-full transition-all duration-500"
                style={{
                  width:
                    progress.total > 0
                      ? `${(progress.completed / progress.total) * 100}%`
                      : "0%",
                }}
              />
            </div>
          </div>

          {slides.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {slides.map((s) => (
                <SlideCard
                  key={s.id}
                  position={s.position}
                  caption={s.caption}
                  prompt={s.prompt}
                  imageUrl={s.image_url}
                  status={s.status}
                  mediaType="image"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Captions (LAST) — edit captions written to fit the slides */}
      {step === "captions" && carouselId && (
        <SlideCaptionEditor
          carouselId={carouselId}
          slides={completedSlides.map((s) => ({
            id: s.id,
            position: s.position,
            image_url: s.image_url,
          }))}
          initialCaptions={fitCaptions}
          onFinalized={handleFinalized}
        />
      )}

      {/* Step 5: Done */}
      {step === "done" && carouselId && (
        <div className="space-y-6">
          {error ? (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 text-center">
              <h2 className="text-lg font-bold text-red-700 mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
              <h2 className="text-lg font-bold text-green-800 mb-2">
                Carousel Ready!
              </h2>
              <p className="text-sm text-green-700">
                {progress.completed} of {progress.total} slides generated
                successfully.
              </p>
            </div>
          )}

          {slides.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {slides.map((s) => (
                <SlideCard
                  key={s.id}
                  position={s.position}
                  caption={s.caption}
                  prompt={s.prompt}
                  imageUrl={s.image_url}
                  status={s.status}
                  mediaType="image"
                />
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/carousels/${carouselId}`)}
              className="px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
            >
              View Carousel
            </button>
            <button
              type="button"
              onClick={resetFlow}
              className="px-5 py-2.5 rounded-lg bg-gray-100 text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Create Another
            </button>
          </div>
        </div>
      )}

      {previewTemplate && (
        <TemplatePreviewModal
          {...previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}
