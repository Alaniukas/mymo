import type { AssetRef } from "./prompts";

/** Preserve the user's selection order from the picker (Postgres IN does not). */
export function orderAssetsByIds<T extends { id: string }>(
  ids: string[],
  rows: T[],
): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is T => row !== undefined);
}

/** One asset per slide — cycles when there are more slides than assets. */
export function assetUrlForSlide(
  assets: Pick<AssetRef, "public_url">[],
  slideIndex: number,
): string | undefined {
  if (assets.length === 0) return undefined;
  return assets[slideIndex % assets.length]?.public_url;
}

/**
 * Assets for a single slide — returns multiple URLs when the blueprint expects
 * split/collage composition (uses consecutive assets, cycling the pool).
 */
export function assetUrlsForSlide(
  assets: Pick<AssetRef, "public_url">[],
  slideIndex: number,
  photoCount: 1 | 2 | 3 | "grid" = 1,
  photoLayout?: string,
): string[] {
  if (assets.length === 0) return [];

  const needsMulti =
    photoCount === 2 ||
    photoCount === 3 ||
    photoCount === "grid" ||
    photoLayout === "split_vertical" ||
    photoLayout === "split_horizontal" ||
    photoLayout === "collage";

  const count = !needsMulti
    ? 1
    : photoCount === "grid"
      ? Math.min(4, assets.length)
      : photoCount === 3
        ? Math.min(3, assets.length)
        : Math.min(2, assets.length);

  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    urls.push(assets[(slideIndex + i) % assets.length]!.public_url);
  }
  return urls;
}

/**
 * Reference order for image models: user photo leads so the output keeps real
 * subjects; template follows as layout/style guide only.
 */
export function buildStudioReferenceUrls(opts: {
  slideAssetUrl?: string;
  templateUrl?: string;
  extraAssetUrls?: string[];
}): string[] {
  const refs: string[] = [];
  if (opts.slideAssetUrl) refs.push(opts.slideAssetUrl);
  if (opts.templateUrl) refs.push(opts.templateUrl);
  if (opts.extraAssetUrls) {
    for (const url of opts.extraAssetUrls) {
      if (url && !refs.includes(url)) refs.push(url);
    }
  }
  return refs.slice(0, 4);
}

export const USER_ASSET_PRIMARY_PROMPT =
  "Image #1 is the user's real uploaded photo — keep its subject, scene, people, and objects recognizable and prominent. Do NOT replace with generic stock imagery.";

export const TEMPLATE_LAYOUT_GUIDE_PROMPT =
  "Image #2 is the template slide — replicate its EXACT layout geometry (panel splits, inset frame size/position, blurred vs sharp background, text-zone spacing). Swap in the user's photo content from Image #1; do NOT copy the template's original subjects or literal text.";
