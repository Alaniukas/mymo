import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildImagePrompt,
  collectAssetUrls,
  extractTemplateStoryline,
  generateStoryline,
  getSizeForPlatform,
  selectStudioReferences,
} from "@/lib/carousel/prompts";
import type { BrandIdentity, AssetRef, Storyline } from "@/lib/carousel/prompts";
import { submitImageGeneration, EvolinkError } from "@/lib/evolink/client";
import { buildImagePayload } from "@/lib/evolink/models";
import { getModelSettings } from "@/lib/settings/service";
import { getUsableFramework } from "@/lib/carousel/frameworks";
import type { FrameworkSlide } from "@/lib/carousel/frameworks";
import { logContentEvent } from "@/lib/analytics/events";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

interface SlideInput {
  position: number;
  role: string;
  caption: string;
}

type DB = Awaited<ReturnType<typeof createClient>>;

// Optional carousel columns added by later migrations (music → 007,
// framework_id/post_caption/hashtags → 010). Stripped on retry so generation
// still works against an un-migrated database.
const OPTIONAL_CAROUSEL_COLS = ["music", "framework_id", "post_caption", "hashtags"];

/** Inserts a carousel, retrying without optional columns if they don't exist. */
async function insertCarousel(
  supabase: DB,
  carouselInsert: Record<string, unknown>,
): Promise<{ id: string } | null> {
  let { data, error } = await supabase
    .from("carousels")
    .insert(carouselInsert)
    .select("id")
    .single();

  if (error) {
    const retry = { ...carouselInsert };
    for (const k of OPTIONAL_CAROUSEL_COLS) delete retry[k];
    ({ data, error } = await supabase
      .from("carousels")
      .insert(retry)
      .select("id")
      .single());
  }

  return error || !data ? null : (data as { id: string });
}

/**
 * Inserts slide rows, retrying without columns that may be missing on an
 * un-migrated database (caption/video_status/layout/role/base_image_url).
 * Returns an error message on failure, or null on success.
 */
async function insertSlides(
  supabase: DB,
  slideRows: Record<string, unknown>[],
): Promise<string | null> {
  const { error } = await supabase.from("carousel_slides").insert(slideRows);
  if (!error) return null;

  const fallbackRows = slideRows.map((row) => {
    const copy = { ...row };
    delete copy.caption;
    delete copy.video_status;
    delete copy.layout;
    delete copy.role;
    delete copy.base_image_url;
    return copy;
  });
  const { error: retryErr } = await supabase
    .from("carousel_slides")
    .insert(fallbackRows);

  return retryErr ? retryErr.message : null;
}

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      combination_id,
      custom_topic,
      template_id,
      framework_id,
      platform = "instagram",
      media_type = "image",
      music,
      post_caption,
      hashtags,
      slides: slidesInput,
      asset_ids: assetIds,
      slide_count: slideCount,
      topic,
    } = body as {
      combination_id?: string;
      custom_topic?: string;
      template_id?: string;
      framework_id?: string;
      platform?: string;
      media_type?: string;
      music?: Record<string, unknown> | null;
      post_caption?: string;
      hashtags?: string[];
      slides?: SlideInput[];
      asset_ids?: string[];
      slide_count?: number;
      topic?: string;
    };

    // Studio mode: the unified, images-first flow. A required template is
    // replicated with the user's pooled assets across a storyline-coherent set
    // of CLEAN slide images; captions are written + burned on afterward, so no
    // `slides` array is sent up front and the slide count is independent of how
    // many assets were uploaded.
    const studioMode =
      Boolean(template_id) && !(Array.isArray(slidesInput) && slidesInput.length > 0);

    // Normalize the optional trending sound to a known, bounded shape so we
    // never persist arbitrary client payloads.
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    const musicJson =
      music && typeof music === "object"
        ? {
            id: str(music.id),
            title: str(music.title),
            author: str(music.author),
            coverUrl: str(music.coverUrl),
            playUrl: str(music.playUrl),
            tiktokUrl: str(music.tiktokUrl),
          }
        : null;
    const hasMusic = Boolean(musicJson?.id);

    if (!studioMode && !slidesInput?.length) {
      return NextResponse.json(
        { error: "slides array with captions is required" },
        { status: 400 },
      );
    }

    if (!["instagram", "tiktok", "both"].includes(platform)) {
      return NextResponse.json(
        { error: "platform must be instagram, tiktok, or both" },
        { status: 400 },
      );
    }

    if (!["image", "video"].includes(media_type)) {
      return NextResponse.json(
        { error: "media_type must be image or video" },
        { status: 400 },
      );
    }

    const activeProjectId = await resolveActiveWorkspaceId(supabase, user.id);

    if (!activeProjectId) {
      return NextResponse.json(
        { error: "No project selected. Create a project first." },
        { status: 404 },
      );
    }
    const workspace = { id: activeProjectId };

    // Select the whole row so the full Variable Dictionary (logo_url, etc.) is
    // available; absent columns on an un-migrated DB are simply undefined.
    const { data: identity } = await supabase
      .from("app_identities")
      .select("*")
      .eq("workspace_id", workspace.id)
      .limit(1)
      .maybeSingle();

    if (!identity) {
      return NextResponse.json(
        { error: "No brand identity found. Complete onboarding first." },
        { status: 400 },
      );
    }

    const { data: assetRows } = await supabase
      .from("assets")
      .select("type, name, public_url")
      .eq("workspace_id", workspace.id);

    const assets: AssetRef[] = (assetRows ?? []).map((a) => ({
      type: a.type as "hook" | "demo",
      name: a.name,
      public_url: a.public_url,
    }));
    const assetImageUrls = collectAssetUrls(assets);
    const hookUrls = assets.filter((a) => a.type === "hook").map((a) => a.public_url);
    const demoUrls = assets.filter((a) => a.type === "demo").map((a) => a.public_url);
    const logoUrl =
      typeof (identity as Record<string, unknown>).logo_url === "string"
        ? ((identity as Record<string, unknown>).logo_url as string)
        : null;

    // Optional angle framework: provides per-slide layout, role and {asset}
    // routing (server-authoritative — not trusted from the client).
    const framework = getUsableFramework(framework_id);
    const fwSlideByPos = new Map<number, FrameworkSlide>();
    if (framework) for (const s of framework.slides) fwSlideByPos.set(s.n, s);

    // Optional template remix: load the chosen template's ordered slide images
    // (RLS allows global + own). Each generated slide references the matching
    // template slide as its primary style guide.
    let templateImageUrls: string[] = [];
    if (template_id) {
      const { data: template } = await supabase
        .from("carousel_templates")
        .select("slides")
        .eq("id", template_id)
        .maybeSingle();

      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      const templateSlides = (template.slides ?? []) as {
        position?: number;
        image_url?: string;
      }[];
      templateImageUrls = templateSlides
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((s) => s.image_url)
        .filter((u): u is string => typeof u === "string" && u.length > 0);
    }
    const useTemplateStyle = templateImageUrls.length > 0;

    let title = custom_topic ?? "Carousel";
    if (combination_id) {
      const { data: combo } = await supabase
        .from("combinations")
        .select("caption")
        .eq("id", combination_id)
        .eq("workspace_id", workspace.id)
        .single();

      if (!combo) {
        return NextResponse.json({ error: "Combination not found" }, { status: 404 });
      }
      title = (combo.caption ?? title).slice(0, 60);
    }

    const brandIdentity: BrandIdentity = {
      brand_tone: identity.brand_tone,
      target_audience: identity.target_audience,
      value_propositions: identity.value_propositions,
      llm_summary: identity.llm_summary,
    };

    const cleanHashtags = Array.isArray(hashtags)
      ? hashtags.filter((h): h is string => typeof h === "string" && h.trim().length > 0)
      : [];

    // ── Studio mode ──────────────────────────────────────────────────────
    // The required template is replicated with the user's pooled assets across
    // a storyline-coherent set of CLEAN, text-free slide images. Slide count is
    // chosen by the user (independent of asset count); captions are written to
    // fit the finished slides and burned on later via /caption + /finalize.
    if (studioMode) {
      if (!useTemplateStyle) {
        return NextResponse.json(
          { error: "A template is required to generate a carousel." },
          { status: 400 },
        );
      }

      const count = Math.min(
        Math.max(
          Math.round(Number(slideCount)) || templateImageUrls.length || 5,
          2,
        ),
        10,
      );

      // Unified asset pool: the selected assets are used TOGETHER as visual
      // source material across slides (never one-asset-per-slide). Empty is OK
      // — the template + brand still drive the look.
      const poolIds = Array.isArray(assetIds)
        ? assetIds.filter((x): x is string => typeof x === "string")
        : [];
      let pooledAssets: AssetRef[] = [];
      if (poolIds.length > 0) {
        const { data: poolRows } = await supabase
          .from("assets")
          .select("type, name, public_url")
          .eq("workspace_id", workspace.id)
          .in("id", poolIds);
        pooledAssets = (poolRows ?? []).map((a) => ({
          type: a.type as "hook" | "demo",
          name: a.name,
          public_url: a.public_url,
        }));
      }
      const topicText = (custom_topic ?? topic ?? "").trim();
      const studioTitle = (topicText || title || "Carousel").slice(0, 60);

      const settings = await getModelSettings(supabase);

      // Reverse-engineer the chosen template's narrative arc first, then plan a
      // NEW storyline that reuses that proven arc and reads as one continuous
      // story for this brand/topic (with a shared visual world across slides).
      const templateStoryline = await extractTemplateStoryline(
        templateImageUrls,
        settings.text_model,
      );

      let storyline: Storyline;
      try {
        storyline = await generateStoryline(
          brandIdentity,
          topicText,
          platform,
          count,
          settings.text_model,
          false,
          templateStoryline,
        );
      } catch (err) {
        console.error("[generate-carousel] storyline planning failed:", err);
        // Fall back to a generic hook → value → cta arc so generation proceeds.
        storyline = {
          visualTheme: "",
          beats: Array.from({ length: count }, (_, i) => ({
            position: i + 1,
            role: i === 0 ? "hook" : i === count - 1 ? "cta" : "value",
            brief: topicText || "on-brand lifestyle visual",
          })),
        };
      }

      const beats = storyline.beats;

      const studioInsert: Record<string, unknown> = {
        workspace_id: workspace.id,
        combination_id: null,
        title: studioTitle,
        platform,
        slide_count: beats.length,
        status: "generating",
      };
      if (hasMusic) studioInsert.music = musicJson;

      const studioCarousel = await insertCarousel(supabase, studioInsert);
      if (!studioCarousel) {
        return NextResponse.json(
          { error: "Failed to create carousel" },
          { status: 500 },
        );
      }

      const size = getSizeForPlatform(platform);
      const total = beats.length;
      const layout = "fullbleed_dark_overlay";
      const slideRows: Record<string, unknown>[] = [];

      for (const beat of beats) {
        const role =
          beat.role ||
          (beat.position === 1
            ? "hook"
            : beat.position === total
              ? "cta"
              : "value");

        // The beat's brief seeds the slide's visual theme only — buildImagePrompt
        // never writes it on the image. The overlay caption is generated to fit
        // the finished slide later (null for now). The shared visualTheme keeps
        // every slide visually consistent from the first slide to the last.
        const imagePrompt = buildImagePrompt(
          beat.brief,
          role,
          beat.position,
          total,
          brandIdentity,
          platform,
          pooledAssets,
          true,
          undefined,
          layout,
          storyline.visualTheme,
        );

        // Per-slide references: the matching template slide leads (drives the
        // layout/style); brand people (hooks) ride the hook + CTA slides, product
        // (demos) the value slides — so the creator isn't pasted onto every slide.
        const slideImageUrls = selectStudioReferences({
          templateUrl:
            templateImageUrls[(beat.position - 1) % templateImageUrls.length],
          assets: pooledAssets,
          role,
        });

        const { payload } = buildImagePayload(settings.image_model, imagePrompt, {
          size,
          quality: "medium",
          image_urls: slideImageUrls.length > 0 ? slideImageUrls : undefined,
        });

        let evolinkTaskId: string | null = null;
        let slideStatus = "pending";
        try {
          const task = await submitImageGeneration(payload);
          evolinkTaskId = task.id;
          slideStatus = "generating";
        } catch (err) {
          console.error(
            `[generate-carousel] studio slide ${beat.position} submission failed:`,
            err,
          );
          slideStatus = "failed";
        }

        slideRows.push({
          carousel_id: studioCarousel.id,
          position: beat.position,
          caption: null,
          prompt: imagePrompt,
          status: slideStatus,
          evolink_task_id: evolinkTaskId,
          layout,
          role,
        });
      }

      const insertErr = await insertSlides(supabase, slideRows);
      if (insertErr) {
        await supabase
          .from("carousels")
          .update({ status: "draft" })
          .eq("id", studioCarousel.id);
        return NextResponse.json(
          { error: "Failed to save slides: " + insertErr },
          { status: 500 },
        );
      }

      const allFailedStudio = slideRows.every((s) => s.status === "failed");
      if (allFailedStudio) {
        await supabase
          .from("carousels")
          .update({ status: "draft" })
          .eq("id", studioCarousel.id);
      } else {
        await logContentEvent(supabase, {
          workspaceId: workspace.id,
          eventType: "generated",
          carouselId: studioCarousel.id,
          frameworkId: null,
          angle: null,
          platform,
        });
      }

      return NextResponse.json({
        carousel_id: studioCarousel.id,
        media_type: "image",
        mode: "studio",
        status: allFailedStudio ? "draft" : "generating",
        slides_submitted: slideRows.filter((s) => s.status === "generating").length,
        slides_failed: slideRows.filter((s) => s.status === "failed").length,
      });
    }

    // ── Single-source path (existing): captions are provided up front. ──────
    const singleSlides: SlideInput[] = slidesInput ?? [];

    const carouselInsert: Record<string, unknown> = {
      workspace_id: workspace.id,
      combination_id: combination_id || null,
      title,
      platform,
      slide_count: singleSlides.length,
      status: "generating",
    };
    // Only set media_type for video carousels so image carousels stay
    // insertable even before migration 005 is applied.
    if (media_type === "video") carouselInsert.media_type = media_type;
    if (hasMusic) carouselInsert.music = musicJson;
    if (framework) carouselInsert.framework_id = framework.id;
    if (typeof post_caption === "string" && post_caption.trim()) {
      carouselInsert.post_caption = post_caption.trim();
    }
    if (cleanHashtags.length > 0) carouselInsert.hashtags = cleanHashtags;

    const carousel = await insertCarousel(supabase, carouselInsert);

    if (!carousel) {
      return NextResponse.json(
        { error: "Failed to create carousel" },
        { status: 500 },
      );
    }

    const settings = await getModelSettings(supabase);
    const size = getSizeForPlatform(platform);
    const totalSlides = singleSlides.length;
    const slideRows = [];

    for (const si of singleSlides) {
      // Framework slides are server-authoritative for layout/role/asset slot;
      // the freeform path keeps the client's role and a default layout.
      const fwSlide = fwSlideByPos.get(si.position);
      const layout = fwSlide?.layout ?? "fullbleed_dark_overlay";
      const role = fwSlide?.role ?? si.role;

      const imagePrompt = buildImagePrompt(
        si.caption,
        role,
        si.position,
        totalSlides,
        brandIdentity,
        platform,
        assets,
        useTemplateStyle,
        fwSlide?.visual,
        layout,
      );

      // Style references for this slide: the matching template image first (so
      // the model prioritizes its design), then the assets routed by the
      // slide's {asset} slot. gpt-image-2 accepts up to 16 reference images.
      const slideImageUrls: string[] = [];
      if (useTemplateStyle) {
        slideImageUrls.push(
          templateImageUrls[(si.position - 1) % templateImageUrls.length],
        );
      }

      if (framework && fwSlide) {
        if (fwSlide.layout === "split_compare") {
          if (hookUrls[0]) slideImageUrls.push(hookUrls[0]);
          if (demoUrls[0]) slideImageUrls.push(demoUrls[0]);
        } else if (fwSlide.asset === "hook") {
          slideImageUrls.push(...hookUrls);
        } else if (fwSlide.asset === "demo") {
          slideImageUrls.push(...demoUrls);
        } else if (fwSlide.asset === "logo" && logoUrl) {
          slideImageUrls.push(logoUrl);
        }
        // No asset slot (e.g. text_only) → render a clean background, no refs.
      } else {
        slideImageUrls.push(...assetImageUrls);
      }

      const cappedImageUrls = Array.from(new Set(slideImageUrls)).slice(0, 16);

      const { payload } = buildImagePayload(settings.image_model, imagePrompt, {
        size,
        quality: "medium",
        image_urls: cappedImageUrls.length > 0 ? cappedImageUrls : undefined,
      });

      let evolinkTaskId: string | null = null;
      let slideStatus = "pending";

      try {
        const task = await submitImageGeneration(payload);
        evolinkTaskId = task.id;
        slideStatus = "generating";
      } catch (err) {
        console.error(`[generate-carousel] slide ${si.position} submission failed:`, err);
        slideStatus = "failed";
      }

      slideRows.push({
        carousel_id: carousel.id,
        position: si.position,
        caption: si.caption,
        prompt: imagePrompt,
        status: slideStatus,
        evolink_task_id: evolinkTaskId,
        layout,
        role,
        // Video carousels animate each image once it completes; seed the video
        // phase as pending so the status poller picks it up.
        ...(media_type === "video" ? { video_status: "pending" } : {}),
      });
    }

    const insertErr = await insertSlides(supabase, slideRows);
    if (insertErr) {
      console.error("[generate-carousel] slide insert failed:", insertErr);
      await supabase
        .from("carousels")
        .update({ status: "draft" })
        .eq("id", carousel.id);

      return NextResponse.json(
        { error: "Failed to save slides: " + insertErr },
        { status: 500 },
      );
    }

    const allFailed = slideRows.every((s) => s.status === "failed");
    if (allFailed) {
      await supabase
        .from("carousels")
        .update({ status: "draft" })
        .eq("id", carousel.id);
    } else {
      // Angle analytics: a real generation kicked off for this framework.
      await logContentEvent(supabase, {
        workspaceId: workspace.id,
        eventType: "generated",
        carouselId: carousel.id,
        frameworkId: framework?.id ?? null,
        angle: framework?.angle ?? null,
        platform,
      });
    }

    return NextResponse.json({
      carousel_id: carousel.id,
      media_type,
      status: allFailed ? "draft" : "generating",
      slides_submitted: slideRows.filter((s) => s.status === "generating").length,
      slides_failed: slideRows.filter((s) => s.status === "failed").length,
    });
  } catch (error) {
    if (error instanceof EvolinkError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[generate-carousel] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
