import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reuploadImage } from "@/lib/carousel/storage";
import {
  buildPresetSlideSvg,
  presetSourceUrl,
  resolvePreset,
} from "@/lib/carousel/materialize-preset";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { rateLimit } from "@/lib/rate-limit";
import { isNiche } from "@/lib/carousel/niches";
import { persistTemplateBlueprint, slideImageUrlsFromTemplate } from "@/lib/carousel/persist-template-blueprint";
import { getModelSettings } from "@/lib/settings/service";

export const maxDuration = 120;

type TemplateSlide = {
  position: number;
  image_url: string;
  storage_path: string;
  media_type: "image";
};

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

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

  const body = (await request.json()) as { preset_id?: string };
  const presetId = body.preset_id?.trim();
  if (!presetId) {
    return NextResponse.json({ error: "preset_id is required" }, { status: 400 });
  }

  const preset = resolvePreset(presetId);
  if (!preset) {
    return NextResponse.json({ error: "Unknown preset" }, { status: 404 });
  }

  const { data: workspaceRow } = await supabase
    .from("workspaces")
    .select("niche")
    .eq("id", workspaceId)
    .single();

  const templateNiche = isNiche(workspaceRow?.niche)
    ? workspaceRow.niche
    : preset.niche;

  const marker = presetSourceUrl(presetId);

  const { data: existing } = await supabase
    .from("carousel_templates")
    .select("id, slides")
    .eq("workspace_id", workspaceId)
    .eq("source_url", marker)
    .maybeSingle();

  if (existing?.id && Array.isArray(existing.slides) && existing.slides.length > 0) {
    return NextResponse.json({
      templateId: existing.id,
      starterTopic: preset.starterTopic,
      reused: true,
    });
  }

  const { data: tpl, error: insErr } = await supabase
    .from("carousel_templates")
    .insert({
      workspace_id: workspaceId,
      niche: templateNiche,
      title: preset.title,
      source_url: marker,
      source_platform: null,
      caption: preset.starterTopic,
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

  const origin = request.nextUrl.origin;
  const slides: TemplateSlide[] = [];

  for (let i = 0; i < preset.slideCount; i++) {
    const position = i + 1;
    const storagePath = `${workspaceId}/${tpl.id}/${position}.svg`;

    if (preset.thumbnail) {
      const fullUrl = preset.thumbnail.startsWith("http")
        ? preset.thumbnail
        : `${origin}${preset.thumbnail.startsWith("/") ? preset.thumbnail : `/${preset.thumbnail}`}`;
      const ext = preset.thumbnail.endsWith(".svg") ? "svg" : "jpg";
      const path = `${workspaceId}/${tpl.id}/${position}.${ext}`;
      const result = await reuploadImage(supabase, fullUrl, path, "templates");
      if (result.ok) {
        slides.push({
          position,
          image_url: result.publicUrl,
          storage_path: result.storagePath,
          media_type: "image",
        });
        continue;
      }
    }

    const svg = buildPresetSlideSvg(preset, i);
    const buffer = Buffer.from(svg, "utf-8");
    const { error: uploadError } = await supabase.storage
      .from("templates")
      .upload(storagePath, new Blob([buffer], { type: "image/svg+xml" }), {
        contentType: "image/svg+xml",
        upsert: true,
      });

    if (uploadError) {
      console.warn("[from-preset] upload failed:", uploadError);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from("templates")
      .getPublicUrl(storagePath);

    slides.push({
      position,
      image_url: urlData.publicUrl,
      storage_path: storagePath,
      media_type: "image",
    });
  }

  if (slides.length === 0) {
    await supabase.from("carousel_templates").delete().eq("id", tpl.id);
    return NextResponse.json(
      { error: "Failed to build preset slides" },
      { status: 500 },
    );
  }

  await supabase
    .from("carousel_templates")
    .update({ slides })
    .eq("id", tpl.id);

  let blueprintAnalyzed = false;
  try {
    const settings = await getModelSettings(supabase);
    await persistTemplateBlueprint(supabase, tpl.id, {
      imageUrls: slideImageUrlsFromTemplate(slides),
      caption: preset.starterTopic,
      model: settings.text_model,
      force: true,
    });
    blueprintAnalyzed = true;
  } catch (err) {
    console.warn("[from-preset] blueprint analysis failed:", err);
  }

  return NextResponse.json({
    templateId: tpl.id,
    starterTopic: preset.starterTopic,
    reused: false,
    blueprint_analyzed: blueprintAnalyzed,
  });
}
