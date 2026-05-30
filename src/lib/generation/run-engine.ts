import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildImagePrompt,
  getSizeForPlatform,
  type BrandIdentity,
} from "@/lib/carousel/prompts";
import { brandProfileFromRow } from "@/lib/carousel/variables";
import { renderAssetAsSlide } from "@/lib/carousel/compose-asset-slide";
import { renderTextSlideBackground } from "@/lib/carousel/render-text-slide";
import { fetchMediaBuffer, uploadBuffer } from "@/lib/carousel/storage";
import { orderAssetsByIds } from "@/lib/carousel/studio-asset-references";
import { submitImageGeneration } from "@/lib/evolink/client";
import { buildImagePayload } from "@/lib/evolink/models";
import { getModelSettings } from "@/lib/settings/service";
import { logContentEvent } from "@/lib/analytics/events";
import { planBrandStory } from "@/lib/stories/plan-brand-story";
import { planStoryCarousel } from "@/lib/stories/plan-story-carousel";
import type {
  BrandStoryGoal,
  StoryCarouselMediaMode,
  StoryNarrativeAngle,
} from "@/lib/stories/types";
import { planViralMeme, resolveMemeFormat } from "@/lib/viral/plan-viral-meme";
import type { ViralGoal } from "@/lib/viral/formats";
import { fetchMemeTemplates, renderMemeBuffer } from "@/lib/meme/memegen-client";
import { assignMemeTemplatesToSlides } from "@/lib/meme/compose-meme-slides";
import { getActiveBrandVibe } from "@/lib/vibe/service";
import { formatVibeForPrompt, parseBrandVibePayload } from "@/lib/vibe/types";

type DB = SupabaseClient;

export interface EngineSlidePlan {
  position: number;
  role: string;
  caption: string;
  visualBrief: string;
  layout: string;
  textPlacement: string;
  textStyle: string;
  textAlignment: string;
  useUserPhoto: boolean;
  memeTemplateId?: string;
  memeLines?: string[];
  /** Solid background for text-only slides — skips AI image gen when set. */
  backgroundColor?: string;
  textColor?: string;
}

async function insertCarousel(
  supabase: DB,
  row: Record<string, unknown>,
): Promise<{ id: string } | null> {
  const optional = [
    "music",
    "framework_id",
    "post_caption",
    "hashtags",
    "template_id",
    "content_type",
    "campaign_id",
    "engine_meta",
  ];
  let { data, error } = await supabase
    .from("carousels")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    const retry = { ...row };
    for (const k of optional) delete retry[k];
    ({ data, error } = await supabase
      .from("carousels")
      .insert(retry)
      .select("id")
      .single());
  }
  return error || !data ? null : (data as { id: string });
}

async function insertSlides(
  supabase: DB,
  slideRows: Record<string, unknown>[],
): Promise<string | null> {
  const { error } = await supabase.from("carousel_slides").insert(slideRows);
  if (!error) return null;
  const fallback = slideRows.map((row) => {
    const copy = { ...row };
    delete copy.caption;
    delete copy.layout;
    delete copy.role;
    delete copy.base_image_url;
    delete copy.text_zone;
    return copy;
  });
  const { error: retryErr } = await supabase
    .from("carousel_slides")
    .insert(fallback);
  return retryErr ? retryErr.message : null;
}

async function generateSlidesForPlan(opts: {
  supabase: DB;
  workspaceId: string;
  carouselId: string;
  slides: EngineSlidePlan[];
  visualTheme: string;
  brandIdentity: BrandIdentity;
  platform: string;
  assetUrls: string[];
  imageModel: string;
}): Promise<{
  slideRows: Record<string, unknown>[];
  allFailed: boolean;
  allCompleted: boolean;
}> {
  const size = getSizeForPlatform(opts.platform);
  const total = opts.slides.length;
  let photoIdx = 0;
  const slideRows: Record<string, unknown>[] = [];

  for (const slide of opts.slides) {
    let slideStatus: "completed" | "failed" | "generating" | "pending" =
      "pending";
    let imageUrl: string | null = null;
    let storagePath: string | null = null;
    let evolinkTaskId: string | null = null;
    let imagePrompt = "";

    const usePhoto =
      slide.useUserPhoto && opts.assetUrls.length > 0;
    const assetUrl = usePhoto
      ? opts.assetUrls[photoIdx % opts.assetUrls.length]
      : undefined;
    if (usePhoto) photoIdx++;

    if (slide.memeTemplateId && slide.memeLines?.length) {
      try {
        const png = await renderMemeBuffer({
          templateId: slide.memeTemplateId,
          lines: slide.memeLines,
        });
        const path = `${opts.workspaceId}/${opts.carouselId}/${slide.position}.png`;
        const uploaded = await uploadBuffer(
          opts.supabase,
          png,
          path,
          "image/png",
          "carousels",
        );
        if (uploaded.ok) {
          imageUrl = uploaded.publicUrl;
          storagePath = uploaded.storagePath;
          slideStatus = "completed";
          imagePrompt = `[meme:${slide.memeTemplateId}] ${slide.memeLines.join(" / ")}`;
        }
      } catch (err) {
        console.error(`[engine] meme slide ${slide.position} failed:`, err);
      }
    }

    if (slideStatus !== "completed" && usePhoto && assetUrl) {
      try {
        const media = await fetchMediaBuffer(assetUrl);
        if (media) {
          const png = await renderAssetAsSlide(media.buffer, size, "center");
          if (png) {
            const path = `${opts.workspaceId}/${opts.carouselId}/${slide.position}.png`;
            const uploaded = await uploadBuffer(
              opts.supabase,
              png,
              path,
              "image/png",
              "carousels",
            );
            if (uploaded.ok) {
              imageUrl = uploaded.publicUrl;
              storagePath = uploaded.storagePath;
              slideStatus = "completed";
              imagePrompt = `[user-photo] ${slide.visualBrief}`;
            }
          }
        }
      } catch (err) {
        console.error(`[engine] photo slide ${slide.position} failed:`, err);
      }
    }

    if (slideStatus !== "completed" && slide.layout === "text_only" && slide.backgroundColor) {
      try {
        const png = renderTextSlideBackground({
          aspect: size,
          backgroundColor: slide.backgroundColor,
        });
        const path = `${opts.workspaceId}/${opts.carouselId}/${slide.position}.png`;
        const uploaded = await uploadBuffer(
          opts.supabase,
          png,
          path,
          "image/png",
          "carousels",
        );
        if (uploaded.ok) {
          imageUrl = uploaded.publicUrl;
          storagePath = uploaded.storagePath;
          slideStatus = "completed";
          imagePrompt = `[text-only:${slide.backgroundColor}]`;
        }
      } catch (err) {
        console.error(`[engine] text slide ${slide.position} failed:`, err);
      }
    }

    if (slideStatus !== "completed") {
      imagePrompt = buildImagePrompt(
        `${slide.visualBrief}. Visual theme: ${opts.visualTheme}. Meme-friendly, bold, social-native. NO readable text in the image.`,
        slide.role,
        slide.position,
        total,
        opts.brandIdentity,
        opts.platform,
        [],
        false,
        undefined,
        slide.layout,
        opts.visualTheme,
        assetUrl,
      );

      const refUrls = assetUrl ? [assetUrl] : undefined;
      const { payload } = buildImagePayload(opts.imageModel, imagePrompt, {
        size,
        quality: "medium",
        image_urls: refUrls,
      });

      slideStatus = "failed";
      try {
        const task = await submitImageGeneration(payload);
        evolinkTaskId = task.id;
        slideStatus = "generating";
      } catch (err) {
        console.error(`[engine] AI slide ${slide.position} failed:`, err);
      }
    }

    slideRows.push({
      carousel_id: opts.carouselId,
      position: slide.position,
      caption: slide.caption,
      prompt: imagePrompt,
      status: slideStatus,
      evolink_task_id: evolinkTaskId,
      image_url: imageUrl,
      storage_path: storagePath,
      base_image_url: imageUrl,
      layout: slide.layout,
      role: slide.role,
      text_zone: {
        placement: slide.textPlacement,
        style: slide.textStyle,
        lengthHint: "short",
        alignment: slide.textAlignment,
        ...(slide.textColor ? { textColor: slide.textColor } : {}),
        ...(slide.backgroundColor ? { backgroundColor: slide.backgroundColor } : {}),
        overlayStrength:
          slide.layout === "text_only" ? "light" : undefined,
      },
    });
  }

  return {
    slideRows,
    allFailed: slideRows.every((s) => s.status === "failed"),
    allCompleted: slideRows.every((s) => s.status === "completed"),
  };
}

export async function runBrandStoryEngine(
  supabase: DB,
  opts: {
    workspaceId: string;
    goal: BrandStoryGoal;
    topic: string;
    context?: string;
    slideCount: number;
    platform: string;
    assetIds?: string[];
    campaignId?: string;
  },
) {
  const { data: identity } = await supabase
    .from("app_identities")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .limit(1)
    .maybeSingle();

  if (!identity) {
    return { error: "Complete brand setup first.", status: 400 as const };
  }

  const settings = await getModelSettings(supabase);
  const brandProfile = brandProfileFromRow(identity);
  const brandIdentity: BrandIdentity = {
    brand_tone: identity.brand_tone,
    target_audience: identity.target_audience,
    value_propositions: identity.value_propositions,
    llm_summary: identity.llm_summary,
  };

  const plan = await planBrandStory({
    brand: brandProfile,
    goal: opts.goal,
    topic: opts.topic,
    context: opts.context,
    slideCount: opts.slideCount,
    platform: opts.platform,
    model: settings.text_model,
  });

  let campaignId = opts.campaignId;
  if (!campaignId) {
    const { data: campaign } = await supabase
      .from("story_campaigns")
      .insert({
        workspace_id: opts.workspaceId,
        title: plan.title,
        theme: opts.topic,
        goal: opts.goal,
        context: opts.context?.slice(0, 8000) ?? null,
        status: "generating",
      })
      .select("id")
      .single();
    campaignId = campaign?.id;
  }

  const carousel = await insertCarousel(supabase, {
    workspace_id: opts.workspaceId,
    combination_id: null,
    title: plan.title.slice(0, 60),
    platform: opts.platform,
    slide_count: plan.slides.length,
    status: "generating",
    content_type: "brand_story",
    campaign_id: campaignId ?? null,
    post_caption: plan.postCaption || null,
    hashtags: plan.hashtags.length > 0 ? plan.hashtags : null,
    engine_meta: { goal: opts.goal, visualTheme: plan.visualTheme },
  });

  if (!carousel) {
    return { error: "Failed to create carousel", status: 500 as const };
  }

  const poolIds = (opts.assetIds ?? []).filter(Boolean);
  let assetUrls: string[] = [];
  if (poolIds.length > 0) {
    const { data: rows } = await supabase
      .from("assets")
      .select("id, public_url")
      .eq("workspace_id", opts.workspaceId)
      .in("id", poolIds);
    assetUrls = orderAssetsByIds(poolIds, rows ?? []).map((r) => r.public_url);
  }

  const engineSlides: EngineSlidePlan[] = plan.slides.map((s) => ({
    position: s.position,
    role: s.role,
    caption: s.caption,
    visualBrief: s.visualBrief,
    layout: s.layout,
    textPlacement: s.textPlacement,
    textStyle: s.textStyle,
    textAlignment: s.textAlignment,
    useUserPhoto: s.useUserPhoto && assetUrls.length > 0,
  }));

  const { slideRows, allFailed, allCompleted } = await generateSlidesForPlan({
    supabase,
    workspaceId: opts.workspaceId,
    carouselId: carousel.id,
    slides: engineSlides,
    visualTheme: plan.visualTheme,
    brandIdentity,
    platform: opts.platform,
    assetUrls,
    imageModel: settings.image_model,
  });

  const insertErr = await insertSlides(supabase, slideRows);
  if (insertErr) {
    await supabase.from("carousels").update({ status: "draft" }).eq("id", carousel.id);
    return { error: insertErr, status: 500 as const };
  }

  if (allFailed) {
    await supabase.from("carousels").update({ status: "draft" }).eq("id", carousel.id);
  } else if (allCompleted) {
    await supabase.from("carousels").update({ status: "ready" }).eq("id", carousel.id);
    if (campaignId) {
      await supabase
        .from("story_campaigns")
        .update({ status: "ready" })
        .eq("id", campaignId);
    }
  }

  await logContentEvent(supabase, {
    workspaceId: opts.workspaceId,
    eventType: "generated",
    carouselId: carousel.id,
    platform: opts.platform,
    metadata: { engine: "brand_story", goal: opts.goal },
  });

  return {
    carousel_id: carousel.id,
    campaign_id: campaignId,
    content_type: "brand_story" as const,
    status: allFailed ? "draft" : allCompleted ? "ready" : "generating",
    plan,
  };
}

export async function runStoryCarouselEngine(
  supabase: DB,
  opts: {
    workspaceId: string;
    mediaMode: StoryCarouselMediaMode;
    narrativeAngle: StoryNarrativeAngle;
    topic: string;
    context?: string;
    slideCount: number;
    platform: string;
  },
) {
  const { data: identity } = await supabase
    .from("app_identities")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .limit(1)
    .maybeSingle();

  if (!identity) {
    return { error: "Complete brand setup first.", status: 400 as const };
  }

  const settings = await getModelSettings(supabase);
  const brandProfile = brandProfileFromRow(identity);
  const brandIdentity: BrandIdentity = {
    brand_tone: identity.brand_tone,
    target_audience: identity.target_audience,
    value_propositions: identity.value_propositions,
    llm_summary: identity.llm_summary,
  };

  const plan = await planStoryCarousel({
    brand: brandProfile,
    mediaMode: opts.mediaMode,
    narrativeAngle: opts.narrativeAngle,
    topic: opts.topic,
    context: opts.context,
    slideCount: opts.slideCount,
    platform: opts.platform,
    model: settings.text_model,
  });

  const carousel = await insertCarousel(supabase, {
    workspace_id: opts.workspaceId,
    combination_id: null,
    title: plan.title.slice(0, 60),
    platform: opts.platform,
    slide_count: plan.slides.length,
    status: "generating",
    content_type: "brand_story",
    post_caption: plan.postCaption || null,
    hashtags: plan.hashtags.length > 0 ? plan.hashtags : null,
    engine_meta: {
      storyFormat: "carousel",
      mediaMode: opts.mediaMode,
      narrativeAngle: opts.narrativeAngle,
      storyLine: plan.storyLine,
      visualTheme: plan.visualTheme,
    },
  });

  if (!carousel) {
    return { error: "Failed to create carousel", status: 500 as const };
  }

  const visualThemeForImages =
    plan.visualTheme ||
    `Cohesive story visuals: ${plan.storyLine || plan.title}. Same characters and mood on every slide.`;

  const engineSlides: EngineSlidePlan[] = plan.slides.map((s) => ({
    position: s.position,
    role: s.role,
    caption: s.caption,
    visualBrief:
      opts.mediaMode === "with_images" && s.layout !== "text_only"
        ? `${s.visualBrief}. Story beat ${s.position}/${plan.slides.length}. Thread: ${plan.storyLine}. ${visualThemeForImages}`
        : s.visualBrief,
    layout: s.layout,
    textPlacement: s.textPlacement,
    textStyle: s.textStyle,
    textAlignment: s.textAlignment,
    useUserPhoto: false,
    backgroundColor:
      s.layout === "text_only" || opts.mediaMode === "text_only"
        ? s.backgroundColor
        : undefined,
    textColor: s.textColor,
  }));

  const { slideRows, allFailed, allCompleted } = await generateSlidesForPlan({
    supabase,
    workspaceId: opts.workspaceId,
    carouselId: carousel.id,
    slides: engineSlides,
    visualTheme: visualThemeForImages,
    brandIdentity,
    platform: opts.platform,
    assetUrls: [],
    imageModel: settings.image_model,
  });

  const insertErr = await insertSlides(supabase, slideRows);
  if (insertErr) {
    await supabase.from("carousels").update({ status: "draft" }).eq("id", carousel.id);
    return { error: insertErr, status: 500 as const };
  }

  if (allFailed) {
    await supabase.from("carousels").update({ status: "draft" }).eq("id", carousel.id);
  } else if (allCompleted) {
    await supabase.from("carousels").update({ status: "ready" }).eq("id", carousel.id);
  }

  await logContentEvent(supabase, {
    workspaceId: opts.workspaceId,
    eventType: "generated",
    carouselId: carousel.id,
    platform: opts.platform,
    metadata: {
      engine: "story_carousel",
      mediaMode: opts.mediaMode,
      narrativeAngle: opts.narrativeAngle,
    },
  });

  return {
    carousel_id: carousel.id,
    content_type: "brand_story" as const,
    status: allFailed ? "draft" : allCompleted ? "ready" : "generating",
    plan,
  };
}

export async function runViralMemeEngine(
  supabase: DB,
  opts: {
    workspaceId: string;
    formatId: string;
    goal: ViralGoal;
    topic: string;
    platform: string;
    assetIds?: string[];
    useMemeLibrary?: boolean;
    memeTemplateIds?: string[];
    vibeId?: string;
    batchVariant?: number;
  },
) {
  const { data: identity } = await supabase
    .from("app_identities")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .limit(1)
    .maybeSingle();

  if (!identity) {
    return { error: "Complete brand setup first.", status: 400 as const };
  }

  const settings = await getModelSettings(supabase);
  const brandProfile = brandProfileFromRow(identity);
  const brandIdentity: BrandIdentity = {
    brand_tone: identity.brand_tone,
    target_audience: identity.target_audience,
    value_propositions: identity.value_propositions,
    llm_summary: identity.llm_summary,
  };

  let vibeContext = "";
  let visualTheme = "bold meme-native social feed aesthetic";
  if (opts.vibeId) {
    const { data: vibeRow } = await supabase
      .from("brand_vibe_snapshots")
      .select("vibe")
      .eq("id", opts.vibeId)
      .eq("workspace_id", opts.workspaceId)
      .maybeSingle();
    const payload = parseBrandVibePayload(vibeRow?.vibe);
    if (payload) {
      vibeContext = formatVibeForPrompt(payload);
      if (payload.visualTheme) visualTheme = payload.visualTheme;
    }
  } else {
    const activeVibe = await getActiveBrandVibe(supabase, opts.workspaceId);
    if (activeVibe) {
      vibeContext = formatVibeForPrompt(activeVibe.vibe);
      if (activeVibe.vibe.visualTheme) visualTheme = activeVibe.vibe.visualTheme;
    }
  }

  const format = resolveMemeFormat(opts.formatId);
  let memeTemplateNames: string[] | undefined;
  if (opts.memeTemplateIds?.length) {
    try {
      const allTemplates = await fetchMemeTemplates();
      memeTemplateNames = opts.memeTemplateIds
        .map((id) => allTemplates.find((t) => t.id === id)?.name ?? id)
        .filter(Boolean);
    } catch {
      memeTemplateNames = opts.memeTemplateIds;
    }
  }

  const topicWithVariant =
    opts.batchVariant && opts.batchVariant > 0
      ? `${opts.topic} (variation ${opts.batchVariant + 1} — fresh angle, same brand)`
      : opts.topic;

  const plan = await planViralMeme({
    brand: brandProfile,
    format,
    goal: opts.goal,
    topic: topicWithVariant,
    platform: opts.platform,
    model: settings.text_model,
    vibeContext,
    memeTemplateNames,
  });

  const carousel = await insertCarousel(supabase, {
    workspace_id: opts.workspaceId,
    combination_id: null,
    title: plan.title.slice(0, 60),
    platform: opts.platform,
    slide_count: plan.slides.length,
    status: "generating",
    content_type: "viral_meme",
    post_caption: plan.postCaption || null,
    hashtags: plan.hashtags.length > 0 ? plan.hashtags : null,
    engine_meta: {
      formatId: plan.formatId,
      goal: opts.goal,
      vibeApplied: Boolean(vibeContext),
      memeTemplateIds: opts.memeTemplateIds ?? [],
      batchVariant: opts.batchVariant ?? 0,
    },
  });

  if (!carousel) {
    return { error: "Failed to create carousel", status: 500 as const };
  }

  const poolIds = (opts.assetIds ?? []).filter(Boolean);
  let assetUrls: string[] = [];
  if (poolIds.length > 0) {
    const { data: rows } = await supabase
      .from("assets")
      .select("id, public_url")
      .eq("workspace_id", opts.workspaceId)
      .in("id", poolIds);
    assetUrls = orderAssetsByIds(poolIds, rows ?? []).map((r) => r.public_url);
  }

  const useMemeLibrary = opts.useMemeLibrary !== false;
  let memeByPosition = new Map<number, { templateId: string; lines: string[] }>();
  if (useMemeLibrary) {
    try {
      const templates = await fetchMemeTemplates();
      const hints = [
        brandProfile.app_category ?? "",
        brandProfile.target_audience ?? "",
        opts.topic,
        opts.goal,
        vibeContext.slice(0, 200),
      ].filter(Boolean);
      memeByPosition = assignMemeTemplatesToSlides(
        plan.slides.map((s) => ({
          position: s.position,
          caption: s.caption,
          role: s.role,
          useUserPhoto: s.useUserPhoto && assetUrls.length > 0,
        })),
        templates,
        hints,
        opts.memeTemplateIds,
      );
    } catch (err) {
      console.warn("[engine] meme library unavailable:", err);
    }
  }

  const engineSlides: EngineSlidePlan[] = plan.slides.map((s) => {
    const meme = memeByPosition.get(s.position);
    return {
      position: s.position,
      role: s.role,
      caption: s.caption,
      visualBrief: s.visualBrief,
      layout: s.layout,
      textPlacement: s.textPlacement,
      textStyle: s.textStyle,
      textAlignment: s.textAlignment,
      useUserPhoto: s.useUserPhoto && assetUrls.length > 0,
      memeTemplateId: meme?.templateId,
      memeLines: meme?.lines,
    };
  });

  const { slideRows, allFailed, allCompleted } = await generateSlidesForPlan({
    supabase,
    workspaceId: opts.workspaceId,
    carouselId: carousel.id,
    slides: engineSlides,
    visualTheme,
    brandIdentity,
    platform: opts.platform,
    assetUrls,
    imageModel: settings.image_model,
  });

  const insertErr = await insertSlides(supabase, slideRows);
  if (insertErr) {
    await supabase.from("carousels").update({ status: "draft" }).eq("id", carousel.id);
    return { error: insertErr, status: 500 as const };
  }

  if (allFailed) {
    await supabase.from("carousels").update({ status: "draft" }).eq("id", carousel.id);
  } else if (allCompleted) {
    await supabase.from("carousels").update({ status: "ready" }).eq("id", carousel.id);
  }

  await logContentEvent(supabase, {
    workspaceId: opts.workspaceId,
    eventType: "generated",
    carouselId: carousel.id,
    platform: opts.platform,
    metadata: { engine: "viral_meme", formatId: plan.formatId },
  });

  return {
    carousel_id: carousel.id,
    content_type: "viral_meme" as const,
    status: allFailed ? "draft" : allCompleted ? "ready" : "generating",
    plan,
  };
}
