import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { submitImageGeneration, EvolinkError } from "@/lib/evolink/client";
import { buildImagePayload } from "@/lib/evolink/models";
import {
  buildImagePrompt,
  collectAssetUrls,
  getSizeForPlatform,
} from "@/lib/carousel/prompts";
import type { BrandIdentity, AssetRef } from "@/lib/carousel/prompts";
import { getModelSettings } from "@/lib/settings/service";
import { logContentEvent } from "@/lib/analytics/events";

interface SlideRow {
  id: string;
  position: number;
  caption: string | null;
  prompt: string | null;
  image_url: string | null;
  layout?: string | null;
  role?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { carouselId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { slide_id, custom_caption } = body;

    if (!slide_id) {
      return NextResponse.json({ error: "slide_id is required" }, { status: 400 });
    }

    const { data: carousel } = await supabase
      .from("carousels")
      .select("id, workspace_id, platform, slide_count")
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

    // Tolerant read of media_type (column added in migration 005).
    let mediaType = "image";
    const { data: mediaRow } = await supabase
      .from("carousels")
      .select("media_type")
      .eq("id", carouselId)
      .maybeSingle();
    if (mediaRow && typeof mediaRow.media_type === "string") {
      mediaType = mediaRow.media_type;
    }

    // Tolerant read of framework_id (migration 010) for angle analytics.
    let frameworkId: string | null = null;
    const { data: fwRow } = await supabase
      .from("carousels")
      .select("framework_id")
      .eq("id", carouselId)
      .maybeSingle();
    if (fwRow && typeof (fwRow as { framework_id?: unknown }).framework_id === "string") {
      frameworkId = (fwRow as { framework_id: string }).framework_id;
    }

    // Tolerant read of the slide, including layout/role (migration 010) so a
    // regenerated slide keeps its framework layout.
    const slideSel = "id, position, caption, prompt, image_url";
    let slide: SlideRow | null = null;
    const withMeta = await supabase
      .from("carousel_slides")
      .select(`${slideSel}, layout, role`)
      .eq("id", slide_id)
      .eq("carousel_id", carouselId)
      .single();
    if (!withMeta.error && withMeta.data) {
      slide = withMeta.data as unknown as SlideRow;
    } else {
      const basic = await supabase
        .from("carousel_slides")
        .select(slideSel)
        .eq("id", slide_id)
        .eq("carousel_id", carouselId)
        .single();
      slide = (basic.data as unknown as SlideRow) ?? null;
    }

    if (!slide) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // Video carousels re-animate the existing slide image instead of generating
    // a new one; the status poller submits a fresh image-to-video task.
    if (mediaType === "video" && slide.image_url) {
      const { error: resetErr } = await supabase
        .from("carousel_slides")
        .update({
          video_status: "pending",
          video_task_id: null,
          video_url: null,
          video_storage_path: null,
        })
        .eq("id", slide_id);

      if (resetErr) {
        return NextResponse.json({ error: resetErr.message }, { status: 500 });
      }

      await supabase
        .from("carousels")
        .update({ status: "generating" })
        .eq("id", carouselId);

      return NextResponse.json({ slide_id, status: "generating", phase: "video" });
    }

    const caption = custom_caption ?? slide.caption ?? "";
    if (!caption) {
      return NextResponse.json({ error: "No caption available" }, { status: 400 });
    }

    const { data: identity } = await supabase
      .from("app_identities")
      .select("brand_tone, target_audience, value_propositions, llm_summary")
      .eq("workspace_id", workspace.id)
      .limit(1)
      .maybeSingle();

    const brandIdentity: BrandIdentity = {
      brand_tone: identity?.brand_tone ?? null,
      target_audience: identity?.target_audience ?? null,
      value_propositions: identity?.value_propositions ?? null,
      llm_summary: identity?.llm_summary ?? null,
    };

    const { data: assetRows } = await supabase
      .from("assets")
      .select("type, name, public_url")
      .eq("workspace_id", workspace.id);

    const assets: AssetRef[] = (assetRows ?? []).map((a) => ({
      type: a.type as "hook" | "demo",
      name: a.name,
      public_url: a.public_url,
    }));

    const role =
      slide.role ??
      (slide.position === 1
        ? "hook"
        : slide.position === carousel.slide_count
          ? "cta"
          : "value");

    const imagePrompt = buildImagePrompt(
      caption,
      role,
      slide.position,
      carousel.slide_count,
      brandIdentity,
      carousel.platform,
      assets,
      false,
      undefined,
      slide.layout ?? undefined,
    );

    const settings = await getModelSettings(supabase);
    const size = getSizeForPlatform(carousel.platform);
    const assetImageUrls = collectAssetUrls(assets);
    const { payload } = buildImagePayload(settings.image_model, imagePrompt, {
      size,
      quality: "medium",
      image_urls: assetImageUrls.length > 0 ? assetImageUrls.slice(0, 4) : undefined,
    });

    const task = await submitImageGeneration(payload);

    const updatePayload: Record<string, unknown> = {
      status: "generating",
      evolink_task_id: task.id,
      caption,
      prompt: imagePrompt,
      image_url: null,
      storage_path: null,
      // For video carousels, reset the video phase so the poller re-animates
      // the fresh image once it completes.
      ...(mediaType === "video"
        ? {
            video_status: "pending",
            video_task_id: null,
            video_url: null,
            video_storage_path: null,
          }
        : {}),
    };

    const { error: updateErr } = await supabase
      .from("carousel_slides")
      .update(updatePayload)
      .eq("id", slide_id);

    if (updateErr) {
      delete updatePayload.caption;
      await supabase
        .from("carousel_slides")
        .update(updatePayload)
        .eq("id", slide_id);
    }

    await supabase
      .from("carousels")
      .update({ status: "generating" })
      .eq("id", carouselId);

    // Angle analytics: a manual copy edit signals the angle needed tweaking.
    if (typeof custom_caption === "string" && custom_caption.trim()) {
      await logContentEvent(supabase, {
        workspaceId: workspace.id,
        eventType: "edited",
        carouselId,
        frameworkId,
        platform: carousel.platform,
        metadata: { slide_id, position: slide.position },
      });
    }

    return NextResponse.json({
      slide_id,
      task_id: task.id,
      status: "generating",
    });
  } catch (error) {
    if (error instanceof EvolinkError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[regenerate-slide] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
