import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enrichBlueprintWithDecorAssets,
  sanitizeBlueprintDecor,
  decorAssetsNeedEnrichment,
} from "./extract-template-decor";
import {
  analyzeTemplateBlueprint,
  buildFallbackBlueprint,
  parseTemplateBlueprint,
  type TemplateBlueprint,
} from "./template-blueprint";
import { slideHasGeometry } from "./slide-geometry";

type TemplateSlideRow = {
  position?: number;
  image_url?: string;
};

export function slideImageUrlsFromTemplate(
  slides: unknown,
): string[] {
  const rows = (Array.isArray(slides) ? slides : []) as TemplateSlideRow[];
  return rows
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => s.image_url)
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

export class TemplateBlueprintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateBlueprintError";
  }
}

/**
 * Run multimodal blueprint analysis and persist to carousel_templates.
 * Throws TemplateBlueprintError when analysis cannot produce a valid blueprint.
 */
export async function persistTemplateBlueprint(
  db: SupabaseClient,
  templateId: string,
  opts: {
    imageUrls: string[];
    /** Original scrape URLs — retried if hosted URLs fail to load. */
    fallbackImageUrls?: string[];
    caption?: string | null;
    model?: string;
    /** Re-analyze even when a blueprint already exists. */
    force?: boolean;
  },
): Promise<{ blueprint: TemplateBlueprint; analyzedAt: string }> {
  const urls = opts.imageUrls.filter((u) => typeof u === "string" && u.trim());
  if (urls.length === 0) {
    throw new TemplateBlueprintError("Template has no slide images to analyze.");
  }

  if (!opts.force) {
    const { data: existing } = await db
      .from("carousel_templates")
      .select("blueprint, blueprint_analyzed_at")
      .eq("id", templateId)
      .maybeSingle();

    const parsed = parseTemplateBlueprint(existing?.blueprint);
    const needsGeometryRefresh =
      parsed &&
      parsed.slides.length > 0 &&
      !parsed.slides.some((s) => slideHasGeometry(s));

    if (parsed && parsed.slides.length > 0 && !needsGeometryRefresh) {
      let blueprint = parsed;
      if (decorAssetsNeedEnrichment(blueprint)) {
        try {
          blueprint = await enrichBlueprintWithDecorAssets(
            db,
            templateId,
            urls,
            blueprint,
          );
          await db
            .from("carousel_templates")
            .update({ blueprint: blueprint as unknown as Record<string, unknown> })
            .eq("id", templateId);
        } catch (err) {
          console.warn(
            "[persist-template-blueprint] decor enrichment on cache hit failed:",
            err,
          );
        }
      }
      return {
        blueprint,
        analyzedAt:
          (existing?.blueprint_analyzed_at as string | null) ??
          new Date().toISOString(),
      };
    }
  }

  let analyzed = await analyzeTemplateBlueprint(
    urls,
    opts.caption ?? null,
    opts.model,
  );

  if ((!analyzed || analyzed.slides.length === 0) && opts.fallbackImageUrls?.length) {
    const alt = opts.fallbackImageUrls.filter((u) => typeof u === "string" && u.trim());
    if (alt.length > 0) {
      analyzed = await analyzeTemplateBlueprint(alt, opts.caption ?? null, opts.model);
    }
  }

  if (!analyzed || analyzed.slides.length === 0) {
    console.warn(
      "[persist-template-blueprint] vision analysis failed — using structural fallback blueprint",
    );
    analyzed = buildFallbackBlueprint(urls.length);
  }

  analyzed = sanitizeBlueprintDecor(analyzed);

  try {
    analyzed = await enrichBlueprintWithDecorAssets(
      db,
      templateId,
      urls,
      analyzed,
    );
  } catch (err) {
    console.warn("[persist-template-blueprint] decor extraction failed:", err);
  }

  const analyzedAt = new Date().toISOString();
  const { error } = await db
    .from("carousel_templates")
    .update({
      blueprint: analyzed as unknown as Record<string, unknown>,
      blueprint_analyzed_at: analyzedAt,
    })
    .eq("id", templateId);

  if (error) {
    throw new TemplateBlueprintError(
      `Failed to save template analysis: ${error.message}`,
    );
  }

  return { blueprint: analyzed, analyzedAt };
}

/** Crop template stickers/logos if the blueprint has bboxes but no hosted PNGs yet. */
export async function ensureDecorAssetsEnriched(
  db: SupabaseClient,
  templateId: string,
  imageUrls: string[],
  blueprint: TemplateBlueprint,
): Promise<TemplateBlueprint> {
  if (!decorAssetsNeedEnrichment(blueprint)) return blueprint;
  const enriched = await enrichBlueprintWithDecorAssets(
    db,
    templateId,
    imageUrls,
    blueprint,
  );
  await db
    .from("carousel_templates")
    .update({ blueprint: enriched as unknown as Record<string, unknown> })
    .eq("id", templateId);
  return enriched;
}

/** Load blueprint from DB or analyze + persist on demand. */
export async function ensureTemplateBlueprint(
  db: SupabaseClient,
  templateId: string,
  opts: {
    slides: unknown;
    caption?: string | null;
    model?: string;
  },
): Promise<TemplateBlueprint> {
  const imageUrls = slideImageUrlsFromTemplate(opts.slides);
  const { blueprint } = await persistTemplateBlueprint(db, templateId, {
    imageUrls,
    caption: opts.caption,
    model: opts.model,
  });
  return blueprint;
}
