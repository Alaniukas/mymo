import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { renderImageWithOverlay } from "@/lib/carousel/overlay";
import { reuploadImage } from "@/lib/carousel/storage";
import { getSizeForPlatform } from "@/lib/carousel/prompts";
import { parseTemplateBlueprint } from "@/lib/carousel/template-blueprint";
import { overlaySpecFromBlueprint, parseStoredTextZone, parseStoredSlideColors } from "@/lib/carousel/blueprint-overlay";
import { trimBlueprintSlides } from "@/lib/carousel/studio-slide-count";

// Canvas overlay work needs the Node runtime and headroom to download,
// composite, and re-upload each slide. 60s is the safe ceiling across plans.
export const runtime = "nodejs";
export const maxDuration = 60;

function roleForPosition(position: number, total: number): string {
  if (position <= 1) return "hook";
  if (position >= total) return "cta";
  return "value";
}

interface SlideCaptionInput {
  id: string;
  caption: string;
}

type SlideRow = {
  id: string;
  position: number;
  image_url: string | null;
  base_image_url?: string | null;
  layout?: string | null;
  role?: string | null;
  text_zone?: unknown;
};

/**
 * Finalize a multi-asset carousel: burn the (edited) captions onto the clean,
 * already-generated slide images and mark the carousel ready.
 *
 * Idempotent — the caption is always composited from the CLEAN base image
 * (`base_image_url`, captured on first finalize), with the result written to a
 * separate `-final.png` object. Re-finalizing after a caption edit re-burns
 * from the clean base instead of stacking text on an already-captioned image.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 20, windowMs: 60_000 });
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

    const body = await request.json();
    const captionInputs = (body?.slides ?? []) as SlideCaptionInput[];
    const postCaptionOverride =
      typeof body?.post_caption === "string" ? body.post_caption.trim() : null;
    const hashtagsOverride = Array.isArray(body?.hashtags)
      ? body.hashtags.filter((h: unknown) => typeof h === "string")
      : null;

    if (!Array.isArray(captionInputs) || captionInputs.length === 0) {
      return NextResponse.json(
        { error: "slides array with { id, caption } is required" },
        { status: 400 },
      );
    }

    const { data: carousel } = await supabase
      .from("carousels")
      .select("id, workspace_id, platform, template_id")
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

    // Brand color tints UI chrome in some layouts; tolerant of un-migrated DB.
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

    const aspect = getSizeForPlatform(carousel.platform);

    // Load slides; tolerant of base_image_url (015) / layout, role (010).
    let slideRows: SlideRow[] = [];
    const full = await supabase
      .from("carousel_slides")
      .select("id, position, image_url, base_image_url, layout, role, text_zone")
      .eq("carousel_id", carouselId)
      .order("position", { ascending: true });
    if (!full.error) {
      slideRows = (full.data ?? []) as SlideRow[];
    } else {
      const basic = await supabase
        .from("carousel_slides")
        .select("id, position, image_url, base_image_url, layout, role")
        .eq("carousel_id", carouselId)
        .order("position", { ascending: true });
      slideRows = (basic.data ?? []) as SlideRow[];
    }

    const blueprintByPosition = new Map<
      number,
      ReturnType<typeof overlaySpecFromBlueprint>
    >();
    if (carousel.template_id) {
      const { data: tpl } = await supabase
        .from("carousel_templates")
        .select("blueprint")
        .eq("id", carousel.template_id)
        .maybeSingle();
      const blueprint = parseTemplateBlueprint(
        (tpl as { blueprint?: unknown } | null)?.blueprint,
      );
      if (blueprint) {
        const trimmed =
          slideRows.length > 0 && blueprint.slides.length > slideRows.length
            ? trimBlueprintSlides(blueprint, slideRows.length)
            : blueprint;
        for (const s of trimmed.slides) {
          blueprintByPosition.set(s.position, overlaySpecFromBlueprint(s));
        }
      }
    }

    const slideById = new Map(slideRows.map((s) => [s.id, s]));
    const total = slideRows.length;

    let updated = 0;
    const failures: string[] = [];

    for (const input of captionInputs) {
      const slide = slideById.get(input.id);
      const caption = (input.caption ?? "").trim();
      if (!slide || !caption) continue;

      // Always composite from the clean base so repeated finalizes never stack
      // text. Until the first burn the clean image is the current image_url.
      const baseUrl = slide.base_image_url ?? slide.image_url;
      if (!baseUrl) {
        failures.push(input.id);
        continue;
      }

      const role = slide.role ?? roleForPosition(slide.position, total);
      const finalPath = `${workspace.id}/${carouselId}/${slide.id}-final.png`;

      const storedZone = parseStoredTextZone(slide.text_zone);
      const storedColors = parseStoredSlideColors(slide.text_zone);
      const bpSpec = blueprintByPosition.get(slide.position);
      const layout =
        slide.layout ?? bpSpec?.layout ?? "fullbleed_dark_overlay";
      const textPlacement =
        storedZone?.placement ?? bpSpec?.textPlacement ?? "center";
      const textStyle = storedZone?.style ?? bpSpec?.textStyle ?? "headline";
      const textAlignment =
        storedZone?.alignment ?? bpSpec?.textAlignment ?? "center";

      const result = await reuploadImage(supabase, baseUrl, finalPath, "carousels", {
        transform: async ({ buffer }) => ({
          buffer: await renderImageWithOverlay(buffer, caption, role, {
            layout,
            textPlacement,
            textStyle,
            textAlignment,
            textColor: storedColors.textColor ?? bpSpec?.textColor,
            accentColor: bpSpec?.accentColor,
            overlayStrength:
              storedColors.overlayStrength ?? bpSpec?.overlayStrength,
            hasUIChrome: bpSpec?.hasUIChrome,
            textBBox: bpSpec?.textBBox,
            aspect,
            brandColor,
          }),
          contentType: "image/png",
        }),
      });

      if (!result.ok) {
        failures.push(input.id);
        continue;
      }

      // Persist the caption + composited image; base_image_url remembers the
      // clean source for future re-burns. Retry without base_image_url on an
      // un-migrated DB so finalize still works.
      const update: Record<string, unknown> = {
        caption,
        image_url: result.publicUrl,
        status: "completed",
        base_image_url: slide.base_image_url ?? baseUrl,
      };

      let { error: updErr } = await supabase
        .from("carousel_slides")
        .update(update)
        .eq("id", slide.id);

      if (updErr) {
        delete update.base_image_url;
        ({ error: updErr } = await supabase
          .from("carousel_slides")
          .update(update)
          .eq("id", slide.id));
      }

      if (updErr) {
        failures.push(input.id);
        continue;
      }

      updated++;
    }

    if (updated > 0) {
      const carouselUpdate: Record<string, unknown> = { status: "ready" };
      if (postCaptionOverride) carouselUpdate.post_caption = postCaptionOverride;
      if (hashtagsOverride) carouselUpdate.hashtags = hashtagsOverride;

      await supabase
        .from("carousels")
        .update(carouselUpdate)
        .eq("id", carouselId);
    }

    return NextResponse.json({
      carousel_id: carouselId,
      status: updated > 0 ? "ready" : "draft",
      updated,
      failed: failures.length,
    });
  } catch (error) {
    console.error("[carousel/finalize] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
