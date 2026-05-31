import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { fetchMediaBuffer } from "@/lib/carousel/storage";
import { overlayDimsForAspect } from "@/lib/carousel/overlay";
import {
  renderSlideshow,
  renderClipReel,
  perSlideSeconds,
  MIN_TOTAL_SECONDS,
  MAX_TOTAL_SECONDS,
} from "@/lib/carousel/video-export";
import { getSizeForPlatform } from "@/lib/carousel/prompts";
import { getVideoAspectForPlatform } from "@/lib/carousel/video";
import { logContentEvent } from "@/lib/analytics/events";

// Downloading slide images, compositing captions (canvas) and encoding the MP4
// (ffmpeg) need the Node runtime and more time than the default. 60s is the
// safe ceiling across Vercel plans for a short slideshow.
export const runtime = "nodejs";
export const maxDuration = 60;

type DB = Awaited<ReturnType<typeof createClient>>;

interface MusicJson {
  id: string | null;
  title: string | null;
  author: string | null;
  playUrl: string | null;
}

interface CarouselRow {
  id: string;
  workspace_id: string;
  platform: string;
  slide_count: number | null;
  media_type: string;
  music: MusicJson | null;
  export_status: string | null;
  export_video_url: string | null;
  export_options: Record<string, unknown> | null;
  framework_id?: string | null;
}

interface SlideRow {
  id: string;
  position: number;
  caption: string | null;
  status: string;
  image_url: string | null;
}

// Tolerant carousel read: media_type/music/export_* may be absent on a database
// that hasn't run migrations 005/007/008 yet.
async function loadCarousel(
  supabase: DB,
  carouselId: string,
): Promise<CarouselRow | null> {
  const full = await supabase
    .from("carousels")
    .select(
      "id, workspace_id, platform, slide_count, media_type, music, export_status, export_video_url, export_options, framework_id",
    )
    .eq("id", carouselId)
    .single();

  if (!full.error && full.data) return full.data as CarouselRow;

  const withoutFramework = await supabase
    .from("carousels")
    .select(
      "id, workspace_id, platform, slide_count, media_type, music, export_status, export_video_url, export_options",
    )
    .eq("id", carouselId)
    .single();

  if (!withoutFramework.error && withoutFramework.data) {
    return { ...(withoutFramework.data as CarouselRow), framework_id: null };
  }

  const basic = await supabase
    .from("carousels")
    .select("id, workspace_id, platform, slide_count")
    .eq("id", carouselId)
    .single();

  if (!basic.data) return null;
  return {
    ...(basic.data as Omit<
      CarouselRow,
      | "media_type"
      | "music"
      | "export_status"
      | "export_video_url"
      | "export_options"
      | "framework_id"
    >),
    media_type: "image",
    music: null,
    export_status: null,
    export_video_url: null,
    export_options: null,
    framework_id: null,
  };
}

async function loadCompletedSlides(
  supabase: DB,
  carouselId: string,
): Promise<SlideRow[]> {
  const query = (sel: string) =>
    supabase
      .from("carousel_slides")
      .select(sel)
      .eq("carousel_id", carouselId)
      .eq("status", "completed")
      .not("image_url", "is", null)
      .order("position", { ascending: true });

  const withCaption = await query("id, position, caption, status, image_url");
  if (!withCaption.error) return (withCaption.data ?? []) as unknown as SlideRow[];

  const basic = await query("id, position, status, image_url");
  return ((basic.data ?? []) as unknown as Record<string, unknown>[]).map(
    (s) => ({ ...s, caption: null }) as SlideRow,
  );
}

/**
 * Video carousels store one finished clip per slide. Returns the completed
 * clip URLs in play order (the AI hook clip first, then the founder's app-demo
 * clips). Captions are already burned onto each clip during generation.
 */
async function loadCompletedClips(
  supabase: DB,
  carouselId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("carousel_slides")
    .select("video_url, video_status, position")
    .eq("carousel_id", carouselId)
    .eq("video_status", "completed")
    .order("position", { ascending: true });

  return ((data ?? []) as { video_url: string | null }[])
    .map((s) => s.video_url)
    .filter((url): url is string => !!url);
}

async function resolveWorkspace(
  supabase: DB,
  carousel: CarouselRow,
  userId: string,
) {
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", carousel.workspace_id)
    .eq("user_id", userId)
    .single();
  return data;
}

async function persistExport(
  supabase: DB,
  carouselId: string,
  fields: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("carousels")
    .update(fields)
    .eq("id", carouselId);
  if (error) {
    console.warn(
      "[export-video] could not persist export state (is migration 008 applied?):",
      error.message,
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { carouselId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const carousel = await loadCarousel(supabase, carouselId);
    if (!carousel) {
      return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
    }

    const workspace = await resolveWorkspace(supabase, carousel, user.id);
    if (!workspace) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const eligible =
      carousel.media_type === "video"
        ? (await loadCompletedClips(supabase, carouselId)).length
        : (await loadCompletedSlides(supabase, carouselId)).length;

    return NextResponse.json({
      platform: carousel.platform,
      media_type: carousel.media_type,
      eligible_slides: eligible,
      music: carousel.music?.playUrl
        ? { title: carousel.music.title, author: carousel.music.author, available: true }
        : null,
      export: {
        status: carousel.export_status,
        url: carousel.export_video_url,
        options: carousel.export_options,
      },
    });
  } catch (error) {
    console.error("[export-video] GET error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { carouselId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const carousel = await loadCarousel(supabase, carouselId);
    if (!carousel) {
      return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
    }

    const workspace = await resolveWorkspace(supabase, carousel, user.id);
    if (!workspace) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as {
      total_length_seconds?: number;
      include_music?: boolean;
    };

    const isVideoCarousel = carousel.media_type === "video";

    // Optional trending-sound track, laid over the whole video (shared by both
    // the clip-reel and slideshow paths).
    let audio: Buffer | null = null;
    const includeMusic =
      Boolean(body.include_music) && Boolean(carousel.music?.playUrl);
    if (includeMusic && carousel.music?.playUrl) {
      const dl = await fetchMediaBuffer(carousel.music.playUrl);
      audio = dl?.buffer ?? null;
    }

    let videoBuffer: Buffer;
    let options: Record<string, unknown>;

    if (isVideoCarousel) {
      // Video carousel → stitch the finished per-slide CLIPS into one continuous
      // reel (the AI hook clip first, then the founder's app-demo clips). Each
      // clip already carries its burned-in caption, so nothing is overlaid here.
      const clipUrls = await loadCompletedClips(supabase, carouselId);
      if (clipUrls.length === 0) {
        return NextResponse.json(
          { error: "No finished video clips to export yet." },
          { status: 400 },
        );
      }

      await persistExport(supabase, carouselId, { export_status: "rendering" });

      const clips: Buffer[] = [];
      for (const url of clipUrls) {
        const dl = await fetchMediaBuffer(url);
        if (dl) clips.push(dl.buffer);
      }
      if (clips.length === 0) {
        await persistExport(supabase, carouselId, {
          export_status: "failed",
          export_error: "Could not download the video clips to combine.",
        });
        return NextResponse.json(
          { error: "Could not download the video clips to combine." },
          { status: 502 },
        );
      }

      const aspect = getVideoAspectForPlatform(carousel.platform);
      const { width, height } = overlayDimsForAspect(aspect);
      videoBuffer = await renderClipReel({ clips, width, height, audio });
      options = {
        mode: "clips",
        clip_count: clips.length,
        include_music: Boolean(audio),
      };
    } else {
      // Image carousel → still-image slideshow (captions are already baked into
      // each slide image), each frame held for an even share of the length.
      const slides = await loadCompletedSlides(supabase, carouselId);
      if (slides.length === 0) {
        return NextResponse.json(
          { error: "No completed slides to export yet." },
          { status: 400 },
        );
      }

      const totalLength = Math.min(
        MAX_TOTAL_SECONDS,
        Math.max(
          MIN_TOTAL_SECONDS,
          Math.round(body.total_length_seconds ?? slides.length * 3),
        ),
      );
      const secondsPerFrame = perSlideSeconds(totalLength, slides.length);

      await persistExport(supabase, carouselId, { export_status: "rendering" });

      const frames: Buffer[] = [];
      for (const slide of slides) {
        if (!slide.image_url) continue;
        const dl = await fetchMediaBuffer(slide.image_url);
        if (dl) frames.push(dl.buffer);
      }

      if (frames.length === 0) {
        await persistExport(supabase, carouselId, {
          export_status: "failed",
          export_error: "Could not download any slide images.",
        });
        return NextResponse.json(
          { error: "Could not download any slide images." },
          { status: 502 },
        );
      }

      const { width, height } = overlayDimsForAspect(
        getSizeForPlatform(carousel.platform),
      );
      videoBuffer = await renderSlideshow({
        frames,
        secondsPerFrame,
        width,
        height,
        audio,
      });
      options = {
        total_length_seconds: totalLength,
        per_slide_seconds: secondsPerFrame,
        include_music: Boolean(audio),
      };
    }

    const storagePath = `${workspace.id}/${carouselId}/export.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("carousels")
      .upload(storagePath, new Blob([new Uint8Array(videoBuffer)], { type: "video/mp4" }), {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      await persistExport(supabase, carouselId, {
        export_status: "failed",
        export_error: uploadError.message,
      });
      return NextResponse.json(
        { error: `Failed to store video: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const { data: publicUrl } = supabase.storage
      .from("carousels")
      .getPublicUrl(storagePath);

    await persistExport(supabase, carouselId, {
      export_status: "ready",
      export_video_url: publicUrl.publicUrl,
      export_video_storage_path: storagePath,
      export_options: options,
      export_error: null,
    });

    // Angle analytics: a finished video export of this angle.
    await logContentEvent(supabase, {
      workspaceId: workspace.id,
      eventType: "exported",
      carouselId,
      frameworkId: carousel.framework_id ?? null,
      platform: carousel.platform,
    });

    return NextResponse.json({
      status: "ready",
      url: publicUrl.publicUrl,
      options,
    });
  } catch (error) {
    console.error("[export-video] POST error:", error);
    try {
      const supabase = await createClient();
      await supabase
        .from("carousels")
        .update({
          export_status: "failed",
          export_error: error instanceof Error ? error.message : "Render failed",
        })
        .eq("id", carouselId);
    } catch {
      // best-effort; the response below still surfaces the failure
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
