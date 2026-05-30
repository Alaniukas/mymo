import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildMediaPostBody,
  createPost,
  isSupportedPlatform,
  toWoopPlatform,
  uploadMediaFromBuffer,
  uploadMediaFromUrl,
  validatePost,
  type MediaKind,
} from "@/lib/social/woopsocial";
import { fetchMediaBuffer } from "@/lib/carousel/storage";
import { overlayDimsForAspect } from "@/lib/carousel/overlay";
import { renderClipReel } from "@/lib/carousel/video-export";
import { getVideoAspectForPlatform } from "@/lib/carousel/video";
import { logContentEvent } from "@/lib/analytics/events";

// Video carousels are combined into one MP4 with ffmpeg before publishing, so
// this route needs the Node runtime and extra headroom for download + encode.
export const runtime = "nodejs";
export const maxDuration = 60;

type DB = Awaited<ReturnType<typeof createClient>>;

interface CarouselRow {
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
async function loadCarousel(
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
async function resolvePublishCaption(
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
  }

  const tags = Array.isArray(carousel.hashtags) ? carousel.hashtags : [];
  const formatted = tags
    .map((t) => `#${String(t).replace(/^#+/, "").trim()}`)
    .filter((t) => t.length > 1)
    .join(" ");
  return formatted ? `${caption}\n\n${formatted}` : caption;
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

  // Mirror each completed slide into the WoopSocial media library (order kept).
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

  // Target the clips' native aspect (the carousel's creation platform) so the
  // combined reel isn't re-letterboxed; fall back to the publish platform.
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

/**
 * Returns the caption the posting UI prefills its editor with — the same string
 * publishing would use by default (angle caption + hashtags) — so the user edits
 * the real default rather than a guess.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { carouselId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const carousel = await loadCarousel(supabase, carouselId);
    if (!carousel) {
      return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", carousel.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const caption = await resolvePublishCaption(supabase, carousel);

    return NextResponse.json({
      caption,
      media_type: carousel.media_type,
      status: carousel.status,
    });
  } catch (error) {
    console.error("[publish:GET] error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { carouselId } = await params;

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
      platform,
      social_connection_id,
      auto_add_music = true,
      caption: captionOverride,
    } = body;

    if (!platform || !social_connection_id) {
      return NextResponse.json(
        { error: "platform and social_connection_id are required" },
        { status: 400 },
      );
    }

    if (!isSupportedPlatform(platform)) {
      return NextResponse.json(
        { error: `Unsupported platform: ${platform}` },
        { status: 400 },
      );
    }

    const carousel = await loadCarousel(supabase, carouselId);
    if (!carousel) {
      return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", carousel.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: connection } = await supabase
      .from("social_connections")
      .select("id, platform, woopsocial_account_id, woopsocial_project_id")
      .eq("id", social_connection_id)
      .eq("workspace_id", workspace.id)
      .eq("platform", platform)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Social connection not found" },
        { status: 404 },
      );
    }

    if (!connection.woopsocial_account_id || !connection.woopsocial_project_id) {
      return NextResponse.json(
        { error: "This connection is missing WoopSocial details. Reconnect the account." },
        { status: 400 },
      );
    }

    // An edited caption from the posting UI is published verbatim (it already
    // shows the user the full text, hashtags included); otherwise fall back to
    // the angle/combination caption resolution.
    const trimmedOverride =
      typeof captionOverride === "string" ? captionOverride.trim() : "";
    const caption =
      trimmedOverride || (await resolvePublishCaption(supabase, carousel));

    const { data: postRecord, error: insertError } = await supabase
      .from("social_posts")
      .insert({
        carousel_id: carouselId,
        social_connection_id: connection.id,
        platform,
        status: "publishing",
      })
      .select("id")
      .single();

    if (insertError || !postRecord) {
      return NextResponse.json(
        { error: "Failed to create publish record" },
        { status: 500 },
      );
    }

    try {
      const projectId = connection.woopsocial_project_id;
      const kind: MediaKind = carousel.media_type === "video" ? "video" : "image";

      // Build the media for this post: a single combined clip for video
      // carousels, or one media item per slide image for image carousels.
      const mediaIds =
        kind === "video"
          ? await buildVideoMedia(
              supabase,
              carousel,
              platform,
              projectId,
              Boolean(auto_add_music),
            )
          : await buildImageMedia(supabase, carouselId, projectId);

      const postBody = buildMediaPostBody({
        platform: toWoopPlatform(platform),
        socialAccountId: connection.woopsocial_account_id,
        caption,
        mediaIds,
        kind,
        autoAddMusic: Boolean(auto_add_music),
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

      const platformPostId = accountPost?.externalPostId || post.id;

      await supabase
        .from("social_posts")
        .update({
          status: "published",
          platform_post_id: platformPostId,
          published_at: new Date().toISOString(),
        })
        .eq("id", postRecord.id);

      await supabase
        .from("carousels")
        .update({ status: "published" })
        .eq("id", carouselId);

      // Angle analytics: this angle made it all the way to a live post.
      await logContentEvent(supabase, {
        workspaceId: workspace.id,
        eventType: "published",
        carouselId,
        frameworkId: carousel.framework_id ?? null,
        platform,
      });

      return NextResponse.json({
        status: "published",
        post_id: platformPostId,
        post_url: accountPost?.externalPostUrl ?? null,
        platform,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      console.error(`[publish/${platform}] error:`, err);

      await supabase
        .from("social_posts")
        .update({ status: "failed", error_message: message })
        .eq("id", postRecord.id);

      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (error) {
    console.error("[publish] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
