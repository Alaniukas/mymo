import type { TemplateBlueprint } from "./template-blueprint";

export interface StudioSlidePlan {
  totalSlides: number;
  trimBlueprint: boolean;
  photoSlideCount: number;
  aiSlideCount: number;
  fillWithAi: boolean;
}

/**
 * When the user picked photos, cap slides to their count (one photo per slide,
 * collage slides may reuse an asset). Without photos, use the full template.
 */
export function effectiveStudioSlideCount(
  templateSlideCount: number,
  assetCount: number,
): number {
  return resolveStudioSlidePlan(templateSlideCount, assetCount, false).totalSlides;
}

/**
 * Resolve slide count and generation mix for studio mode.
 * fillWithAi=true keeps full template arc; missing slides are AI-generated.
 */
export function resolveStudioSlidePlan(
  templateSlideCount: number,
  assetCount: number,
  fillWithAi: boolean,
): StudioSlidePlan {
  const template = Math.max(Math.round(templateSlideCount) || 1, 1);
  const assets = Math.max(Math.round(assetCount) || 0, 0);

  if (fillWithAi && assets > 0 && assets < template) {
    return {
      totalSlides: template,
      trimBlueprint: false,
      photoSlideCount: assets,
      aiSlideCount: template - assets,
      fillWithAi: true,
    };
  }

  const total = assets > 0 ? Math.min(template, assets) : template;
  return {
    totalSlides: total,
    trimBlueprint: total < template,
    photoSlideCount: total,
    aiSlideCount: 0,
    fillWithAi: false,
  };
}

/** Whether this slide position should use user photos (compose) vs AI generation. */
export function slideUsesUserPhotos(
  slidePosition: number,
  plan: StudioSlidePlan,
): boolean {
  if (plan.aiSlideCount === 0) return plan.photoSlideCount > 0;
  return slidePosition <= plan.photoSlideCount;
}

/**
 * Pick which template slide indices to use when generating fewer slides than the
 * template has. Keeps the opening hook and closing CTA when possible.
 */
export function pickTemplateSlideIndices(
  totalSlides: number,
  targetCount: number,
): number[] {
  const total = Math.max(Math.round(totalSlides) || 1, 1);
  const count = Math.min(Math.max(Math.round(targetCount) || 1, 1), total);

  if (count >= total) {
    return Array.from({ length: total }, (_, i) => i);
  }
  if (count === 1) return [0];
  if (count === 2) return [0, total - 1];

  const leading = Array.from({ length: count - 1 }, (_, i) => i);
  const last = total - 1;
  if (leading[leading.length - 1] === last) return leading;
  return [...leading, last];
}

export function trimBlueprintSlides(
  blueprint: TemplateBlueprint,
  targetCount: number,
): TemplateBlueprint {
  const indices = pickTemplateSlideIndices(blueprint.slides.length, targetCount);
  const slides = indices.map((i, newIdx) => ({
    ...blueprint.slides[i],
    position: newIdx + 1,
  }));
  return {
    ...blueprint,
    slideCount: slides.length,
    slides,
  };
}

export function trimOrderedList<T>(items: T[], targetCount: number): T[] {
  return pickTemplateSlideIndices(items.length, targetCount).map((i) => items[i]);
}
