import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { runStoryCarouselEngine } from "@/lib/generation/run-engine";
import type {
  StoryCarouselMediaMode,
  StoryNarrativeAngle,
} from "@/lib/stories/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_MEDIA: StoryCarouselMediaMode[] = ["text_only", "with_images"];
const VALID_ANGLES: StoryNarrativeAngle[] = [
  "follower_growth",
  "brand_experience",
];

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 8, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await resolveActiveWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "No project selected" }, { status: 404 });
    }

    const body = await request.json();
    const mediaMode = VALID_MEDIA.includes(body?.media_mode)
      ? body.media_mode
      : "text_only";
    const narrativeAngle = VALID_ANGLES.includes(body?.narrative_angle)
      ? body.narrative_angle
      : "follower_growth";
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const context = typeof body?.context === "string" ? body.context.trim() : "";
    const platform =
      body?.platform === "tiktok" || body?.platform === "both"
        ? body.platform
        : "instagram";
    const slideCount =
      typeof body?.slide_count === "number" ? body.slide_count : 5;
    const imperfect = Boolean(body?.imperfect);

    if (!topic && !context) {
      return NextResponse.json(
        { error: "Add a story topic or extra context." },
        { status: 400 },
      );
    }

    const result = await runStoryCarouselEngine(supabase, {
      workspaceId,
      mediaMode,
      narrativeAngle,
      topic,
      context,
      slideCount,
      platform,
      imperfect,
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[stories/carousel/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
