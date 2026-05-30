import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/rate-limit";
import { detectPlatform, scrapeCarousel } from "@/lib/social/scraper";
import type { ScrapedCarousel } from "@/lib/social/scraper";
import { reuploadImage } from "@/lib/carousel/storage";
import { isNiche, nicheLabel } from "@/lib/carousel/niches";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { persistTemplateBlueprint, slideImageUrlsFromTemplate } from "@/lib/carousel/persist-template-blueprint";
import { getModelSettings } from "@/lib/settings/service";

// Apify's synchronous run (cold actor start + scrape) can take a while;
// blueprint analysis adds another LLM pass.
export const maxDuration = 120;

type TemplateSlide = {
  position: number;
  image_url: string;
  storage_path: string;
  media_type: "image" | "video";
  video_url?: string;
  video_storage_path?: string;
};

export async function POST(request: NextRequest) {
  // Apify runs cost money per request -- keep this tight like /publish.
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

    const body = await request.json();
    const { url, scope } = body as {
      url?: string;
      scope?: string;
    };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return NextResponse.json(
        { error: "URL must be an Instagram or TikTok link" },
        { status: 422 },
      );
    }

    const activeProjectId = await resolveActiveWorkspaceId(supabase, user.id);

    if (!activeProjectId) {
      return NextResponse.json(
        { error: "No project selected. Create a project first." },
        { status: 404 },
      );
    }
    const workspace = { id: activeProjectId };

    const { data: workspaceRow, error: workspaceError } = await supabase
      .from("workspaces")
      .select("niche")
      .eq("id", activeProjectId)
      .single();

    if (workspaceError || !isNiche(workspaceRow?.niche)) {
      return NextResponse.json(
        {
          error:
            "This project has no type set. Choose ecommerce, branding, app, or viral when creating the project.",
        },
        { status: 422 },
      );
    }
    const niche = workspaceRow.niche;

    // Global templates (workspace_id null) are visible to everyone and must be
    // written with the service-role client, mirroring /api/admin/settings.
    const wantsGlobal = scope === "global" && isAdminEmail(user.email);
    if (wantsGlobal && !isServiceRoleConfigured()) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SECRET_KEY must be configured to create global templates.",
        },
        { status: 500 },
      );
    }

    // ── Scrape the source post ──
    let scraped: ScrapedCarousel;
    try {
      scraped = await scrapeCarousel(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read the post";
      const isConfig = message.includes("APIFY_TOKEN");
      console.error("[templates/import] scrape failed:", err);
      return NextResponse.json(
        { error: isConfig ? message : `Could not read that post: ${message}` },
        { status: isConfig ? 500 : 502 },
      );
    }

    if (scraped.slides.length === 0) {
      return NextResponse.json(
        {
          error:
            "No carousel media found at that URL. It may be a private account or an unsupported post.",
        },
        { status: 422 },
      );
    }

    const caption = scraped.caption.trim();
    const title = caption
      ? caption.replace(/\s+/g, " ").slice(0, 60)
      : `${nicheLabel(niche)} template`;

    // For global templates write the row with the admin client (bypasses RLS);
    // otherwise the user's own client is sufficient.
    const db = wantsGlobal ? createAdminClient() : supabase;
    const workspaceId = wantsGlobal ? null : workspace.id;
    const scopeFolder = wantsGlobal ? "global" : workspace.id;

    // ── Insert the template row first so we have an id for the storage path. ──
    const { data: template, error: insertError } = await db
      .from("carousel_templates")
      .insert({
        workspace_id: workspaceId,
        niche,
        title,
        source_url: url,
        source_platform: platform,
        caption: caption ? caption.slice(0, 2000) : null,
        slides: [],
      })
      .select("id")
      .single();

    if (insertError || !template) {
      console.error("[templates/import] insert failed:", insertError);
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create template" },
        { status: 500 },
      );
    }

    // ── Re-host every slide into the templates bucket so we own stable URLs.
    // For video slides we re-host both the cover still (used as the poster and
    // as the generator's style reference) and the MP4 so the original post can
    // be played back. Storage writes go through the user's authenticated client
    // (the bucket policy allows any authenticated upload), even for global
    // templates. ──
    const base = `${scopeFolder}/${template.id}`;
    const uploads = await Promise.all(
      scraped.slides.map(async (slide, i) => {
        const n = i + 1;
        const image = await reuploadImage(
          supabase,
          slide.imageUrl,
          `${base}/${n}.jpg`,
          "templates",
        );
        // A slide must at least have its still; drop it if that fails.
        if (!image.ok) return null;

        let video: { publicUrl: string; storagePath: string } | null = null;
        if (slide.videoUrl) {
          const v = await reuploadImage(
            supabase,
            slide.videoUrl,
            `${base}/${n}.mp4`,
            "templates",
          );
          // If the clip can't be re-hosted, keep the slide as a still image.
          if (v.ok) video = { publicUrl: v.publicUrl, storagePath: v.storagePath };
        }

        return {
          image_url: image.publicUrl,
          storage_path: image.storagePath,
          media_type: video ? ("video" as const) : ("image" as const),
          video_url: video?.publicUrl,
          video_storage_path: video?.storagePath,
        };
      }),
    );

    const slides: TemplateSlide[] = [];
    let position = 1;
    for (const result of uploads) {
      if (!result) continue;
      slides.push({ position, ...result });
      position++;
    }

    if (slides.length === 0) {
      await db.from("carousel_templates").delete().eq("id", template.id);
      return NextResponse.json(
        { error: "Failed to import any slides. Please try again." },
        { status: 502 },
      );
    }

    const { error: updateError } = await db
      .from("carousel_templates")
      .update({ slides })
      .eq("id", template.id);

    if (updateError) {
      console.error("[templates/import] slides update failed:", updateError);
      return NextResponse.json(
        { error: "Failed to save template slides: " + updateError.message },
        { status: 500 },
      );
    }

    // Deep structural analysis — template is saved even if this fails; client can retry.
    let blueprint: Record<string, unknown> | null = null;
    let blueprintAnalyzedAt: string | null = null;
    let blueprintError: string | null = null;
    try {
      const settings = await getModelSettings(supabase);
      const imageUrls = slideImageUrlsFromTemplate(slides);
      const result = await persistTemplateBlueprint(db, template.id, {
        imageUrls,
        fallbackImageUrls: scraped.slides.map((s) => s.imageUrl),
        caption: caption || null,
        model: settings.text_model,
        force: true,
      });
      blueprint = result.blueprint as unknown as Record<string, unknown>;
      blueprintAnalyzedAt = result.analyzedAt;
    } catch (err) {
      blueprintError =
        err instanceof Error ? err.message : "Blueprint analysis failed";
      console.warn("[templates/import] blueprint analysis failed:", err);
    }

    return NextResponse.json({
      template_id: template.id,
      niche,
      scope: wantsGlobal ? "global" : "workspace",
      platform,
      slides_imported: slides.length,
      blueprint_analyzed: Boolean(blueprint),
      blueprint_error: blueprintError,
      // Returned so the client can immediately preview the carousel exactly as
      // it was scraped, without an extra round-trip to refetch the new row.
      template: {
        id: template.id,
        title,
        caption: caption || null,
        source_url: url,
        source_platform: platform,
        slides,
        blueprint,
      },
    });
  } catch (error) {
    console.error("[templates/import] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
