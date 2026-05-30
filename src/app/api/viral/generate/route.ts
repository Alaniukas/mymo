import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { runViralMemeEngine } from "@/lib/generation/run-engine";
import { MEME_FORMATS, type ViralGoal } from "@/lib/viral/formats";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_GOALS: ViralGoal[] = [
  "awareness",
  "product",
  "followers",
  "engagement",
];

export async function GET() {
  return NextResponse.json({ formats: MEME_FORMATS });
}

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
    const formatId =
      typeof body?.format_id === "string" ? body.format_id : "pov_relate";
    const goal = VALID_GOALS.includes(body?.goal) ? body.goal : "awareness";
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const platform =
      body?.platform === "tiktok" || body?.platform === "both"
        ? body.platform
        : "instagram";
    const assetIds = Array.isArray(body?.asset_ids)
      ? body.asset_ids.filter((x: unknown) => typeof x === "string")
      : [];
    const useMemeLibrary = body?.use_meme_library !== false;
    const memeTemplateIds = Array.isArray(body?.meme_template_ids)
      ? body.meme_template_ids.filter((x: unknown) => typeof x === "string")
      : undefined;
    const vibeId = typeof body?.vibe_id === "string" ? body.vibe_id : undefined;
    const batchCount = Math.min(
      Math.max(Number(body?.batch_count) || 1, 1),
      5,
    );

    const results = [];
    for (let i = 0; i < batchCount; i++) {
      const result = await runViralMemeEngine(supabase, {
        workspaceId,
        formatId,
        goal,
        topic,
        platform,
        assetIds,
        useMemeLibrary,
        memeTemplateIds,
        vibeId,
        batchVariant: batchCount > 1 ? i : undefined,
      });

      if ("error" in result && result.error) {
        return NextResponse.json(
          { error: result.error, partial: results },
          { status: result.status ?? 500 },
        );
      }
      results.push(result);
    }

    if (results.length === 1) {
      return NextResponse.json(results[0]);
    }

    return NextResponse.json({
      batch_count: results.length,
      carousel_ids: results.map((r) => r.carousel_id),
      results,
    });
  } catch (err) {
    console.error("[viral/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
