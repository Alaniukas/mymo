import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isSupportedPlatform } from "@/lib/social/woopsocial";
import {
  loadCarousel,
  resolvePublishCaption,
  submitCarouselToWoop,
} from "@/lib/social/publish-carousel";

// Scheduling uploads media for each carousel, so this can run long; cap the
// batch and use the Node runtime with headroom.
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PER_RUN = 10;

/**
 * Auto-fills the posting queue: takes the workspace's ready, not-yet-queued
 * carousels (oldest first) and schedules them onto the provided future time
 * slots via WoopSocial's native SCHEDULE_FOR_LATER. Times are computed
 * client-side (local timezone) and passed as ISO strings.
 */
export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 3, windowMs: 60_000 });
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
    const platform = body?.platform;
    const connectionId = body?.social_connection_id;
    const autoAddMusic = body?.auto_add_music ?? true;
    const rawTimes: unknown = body?.schedule_times;

    if (!platform || !connectionId) {
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

    const now = Date.now();
    const times = (Array.isArray(rawTimes) ? rawTimes : [])
      .filter((t): t is string => typeof t === "string")
      .map((t) => new Date(t))
      .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now + 60_000)
      .sort((a, b) => a.getTime() - b.getTime())
      .slice(0, MAX_PER_RUN);

    if (times.length === 0) {
      return NextResponse.json(
        { error: "No valid future time slots provided" },
        { status: 400 },
      );
    }

    const { data: connection } = await supabase
      .from("social_connections")
      .select(
        "id, workspace_id, platform, woopsocial_account_id, woopsocial_project_id",
      )
      .eq("id", connectionId)
      .eq("platform", platform)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Social connection not found" },
        { status: 404 },
      );
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", connection.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!connection.woopsocial_account_id || !connection.woopsocial_project_id) {
      return NextResponse.json(
        { error: "This connection is missing WoopSocial details. Reconnect the account." },
        { status: 400 },
      );
    }

    // Ready carousels in this workspace that aren't already queued or live.
    const { data: readyCarousels } = await supabase
      .from("carousels")
      .select("id, created_at")
      .eq("workspace_id", connection.workspace_id)
      .eq("status", "ready")
      .order("created_at", { ascending: true });

    const candidateIds = (readyCarousels ?? []).map((c) => c.id);
    if (candidateIds.length === 0) {
      return NextResponse.json({ scheduled: 0, items: [], message: "No ready carousels to schedule." });
    }

    const { data: existing } = await supabase
      .from("social_posts")
      .select("carousel_id, status")
      .in("carousel_id", candidateIds)
      .in("status", ["scheduled", "publishing", "published"]);
    const taken = new Set((existing ?? []).map((p) => p.carousel_id));

    const queueIds = candidateIds.filter((id) => !taken.has(id)).slice(0, times.length);
    if (queueIds.length === 0) {
      return NextResponse.json({ scheduled: 0, items: [], message: "Everything ready is already scheduled." });
    }

    const scheduled: { carousel_id: string; scheduled_for: string }[] = [];
    const errors: { carousel_id: string; error: string }[] = [];

    for (let i = 0; i < queueIds.length; i++) {
      const carouselId = queueIds[i]!;
      const scheduledFor = times[i]!.toISOString();
      try {
        const carousel = await loadCarousel(supabase, carouselId);
        if (!carousel) throw new Error("Carousel not found");

        const caption = await resolvePublishCaption(supabase, carousel);

        const { data: record } = await supabase
          .from("social_posts")
          .insert({
            carousel_id: carouselId,
            social_connection_id: connection.id,
            platform,
            status: "scheduled",
            scheduled_for: scheduledFor,
          })
          .select("id")
          .single();

        const { platformPostId } = await submitCarouselToWoop(supabase, {
          carousel,
          platform,
          socialAccountId: connection.woopsocial_account_id,
          projectId: connection.woopsocial_project_id,
          caption,
          autoAddMusic: Boolean(autoAddMusic),
          schedule: { type: "SCHEDULE_FOR_LATER", scheduledFor },
        });

        if (record) {
          await supabase
            .from("social_posts")
            .update({ platform_post_id: platformPostId })
            .eq("id", record.id);
        }

        scheduled.push({ carousel_id: carouselId, scheduled_for: scheduledFor });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Schedule failed";
        // Roll back the placeholder row so a failed slot doesn't block re-runs.
        await supabase
          .from("social_posts")
          .delete()
          .eq("carousel_id", carouselId)
          .eq("status", "scheduled")
          .eq("scheduled_for", scheduledFor);
        errors.push({ carousel_id: carouselId, error: message });
      }
    }

    return NextResponse.json({
      scheduled: scheduled.length,
      items: scheduled,
      errors,
    });
  } catch (error) {
    console.error("[schedule/autofill] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
