import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { ensureAssetsAnalyzed } from "@/lib/carousel/ensure-assets-analyzed";
import { getModelSettings } from "@/lib/settings/service";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

export const maxDuration = 120;

/** Analyze all selected user photos (vision) before carousel generation. */
export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 15, windowMs: 60_000 });
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
    const assetIds = Array.isArray(body?.asset_ids)
      ? body.asset_ids.filter((x: unknown): x is string => typeof x === "string")
      : [];

    if (assetIds.length === 0) {
      return NextResponse.json(
        { error: "asset_ids array is required" },
        { status: 400 },
      );
    }

    const settings = await getModelSettings(supabase);
    const analyzed = await ensureAssetsAnalyzed(
      supabase,
      workspaceId,
      assetIds.slice(0, 12),
      settings.text_model,
    );

    return NextResponse.json({
      analyzed: analyzed.length,
      assets: analyzed.map((a) => ({
        id: a.id,
        has_analysis: Boolean(a.analysis),
      })),
    });
  } catch (error) {
    console.error("[assets/analyze-batch] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
