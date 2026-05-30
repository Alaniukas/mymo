import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { scrapeProfilePosts } from "@/lib/social/scrape-profile";
import { importProfilePostsToWorkspace } from "@/lib/social/import-profile-posts";
import { getModelSettings } from "@/lib/settings/service";
import { extractBrandVibeFromContent } from "@/lib/vibe/extract-vibe";
import { saveBrandVibeSnapshot } from "@/lib/vibe/service";
import { runBrandStoryEngine } from "@/lib/generation/run-engine";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const profileUrl =
      typeof body?.profile_url === "string" ? body.profile_url.trim() : "";
    const postLimit = typeof body?.post_limit === "number" ? body.post_limit : 10;
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const goalRaw = body?.goal;
    const goal =
      goalRaw === "launch" ||
      goalRaw === "event" ||
      goalRaw === "recap" ||
      goalRaw === "educate"
        ? goalRaw
        : "story";
    const platform =
      body?.platform === "tiktok" || body?.platform === "both"
        ? body.platform
        : "instagram";
    const slideCount =
      typeof body?.slide_count === "number" ? body.slide_count : 5;
    const generate = Boolean(body?.generate);
    const saveVibe = body?.save_vibe !== false;

    if (!profileUrl) {
      return NextResponse.json({ error: "profile_url is required" }, { status: 400 });
    }

    const scraped = await scrapeProfilePosts(profileUrl, postLimit);

    let vibeSnapshotId: string | null = null;
    if (saveVibe) {
      const settings = await getModelSettings(supabase);
      const vibe = await extractBrandVibeFromContent({
        platform: scraped.platform,
        sourceUrl: scraped.profileUrl,
        captions: scraped.posts.map((p) => p.caption),
        imageUrls: scraped.posts.map((p) => p.imageUrl),
        videoUrls: scraped.posts.map((p) => p.videoUrl).filter((v): v is string => Boolean(v)),
        model: settings.text_model,
      });
      const snapshot = await saveBrandVibeSnapshot(supabase, {
        workspaceId,
        sourceType: scraped.platform,
        sourceUrl: scraped.profileUrl,
        title: `${scraped.platform} profile vibe`,
        vibe,
        setActive: true,
      });
      vibeSnapshotId = snapshot?.id ?? null;
    }

    const imported = await importProfilePostsToWorkspace(
      supabase,
      workspaceId,
      scraped.posts,
    );

    if (imported.imported === 0) {
      return NextResponse.json(
        { error: "Could not import any images from this profile." },
        { status: 422 },
      );
    }

    if (!generate) {
      return NextResponse.json({
        imported: imported.imported,
        asset_ids: imported.assetIds,
        context: imported.context,
        platform: scraped.platform,
        vibe_id: vibeSnapshotId,
      });
    }

    const result = await runBrandStoryEngine(supabase, {
      workspaceId,
      goal,
      topic: topic || `Marketing story from @${scraped.platform} content`,
      context: imported.context,
      slideCount,
      platform,
      assetIds: imported.assetIds,
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }

    return NextResponse.json({
      ...result,
      imported: imported.imported,
      asset_ids: imported.assetIds,
    });
  } catch (err) {
    console.error("[social/import-profile]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 422 },
    );
  }
}
