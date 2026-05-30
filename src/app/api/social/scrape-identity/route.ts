import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isNiche, type NicheSlug } from "@/lib/carousel/niches";
import {
  ensureWorkspace,
  parseBrandProfile,
  upsertAppIdentity,
} from "@/lib/carousel/brand-identity";
import { scrapeProfilePosts, buildContextFromPosts } from "@/lib/social/scrape-profile";
import { importProfilePostsToWorkspace } from "@/lib/social/import-profile-posts";
import { extractBrandVibeFromContent } from "@/lib/vibe/extract-vibe";
import { saveBrandVibeSnapshot } from "@/lib/vibe/service";
import { formatVibeForPrompt } from "@/lib/vibe/types";
import { getModelSettings } from "@/lib/settings/service";

export const runtime = "nodejs";
export const maxDuration = 120;

function handleFromProfileUrl(url: string, platform: string): string {
  try {
    const u = new URL(url.trim());
    const path = u.pathname.replace(/\/$/, "");
    if (platform === "tiktok") {
      const m = path.match(/^\/@([^/]+)/i);
      return m ? `@${m[1]}` : "";
    }
    if (platform === "instagram") {
      const seg = path.split("/").filter(Boolean)[0];
      if (seg && !["explore", "reels", "stories", "p", "reel"].includes(seg)) {
        return `@${seg}`;
      }
    }
  } catch {
    return "";
  }
  return "";
}

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

    const body = await request.json();
    const profileUrl =
      typeof body?.profile_url === "string" ? body.profile_url.trim() : "";
    const niche: NicheSlug | null = isNiche(body.niche) ? body.niche : null;
    const importPhotos = Boolean(body?.import_photos);
    const postLimit = typeof body?.post_limit === "number" ? body.post_limit : 10;

    if (!profileUrl) {
      return NextResponse.json({ error: "profile_url is required" }, { status: 400 });
    }
    if (!niche) {
      return NextResponse.json(
        { error: "Pick what you're creating content for first." },
        { status: 400 },
      );
    }

    const workspace = await ensureWorkspace(supabase, user.id, {
      name: "My Workspace",
      niche,
    });

    const scraped = await scrapeProfilePosts(profileUrl, postLimit);
    const captionContext = buildContextFromPosts(scraped.posts);
    const handle = handleFromProfileUrl(scraped.profileUrl, scraped.platform);

    const settings = await getModelSettings(supabase);

    const vibe = await extractBrandVibeFromContent({
      platform: scraped.platform,
      sourceUrl: scraped.profileUrl,
      captions: scraped.posts.map((p) => p.caption),
      imageUrls: scraped.posts.map((p) => p.imageUrl),
      videoUrls: scraped.posts
        .map((p) => p.videoUrl)
        .filter((v): v is string => Boolean(v)),
      model: settings.text_model,
    });

    const vibeSnapshot = await saveBrandVibeSnapshot(supabase, {
      workspaceId: workspace.id,
      sourceType: scraped.platform,
      sourceUrl: scraped.profileUrl,
      title: `${scraped.platform} · ${handle || "profile"}`,
      vibe,
      setActive: true,
    });

    const sourceText = [
      `Social profile URL: ${scraped.profileUrl}`,
      `Platform: ${scraped.platform}`,
      handle ? `Handle: ${handle}` : "",
      "",
      "Recent public posts (captions):",
      captionContext,
      "",
      "Visual & voice analysis from their feed:",
      formatVibeForPrompt(vibe),
    ]
      .filter(Boolean)
      .join("\n");

    const parsed = await parseBrandProfile(supabase, niche, sourceText);

    if (handle && !parsed.social_handle?.trim()) {
      parsed.social_handle = handle;
    }
    if (vibe.colors[0] && !parsed.brand_color?.trim()) {
      parsed.brand_color = vibe.colors[0];
    }
    if (vibe.summary && !parsed.brand_dna?.trim()) {
      parsed.brand_dna = vibe.summary;
    }
    if (vibe.captionVoice && !parsed.brand_tone?.trim()) {
      parsed.brand_tone = vibe.captionVoice;
    }
    if (vibe.contentTopics.length > 0 && !parsed.app_category?.trim()) {
      parsed.app_category = vibe.contentTopics.slice(0, 2).join(", ");
    }

    const { data: existingIdentity } = await supabase
      .from("app_identities")
      .select("id")
      .eq("workspace_id", workspace.id)
      .limit(1)
      .maybeSingle();

    const identity = await upsertAppIdentity(
      supabase,
      workspace.id,
      parsed,
      sourceText.slice(0, 5000),
      { mode: existingIdentity ? "merge" : "replace" },
    );

    let importedCount = 0;
    let previewUrls: string[] = [];
    if (importPhotos) {
      const imported = await importProfilePostsToWorkspace(
        supabase,
        workspace.id,
        scraped.posts,
      );
      importedCount = imported.imported;
      if (imported.assetIds.length > 0) {
        const { data: assets } = await supabase
          .from("assets")
          .select("public_url")
          .in("id", imported.assetIds.slice(0, 6));
        previewUrls = (assets ?? []).map((a) => a.public_url);
      }
    }

    return NextResponse.json({
      workspace_id: workspace.id,
      identity,
      vibe_id: vibeSnapshot?.id ?? null,
      platform: scraped.platform,
      posts_analyzed: scraped.posts.length,
      handle: handle || null,
      assets_imported: importPhotos
        ? { count: importedCount, preview_urls: previewUrls }
        : null,
      preview_posts: scraped.posts.slice(0, 6).map((p) => ({
        id: p.id,
        caption: p.caption.slice(0, 120),
        image_url: p.imageUrl,
      })),
    });
  } catch (err) {
    console.error("[social/scrape-identity]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Social scrape failed" },
      { status: 422 },
    );
  }
}
