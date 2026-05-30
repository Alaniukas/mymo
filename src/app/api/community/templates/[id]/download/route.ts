import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reuploadImage } from "@/lib/carousel/storage";
import {
  persistTemplateBlueprint,
  slideImageUrlsFromTemplate,
} from "@/lib/carousel/persist-template-blueprint";
import { getModelSettings } from "@/lib/settings/service";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { rateLimit } from "@/lib/rate-limit";
import type { CommunityTemplateSlide } from "@/lib/community/types";
import {
  isMissingCommunityTableError,
  seedTemplatesFromCode,
} from "@/lib/community/fallback-seed";

export const maxDuration = 120;

function isPublicCommunitySlide(url: string): boolean {
  return url.startsWith("/community-templates/");
}

function absoluteUrl(path: string, origin: string): string {
  if (path.startsWith("http")) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await resolveActiveWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No project selected. Create a project first." },
      { status: 404 },
    );
  }

  const { data: community, error: fetchErr } = await supabase
    .from("community_templates")
    .select("id, title, niche, slides, source_url, source_platform")
    .eq("id", id)
    .single();

  let communityData = community;

  if (fetchErr) {
    if (isMissingCommunityTableError(fetchErr.message)) {
      const seed = seedTemplatesFromCode().find((t) => t.id === id);
      if (!seed) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      communityData = {
        id: seed.id,
        title: seed.title,
        niche: seed.niche,
        slides: seed.slides,
        source_url: null,
        source_platform: null,
      };
    } else {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
  }

  if (!communityData) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const sourceSlides = (communityData.slides ?? []) as CommunityTemplateSlide[];
  if (sourceSlides.length === 0) {
    return NextResponse.json(
      { error: "Template has no slides" },
      { status: 422 },
    );
  }

  const origin = request.nextUrl.origin;

  const { data: tpl, error: insErr } = await supabase
    .from("carousel_templates")
    .insert({
      workspace_id: workspaceId,
      niche: communityData.niche,
      title: communityData.title,
      source_url: communityData.source_url,
      source_platform: communityData.source_platform,
      caption: null,
      slides: [],
    })
    .select("id")
    .single();

  if (insErr || !tpl) {
    return NextResponse.json(
      { error: insErr?.message ?? "Failed to create template" },
      { status: 500 },
    );
  }

  const copiedSlides: CommunityTemplateSlide[] = [];

  for (const slide of [...sourceSlides].sort(
    (a, b) => a.position - b.position,
  )) {
    const srcUrl = slide.image_url;
    const isPublic = isPublicCommunitySlide(srcUrl);

    if (isPublic) {
      const fullUrl = absoluteUrl(srcUrl, origin);
      const ext = srcUrl.endsWith(".svg") ? "svg" : "jpg";
      const storagePath = `${workspaceId}/${tpl.id}/${slide.position}.${ext}`;
      const result = await reuploadImage(
        supabase,
        fullUrl,
        storagePath,
        "templates",
      );

      if (result.ok) {
        copiedSlides.push({
          position: slide.position,
          image_url: result.publicUrl,
          storage_path: result.storagePath,
          media_type: slide.media_type ?? "image",
          video_url: slide.video_url,
          video_storage_path: slide.video_storage_path,
        });
      } else {
        copiedSlides.push({
          position: slide.position,
          image_url: fullUrl,
          storage_path: "",
          media_type: slide.media_type ?? "image",
        });
      }
    } else if (slide.storage_path) {
      copiedSlides.push({
        position: slide.position,
        image_url: slide.image_url,
        storage_path: slide.storage_path,
        media_type: slide.media_type ?? "image",
        video_url: slide.video_url,
        video_storage_path: slide.video_storage_path,
      });
    } else {
      copiedSlides.push({
        position: slide.position,
        image_url: slide.image_url,
        storage_path: slide.storage_path ?? "",
        media_type: slide.media_type ?? "image",
      });
    }
  }

  await supabase
    .from("carousel_templates")
    .update({ slides: copiedSlides })
    .eq("id", tpl.id);

  let blueprintAnalyzed = false;
  try {
    const settings = await getModelSettings(supabase);
    await persistTemplateBlueprint(supabase, tpl.id, {
      imageUrls: slideImageUrlsFromTemplate(copiedSlides),
      model: settings.text_model,
      force: true,
    });
    blueprintAnalyzed = true;
  } catch (err) {
    console.warn("[community/download] blueprint analysis failed:", err);
  }

  const { error: rpcErr } = await supabase.rpc("increment_community_download", {
    template_id: id,
  });
  if (rpcErr && !isMissingCommunityTableError(rpcErr.message)) {
    console.warn("[community/download] increment failed:", rpcErr.message);
  }

  return NextResponse.json({
    templateId: tpl.id,
    redirectUrl: `/dashboard/carousels/new?template=${tpl.id}`,
    blueprint_analyzed: blueprintAnalyzed,
  });
}
