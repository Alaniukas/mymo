"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { nicheLabel, isNiche, type NicheSlug } from "@/lib/carousel/niches";
import { fetchCarouselTemplates } from "@/lib/carousel/fetch-templates";
import {
  NICHE_META,
  presetsForNiche,
} from "@/lib/carousel/template-presets";
import { resolveStudioSlidePlan } from "@/lib/carousel/studio-slide-count";
import { defaultTopicFromBrand, brandProfileFromRow } from "@/lib/carousel/variables";
import { TemplateCard, type TemplateCardItem } from "@/components/dashboard/template-card";
import type { TrendingSound } from "@/lib/trends/types";

interface TemplateSlide {
  position: number;
  image_url: string;
  storage_path: string;
  media_type?: "image" | "video";
  video_url?: string | null;
  video_storage_path?: string | null;
}

interface TemplateBlueprintSummary {
  summary?: string;
  arcType?: string;
  slideCount?: number;
  copyPattern?: string;
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
  blueprint?: TemplateBlueprintSummary | null;
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

function templateSlideCount(t: CarouselTemplate | null | undefined): number {
  return Math.max(t?.slides?.length ?? 5, 1);
}

export default function NewCarouselPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProjectId, activeProject } = useActiveProject();
  const [step, setStep] = useState<Step>("template");
  const [loading, setLoading] = useState(true);

  // Source: a required template the carousel replicates with the user's assets.
  const [templates, setTemplates] = useState<CarouselTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [materializing, setMaterializing] = useState(false);
  const [previewTemplate, setPreviewTemplate] =
    useState<TemplatePreviewData | null>(null);

  // Configure
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [slideCount, setSlideCount] = useState(5);
  const [imperfect, setImperfect] = useState(false);
  const [fillMissingWithAi, setFillMissingWithAi] = useState(false);
  const [selectedSound, setSelectedSound] = useState<TrendingSound | null>(null);
  const [postCaption, setPostCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [analyzingAssets, setAnalyzingAssets] = useState(false);

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
  const topicPrefilledRef = useRef(false);

  const prefillTopicFromBrand = useCallback(async () => {
    if (!activeProjectId || topicPrefilledRef.current) return;
    const supabase = createClient();
    const { data: identity } = await supabase
      .from("app_identities")
      .select("*")
      .eq("workspace_id", activeProjectId)
      .limit(1)
      .maybeSingle();

    const suggested = defaultTopicFromBrand(brandProfileFromRow(identity));
    if (suggested) {
      setTopic((prev) => (prev.trim() ? prev : suggested));
      topicPrefilledRef.current = true;
    }
  }, [activeProjectId]);

  const loadTemplates = useCallback(async () => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const rows = (await fetchCarouselTemplates(supabase, {
      workspaceId: activeProjectId,
    })) as CarouselTemplate[];
    setTemplates(rows);

    const topicParam = searchParams.get("topic");
    const slidesParam = searchParams.get("slides");
    const templateParam = searchParams.get("template");

    if (templateParam) {
      const tpl = rows.find((t) => t.id === templateParam);
      if (tpl) {
        setSelectedTemplate(tpl.id);
        setSlideCount(templateSlideCount(tpl));
        setStep("configure");
        if (topicParam) {
          setTopic(topicParam);
          topicPrefilledRef.current = true;
        } else {
          void prefillTopicFromBrand();
        }
        setLoading(false);
        return;
      }
      setError("That template could not be found. Pick one from the list below.");
    }

    if (topicParam) {
      setTopic(topicParam);
      topicPrefilledRef.current = true;
    } else {
      void prefillTopicFromBrand();
    }
    if (slidesParam && Number.isFinite(Number(slidesParam))) {
      setSlideCount(Number(slidesParam));
    }

    setLoading(false);
  }, [searchParams, activeProjectId, prefillTopicFromBrand]);

  useEffect(() => {
    if (step !== "configure" || !activeProjectId || selectedAssetIds.length > 0) {
      return;
    }
    const supabase = createClient();
    void supabase
      .from("assets")
      .select("id")
      .eq("workspace_id", activeProjectId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const ids = (data ?? []).map((a) => a.id);
        if (ids.length > 0) setSelectedAssetIds(ids);
      });
  }, [step, activeProjectId, selectedAssetIds.length]);

  useEffect(() => {
    if (step !== "configure" || selectedAssetIds.length === 0) return;
    let cancelled = false;
    setAnalyzingAssets(true);
    void (async () => {
      try {
        await fetch("/api/assets/analyze-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_ids: selectedAssetIds.slice(0, 12),
          }),
        });
      } catch {
        // server re-analyzes on generate if needed
      }
      if (!cancelled) setAnalyzingAssets(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, selectedAssetIds.join(",")]);

  useEffect(() => {
    if (step !== "configure" || !selectedTemplate) return;
    void fetch(`/api/templates/${selectedTemplate}/analyze-blueprint`, {
      method: "POST",
    }).catch(() => {
      // generate-carousel ensures blueprint on submit
    });
  }, [step, selectedTemplate]);

  useEffect(() => {
    if (step === "configure") {
      void prefillTopicFromBrand();
    }
  }, [step, prefillTopicFromBrand]);

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
        if (typeof data.post_caption === "string") {
          setPostCaption(data.post_caption);
        }
        if (Array.isArray(data.hashtags)) {
          setHashtags(data.hashtags.filter((h: unknown) => typeof h === "string"));
        }
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
          fill_missing_with_ai: fillMissingWithAi,
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
        const msg = data.error || "Generation failed";
        setError(msg);
        setGenerating(false);
        if (/brand identity|onboarding/i.test(msg)) {
          setStep("configure");
        }
        return;
      }

      setCarouselId(data.carousel_id);
      const genSlides = resolveStudioSlidePlan(
        templateSlideCount(selectedTpl),
        selectedAssetIds.length,
        fillMissingWithAi,
      ).totalSlides;
      setProgress({
        completed: data.slides_completed ?? 0,
        failed: data.slides_failed ?? 0,
        generating: data.status === "ready" ? 0 : genSlides,
        total: genSlides,
      });

      if (data.status === "ready") {
        setStep("generating");
        captionsStartedRef.current = true;
        let readySlides: SlideStatus[] = [];
        try {
          const statusRes = await fetch(`/api/carousel-status/${data.carousel_id}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            readySlides = statusData.slides ?? [];
            setSlides(readySlides);
          }
        } catch {
          // caption step can still proceed from carousel_id alone
        }
        await loadFitCaptions(data.carousel_id, readySlides);
        return;
      }

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
    setSelectedPresetId(null);
    setSelectedAssetIds([]);
    setTopic("");
    topicPrefilledRef.current = false;
    setSlideCount(5);
    setImperfect(false);
    setFillMissingWithAi(false);
    setPostCaption("");
    setHashtags([]);
    setSelectedSound(null);
    setCarouselId(null);
    setSlides([]);
    setFitCaptions([]);
    setError(null);
    setProgress({ completed: 0, failed: 0, generating: 0, total: 0 });
    captionsStartedRef.current = false;
  }

  async function handleTemplateContinue() {
    if (selectedPresetId) {
      setMaterializing(true);
      setError(null);
      try {
        const res = await fetch("/api/templates/from-preset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset_id: selectedPresetId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to prepare template");
          return;
        }
        if (data.starterTopic) setTopic(data.starterTopic);
        setSelectedTemplate(data.templateId);
        setSelectedPresetId(null);
        const supabase = createClient();
        const rows = (await fetchCarouselTemplates(supabase, {
          workspaceId: activeProjectId!,
        })) as CarouselTemplate[];
        setTemplates(rows);
        const tpl = rows.find((t) => t.id === data.templateId);
        setSlideCount(templateSlideCount(tpl));
        setStep("configure");
      } catch {
        setError("Network error");
      } finally {
        setMaterializing(false);
      }
      return;
    }
    if (selectedTemplate) {
      void prefillTopicFromBrand();
      setStep("configure");
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

  const projectNiche: NicheSlug | null =
    activeProject?.niche && isNiche(activeProject.niche)
      ? activeProject.niche
      : null;
  const nicheTemplates = templates;
  const nicheMeta = projectNiche ? NICHE_META[projectNiche] : null;
  const presetItems: TemplateCardItem[] = projectNiche
    ? presetsForNiche(projectNiche).map((p) => ({
        kind: "preset",
        id: p.id,
        title: p.title,
        description: p.description,
        slideCount: p.slideCount,
        gradient: nicheMeta!.gradient,
        thumbnail: p.thumbnail,
      }))
    : [];
  const selectedTpl = templates.find((t) => t.id === selectedTemplate) ?? null;
  const templateSlides = templateSlideCount(selectedTpl);
  const slidePlan = resolveStudioSlidePlan(
    templateSlides,
    selectedAssetIds.length,
    fillMissingWithAi,
  );
  const effectiveSlides = slidePlan.totalSlides;
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
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Create Carousel</h1>
          <p className="text-[#666] mt-0.5 text-sm">
            {step === "template" && "Pick a template to use as your style"}
            {step === "configure" &&
              "Choose photos and tell us what this carousel is about"}
            {step === "generating" && "Generating your slides..."}
            {step === "captions" &&
              "Edit the captions written to fit your slides, then finalize"}
            {step === "done" && "Your carousel is ready!"}
          </p>
        </div>
      </div>

      <CreateWizardStepper step={step} />

      {/* Step 1: Template (required source) */}
      {step === "template" && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-black rounded-xl p-5 shadow-[4px_4px_0_0_#000] space-y-4">
            <p className="text-sm text-[#666]">
              Your carousel replicates a template&apos;s look and layout
              slide-by-slide, using your brand and the assets you choose.
              {activeProject?.name && (
                <>
                  {" "}
                  Templates from{" "}
                  <span className="font-semibold text-[#333]">
                    {activeProject.name}
                  </span>
                  {projectNiche && <> ({nicheLabel(projectNiche)})</>}.
                </>
              )}
            </p>

            {!projectNiche && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Set a project type when creating the project to see suggested
                starters.
              </p>
            )}

            {presetItems.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Our suggested templates</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {presetItems.map((item) => (
                    <TemplateCard
                      key={`preset-${item.id}`}
                      item={item}
                      selected={selectedPresetId === item.id}
                      onSelect={() => {
                        setSelectedPresetId(item.id);
                        setSelectedTemplate(null);
                        setSlideCount(item.slideCount);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Your library</h3>
              {nicheTemplates.length === 0 ? (
                <p className="text-sm text-[#666] border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                  No templates in this project yet — import a URL from Templates
                  or download from community.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {nicheTemplates.map((t) => {
                    const thumb = t.slides?.[0]?.image_url ?? null;
                    const isSel =
                      selectedTemplate === t.id && !selectedPresetId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplate(t.id);
                          setSelectedPresetId(null);
                          setSlideCount(templateSlideCount(t));
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
                                id: t.id,
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
                                  id: t.id,
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

            <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={() =>
                  router.push("/dashboard/templates?return=create")
                }
                className="px-4 py-2 rounded-lg bg-white text-sm font-semibold border-2 border-black"
              >
                Browse templates & import URL
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    projectNiche
                      ? `/dashboard/community-templates?niche=${projectNiche}`
                      : "/dashboard/community-templates",
                  )
                }
                className="px-4 py-2 rounded-lg bg-[var(--ember)] text-white text-sm font-semibold border-2 border-black"
              >
                Browse community templates
              </button>
            </div>
          </div>

          {error && step === "template" && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleTemplateContinue}
              disabled={
                materializing || (!selectedTemplate && !selectedPresetId)
              }
              className="px-5 py-2.5 rounded-lg bg-[var(--ember)] hover:bg-[var(--ember-hover)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-50 inline-flex items-center gap-2"
            >
              {materializing && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure (assets + topic + settings) */}
      {step === "configure" && (
        <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0_0_#000] space-y-8">
          {selectedTpl && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-[var(--ember)]/5 border-2 border-[var(--ember)] rounded-lg px-4 py-3 text-sm">
                <LayoutTemplate className="w-4 h-4 mt-0.5 shrink-0 text-[var(--ember)]" />
                <span>
                  Replicating{" "}
                  <span className="font-semibold">{selectedTpl.title}</span> —
                  {effectiveSlides} slide{effectiveSlides === 1 ? "" : "s"}
                  {selectedAssetIds.length > 0
                    ? slidePlan.fillWithAi
                      ? ` · ${selectedAssetIds.length} photo${selectedAssetIds.length === 1 ? "" : "s"} + ${slidePlan.aiSlideCount} AI-generated`
                      : effectiveSlides < templateSlides
                        ? ` · ${selectedAssetIds.length} photo${selectedAssetIds.length === 1 ? "" : "s"} → ${effectiveSlides} slides (template layout, your content)`
                        : ` · ${selectedAssetIds.length} photo${selectedAssetIds.length === 1 ? "" : "s"} matched to template`
                    : " — select photos from your library"}
                </span>
              </div>
              {selectedTpl.blueprint?.summary && (
                <p className="text-xs text-[#666] px-1">
                  {selectedTpl.blueprint.summary}
                  {selectedTpl.blueprint.arcType
                    ? ` · ${selectedTpl.blueprint.arcType}`
                    : ""}
                </p>
              )}
            </div>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#666]">
              1. Photos
            </h3>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <ImagePlus className="w-4 h-4 text-[var(--ember)]" />
              Your images{" "}
              <span className="text-[#999] font-normal">(required — auto-selected from library)</span>
            </label>
            <AssetPicker
              workspaceId={activeProjectId}
              selected={selectedAssetIds}
              onChange={setSelectedAssetIds}
            />
          </section>

          <section className="space-y-4 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#666]">
              2. Topic &amp; platform
            </h3>
            <div>
              <label className="block text-sm font-semibold mb-2">Topic</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What should this carousel be about? (prefilled from your Brand DNA)"
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-black bg-gray-50 text-sm font-semibold">
              {effectiveSlides}
              <span className="text-xs font-normal text-[#666]">
                {selectedAssetIds.length > 0 && slidePlan.fillWithAi
                  ? `(template has ${templateSlides} — ${selectedAssetIds.length} photos + ${slidePlan.aiSlideCount} AI slides)`
                  : selectedAssetIds.length > 0 && effectiveSlides < templateSlides
                    ? `(template has ${templateSlides} — using your ${selectedAssetIds.length} photos)`
                    : "(matches template)"}
              </span>
            </div>
            {selectedAssetIds.length > 0 &&
              selectedAssetIds.length < templateSlides && (
                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fillMissingWithAi}
                    onChange={(e) => setFillMissingWithAi(e.target.checked)}
                    className="mt-1 rounded border-gray-300"
                  />
                  <span className="text-sm">
                    <span className="font-semibold">Fill missing slides with AI</span>
                    <span className="block text-xs text-[#666] mt-0.5">
                      Keep all {templateSlides} template slides — AI generates{" "}
                      {templateSlides - selectedAssetIds.length} matching
                      backgrounds for the rest of the storyline.
                    </span>
                  </span>
                </label>
              )}
            {analyzingAssets && (
              <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                AI is reading your photos (subject, scene, best slide fit)...
              </p>
            )}
            <p className="text-xs text-[#666] mt-2">
              Your photos become slide backgrounds; the template sets layout, decor,
              and caption style. Matching runs automatically when you generate.
            </p>
            </div>
          </section>

          <section className="space-y-4 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#666]">
              3. Optional extras
            </h3>
            <div>
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

          <div className="flex items-start justify-between gap-4">
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
          </section>

          {error && (
            <WizardErrorMessage message={error} />
          )}

          <div className="flex gap-3 border-t border-gray-100 pt-5">
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
              disabled={
                generating ||
                analyzingAssets ||
                selectedAssetIds.length === 0
              }
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
          initialPostCaption={postCaption}
          initialHashtags={hashtags}
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
          onUseInCarousel={
            previewTemplate.id
              ? (templateId) => {
                  setPreviewTemplate(null);
                  setSelectedPresetId(null);
                  setSelectedTemplate(templateId);
                  const tpl = templates.find((t) => t.id === templateId);
                  if (tpl) setSlideCount(templateSlideCount(tpl));
                  setStep("configure");
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

const WIZARD_STEPS: { id: Step; label: string }[] = [
  { id: "template", label: "Template" },
  { id: "configure", label: "Configure" },
  { id: "generating", label: "Generate" },
  { id: "captions", label: "Captions" },
];

function wizardStepIndex(step: Step): number {
  switch (step) {
    case "template":
      return 0;
    case "configure":
      return 1;
    case "generating":
      return 2;
    case "captions":
      return 3;
    case "done":
      return 4;
  }
}

function CreateWizardStepper({ step }: { step: Step }) {
  const current = wizardStepIndex(step);

  return (
    <nav
      aria-label="Create carousel progress"
      className="flex items-center justify-between gap-2"
    >
      {WIZARD_STEPS.map((s, i) => {
        const done = current > i || step === "done";
        const active = current === i;
        return (
          <div key={s.id} className="flex flex-1 items-center gap-2 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 border-black text-xs font-bold shrink-0",
                  done && !active
                    ? "bg-black text-white"
                    : active
                      ? "bg-[var(--ember)] text-white"
                      : "bg-white text-[#999]",
                )}
              >
                {done && !active ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "mt-1 text-[11px] font-semibold truncate w-full text-center",
                  active ? "text-black" : "text-[#999]",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full mb-4 max-w-[40px]",
                  current > i ? "bg-black" : "bg-gray-200",
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function WizardErrorMessage({ message }: { message: string }) {
  const needsIdentity = /brand identity|onboarding/i.test(message);

  return (
    <div className="flex flex-col gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
      {needsIdentity && (
        <Link
          href="/dashboard/onboarding"
          className="text-sm font-semibold text-red-800 underline hover:no-underline pl-6"
        >
          Complete Brand setup (Identity tab) →
        </Link>
      )}
    </div>
  );
}
