import type { createClient } from "@/lib/supabase/server";
import { reuploadImage } from "@/lib/carousel/storage";
import type { PageAssetsExtracted } from "@/lib/carousel/page-assets";
import type { NicheSlug } from "@/lib/carousel/niches";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const SITE_ASSET_PREFIX = "From site:";
const MAX_PRODUCT_IMAGES = 8;

export interface ImportedSiteAssets {
  logoUrl: string | null;
  brandColor: string | null;
  assets: { id: string; type: "hook" | "demo"; public_url: string; name: string }[];
}

function assetTypeForImage(
  index: number,
  niche: NicheSlug | null,
): "hook" | "demo" {
  if (niche === "ecomm" || niche === "app") {
    return index === 0 ? "demo" : index % 2 === 0 ? "hook" : "demo";
  }
  return "hook";
}

async function removePreviousSiteImports(
  supabase: ServerSupabaseClient,
  workspaceId: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from("assets")
    .select("id, storage_path")
    .eq("workspace_id", workspaceId)
    .like("name", `${SITE_ASSET_PREFIX}%`);

  if (!rows?.length) return;

  const paths = rows.map((r) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from("assets").remove(paths);
  }
  await supabase
    .from("assets")
    .delete()
    .eq("workspace_id", workspaceId)
    .like("name", `${SITE_ASSET_PREFIX}%`);
}

/**
 * Downloads logo + hero/product images from a crawled page into the workspace
 * asset pool (and returns a stable logo URL for app_identities.logo_url).
 */
export async function importPageAssetsToWorkspace(
  supabase: ServerSupabaseClient,
  workspaceId: string,
  extracted: PageAssetsExtracted,
  niche: NicheSlug | null,
  opts: { replaceExisting?: boolean } = {},
): Promise<ImportedSiteAssets> {
  if (opts.replaceExisting !== false) {
    await removePreviousSiteImports(supabase, workspaceId);
  }

  const assets: ImportedSiteAssets["assets"] = [];
  let logoUrl: string | null = null;

  if (extracted.logoUrl) {
    const path = `${workspaceId}/logos/${crypto.randomUUID()}.png`;
    const up = await reuploadImage(supabase, extracted.logoUrl, path, "assets");
    if (up.ok) logoUrl = up.publicUrl;
  }

  const urls = extracted.imageUrls.slice(0, MAX_PRODUCT_IMAGES);
  for (let i = 0; i < urls.length; i++) {
    const source = urls[i];
    const type = assetTypeForImage(i, niche);
    const path = `${workspaceId}/${type}s/${crypto.randomUUID()}.jpg`;
    const up = await reuploadImage(supabase, source, path, "assets");
    if (!up.ok) continue;

    const label =
      i === 0 ? "hero" : i === 1 ? "image-2" : `image-${i + 1}`;
    const name = `${SITE_ASSET_PREFIX} ${label}`;

    const { data: row, error } = await supabase
      .from("assets")
      .insert({
        workspace_id: workspaceId,
        type,
        name,
        storage_path: up.storagePath,
        public_url: up.publicUrl,
        mime_type: "image/jpeg",
      })
      .select("id, type, public_url, name")
      .single();

    if (!error && row) {
      assets.push(row as ImportedSiteAssets["assets"][number]);
    }
  }

  return {
    logoUrl,
    brandColor: extracted.brandColor,
    assets,
  };
}
