import type { DecorAssetBBox, TemplateSlideBlueprint } from "./template-blueprint";

export type PixelRect = { x: number; y: number; w: number; h: number };

export interface BackgroundPanelSpec {
  bbox: DecorAssetBBox;
  color: string;
  role?: "text_panel" | "accent" | "background";
}

export function bboxToPixelRect(
  bbox: DecorAssetBBox,
  width: number,
  height: number,
): PixelRect {
  return {
    x: bbox.x * width,
    y: bbox.y * height,
    w: bbox.w * width,
    h: bbox.h * height,
  };
}

/** True when AI provided measured regions — renderer uses geometry instead of layout heuristics. */
export function slideHasGeometry(slide: TemplateSlideBlueprint): boolean {
  return (
    (slide.photoSlots?.length ?? 0) > 0 || Boolean(slide.textZone?.bbox)
  );
}

/** Geometry path unless the slide needs structured UI chrome (Notes bar, review stars). */
export function shouldUseGeometryRenderer(
  slide: TemplateSlideBlueprint,
): boolean {
  if (!slideHasGeometry(slide)) return false;
  const needsStructuredChrome =
    slide.composition.hasUIChrome &&
    (slide.textZone.placement === "card" ||
      slide.textZone.style === "quote" ||
      slide.layout === "notification_mock");
  return !needsStructuredChrome;
}

export function photoRegionsFromGeometry(
  slide: TemplateSlideBlueprint,
  width: number,
  height: number,
): PixelRect[] {
  if (!slide.photoSlots?.length) return [];
  return slide.photoSlots.map((bbox) => bboxToPixelRect(bbox, width, height));
}

export function backgroundPanelsFromGeometry(
  slide: TemplateSlideBlueprint,
  width: number,
  height: number,
): (BackgroundPanelSpec & PixelRect)[] {
  if (!slide.backgroundPanels?.length) return [];
  return slide.backgroundPanels.map((panel) => ({
    ...panel,
    ...bboxToPixelRect(panel.bbox, width, height),
  }));
}

export function textZoneRectFromGeometry(
  slide: TemplateSlideBlueprint,
  width: number,
  height: number,
): PixelRect | null {
  const bbox = slide.textZone?.bbox;
  if (!bbox) return null;
  return bboxToPixelRect(bbox, width, height);
}

/** Blurred full-bleed backdrop when geometry leaves margins or backgroundType says so. */
export function geometryUsesBlurredBackdrop(
  slide: TemplateSlideBlueprint,
  width: number,
  height: number,
): boolean {
  if (slide.backgroundType === "blurred") return true;
  const regions = photoRegionsFromGeometry(slide, width, height);
  if (regions.length === 0) return slide.backgroundType === "photo";
  const canvasArea = width * height;
  const maxSlot = Math.max(...regions.map((r) => r.w * r.h));
  return maxSlot < canvasArea * 0.82;
}

export function defaultCanvasFill(slide: TemplateSlideBlueprint): string {
  const panel = slide.backgroundPanels?.find(
    (p) => p.role === "background" || p.role === "text_panel",
  );
  if (panel?.color?.startsWith("#")) return panel.color;
  if (slide.backgroundType === "solid") {
    const c = slide.colors?.accentColor;
    if (c?.startsWith("#")) return c;
    return "#FFFFFF";
  }
  return "#0a0a0a";
}
