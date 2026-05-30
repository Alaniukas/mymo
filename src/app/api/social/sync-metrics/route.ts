import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

/**
 * Best-effort metrics sync for published posts. WoopSocial analytics API is not
 * wired yet — stores placeholder structure for Library UI; extend when API docs
 * expose post engagement endpoints.
 */
export async function POST(_request: NextRequest) {
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

    const { data: carousels } = await supabase
      .from("carousels")
      .select("id")
      .eq("workspace_id", workspaceId);
    const workspaceCarouselIds = new Set((carousels ?? []).map((c) => c.id));

    const { data: posts } = await supabase
      .from("social_posts")
      .select("id, carousel_id, platform_post_id, status")
      .eq("status", "published")
      .not("platform_post_id", "is", null);

    let updated = 0;
    const now = new Date().toISOString();

    for (const post of posts ?? []) {
      if (!workspaceCarouselIds.has(post.carousel_id)) continue;

      const metrics = {
        views: null,
        likes: null,
        comments: null,
        shares: null,
        source: "pending_woopsocial_api",
        note: "Platform metrics sync requires WoopSocial analytics endpoint",
      };

      const { error } = await supabase
        .from("social_posts")
        .update({ metrics, metrics_synced_at: now })
        .eq("id", post.id);

      if (!error) updated++;
    }

    return NextResponse.json({ updated, synced_at: now });
  } catch (error) {
    console.error("[sync-metrics] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
