import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

export interface ScheduledPostItem {
  id: string;
  carousel_id: string;
  title: string;
  platform: string;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  preview_url: string | null;
}

/**
 * Lists the workspace's scheduled queue plus recently published/failed posts so
 * the Schedule tab can show what's coming up and what just went out.
 */
export async function GET() {
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
      .select("id, title")
      .eq("workspace_id", workspaceId);

    const carouselIds = (carousels ?? []).map((c) => c.id);
    if (carouselIds.length === 0) {
      return NextResponse.json({ items: [] });
    }
    const titleById = new Map((carousels ?? []).map((c) => [c.id, c.title]));

    const { data: posts } = await supabase
      .from("social_posts")
      .select(
        "id, carousel_id, platform, status, scheduled_for, published_at, created_at",
      )
      .in("carousel_id", carouselIds)
      .in("status", ["scheduled", "published", "failed", "publishing"])
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: slides } = await supabase
      .from("carousel_slides")
      .select("carousel_id, image_url")
      .in("carousel_id", carouselIds)
      .eq("position", 1);
    const previewById = new Map(
      (slides ?? []).map((s) => [s.carousel_id, s.image_url]),
    );

    const items: ScheduledPostItem[] = (posts ?? []).map((p) => ({
      id: p.id,
      carousel_id: p.carousel_id,
      title: titleById.get(p.carousel_id) ?? "Untitled",
      platform: p.platform,
      status: p.status,
      scheduled_for: p.scheduled_for ?? null,
      published_at: p.published_at ?? null,
      preview_url: previewById.get(p.carousel_id) ?? null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[schedule:GET] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
