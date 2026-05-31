// Shared carousel → WoopSocial publishing logic.
//
// Both the immediate-publish route (`/api/publish/[carouselId]`) and the
// scheduler (`/api/schedule/*`) need to turn a carousel into a WoopSocial post:
// resolve the caption, build the media (image carousel or combined video clip),
// assemble the post body, validate it, and create it. The only difference is the
// `schedule` (PUBLISH_NOW vs SCHEDULE_FOR_LATER), so that logic lives here once.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMediaPostBody,
  createPost,
  toWoopPlatform,
  uploadMediaFromBuffer,
  uploadMediaFromUrl,
  validatePost,
  type AppPlatform,
  type MediaKind,
  type PostSchedule,
  type WoopPost,
  type WoopSocialAccountPost,
} from "./woopsocial";
import { fetchMediaBuffer } from "@/lib/carousel/storage";
import { overlayDimsForAspect } from "@/lib/carousel/overlay";
import { renderClipReel } from "@/lib/carousel/video-export";
import { getVideoAspectForPlatform } from "@/lib/carousel/video";
import {
  aggregateSlideCaptionsForPublish,
  formatHashtagsForPublish,
} from "@/lib/carousel/prompts";

type DB = SupabaseClient;

export interface CarouselRow {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
  combination_id: string | null;
  media_type: string;
  music: { playUrl?: string | null } | null;
  post_caption?: string | null;
  hashtags?: string[] | null;
  framework_id?: string | null;
}

// Tolerant carousel read: media_type/music (005/007) and post_caption/hashtags
// (010) may be absent on a database that hasn't run those migrations yet.
export async function loadCarousel(
  supabase: DB,
  carouselId: string,
): Promise<CarouselRow | null> {
  const withFramework = await supabase
    .from("carousels")
    .select(
      "id, workspace_id, title, status, combination_id, media_type, music, post_caption, hashtags, framework_id",
    )
    .eq("id", carouselId)
    .single();

  if (!withFramework.error && withFramework.data) {
    return withFramework.data as CarouselRow;
  }

  const full = await supabase
    .from("carousels")
    .select("id, workspace_id, title, status, combination_id, media_type, music")
    .eq("id", carouselId)
    .single();

  if (!full.error && full.data) {
    return {
      ...(full.data as CarouselRow),
      post_caption: null,
      hashtags: null,
      framework_id: null,
    };
  }

  const basic = await supabase
    .from("carousels")
    .select("id, workspace_id, title, status, combination_id")
    .eq("id", carouselId)
    .single();

  if (!basic.data) return null;
  return {
    ...(basic.data as Omit<
      CarouselRow,
      "media_type" | "music" | "post_caption" | "hashtags" | "framework_id"
    >),
    media_type: "image",
    music: null,
    post_caption: null,
    hashtags: null,
    framework_id: null,
  };
}

/**
 * Resolves the caption WoopSocial publishes. An angle framework's resolved
 * post caption wins when present (it's written for that angle and already obeys
 * the production rules); otherwise we fall back to the combination caption, then
 * the carousel title. The angle's hashtags are appended as a trailing block.
 */
export async function resolvePublishCaption(
  supabase: DB,
  carousel: CarouselRow,
): Promise<string> {
  let caption: string;
  if (carousel.post_caption && carousel.post_caption.trim()) {
    caption = carousel.post_caption.trim();
  } else {
    caption = carousel.title;
    if (carousel.combination_id) {
      const { data: combination } = await supabase
        .from("combinations")
        .select("caption")
        .eq("id", carousel.combination_id)
        .single();
      caption = combination?.caption ?? caption;
    }

    if (!carousel.post_caption?.trim()) {
      const { data: slideRows } = await supabase
        .from("carousel_slides")
        .select("position, caption")
        .eq("carousel_id", carousel.id)
        .order("position", { ascending: true });
      const aggregated = aggregateSlideCaptionsForPublish(slideRows ?? []);
      if (aggregated) caption = aggregated;
    }
  }

  const tags = Array.isArray(carousel.hashtags) ? carousel.hashtags : [];
  const formatted = formatHashtagsForPublish(tags.map(String)).join(" ");
  return formatted ? `${caption}\n\n${formatted}` : caption;
}

/**
 * Normalizes a user-edited caption from the posting UI. The editor shows the
 * full text (hashtags included), so it's published verbatim — except a trailing
 * hashtag block is re-run through `formatHashtagsForPublish` for consistency.
 */
export function normalizePublishCaptionOverride(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\n\n+/);
  if (parts.length < 2) return trimmed;
  const last = parts[parts.length - 1]!;
  if (!/^#\w/.test(last.trim())) return trimmed;
  const body = parts.slice(0, -1).join("\n\n").trim();
  const tags = last
    .split(/\s+/)
    .filter((t) => t.startsWith("#"))
    .map((t) => t.replace(/^#+/, ""));
  const formatted = formatHashtagsForPublish(tags).join(" ");
  return formatted ? `${body}\n\n${formatted}` : body;
}

/** Image carousel → ordered media IDs for each completed slide image. */
async function buildImageMedia(
  supabase: DB,
  carouselId: string,
  projectId: string,
): Promise<string[]> {
  const { data: slides } = await supabase
    .from("carousel_slides")
    .select("image_url, status, position")
    .eq("carousel_id", carouselId)
    .eq("status", "completed")
    .order("position", { ascending: true });

  const imageUrls = (slides ?? [])
    .map((s) => s.image_url)
    .filter((url): url is string => !!url);

  if (imageUrls.length === 0) {
    throw new Error("No completed slide images to publish");
  }

  return Promise.all(imageUrls.map((url) => uploadMediaFromUrl(projectId, url)));
}

/**
 * Video carousel → one combined MP4. Downloads the finished per-slide clips,
 * concatenates them into a single video (optionally with the carousel's
 * attached trending sound), and uploads it to the media library.
 */
async function buildVideoMedia(
  supabase: DB,
  carousel: CarouselRow,
  platform: string,
  projectId: string,
  includeSound: boolean,
): Promise<string[]> {
  const { data: slides } = await supabase
    .from("carousel_slides")
    .select("video_url, video_status, position")
    .eq("carousel_id", carousel.id)
    .eq("video_status", "completed")
    .order("position", { ascending: true });

  const clipUrls = (slides ?? [])
    .map((s) => s.video_url)
    .filter((url): url is string => !!url);

  if (clipUrls.length === 0) {
    throw new Error("No completed video clips to publish");
  }

  const clips: Buffer[] = [];
  for (const url of clipUrls) {
    const dl = await fetchMediaBuffer(url);
    if (dl) clips.push(dl.buffer);
  }
  if (clips.length === 0) {
    throw new Error("Could not download the video clips to combine");
  }

  let audio: Buffer | null = null;
  if (includeSound && carousel.music?.playUrl) {
    const dl = await fetchMediaBuffer(carousel.music.playUrl);
    audio = dl?.buffer ?? null;
  }

  const { data: pf } = await supabase
    .from("carousels")
    .select("platform")
    .eq("id", carousel.id)
    .single();
  const aspect = getVideoAspectForPlatform(pf?.platform ?? platform);
  const { width, height } = overlayDimsForAspect(aspect);
  const video = await renderClipReel({ clips, width, height, audio });

  const mediaId = await uploadMediaFromBuffer(
    projectId,
    video,
    `${carousel.id}.mp4`,
    "video/mp4",
  );
  return [mediaId];
}

export interface SubmitCarouselInput {
  carousel: CarouselRow;
  platform: AppPlatform;
  socialAccountId: string;
  projectId: string;
  caption: string;
  autoAddMusic: boolean;
  /** Defaults to PUBLISH_NOW. Pass SCHEDULE_FOR_LATER to queue the post. */
  schedule?: PostSchedule;
}

export interface SubmitCarouselResult {
  post: WoopPost;
  accountPost: WoopSocialAccountPost | undefined;
  platformPostId: string;
}

/**
 * Builds the media + post body for a carousel and submits it to WoopSocial.
 * Throws on validation failure or an immediately-failed delivery; callers own
 * the local `social_posts` bookkeeping.
 */
export async function submitCarouselToWoop(
  supabase: DB,
  input: SubmitCarouselInput,
): Promise<SubmitCarouselResult> {
  const kind: MediaKind =
    input.carousel.media_type === "video" ? "video" : "image";

  const mediaIds =
    kind === "video"
      ? await buildVideoMedia(
          supabase,
          input.carousel,
          input.platform,
          input.projectId,
          input.autoAddMusic,
        )
      : await buildImageMedia(supabase, input.carousel.id, input.projectId);

  const postBody = buildMediaPostBody({
    platform: toWoopPlatform(input.platform),
    socialAccountId: input.socialAccountId,
    caption: input.caption,
    mediaIds,
    kind,
    schedule: input.schedule,
    autoAddMusic: input.autoAddMusic,
  });

  const validation = await validatePost(postBody);
  if (!validation.isValid) {
    throw new Error(
      validation.errors[0]?.message || "Post failed WoopSocial validation",
    );
  }

  const post = await createPost(postBody);
  const accountPost = post.socialAccountPosts?.[0];

  if (accountPost?.deliveryStatus === "FAILED") {
    throw new Error(accountPost.errorMessage || "Publishing failed");
  }

  return {
    post,
    accountPost,
    platformPostId: accountPost?.externalPostId || post.id,
  };
}
