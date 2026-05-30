import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { getModelSettings } from "@/lib/settings/service";
import { scrapeProfilePosts } from "@/lib/social/scrape-profile";
import { importProfilePostsToWorkspace } from "@/lib/social/import-profile-posts";
import { extractBrandVibeFromContent } from "@/lib/vibe/extract-vibe";
import { saveBrandVibeSnapshot } from "@/lib/vibe/service";
import { scrapeVideoOrPost } from "@/lib/vibe/scrape-video";
import { detectPlatform, detectSocialProfilePlatform } from "@/lib/social/platform";

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
    const sourceUrl =
      typeof body?.source_url === "string" ? body.source_url.trim() : "";
    const importPhotos = Boolean(body?.import_photos);
    const postLimit = typeof body?.post_limit === "number" ? body.post_limit : 10;

    if (!sourceUrl) {
      return NextResponse.json({ error: "source_url is required" }, { status: 400 });
    }

    const settings = await getModelSettings(supabase);
    const isProfile = Boolean(detectSocialProfilePlatform(sourceUrl));
    const isPost = Boolean(detectPlatform(sourceUrl));

    let platform = "instagram";
    let captions: string[] = [];
    let imageUrls: string[] = [];
    let videoUrls: string[] = [];
    let title = "Saved vibe";
    let assetIds: string[] = [];
    let sourceType = "manual";

    if (isProfile) {
      const scraped = await scrapeProfilePosts(sourceUrl, postLimit);
      platform = scraped.platform;
      sourceType = scraped.platform;
      captions = scraped.posts.map((p) => p.caption);
      imageUrls = scraped.posts.map((p) => p.imageUrl);
      videoUrls = scraped.posts.map((p) => p.videoUrl).filter((v): v is string => Boolean(v));
      title = `${scraped.platform} @ ${new URL(scraped.profileUrl).pathname.slice(0, 40)}`;

      if (importPhotos) {
        const imported = await importProfilePostsToWorkspace(
          supabase,
          workspaceId,
          scraped.posts,
        );
        assetIds = imported.assetIds;
      }
    } else if (isPost) {
      const scraped = await scrapeVideoOrPost(sourceUrl);
      platform = scraped.platform;
      sourceType = scraped.videoUrls.length > 0 ? "video" : scraped.platform;
      captions = scraped.caption ? [scraped.caption] : [];
      imageUrls = scraped.imageUrls;
      videoUrls = scraped.videoUrls;
      title = `${scraped.platform} post vibe`;
    } else {
      return NextResponse.json(
        { error: "Paste an Instagram/TikTok profile or post/reel/video link." },
        { status: 400 },
      );
    }

    const vibe = await extractBrandVibeFromContent({
      platform,
      sourceUrl,
      captions,
      imageUrls,
      videoUrls,
      model: settings.text_model,
    });

    const snapshot = await saveBrandVibeSnapshot(supabase, {
      workspaceId,
      sourceType,
      sourceUrl,
      title,
      vibe,
      assetIds,
      setActive: true,
    });

    if (!snapshot) {
      return NextResponse.json({ error: "Failed to save vibe" }, { status: 500 });
    }

    return NextResponse.json({
      snapshot,
      imported_photos: assetIds.length,
      video_posts: videoUrls.length,
    });
  } catch (err) {
    console.error("[vibe/scrape]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vibe scrape failed" },
      { status: 422 },
    );
  }
}
