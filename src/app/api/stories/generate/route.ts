import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { runBrandStoryEngine } from "@/lib/generation/run-engine";
import type { BrandStoryGoal } from "@/lib/stories/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_GOALS: BrandStoryGoal[] = [
  "story",
  "launch",
  "event",
  "recap",
  "educate",
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
    const goal = VALID_GOALS.includes(body?.goal) ? body.goal : "story";
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const context = typeof body?.context === "string" ? body.context.trim() : "";
    const platform =
      body?.platform === "tiktok" || body?.platform === "both"
        ? body.platform
        : "instagram";
    const slideCount =
      typeof body?.slide_count === "number" ? body.slide_count : 5;
    const assetIds = Array.isArray(body?.asset_ids)
      ? body.asset_ids.filter((x: unknown) => typeof x === "string")
      : [];

    if (!topic && !context) {
      return NextResponse.json(
        { error: "Add a topic or paste context (reels, events, posts)." },
        { status: 400 },
      );
    }

    const result = await runBrandStoryEngine(supabase, {
      workspaceId,
      goal,
      topic,
      context,
      slideCount,
      platform,
      assetIds,
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[stories/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
