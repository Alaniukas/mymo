import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import {
  overlayDimsForAspect,
  roundedRectPath,
  safeInsets,
} from "./overlay/primitives";
import type { DecorAssetBuffer } from "./extract-template-decor";
import {
  drawDecorAssetsOnCanvas,
  filterDecorAssetsByPhotoOverlap,
  filterTemplateSwatchDecor,
} from "./extract-template-decor";
import type {
  PhotoLayout,
  SubjectZone,
  TemplateSlideBlueprint,
} from "./template-blueprint";
import {
  editorialPanelColor,
  editorialPanelRect,
  editorialPhotoRect,
  overlaySpecFromBlueprint,
  resolveSlideLayout,
} from "./blueprint-overlay";
import {
  backgroundPanelsFromGeometry,
  defaultCanvasFill,
  geometryUsesBlurredBackdrop,
  photoRegionsFromGeometry,
  slideHasGeometry,
} from "./slide-geometry";

function cropCover(
  image: Awaited<ReturnType<typeof loadImage>>,
  destW: number,
  destH: number,
  subjectZone: SubjectZone,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(destW / image.width, destH / image.height);
  const sw = destW / scale;
  const sh = destH / scale;
  let sx = (image.width - sw) / 2;
  let sy = (image.height - sh) / 2;

  if (subjectZone === "top" || subjectZone === "full") sy = 0;
  else if (subjectZone === "bottom") sy = Math.max(0, image.height - sh);
  else if (subjectZone === "left") sx = 0;
  else if (subjectZone === "right") sx = Math.max(0, image.width - sw);

  return { sx, sy, sw, sh };
}

function panelRects(
  width: number,
  height: number,
  layout: PhotoLayout,
  count: number,
  inset: { top: number; bottom: number; left: number; right: number },
): { x: number; y: number; w: number; h: number }[] {
  const innerW = width - inset.left - inset.right;
  const innerH = height - inset.top - inset.bottom;
  const x0 = inset.left;
  const y0 = inset.top;

  if (layout === "split_vertical") {
    const h = innerH / Math.min(count, 2);
    return Array.from({ length: Math.min(count, 2) }, (_, i) => ({
      x: x0,
      y: y0 + i * h,
      w: innerW,
      h,
    }));
  }

  if (layout === "split_horizontal" || count >= 2) {
    const w = innerW / Math.min(count, 2);
    return Array.from({ length: Math.min(count, 2) }, (_, i) => ({
      x: x0 + i * w,
      y: y0,
      w,
      h: innerH,
    }));
  }

  if (layout === "collage" && count >= 3) {
    return [
      { x: x0, y: y0, w: innerW / 2, h: innerH / 2 },
      { x: x0 + innerW / 2, y: y0, w: innerW / 2, h: innerH / 2 },
      { x: x0, y: y0 + innerH / 2, w: innerW, h: innerH / 2 },
    ].slice(0, count);
  }

  return [{ x: x0, y: y0, w: innerW, h: innerH }];
}

/** Photo panel geometry aligned with overlay layout proportions. */
export function photoRegionsForBlueprint(
  blueprint: TemplateSlideBlueprint,
  width: number,
  height: number,
  aspect: string,
): { x: number; y: number; w: number; h: number }[] {
  const ins = safeInsets(width, height, aspect);
  const { composition, textZone } = blueprint;
  const effectiveLayout = resolveSlideLayout(blueprint);
  const photoCount =
    composition.photoCount === "grid"
      ? 4
      : typeof composition.photoCount === "number"
        ? composition.photoCount
        : 1;

  if (slideHasGeometry(blueprint)) {
    const geoRegions = photoRegionsFromGeometry(blueprint, width, height);
    if (geoRegions.length > 0) return geoRegions;
  }

  if (effectiveLayout === "editorial_split") {
    return [editorialPhotoRect(blueprint, width, height)];
  }

  if (effectiveLayout === "split_compare") {
    const bandH = ins.top + height * 0.17;
    const photoTop = bandH;
    const photoH = height - photoTop - ins.bottom;
    const innerW = width - ins.left - ins.right;

    if (composition.photoLayout === "split_vertical" || photoCount >= 2) {
      if (composition.photoLayout === "split_vertical") {
        const panelH = photoH / 2;
        return [
          { x: ins.left, y: photoTop, w: innerW, h: panelH },
          { x: ins.left, y: photoTop + panelH, w: innerW, h: panelH },
        ];
      }
      const panelW = innerW / 2;
      return [
        { x: ins.left, y: photoTop, w: panelW, h: photoH },
        { x: ins.left + panelW, y: photoTop, w: panelW, h: photoH },
      ];
    }
    return [{ x: ins.left, y: photoTop, w: innerW, h: photoH }];
  }

  if (effectiveLayout === "text_only" && blueprint.backgroundType !== "photo") {
    return [];
  }

  // Card / notification slides use a blurred photo backdrop only — sharp photo
  // panels would cover the card chrome burned on at finalize.
  if (
    effectiveLayout === "testimonial_card" ||
    effectiveLayout === "notification_mock" ||
    blueprint.backgroundType === "blurred"
  ) {
    return [];
  }

  if (composition.photoLayout === "inset") {
    const frameW = width * 0.86;
    const frameH = height * 0.55;
    return [
      {
        x: (width - frameW) / 2,
        y: height * 0.2,
        w: frameW,
        h: frameH,
      },
    ];
  }

  const needsMulti =
    photoCount >= 2 ||
    composition.photoLayout === "split_vertical" ||
    composition.photoLayout === "split_horizontal" ||
    composition.photoLayout === "collage";

  if (needsMulti) {
    return panelRects(
      width,
      height,
      composition.photoLayout,
      photoCount,
      ins,
    );
  }

  if (textZone.placement === "top") {
    return [{ x: 0, y: height * 0.14, w: width, h: height * 0.86 }];
  }
  if (textZone.placement === "bottom" || textZone.placement === "card") {
    return [{ x: 0, y: 0, w: width, h: height * 0.72 }];
  }

  return [{ x: 0, y: 0, w: width, h: height }];
}

function solidBackground(blueprint: TemplateSlideBlueprint): string {
  const c = blueprint.colors?.accentColor;
  return c?.startsWith("#") ? c : "#141414";
}

async function drawBlurredCover(
  ctx: SKRSContext2D,
  image: Awaited<ReturnType<typeof loadImage>>,
  width: number,
  height: number,
): Promise<void> {
  ctx.save();
  ctx.filter = `blur(${Math.round(width * 0.035)}px)`;
  const scale = Math.max(width / image.width, height / image.height) * 1.15;
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
  ctx.restore();
}

function dimStrengthForBlueprint(
  blueprint: TemplateSlideBlueprint,
): number {
  const strength = blueprint.colors?.overlayStrength;
  if (strength === "light") return 0.22;
  if (strength === "heavy") return 0.52;
  return 0.36;
}

function drawDimOverlay(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  alpha: number,
): void {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, width, height);
}

/** Layouts where the user photo is only a softened backdrop — no sharp full-bleed panel. */
function usesBlurredPhotoBackdrop(blueprint: TemplateSlideBlueprint): boolean {
  const { backgroundType, composition } = blueprint;
  const layout = resolveSlideLayout(blueprint);
  if (layout === "testimonial_card" || layout === "notification_mock") return true;
  if (layout === "editorial_split") return false;
  if (backgroundType === "blurred") return true;
  if (composition.photoLayout === "inset") return true;
  return false;
}

function drawPhotoInRect(
  ctx: SKRSContext2D,
  image: Awaited<ReturnType<typeof loadImage>>,
  rect: { x: number; y: number; w: number; h: number },
  subjectZone: SubjectZone,
  rounded: boolean,
  width: number,
): void {
  const crop = cropCover(image, rect.w, rect.h, subjectZone);
  ctx.save();
  if (rounded) {
    roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, width * 0.04);
    ctx.clip();
  }
  ctx.drawImage(
    image,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
  );
  ctx.restore();
  if (rounded) {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = Math.max(2, width * 0.002);
    roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, width * 0.04);
    ctx.stroke();
  }
}

/**
 * Compose a slide background that mirrors the template blueprint structure using
 * only the user's photos. Text and UI chrome are burned on later in finalize.
 */
export async function composeSlideFromBlueprint(opts: {
  assetBuffers: Buffer[];
  aspect: string;
  slideBlueprint: TemplateSlideBlueprint;
  /** Cropped stickers/logos from the template slide, layered above user photos. */
  decorBuffers?: DecorAssetBuffer[];
  /** Override template subjectZone with analyzed user photo crop hint. */
  assetSubjectZone?: SubjectZone;
}): Promise<Buffer | null> {
  const { assetBuffers, aspect, slideBlueprint, decorBuffers, assetSubjectZone } =
    opts;
  if (assetBuffers.length === 0) return null;

  const { width, height } = overlayDimsForAspect(aspect);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const effectiveLayout = resolveSlideLayout(slideBlueprint);
  const { backgroundType, composition } = slideBlueprint;
  const images = await Promise.all(assetBuffers.map((b) => loadImage(b)));
  const primary = images[0]!;
  const useGeometry = slideHasGeometry(slideBlueprint);

  if (useGeometry) {
    ctx.fillStyle = defaultCanvasFill(slideBlueprint);
    ctx.fillRect(0, 0, width, height);
    for (const panel of backgroundPanelsFromGeometry(
      slideBlueprint,
      width,
      height,
    )) {
      ctx.fillStyle = panel.color.startsWith("#") ? panel.color : "#FFFFFF";
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    }
  } else if (effectiveLayout === "editorial_split") {
    const panel = editorialPanelRect(slideBlueprint, width, height);
    ctx.fillStyle = editorialPanelColor(slideBlueprint);
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  } else if (backgroundType === "solid" || effectiveLayout === "text_only") {
    ctx.fillStyle = solidBackground(slideBlueprint);
    ctx.fillRect(0, 0, width, height);
  } else if (backgroundType === "gradient") {
    const accent = slideBlueprint.colors?.accentColor ?? "#2a2a2a";
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    const blurredBackdrop = useGeometry
      ? geometryUsesBlurredBackdrop(slideBlueprint, width, height)
      : usesBlurredPhotoBackdrop(slideBlueprint);
    if (blurredBackdrop) {
      await drawBlurredCover(ctx, primary, width, height);
      drawDimOverlay(ctx, width, height, dimStrengthForBlueprint(slideBlueprint));
    }
  }

  let regions = photoRegionsForBlueprint(slideBlueprint, width, height, aspect);
  if (regions.length > images.length && images.length === 1) {
    regions = [regions[regions.length - 1] ?? regions[0]!].filter(Boolean);
  }
  const rounded = composition.photoLayout === "inset";
  const cropZone = assetSubjectZone ?? composition.subjectZone;

  for (let i = 0; i < regions.length; i++) {
    const img = images[i % images.length]!;
    drawPhotoInRect(
      ctx,
      img,
      regions[i]!,
      cropZone,
      rounded,
      width,
    );
  }

  if (
    regions.length === 0 &&
    effectiveLayout !== "text_only" &&
    backgroundType === "photo"
  ) {
    drawPhotoInRect(
      ctx,
      primary,
      { x: 0, y: 0, w: width, h: height },
      cropZone,
      false,
      width,
    );
  }

  if (decorBuffers && decorBuffers.length > 0) {
    let decorToDraw = filterTemplateSwatchDecor(decorBuffers);
    if (useGeometry || effectiveLayout === "editorial_split") {
      decorToDraw = decorToDraw.filter(
        ({ asset }) => asset.kind === "logo" || asset.kind === "icon",
      );
    }
    const filtered = filterDecorAssetsByPhotoOverlap(
      decorToDraw,
      regions.length > 0
        ? regions
        : [{ x: 0, y: 0, w: width, h: height }],
      width,
      height,
    );
    if (filtered.length > 0) {
      await drawDecorAssetsOnCanvas(ctx, width, height, filtered);
    }
  }

  return canvas.toBuffer("image/png");
}

export function slideNeedsMultiAssetCompose(
  slideBlueprint?: TemplateSlideBlueprint | null,
  assetCount = 0,
): boolean {
  if (!slideBlueprint || assetCount < 2) return false;
  const { composition } = slideBlueprint;
  const layout = resolveSlideLayout(slideBlueprint);
  if (layout === "split_compare") return assetCount >= 2;
  if (layout === "editorial_split") return false;
  return (
    composition.photoCount === 2 ||
    composition.photoCount === 3 ||
    composition.photoCount === "grid" ||
    composition.photoLayout === "split_vertical" ||
    composition.photoLayout === "split_horizontal" ||
    composition.photoLayout === "collage"
  );
}

/** @deprecated Use composeSlideFromBlueprint */
export async function renderAssetSlideFromBlueprint(
  assetBuffers: Buffer[],
  aspect: string,
  slideBlueprint?: TemplateSlideBlueprint | null,
): Promise<Buffer | null> {
  if (!slideBlueprint) {
    if (assetBuffers.length === 0) return null;
    return renderAssetAsSlide(assetBuffers[0], aspect);
  }
  return composeSlideFromBlueprint({
    assetBuffers,
    aspect,
    slideBlueprint,
  });
}

export async function renderAssetAsSlide(
  assetBuffer: Buffer,
  aspect: string,
  subjectZone: SubjectZone = "center",
): Promise<Buffer> {
  const { width, height } = overlayDimsForAspect(aspect);
  const image = await loadImage(assetBuffer);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  drawPhotoInRect(
    ctx,
    image,
    { x: 0, y: 0, w: width, h: height },
    subjectZone,
    false,
    width,
  );
  return canvas.toBuffer("image/png");
}

export async function renderMultiAssetSlide(
  assetBuffers: Buffer[],
  aspect: string,
  slideBlueprint: TemplateSlideBlueprint,
): Promise<Buffer> {
  const result = await composeSlideFromBlueprint({
    assetBuffers,
    aspect,
    slideBlueprint,
  });
  if (!result) throw new Error("Failed to compose multi-asset slide");
  return result;
}

export function overlayLayoutFromBlueprint(
  slideBlueprint?: TemplateSlideBlueprint | null,
  fallback = "fullbleed_dark_overlay",
): string {
  return overlaySpecFromBlueprint(slideBlueprint, fallback).layout;
}

export { overlaySpecFromBlueprint } from "./blueprint-overlay";
