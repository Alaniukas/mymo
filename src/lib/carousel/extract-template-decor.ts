import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMediaBuffer, uploadBuffer } from "./storage";
import type {
  TemplateBlueprint,
  TemplateDecorAsset,
  TemplateSlideBlueprint,
} from "./template-blueprint";
import { normalizeDecorAssets } from "./template-blueprint";

export interface DecorAssetBuffer {
  asset: TemplateDecorAsset;
  buffer: Buffer;
}

function decorAssetsToExtract(
  assets: TemplateDecorAsset[] | undefined,
): TemplateDecorAsset[] {
  return (assets ?? []).filter((a) => !a.containsText && a.bbox);
}

/** Crop a single decor region from a slide image. */
export async function cropDecorAssetFromSlide(
  slideBuffer: Buffer,
  asset: TemplateDecorAsset,
): Promise<Buffer | null> {
  if (asset.containsText) return null;
  try {
    const image = await loadImage(slideBuffer);
    const { bbox } = asset;
    const sx = Math.max(0, Math.floor(bbox.x * image.width));
    const sy = Math.max(0, Math.floor(bbox.y * image.height));
    const sw = Math.min(
      image.width - sx,
      Math.max(1, Math.ceil(bbox.w * image.width)),
    );
    const sh = Math.min(
      image.height - sy,
      Math.max(1, Math.ceil(bbox.h * image.height)),
    );
    if (sw < 2 || sh < 2) return null;

    const canvas = createCanvas(sw, sh);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toBuffer("image/png");
  } catch (err) {
    console.warn("[extract-template-decor] crop failed:", asset.id, err);
    return null;
  }
}

/** Upload cropped decor PNGs and attach public URLs to blueprint slides. */
export async function extractDecorAssetsForSlide(
  db: SupabaseClient,
  templateId: string,
  slidePosition: number,
  slideImageUrl: string,
  assets: TemplateDecorAsset[],
): Promise<TemplateDecorAsset[]> {
  const toExtract = decorAssetsToExtract(assets);
  if (toExtract.length === 0) return assets;

  const media = await fetchMediaBuffer(slideImageUrl);
  if (!media) return assets;

  const updated: TemplateDecorAsset[] = [];

  for (const asset of assets) {
    if (asset.containsText) {
      updated.push(asset);
      continue;
    }

    const existing = asset.imageUrl?.trim();
    if (existing) {
      updated.push(asset);
      continue;
    }

    const png = await cropDecorAssetFromSlide(media.buffer, asset);
    if (!png) {
      updated.push(asset);
      continue;
    }

    const storagePath = `${templateId}/decor/s${slidePosition}/${asset.id}.png`;
    const uploaded = await uploadBuffer(
      db,
      png,
      storagePath,
      "image/png",
      "templates",
    );

    if (uploaded.ok) {
      updated.push({
        ...asset,
        imageUrl: uploaded.publicUrl,
        storagePath: uploaded.storagePath,
      });
    } else {
      updated.push(asset);
    }
  }

  return updated;
}

/**
 * After vision blueprint analysis, crop stickers/logos/icons from template slides
 * and persist hosted PNG URLs inside blueprint.decorAssets.
 */
export async function enrichBlueprintWithDecorAssets(
  db: SupabaseClient,
  templateId: string,
  slideImageUrls: string[],
  blueprint: TemplateBlueprint,
): Promise<TemplateBlueprint> {
  const slides: TemplateSlideBlueprint[] = [];

  for (const slide of blueprint.slides) {
    const url = slideImageUrls[slide.position - 1];
    const rawAssets = slide.decorAssets ?? [];
    if (!url || rawAssets.length === 0) {
      slides.push(slide);
      continue;
    }

    const decorAssets = await extractDecorAssetsForSlide(
      db,
      templateId,
      slide.position,
      url,
      rawAssets,
    );
    slides.push({ ...slide, decorAssets });
  }

  return { ...blueprint, slides };
}

/** Prefetch decor PNG buffers for compose (parallel fetch). */
export async function loadDecorAssetBuffers(
  assets: TemplateDecorAsset[] | undefined,
): Promise<DecorAssetBuffer[]> {
  const list = decorAssetsToExtract(assets).filter((a) => a.imageUrl?.trim());
  const results = await Promise.all(
    list.map(async (asset) => {
      const media = await fetchMediaBuffer(asset.imageUrl!);
      if (!media) return null;
      return { asset, buffer: media.buffer };
    }),
  );
  return results.filter((r): r is DecorAssetBuffer => r !== null);
}

/** Skip circular swatch/crop markers copied from templates — not reusable decor. */
export function filterTemplateSwatchDecor(
  decorBuffers: DecorAssetBuffer[],
): DecorAssetBuffer[] {
  return decorBuffers.filter(({ asset }) => {
    const { w, h } = asset.bbox;
    const label = (asset.label ?? "").toLowerCase();
    const isSmallRound =
      w > 0 &&
      h > 0 &&
      w < 0.22 &&
      h < 0.22 &&
      Math.abs(w - h) < 0.06;
    if (
      isSmallRound &&
      /swatch|circle|crop|dot|hotspot|texture|preview|bubble/.test(label)
    ) {
      return false;
    }
    if (isSmallRound && asset.kind !== "logo" && asset.kind !== "icon") {
      return false;
    }
    return true;
  });
}

/** Skip decor stickers that heavily overlap the main photo panel (avoid clutter). */
export function filterDecorAssetsByPhotoOverlap(
  decorBuffers: DecorAssetBuffer[],
  photoRegions: { x: number; y: number; w: number; h: number }[],
  width: number,
  height: number,
  overlapThreshold = 0.4,
): DecorAssetBuffer[] {
  if (photoRegions.length === 0) return decorBuffers;

  return decorBuffers.filter(({ asset }) => {
    if (asset.kind === "logo" || asset.kind === "icon" || asset.kind === "sticker") {
      return true;
    }
    const dx = asset.bbox.x * width;
    const dy = asset.bbox.y * height;
    const dw = asset.bbox.w * width;
    const dh = asset.bbox.h * height;
    const decorArea = dw * dh;
    if (decorArea <= 0) return true;

    for (const region of photoRegions) {
      const ix = Math.max(dx, region.x);
      const iy = Math.max(dy, region.y);
      const iw = Math.min(dx + dw, region.x + region.w) - ix;
      const ih = Math.min(dy + dh, region.y + region.h) - iy;
      if (iw <= 0 || ih <= 0) continue;
      const overlap = (iw * ih) / decorArea;
      if (overlap >= overlapThreshold) return false;
    }
    return true;
  });
}

/** Draw extracted template graphics on top of the composed slide background. */
export async function drawDecorAssetsOnCanvas(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  decorBuffers: DecorAssetBuffer[],
): Promise<void> {
  for (const { asset, buffer } of decorBuffers) {
    try {
      const img = await loadImage(buffer);
      const x = asset.bbox.x * width;
      const y = asset.bbox.y * height;
      const w = asset.bbox.w * width;
      const h = asset.bbox.h * height;
      ctx.drawImage(img, x, y, w, h);
    } catch (err) {
      console.warn("[extract-template-decor] draw failed:", asset.id, err);
    }
  }
}

/** Re-parse decor arrays after LLM output (ensures bbox validity). */
export function sanitizeBlueprintDecor(blueprint: TemplateBlueprint): TemplateBlueprint {
  return {
    ...blueprint,
    slides: blueprint.slides.map((s) => ({
      ...s,
      decorAssets: normalizeDecorAssets(s.decorAssets),
    })),
  };
}

/** True when blueprint lists decor bboxes but hosted crop URLs were never saved. */
export function decorAssetsNeedEnrichment(blueprint: TemplateBlueprint): boolean {
  return blueprint.slides.some((s) =>
    (s.decorAssets ?? []).some(
      (a) => !a.containsText && a.bbox && !a.imageUrl?.trim(),
    ),
  );
}
