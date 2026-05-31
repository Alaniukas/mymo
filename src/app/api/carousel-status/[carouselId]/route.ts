import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { checkTaskStatus, EvolinkError } from "@/lib/evolink/client";
import { reuploadImage } from "@/lib/carousel/storage";
import { renderImageWithOverlay } from "@/lib/carousel/overlay";
import { getModelSettings } from "@/lib/settings/service";
import { resolveHookVideoModel } from "@/lib/settings/models";
import { DEFAULT_VIDEO_MODEL } from "@/lib/evolink/video-models";
import { runVideoPhase, type CarouselSlideRow } from "@/lib/carousel/video";
import { getSizeForPlatform } from "@/lib/carousel/prompts";
import type { BrandIdentity } from "@/lib/carousel/prompts";

// Canvas + ffmpeg overlay work needs the Node runtime and more headroom than
// the default for downloading media, compositing, and re-uploading. 60s is the
// safe ceiling across Vercel plans; work is incremental/idempotent per poll.
export const runtime = "nodejs";
export const maxDuration = 60;

type DB = Awaited<ReturnType<typeof createClient>>;

function roleForPosition(position: number, total: number): string {
  if (position <= 1) return "hook";
  if (position >= total) return "cta";
  return "value";
}

type CarouselRow = {
  id: string;
  workspace_id: string;
  status: string;
  platform: string;
  slide_count: number | null;
  media_type: string;
  content_type?: string | null;
};

async function markSlideFailed(supabase: DB, slide: CarouselSlideRow) {
  await supabase.from("carousel_slides").update({ status: "failed" }).eq("id", slide.id);
  slide.status = "failed";
}

async function completeSlide(
  supabase: DB,
  slide: CarouselSlideRow,
  workspaceId: string,
  carouselId: string,
  imageUrl: string,
  opts: {
    bakeText: boolean;
    role: string;
    layout?: string | null;
    aspect: string;
    brandColor: string | null;
  },
): Promise<void> {
  const storagePath = `${workspaceId}/${carouselId}/${slide.id}.png`;

  // Image carousels burn the caption into the stored image so it ships in
  // downloads/publishes. Video carousels keep the image clean (it's the clip's
  // first frame) and get their overlay composited onto the clip instead.
  const caption = slide.caption?.trim();
  const transform =
    opts.bakeText && caption
      ? async ({ buffer }: { buffer: Buffer; contentType: string }) => ({
          buffer: await renderImageWithOverlay(buffer, caption, opts.role, {
            layout: opts.layout ?? undefined,
            aspect: opts.aspect,
            brandColor: opts.brandColor,
          }),
          contentType: "image/png",
        })
      : undefined;

  const result = await reuploadImage(supabase, imageUrl, storagePath, "carousels", {
    transform,
  });

  if (result.ok) {
    await supabase
      .from("carousel_slides")
      .update({
        status: "completed",
        image_url: result.publicUrl,
        storage_path: result.storagePath,
      })
      .eq("id", slide.id);

    slide.status = "completed";
    slide.image_url = result.publicUrl;
    slide.storage_path = result.storagePath;
    return;
  }

  if (result.reason === "upload") {
    // Fall back to EvoLink URL so the slide is not stuck forever
    await supabase
      .from("carousel_slides")
      .update({ status: "completed", image_url: imageUrl, storage_path: null })
      .eq("id", slide.id);

    slide.status = "completed";
    slide.image_url = imageUrl;
    slide.storage_path = null;
    return;
  }

  // Download failed -- mark the slide failed rather than leaving it stuck.
  await markSlideFailed(supabase, slide);
}

function isStaleGenerating(slide: CarouselSlideRow): boolean {
  if (!slide.created_at) return false;
  const ageMs = Date.now() - new Date(slide.created_at).getTime();
  return ageMs > 20 * 60 * 1000; // 20 minutes
}

// Carousel + slide loaders that degrade gracefully if newer columns
// (media_type, caption, video_*) are absent on an un-migrated database.
async function loadCarousel(
  supabase: DB,
  carouselId: string,
): Promise<CarouselRow | null> {
  const full = await supabase
    .from("carousels")
    .select("id, workspace_id, status, platform, slide_count, media_type, content_type")
    .eq("id", carouselId)
    .single();

  if (!full.error && full.data) return full.data as CarouselRow;

  const basic = await supabase
    .from("carousels")
    .select("id, workspace_id, status, platform, slide_count")
    .eq("id", carouselId)
    .single();

  if (!basic.data) return null;
  return { ...(basic.data as Omit<CarouselRow, "media_type">), media_type: "image" };
}

function fillVideoNulls(s: Record<string, unknown>): CarouselSlideRow {
  return {
    video_status: null,
    video_task_id: null,
    video_url: null,
    video_storage_path: null,
    ...s,
  } as CarouselSlideRow;
}

async function loadSlides(
  supabase: DB,
  carouselId: string,
): Promise<CarouselSlideRow[]> {
  const base =
    "id, position, prompt, image_url, storage_path, status, evolink_task_id, created_at";
  const withCaption = `${base}, caption`;
  const withVideo = `${withCaption}, video_status, video_task_id, video_url, video_storage_path`;
  const full = `${withVideo}, layout, role`;
  const fullest = `${full}, motion_prompt`;

  const query = (sel: string) =>
    supabase
      .from("carousel_slides")
      .select(sel)
      .eq("carousel_id", carouselId)
      .order("position", { ascending: true });

  // motion_prompt missing (pre-migration 025) → retry without it.
  let res = await query(fullest);
  if (!res.error) return (res.data ?? []) as unknown as CarouselSlideRow[];

  res = await query(full);
  if (!res.error) return (res.data ?? []) as unknown as CarouselSlideRow[];

  // layout/role missing (pre-migration 010) → retry without them.
  res = await query(withVideo);
  if (!res.error) return (res.data ?? []) as unknown as CarouselSlideRow[];

  res = await query(withCaption);
  if (!res.error) {
    return ((res.data ?? []) as unknown as Record<string, unknown>[]).map(
      fillVideoNulls,
    );
  }

  const basic = await query(base);
  return ((basic.data ?? []) as unknown as Record<string, unknown>[]).map((s) =>
    fillVideoNulls({ ...s, caption: null }),
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 120, windowMs: 60_000 });
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

    const carousel = await loadCarousel(supabase, carouselId);

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

    const slides = await loadSlides(supabase, carouselId);
    const isVideo = carousel.media_type === "video";
    const aspect = getSizeForPlatform(carousel.platform);

    // Brand color tints UI chrome (e.g. notification mock). Guarded select so an
    // un-migrated DB (no brand_color column) just yields null instead of erroring.
    let brandColor: string | null = null;
    {
      const { data: idColor } = await supabase
        .from("app_identities")
        .select("brand_color")
        .eq("workspace_id", workspace.id)
        .limit(1)
        .maybeSingle();
      const c = (idColor as { brand_color?: unknown } | null)?.brand_color;
      brandColor = typeof c === "string" ? c : null;
    }

    // Phase 1 — advance any slide image still generating.
    for (const slide of slides) {
      if (slide.status !== "generating") continue;

      if (!slide.evolink_task_id) {
        await markSlideFailed(supabase, slide);
        continue;
      }

      if (isStaleGenerating(slide)) {
        await markSlideFailed(supabase, slide);
        continue;
      }

      try {
        const task = await checkTaskStatus(slide.evolink_task_id);

        if (task.status === "completed" && task.results?.[0]) {
          await completeSlide(
            supabase,
            slide,
            workspace.id,
            carouselId,
            task.results[0],
            {
              bakeText: !isVideo,
              // Prefer the persisted framework role/layout; fall back to
              // position-based role + the default layout for legacy carousels.
              role: slide.role ?? roleForPosition(slide.position, slides.length),
              layout: slide.layout ?? undefined,
              aspect,
              brandColor,
            },
          );
        } else if (task.status === "failed") {
          await markSlideFailed(supabase, slide);
        }
      } catch (err) {
        if (err instanceof EvolinkError && err.status === 404) {
          await markSlideFailed(supabase, slide);
        } else {
          console.error(`[carousel-status] slide ${slide.id} check failed:`, err);
        }
      }
    }

    // Phase 2 — video carousels animate each completed image into a clip.
    if (isVideo) {
      const { data: identity } = await supabase
        .from("app_identities")
        .select("brand_tone, target_audience, value_propositions, llm_summary")
        .eq("workspace_id", workspace.id)
        .limit(1)
        .maybeSingle();

      const brand: BrandIdentity = {
        brand_tone: identity?.brand_tone ?? null,
        target_audience: identity?.target_audience ?? null,
        value_propositions: identity?.value_propositions ?? null,
        llm_summary: identity?.llm_summary ?? null,
      };

      const settings = await getModelSettings(supabase);
      const videoModel =
        carousel.content_type === "founder_hook"
          ? resolveHookVideoModel(settings)
          : settings.video_model || DEFAULT_VIDEO_MODEL;

      await runVideoPhase(supabase, slides, {
        workspaceId: workspace.id,
        carouselId,
        model: videoModel,
        platform: carousel.platform,
        brand,
        totalSlides: carousel.slide_count ?? slides.length,
        founderHook: carousel.content_type === "founder_hook",
      });
    }

    // ── Roll up carousel status ──
    const total = slides.length;
    const completed = slides.filter((s) => s.status === "completed").length;
    const failed = slides.filter((s) => s.status === "failed").length;
    const generating = slides.filter((s) => s.status === "generating").length;

    const videoCompleted = slides.filter((s) => s.video_status === "completed").length;
    const videoFailed = slides.filter((s) => s.video_status === "failed").length;
    const videoGenerating = slides.filter(
      (s) => s.video_status === "generating" || s.video_status === "pending",
    ).length;

    let carouselStatus = carousel.status;
    if (isVideo) {
      // Work remains while an image is generating or a completed image still
      // needs its clip. Failed-image slides contribute no further video work.
      const workRemaining = slides.some(
        (s) =>
          s.status === "generating" ||
          (s.status === "completed" &&
            s.video_status !== "completed" &&
            s.video_status !== "failed"),
      );

      if (!workRemaining && videoCompleted > 0) carouselStatus = "ready";
      else if (!workRemaining && videoCompleted === 0 && total > 0)
        carouselStatus = "draft";
      else carouselStatus = "generating";
    } else {
      if (generating === 0 && completed > 0) carouselStatus = "ready";
      else if (generating === 0 && completed === 0 && total > 0)
        carouselStatus = "draft";
      else if (generating > 0) carouselStatus = "generating";
    }

    if (carouselStatus !== carousel.status) {
      await supabase
        .from("carousels")
        .update({ status: carouselStatus })
        .eq("id", carouselId);
    }

    return NextResponse.json({
      carousel_id: carouselId,
      media_type: carousel.media_type,
      status: carouselStatus,
      progress: { completed, failed, generating, total },
      video_progress: isVideo
        ? {
            completed: videoCompleted,
            failed: videoFailed,
            generating: videoGenerating,
            total,
          }
        : null,
      slides: slides.map((s) => ({
        id: s.id,
        position: s.position,
        caption: s.caption ?? null,
        prompt: s.prompt,
        image_url: s.image_url,
        video_url: s.video_url ?? null,
        video_status: s.video_status ?? null,
        status: s.status,
      })),
    });
  } catch (error) {
    console.error("[carousel-status] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
