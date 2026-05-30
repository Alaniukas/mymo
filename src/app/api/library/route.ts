import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

export interface LibraryItem {
  carousel_id: string;
  title: string;
  status: string;
  platform: string;
  created_at: string;
  template_id: string | null;
  preview_url: string | null;
  slide_count: number;
  published: boolean;
  publish_platform: string | null;
  published_at: string | null;
  publish_status: string | null;
  metrics: Record<string, unknown> | null;
  metrics_synced_at: string | null;
}

export async function GET(request: NextRequest) {
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

    const tab = request.nextUrl.searchParams.get("tab") ?? "all";

    const { data: carousels, error } = await supabase
      .from("carousels")
      .select(
        "id, title, status, platform, created_at, template_id, slide_count",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (carousels ?? []).map((c) => c.id);
    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const { data: slides } = await supabase
      .from("carousel_slides")
      .select("carousel_id, image_url, position")
      .in("carousel_id", ids)
      .eq("position", 1);

    const previewByCarousel = new Map(
      (slides ?? []).map((s) => [s.carousel_id, s.image_url]),
    );

    const { data: posts } = await supabase
      .from("social_posts")
      .select(
        "carousel_id, platform, status, published_at, metrics, metrics_synced_at, created_at",
      )
      .in("carousel_id", ids)
      .order("created_at", { ascending: false });

    const latestPostByCarousel = new Map<
      string,
      NonNullable<typeof posts>[number]
    >();
    for (const p of posts ?? []) {
      if (!latestPostByCarousel.has(p.carousel_id)) {
        latestPostByCarousel.set(p.carousel_id, p);
      }
    }

    let items: LibraryItem[] = (carousels ?? []).map((c) => {
      const post = latestPostByCarousel.get(c.id);
      return {
        carousel_id: c.id,
        title: c.title,
        status: c.status,
        platform: c.platform,
        created_at: c.created_at,
        template_id: c.template_id ?? null,
        preview_url: previewByCarousel.get(c.id) ?? null,
        slide_count: c.slide_count ?? 0,
        published: post?.status === "published",
        publish_platform: post?.platform ?? null,
        published_at: post?.published_at ?? null,
        publish_status: post?.status ?? null,
        metrics: (post?.metrics as Record<string, unknown> | null) ?? null,
        metrics_synced_at: post?.metrics_synced_at ?? null,
      };
    });

    if (tab === "published") {
      items = items.filter((i) => i.published);
    } else if (tab === "drafts") {
      items = items.filter((i) => !i.published && i.status !== "generating");
    } else if (tab === "ready") {
      items = items.filter((i) => i.status === "ready" && !i.published);
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[library] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
