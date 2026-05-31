import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import {
  runFounderHookEngine,
  type FounderHookSource,
} from "@/lib/generation/founder-hook-engine";

// Burning storyline captions onto the uploaded app clips uses ffmpeg + canvas,
// which need the Node runtime and more headroom than the default.
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_APP_CLIPS = 5;
const MAX_HOOKS = 5;
const DEFAULT_HOOKS = 5;

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 4, windowMs: 60_000 });
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
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const appAssetIds = Array.isArray(body?.app_asset_ids)
      ? body.app_asset_ids
          .filter((x: unknown): x is string => typeof x === "string")
          .slice(0, MAX_APP_CLIPS)
      : [];

    if (appAssetIds.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one app demo video." },
        { status: 400 },
      );
    }

    const rawHookCount = Number(body?.hook_count);
    const hookCount = Number.isFinite(rawHookCount)
      ? Math.min(MAX_HOOKS, Math.max(1, Math.round(rawHookCount)))
      : DEFAULT_HOOKS;
    const imperfect = Boolean(body?.imperfect);
    const hookSource: FounderHookSource =
      body?.hook_source === "premade" || body?.hook_source === "template"
        ? body.hook_source
        : "ai";
    const hookTemplateIds = Array.isArray(body?.hook_template_ids)
      ? body.hook_template_ids.filter((x: unknown): x is string => typeof x === "string")
      : [];

    const result = await runFounderHookEngine(supabase, {
      workspaceId,
      topic,
      appAssetIds,
      hookCount: hookSource === "ai" ? hookCount : undefined,
      imperfect,
      hookSource,
      hookTemplateIds,
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[founder-hooks/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
