import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { persistAssetAnalysis } from "@/lib/carousel/asset-blueprint";
import { getModelSettings } from "@/lib/settings/service";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { assetId } = await params;

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

    const { data: asset } = await supabase
      .from("assets")
      .select("id, public_url, workspace_id")
      .eq("id", assetId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const settings = await getModelSettings(supabase);
    const analysis = await persistAssetAnalysis(
      supabase,
      assetId,
      asset.public_url,
      settings.text_model,
    );

    if (!analysis) {
      return NextResponse.json(
        { error: "Could not analyze this image" },
        { status: 422 },
      );
    }

    return NextResponse.json({ asset_id: assetId, analysis });
  } catch (error) {
    console.error("[assets/analyze] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
