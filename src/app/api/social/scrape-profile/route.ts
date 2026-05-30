import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { scrapeProfilePosts } from "@/lib/social/scrape-profile";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 5, windowMs: 60_000 });
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
    const profileUrl = typeof body?.profile_url === "string" ? body.profile_url.trim() : "";
    const limit =
      typeof body?.post_limit === "number" ? body.post_limit : 10;

    if (!profileUrl) {
      return NextResponse.json({ error: "profile_url is required" }, { status: 400 });
    }

    const scraped = await scrapeProfilePosts(profileUrl, limit);

    return NextResponse.json({
      platform: scraped.platform,
      profile_url: scraped.profileUrl,
      posts: scraped.posts.map((p) => ({
        id: p.id,
        caption: p.caption.slice(0, 280),
        image_url: p.imageUrl,
        permalink: p.permalink,
      })),
      post_count: scraped.posts.length,
    });
  } catch (err) {
    console.error("[social/scrape-profile]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scrape failed" },
      { status: 422 },
    );
  }
}
