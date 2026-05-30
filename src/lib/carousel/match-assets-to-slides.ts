import type { SubjectZone } from "./template-blueprint";
import type { TemplateSlideBlueprint } from "./template-blueprint";
import type { AssetBlueprint } from "./asset-blueprint";
import { parseAssetBlueprint } from "./asset-blueprint";
import type { StudioSlidePlan } from "./studio-slide-count";
import { slideUsesUserPhotos } from "./studio-slide-count";

export interface AssetWithAnalysis {
  id: string;
  public_url: string;
  analysis?: unknown;
}

function scoreAssetForSlide(
  asset: AssetBlueprint,
  slide: TemplateSlideBlueprint,
): number {
  let score = 0;
  const { composition, role } = slide;

  if (composition.hasPerson && asset.hasPerson) score += 3;
  if (composition.hasProduct && asset.hasProduct) score += 3;
  if (composition.hasScreenshot && asset.hasScreenshot) score += 3;

  if (role === "hook" && asset.suggestedRoles.includes("hook")) score += 2;
  if (role === "cta" && asset.suggestedRoles.includes("cta")) score += 2;
  if (role === "value" && asset.suggestedRoles.includes("value")) score += 1;

  if (
    composition.subjectZone !== "full" &&
    asset.subjectZone === composition.subjectZone
  ) {
    score += 1;
  }

  return score;
}

function pickBestUnused(
  slide: TemplateSlideBlueprint,
  parsed: { id: string; blueprint: AssetBlueprint | null }[],
  used: Set<string>,
): string | null {
  let bestId: string | null = null;
  let bestScore = -1;

  for (const { id, blueprint } of parsed) {
    if (used.has(id)) continue;
    const score = blueprint ? scoreAssetForSlide(blueprint, slide) : 0;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId ?? parsed.find((p) => !used.has(p.id))?.id ?? null;
}

/**
 * Assign user assets to template slides by content fit. When there are at least
 * as many photos as photo slides, each slide gets a unique asset (preserving the
 * user's upload order as tie-breaker). Value slides may reuse assets only when
 * there are fewer photos than slides.
 */
export function matchAssetsToSlides(
  slides: TemplateSlideBlueprint[],
  assets: AssetWithAnalysis[],
  plan: StudioSlidePlan,
): Map<number, string[]> {
  const mapping = new Map<number, string[]>();
  if (assets.length === 0) return mapping;

  const parsed = assets.map((a) => ({
    id: a.id,
    blueprint: parseAssetBlueprint(a.analysis),
  }));

  const photoSlides = slides.filter((s) => slideUsesUserPhotos(s.position, plan));
  if (photoSlides.length === 0) return mapping;

  const allowReuse = photoSlides.length > assets.length;
  const used = new Set<string>();

  // Enough photos for every slide — one unique asset per slide, best-fit first.
  if (!allowReuse) {
    for (const slide of [...photoSlides].sort((a, b) => a.position - b.position)) {
      const id = pickBestUnused(slide, parsed, used);
      if (id) {
        mapping.set(slide.position, [id]);
        used.add(id);
      }
    }
    return mapping;
  }

  // Fewer photos than slides — hook/CTA get best matches; value slides may reuse.
  const hookSlide = photoSlides.find((s) => s.role === "hook");
  const ctaSlide = photoSlides.find((s) => s.role === "cta");
  const valueSlides = photoSlides.filter((s) => s.role === "value");

  if (hookSlide) {
    const id = pickBestUnused(hookSlide, parsed, used);
    if (id) {
      mapping.set(hookSlide.position, [id]);
      used.add(id);
    }
  }

  if (ctaSlide && ctaSlide.position !== hookSlide?.position) {
    const id = pickBestUnused(ctaSlide, parsed, used);
    if (id) {
      mapping.set(ctaSlide.position, [id]);
      used.add(id);
    }
  }

  for (const slide of valueSlides) {
    if (mapping.has(slide.position)) continue;

    let bestId: string | null = null;
    let bestScore = -1;
    for (const { id, blueprint } of parsed) {
      if (!blueprint) continue;
      const s = scoreAssetForSlide(blueprint, slide);
      if (s > bestScore) {
        bestScore = s;
        bestId = id;
      }
    }

    const id = bestId ?? parsed[0]?.id;
    if (id) mapping.set(slide.position, [id]);
  }

  for (const slide of photoSlides) {
    if (mapping.has(slide.position)) continue;
    const idx = (slide.position - 1) % assets.length;
    mapping.set(slide.position, [assets[idx]!.id]);
  }

  return mapping;
}

export function subjectZoneForAsset(
  assetAnalysis: unknown,
  templateZone: SubjectZone,
): SubjectZone {
  const bp = parseAssetBlueprint(assetAnalysis);
  return bp?.subjectZone ?? templateZone;
}
