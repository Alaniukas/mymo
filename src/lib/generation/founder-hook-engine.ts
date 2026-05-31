import type { SupabaseClient } from "@supabase/supabase-js";
import { brandProfileFromRow } from "@/lib/carousel/variables";
import { orderAssetsByIds } from "@/lib/carousel/studio-asset-references";
import { fetchMediaBuffer, uploadBuffer } from "@/lib/carousel/storage";
import { renderVideoWithOverlay } from "@/lib/carousel/overlay";
import { getVideoAspectForPlatform } from "@/lib/carousel/video";
import { submitImageGeneration } from "@/lib/evolink/client";
import { buildImagePayload } from "@/lib/evolink/models";
import { getModelSettings } from "@/lib/settings/service";
import { logContentEvent } from "@/lib/analytics/events";
import {
  planFounderHook,
  planFounderHookStoryline,
} from "@/lib/founder/plan-founder-hook";
import type { FounderHookPlan, HookVariant } from "@/lib/founder/types";
import type { HookTemplateKind } from "@/lib/hook-templates/types";
import { insertCarousel, insertSlides } from "./run-engine";

type DB = SupabaseClient;

const DEFAULT_HOOK_VARIANTS = 5;
const MAX_HOOK_VARIANTS = 5;
const HOOK_IMAGE_SIZE = "9:16";
// Founder hook reels are always vertical, regardless of where they get posted;
// tagging the carousel platform 'tiktok' makes the whole pipeline use 9:16.
const FOUNDER_PLATFORM = "tiktok";

export type FounderHookSource = "ai" | "premade" | "template";

type ResolvedHookVariant = HookVariant & {
  hookTemplateId?: string;
  premadeVideoUrl?: string | null;
  premadeImageUrl?: string | null;
};

/**
 * Wraps the planner's creative creator description with the technical
 * constraints the image model needs: ultra-realistic, vertical, talking to
 * camera, and crucially NO text (the hook line is burned on as a caption later
 * so it stays crisp and correctly spelled).
 */
function buildHookImagePrompt(creatorPrompt: string): string {
  return [
    "Ultra-realistic, photorealistic vertical 9:16 portrait of a real young woman looking at the camera, like authentic UGC filmed on a modern phone's front camera.",
    `Creator: ${creatorPrompt}.`,
    "Natural skin texture, realistic lighting, candid and believable — not a glossy studio model shot.",
    "Silent emotional reaction — mouth relaxed and closed, NOT mid-speech, NOT talking, NOT lip-syncing. Framed head-and-shoulders for a vertical phone video.",
    "Absolutely NO text, captions, subtitles, logos, watermarks, or UI overlays anywhere in the image.",
  ].join(" ");
}

export type FounderHookEngineResult =
  | { error: string; status: 400 | 404 | 500 }
  | {
      carousel_ids: string[];
      content_type: "founder_hook";
      variant_count: number;
      plan: FounderHookPlan;
    };

/**
 * Founder Hook Reels engine.
 *
 * Produces a set of A/B vertical reels: every reel shares the SAME stitched app
 * demo body (the founder's uploaded clips with minimalist storyline captions
 * burned on once) but opens with a DIFFERENT ultra-realistic AI creator video
 * hook. Each reel is a video carousel (slide 1 = AI hook image -> animated clip
 * via the existing image->video poller; slides 2..N = the pre-rendered app
 * clips). Publishing concatenates the slides into one MP4 per reel.
 */
export async function runFounderHookEngine(
  supabase: DB,
  opts: {
    workspaceId: string;
    topic: string;
    appAssetIds: string[];
    /** How many A/B hook reels to produce (1–5). Defaults to 5. */
    hookCount?: number;
    /** Subtle typos + casual tone on hook lines and storyline captions. */
    imperfect?: boolean;
    /** How hook visuals are sourced. Defaults to AI-generated variants. */
    hookSource?: FounderHookSource;
    /** Published hook_templates ids when hookSource is premade or template. */
    hookTemplateIds?: string[];
  },
): Promise<FounderHookEngineResult> {
  const variantCount = Math.min(
    MAX_HOOK_VARIANTS,
    Math.max(1, Math.round(opts.hookCount ?? DEFAULT_HOOK_VARIANTS)),
  );
  const { data: identity } = await supabase
    .from("app_identities")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .limit(1)
    .maybeSingle();

  if (!identity) {
    return { error: "Complete brand setup first.", status: 400 };
  }

  const clipIds = (opts.appAssetIds ?? []).filter(Boolean);
  if (clipIds.length === 0) {
    return { error: "Upload at least one app demo video.", status: 400 };
  }

  const { data: assetRows } = await supabase
    .from("assets")
    .select("id, public_url, mime_type")
    .eq("workspace_id", opts.workspaceId)
    .in("id", clipIds);

  const orderedClips = orderAssetsByIds(clipIds, assetRows ?? []).filter(
    (a) =>
      typeof (a as { mime_type?: unknown }).mime_type === "string" &&
      ((a as { mime_type: string }).mime_type).startsWith("video/"),
  ) as { id: string; public_url: string; mime_type: string }[];

  if (orderedClips.length === 0) {
    return { error: "No app demo videos found to stitch.", status: 400 };
  }

  const clipUrls = orderedClips.map((a) => a.public_url);
  const settings = await getModelSettings(supabase);
  const brandProfile = brandProfileFromRow(identity);

  const hookSource: FounderHookSource =
    opts.hookSource === "premade" || opts.hookSource === "template"
      ? opts.hookSource
      : "ai";

  let hookVariants: ResolvedHookVariant[] = [];
  let plan: FounderHookPlan;

  if (hookSource === "ai") {
    plan = await planFounderHook({
      brand: brandProfile,
      topic: opts.topic,
      appClipCount: clipUrls.length,
      variantCount,
      platform: FOUNDER_PLATFORM,
      model: settings.text_model,
      imperfect: opts.imperfect,
    });
    hookVariants = plan.hookVariants;
  } else {
    const templateIds = (opts.hookTemplateIds ?? []).filter(Boolean);
    if (templateIds.length === 0) {
      return {
        error: `Select at least one ${hookSource === "premade" ? "premade hook" : "hook template"}.`,
        status: 400,
      };
    }

    const { data: templateRows, error: tplErr } = await supabase
      .from("hook_templates")
      .select(
        "id, hook_line, creator_prompt, motion_prompt, preview_image_url, preview_video_url, kind",
      )
      .in("id", templateIds)
      .eq("kind", hookSource as HookTemplateKind)
      .eq("published", true);

    if (tplErr) {
      console.error("[founder-hook] hook_templates load failed:", tplErr);
      return {
        error: "Hook library is not available yet. Apply migration 026_hook_templates.sql.",
        status: 500,
      };
    }

    const byId = new Map((templateRows ?? []).map((r) => [r.id as string, r]));
    const ordered = templateIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    if (ordered.length === 0) {
      return { error: "Selected hooks were not found.", status: 400 };
    }

    const bodyPlan = await planFounderHookStoryline({
      brand: brandProfile,
      topic: opts.topic,
      appClipCount: clipUrls.length,
      platform: FOUNDER_PLATFORM,
      model: settings.text_model,
      imperfect: opts.imperfect,
    });

    hookVariants = ordered.map((row) => ({
      hookLine: String(row.hook_line),
      creatorPrompt: String(row.creator_prompt),
      motionPrompt: String(row.motion_prompt),
      hookTemplateId: row.id as string,
      premadeVideoUrl:
        typeof row.preview_video_url === "string" ? row.preview_video_url : null,
      premadeImageUrl:
        typeof row.preview_image_url === "string" ? row.preview_image_url : null,
    }));

    plan = {
      title: bodyPlan.title,
      postCaption: bodyPlan.postCaption,
      hashtags: bodyPlan.hashtags,
      hookVariants,
      storyline: bodyPlan.storyline,
    };
  }

  const aspect = getVideoAspectForPlatform(FOUNDER_PLATFORM); // 9:16

  // Burn the storyline captions onto each app clip ONCE, then reuse the result
  // across all variants so we don't re-encode the body five times.
  const bodyId = crypto.randomUUID();
  const bodyClips: { url: string; caption: string }[] = [];
  for (let i = 0; i < clipUrls.length; i++) {
    const caption = plan.storyline[i] ?? "";
    const dl = await fetchMediaBuffer(clipUrls[i]!);
    if (!dl) {
      console.warn(`[founder-hook] could not download app clip ${i}`);
      continue;
    }

    let buffer = dl.buffer;
    if (caption.trim()) {
      try {
        buffer = await renderVideoWithOverlay(buffer, caption, "value", aspect, {
          layout: "tiktok_caption",
        });
      } catch (err) {
        console.error(`[founder-hook] overlay app clip ${i} failed:`, err);
      }
    }

    const path = `${opts.workspaceId}/founder-body/${bodyId}/${i}.mp4`;
    const uploaded = await uploadBuffer(
      supabase,
      buffer,
      path,
      "video/mp4",
      "carousels",
    );
    if (uploaded.ok) {
      bodyClips.push({ url: uploaded.publicUrl, caption });
    } else {
      console.warn(`[founder-hook] upload app clip ${i} failed`);
    }
  }

  if (bodyClips.length === 0) {
    return { error: "Failed to process the uploaded app videos.", status: 500 };
  }

  const carouselIds: string[] = [];

  for (let v = 0; v < hookVariants.length; v++) {
    const variant = hookVariants[v]!;
    const slideCount = 1 + bodyClips.length;

    const carousel = await insertCarousel(supabase, {
      workspace_id: opts.workspaceId,
      combination_id: null,
      title: `${plan.title} - hook ${v + 1}`.slice(0, 60),
      platform: FOUNDER_PLATFORM,
      media_type: "video",
      slide_count: slideCount,
      status: "generating",
      content_type: "founder_hook",
      post_caption: plan.postCaption || null,
      hashtags: plan.hashtags.length > 0 ? plan.hashtags : null,
      engine_meta: {
        engine: "founder_hook",
        variant: v,
        hookLine: variant.hookLine,
        motionPrompt: variant.motionPrompt,
        hookSource,
        hookTemplateId: variant.hookTemplateId ?? null,
        bodyId,
        appClipCount: bodyClips.length,
      },
    });

    if (!carousel) continue;

    const hookPrompt = buildHookImagePrompt(variant.creatorPrompt);
    const premadeVideo = variant.premadeVideoUrl?.trim();
    const premadeImage = variant.premadeImageUrl?.trim();

    let hookSlide: Record<string, unknown>;

    if (premadeVideo) {
      // Fully pre-rendered hook clip — skip image + animation pipeline.
      hookSlide = {
        carousel_id: carousel.id,
        position: 1,
        caption: variant.hookLine,
        prompt: `[hook-template:${variant.hookTemplateId ?? "video"}]`,
        status: "completed",
        evolink_task_id: null,
        image_url: premadeImage || null,
        storage_path: null,
        base_image_url: null,
        role: "hook",
        layout: "tiktok_caption",
        video_status: "completed",
        video_url: premadeVideo,
        text_zone: { placement: "center", style: "headline", alignment: "center" },
      };
    } else if (premadeImage) {
      // Still provided — animate via the hook video model in carousel-status.
      hookSlide = {
        carousel_id: carousel.id,
        position: 1,
        caption: variant.hookLine,
        prompt: hookPrompt,
        status: "completed",
        evolink_task_id: null,
        image_url: premadeImage,
        storage_path: null,
        base_image_url: premadeImage,
        role: "hook",
        layout: "tiktok_caption",
        video_status: "pending",
        text_zone: { placement: "center", style: "headline", alignment: "center" },
      };
    } else {
      const { payload } = buildImagePayload(settings.image_model, hookPrompt, {
        size: HOOK_IMAGE_SIZE,
        quality: "medium",
      });

      let hookStatus: "generating" | "failed" = "failed";
      let hookTaskId: string | null = null;
      try {
        const task = await submitImageGeneration(payload);
        hookTaskId = task.id;
        hookStatus = "generating";
      } catch (err) {
        console.error(
          `[founder-hook] hook image submit (variant ${v}) failed:`,
          err,
        );
      }

      hookSlide = {
        carousel_id: carousel.id,
        position: 1,
        caption: variant.hookLine,
        prompt: hookPrompt,
        status: hookStatus,
        evolink_task_id: hookTaskId,
        image_url: null,
        storage_path: null,
        base_image_url: null,
        role: "hook",
        layout: "tiktok_caption",
        video_status: "pending",
        text_zone: { placement: "center", style: "headline", alignment: "center" },
      };
    }

    const slideRows: Record<string, unknown>[] = [
      hookSlide,
      ...bodyClips.map((clip, i) => ({
        carousel_id: carousel.id,
        position: i + 2,
        caption: clip.caption,
        prompt: `[app-clip:${i}]`,
        status: "completed",
        evolink_task_id: null,
        image_url: null,
        storage_path: null,
        base_image_url: null,
        role: "value",
        layout: "tiktok_caption",
        video_status: "completed",
        video_url: clip.url,
        text_zone: { placement: "center", style: "body", alignment: "center" },
      })),
    ];

    const insertErr = await insertSlides(supabase, slideRows);
    if (insertErr) {
      await supabase
        .from("carousels")
        .update({ status: "draft" })
        .eq("id", carousel.id);
      console.error(
        `[founder-hook] insert slides (variant ${v}) failed:`,
        insertErr,
      );
      continue;
    }

    carouselIds.push(carousel.id);

    // Drive the image->video phase with the planned emotional performance (e.g.
    // tearing up, then a joyful smile) instead of a generic camera push-in.
    // Best-effort: silently skipped if migration 025 (motion_prompt) is not yet
    // applied, in which case the hook simply animates with the default motion.
    if (!premadeVideo && variant.motionPrompt?.trim()) {
      const { error: motionErr } = await supabase
        .from("carousel_slides")
        .update({ motion_prompt: variant.motionPrompt })
        .eq("carousel_id", carousel.id)
        .eq("position", 1);
      if (motionErr) {
        console.warn(
          `[founder-hook] motion_prompt not stored (variant ${v}; apply migration 025?):`,
          motionErr.message,
        );
      }
    }

    await logContentEvent(supabase, {
      workspaceId: opts.workspaceId,
      eventType: "generated",
      carouselId: carousel.id,
      platform: FOUNDER_PLATFORM,
      metadata: { engine: "founder_hook", variant: v },
    });
  }

  if (carouselIds.length === 0) {
    return { error: "Failed to create founder hook reels.", status: 500 };
  }

  return {
    carousel_ids: carouselIds,
    content_type: "founder_hook",
    variant_count: carouselIds.length,
    plan,
  };
}
