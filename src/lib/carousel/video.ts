import type { SupabaseClient } from "@supabase/supabase-js";
import {
  submitVideoGeneration,
  checkTaskStatus,
  EvolinkError,
} from "@/lib/evolink/client";
import { buildVideoPayload } from "@/lib/evolink/video-models";
import { renderVideoWithOverlay } from "./overlay";
import type { BrandIdentity } from "./prompts";

/**
 * The video phase of a carousel: each generated slide IMAGE is used as the
 * first frame of an EvoLink image-to-video call, producing a short clip. The
 * image phase still uses the existing status/evolink_task_id/image_url columns;
 * the video phase below uses the video_* columns added in migration 005.
 */
export interface CarouselSlideRow {
  id: string;
  position: number;
  caption: string | null;
  prompt: string | null;
  image_url: string | null;
  storage_path: string | null;
  status: string;
  evolink_task_id: string | null;
  video_status: string | null;
  video_task_id: string | null;
  video_url: string | null;
  video_storage_path: string | null;
  created_at?: string;
  // Framework metadata (migration 010); absent on un-migrated DBs.
  layout?: string | null;
  role?: string | null;
}

// Video clips are larger and slower than images, so we give the video phase a
// longer staleness backstop measured from slide creation.
const VIDEO_STALE_MS = 30 * 60 * 1000;

const VIDEO_ASPECTS: Record<string, string> = {
  instagram: "1:1",
  tiktok: "9:16",
  both: "3:4",
};

export function getVideoAspectForPlatform(platform: string): string {
  return VIDEO_ASPECTS[platform] ?? "1:1";
}

function roleForSlide(position: number, totalSlides: number): string {
  if (position === 1) return "hook";
  if (position >= totalSlides) return "cta";
  return "value";
}

// ── Motion prompt ─────────────────────────────────────────────────────────
// A single, shared cinematic motion language across every slide is what makes
// the clips read as one continuous carousel idea rather than disjointed shots.

export function buildVideoPrompt(
  caption: string,
  role: string,
  brand: BrandIdentity,
): string {
  const tone = brand.brand_tone ?? "professional and modern";

  const energy =
    role === "hook"
      ? "a punchy, attention-grabbing reveal with a touch of energy"
      : role === "cta"
        ? "a warm, inviting motion that gently draws the viewer toward the call to action"
        : "a steady, premium motion that keeps the message clear";

  const parts = [
    "Animate this still image into a short, seamlessly looping social-media clip.",
    "Use subtle, smooth cinematic motion: a gentle camera push-in with soft parallax and depth, plus natural ambient movement in the background.",
    "Keep any on-image text perfectly static, sharp, and legible — do not warp, move, distort, or add any text.",
    `Motion style: ${energy}.`,
    `Overall visual tone: ${tone}. Keep the look consistent and on-brand with the rest of the carousel.`,
    "One continuous shot — no scene changes, cuts, captions, or watermarks.",
  ];

  if (caption) {
    parts.push(`The slide's message is: "${caption}".`);
  }

  return parts.join(" ");
}

export function isStaleVideo(slide: CarouselSlideRow): boolean {
  if (!slide.created_at) return false;
  const ageMs = Date.now() - new Date(slide.created_at).getTime();
  return ageMs > VIDEO_STALE_MS;
}

export async function markSlideVideoFailed(
  supabase: SupabaseClient,
  slide: CarouselSlideRow,
): Promise<void> {
  await supabase
    .from("carousel_slides")
    .update({ video_status: "failed" })
    .eq("id", slide.id);
  slide.video_status = "failed";
}

/**
 * Submit the image-to-video task for a slide whose image is ready. Uses an
 * optimistic claim (pending -> generating) so two overlapping status polls
 * cannot submit the same clip twice.
 */
export async function submitSlideVideo(
  supabase: SupabaseClient,
  slide: CarouselSlideRow,
  opts: {
    model: string;
    platform: string;
    brand: BrandIdentity;
    totalSlides: number;
  },
): Promise<void> {
  if (!slide.image_url) {
    await markSlideVideoFailed(supabase, slide);
    return;
  }

  const { data: claimed } = await supabase
    .from("carousel_slides")
    .update({ video_status: "generating" })
    .eq("id", slide.id)
    .or("video_status.is.null,video_status.eq.pending")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    // Another poll already claimed this slide; reflect that locally.
    slide.video_status = "generating";
    return;
  }

  slide.video_status = "generating";

  const role = roleForSlide(slide.position, opts.totalSlides);
  const prompt = buildVideoPrompt(slide.caption ?? "", role, opts.brand);
  const { payload } = buildVideoPayload(opts.model, prompt, {
    imageUrls: [slide.image_url],
    aspect: getVideoAspectForPlatform(opts.platform),
  });

  try {
    const task = await submitVideoGeneration(payload);
    await supabase
      .from("carousel_slides")
      .update({ video_task_id: task.id })
      .eq("id", slide.id);
    slide.video_task_id = task.id;
  } catch (err) {
    console.error(`[carousel-video] submit slide ${slide.id} failed:`, err);
    await markSlideVideoFailed(supabase, slide);
  }
}

/**
 * Download a finished clip from EvoLink and re-host it in the public `carousels`
 * bucket so we own a stable URL (EvoLink result links expire after 24h).
 */
export async function completeSlideVideo(
  supabase: SupabaseClient,
  slide: CarouselSlideRow,
  workspaceId: string,
  carouselId: string,
  videoUrl: string,
  opts: { platform: string; totalSlides: number },
): Promise<void> {
  try {
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error("Failed to download generated video");

    let buffer: Buffer = Buffer.from(await res.arrayBuffer());
    let contentType = res.headers.get("content-type") || "video/mp4";

    // Burn the caption onto the finished clip so the text is crisp and
    // perfectly static. If compositing fails, keep the un-overlaid clip rather
    // than failing the slide.
    const caption = slide.caption?.trim();
    if (caption) {
      try {
        buffer = await renderVideoWithOverlay(
          buffer,
          caption,
          roleForSlide(slide.position, opts.totalSlides),
          getVideoAspectForPlatform(opts.platform),
        );
        contentType = "video/mp4";
      } catch (err) {
        console.error(`[carousel-video] overlay slide ${slide.id} failed:`, err);
      }
    }

    const storagePath = `${workspaceId}/${carouselId}/${slide.id}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("carousels")
      .upload(
        storagePath,
        new Blob([new Uint8Array(buffer)], { type: contentType }),
        {
          contentType,
          upsert: true,
        },
      );

    if (uploadError) {
      console.error("[carousel-video] upload error:", uploadError);
      // Fall back to the EvoLink URL so the slide is not stuck forever.
      await supabase
        .from("carousel_slides")
        .update({
          video_status: "completed",
          video_url: videoUrl,
          video_storage_path: null,
        })
        .eq("id", slide.id);

      slide.video_status = "completed";
      slide.video_url = videoUrl;
      slide.video_storage_path = null;
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from("carousels")
      .getPublicUrl(storagePath);

    await supabase
      .from("carousel_slides")
      .update({
        video_status: "completed",
        video_url: publicUrl.publicUrl,
        video_storage_path: storagePath,
      })
      .eq("id", slide.id);

    slide.video_status = "completed";
    slide.video_url = publicUrl.publicUrl;
    slide.video_storage_path = storagePath;
  } catch (err) {
    console.error(`[carousel-video] complete slide ${slide.id}:`, err);
    await markSlideVideoFailed(supabase, slide);
  }
}

/**
 * Phase 2 of a video carousel, run from the status poller: kick off the
 * image-to-video task for each slide whose image just finished, and advance any
 * clip already in flight. Slides are mutated in place so the caller can roll up
 * the carousel status from the same array.
 */
export async function runVideoPhase(
  supabase: SupabaseClient,
  slides: CarouselSlideRow[],
  opts: {
    workspaceId: string;
    carouselId: string;
    model: string;
    platform: string;
    brand: BrandIdentity;
    totalSlides: number;
  },
): Promise<void> {
  for (const slide of slides) {
    // 2a — image is ready and the clip hasn't started: kick it off.
    if (
      slide.status === "completed" &&
      slide.image_url &&
      (slide.video_status === null || slide.video_status === "pending") &&
      !slide.video_task_id
    ) {
      await submitSlideVideo(supabase, slide, {
        model: opts.model,
        platform: opts.platform,
        brand: opts.brand,
        totalSlides: opts.totalSlides,
      });
      continue;
    }

    // 2b — a clip is in flight: poll it.
    if (slide.video_status === "generating" && slide.video_task_id) {
      if (isStaleVideo(slide)) {
        await markSlideVideoFailed(supabase, slide);
        continue;
      }

      try {
        const task = await checkTaskStatus(slide.video_task_id);
        if (task.status === "completed" && task.results?.[0]) {
          await completeSlideVideo(
            supabase,
            slide,
            opts.workspaceId,
            opts.carouselId,
            task.results[0],
            { platform: opts.platform, totalSlides: opts.totalSlides },
          );
        } else if (task.status === "failed") {
          await markSlideVideoFailed(supabase, slide);
        }
      } catch (err) {
        if (err instanceof EvolinkError && err.status === 404) {
          await markSlideVideoFailed(supabase, slide);
        } else {
          console.error(`[carousel-video] slide ${slide.id} check failed:`, err);
        }
      }
    }
  }
}
