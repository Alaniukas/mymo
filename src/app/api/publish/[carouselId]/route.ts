import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isSupportedPlatform, type PostSchedule } from "@/lib/social/woopsocial";
import {
  loadCarousel,
  normalizePublishCaptionOverride,
  resolvePublishCaption,
  submitCarouselToWoop,
} from "@/lib/social/publish-carousel";
import { logContentEvent } from "@/lib/analytics/events";

// Video carousels are combined into one MP4 with ffmpeg before publishing, so
// this route needs the Node runtime and extra headroom for download + encode.
export const runtime = "nodejs";
export const maxDuration = 60;

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

/** Parses an optional future timestamp into a SCHEDULE_FOR_LATER schedule. */
function parseSchedule(raw: unknown): {
  schedule?: PostSchedule;
  scheduledFor?: string;
  error?: string;
} {
  if (typeof raw !== "string" || !raw.trim()) return {};
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) {
    return { error: "Invalid schedule time" };
  }
  if (when.getTime() <= Date.now() + 60_000) {
    return { error: "Pick a time at least a minute in the future" };
  }
  const scheduledFor = when.toISOString();
  return {
    scheduledFor,
    schedule: { type: "SCHEDULE_FOR_LATER", scheduledFor },
  };
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
      scheduled_for,
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

    const { schedule, scheduledFor, error: scheduleError } =
      parseSchedule(scheduled_for);
    if (scheduleError) {
      return NextResponse.json({ error: scheduleError }, { status: 400 });
    }
    const isScheduled = Boolean(schedule);

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
    const caption = trimmedOverride
      ? normalizePublishCaptionOverride(trimmedOverride)
      : await resolvePublishCaption(supabase, carousel);

    // Only touch the scheduling columns when actually scheduling, so immediate
    // publishing keeps working on databases that haven't run migration 023 yet.
    const { data: postRecord, error: insertError } = await supabase
      .from("social_posts")
      .insert({
        carousel_id: carouselId,
        social_connection_id: connection.id,
        platform,
        status: isScheduled ? "scheduled" : "publishing",
        ...(isScheduled ? { scheduled_for: scheduledFor } : {}),
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
      const { platformPostId, accountPost } = await submitCarouselToWoop(
        supabase,
        {
          carousel,
          platform,
          socialAccountId: connection.woopsocial_account_id,
          projectId: connection.woopsocial_project_id,
          caption,
          autoAddMusic: Boolean(auto_add_music),
          schedule,
        },
      );

      if (isScheduled) {
        // WoopSocial owns the timer and publishes at `scheduledFor`; we only
        // record the queued post (status flips to published on the next sync).
        await supabase
          .from("social_posts")
          .update({ platform_post_id: platformPostId })
          .eq("id", postRecord.id);

        return NextResponse.json({
          status: "scheduled",
          post_id: platformPostId,
          scheduled_for: scheduledFor,
          platform,
        });
      }

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
