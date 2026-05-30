import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { carouselId } = await params;

  if (!carouselId) {
    return NextResponse.json({ error: "carouselId is required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: carousel } = await supabase
      .from("carousels")
      .select("id, workspace_id")
      .eq("id", carouselId)
      .single();

    if (!carousel) {
      return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", carousel.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Collect both image and video storage paths (video_storage_path added in
    // migration 005); fall back gracefully if the column isn't present yet.
    let slides:
      | { storage_path: string | null; video_storage_path?: string | null }[]
      | null = null;

    const withVideo = await supabase
      .from("carousel_slides")
      .select("storage_path, video_storage_path")
      .eq("carousel_id", carouselId);

    if (withVideo.error) {
      const basic = await supabase
        .from("carousel_slides")
        .select("storage_path")
        .eq("carousel_id", carouselId);
      slides = basic.data;
    } else {
      slides = withVideo.data;
    }

    const storagePaths = (slides ?? [])
      .flatMap((s) => [s.storage_path, s.video_storage_path ?? null])
      .filter((p): p is string => Boolean(p));

    // Also remove the exported slideshow MP4 (column added in migration 008);
    // tolerate its absence on an un-migrated database.
    const exportRow = await supabase
      .from("carousels")
      .select("export_video_storage_path")
      .eq("id", carouselId)
      .maybeSingle();
    const exportPath = exportRow.data?.export_video_storage_path;
    if (typeof exportPath === "string" && exportPath) {
      storagePaths.push(exportPath);
    }

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("carousels")
        .remove(storagePaths);

      if (storageError) {
        console.error("[delete-carousel] storage remove:", storageError);
      }
    }

    const { error: deleteError } = await supabase
      .from("carousels")
      .delete()
      .eq("id", carouselId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[delete-carousel] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
