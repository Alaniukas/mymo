import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAssetBlueprint,
  persistAssetAnalysis,
} from "./asset-blueprint";
import type { AssetWithAnalysis } from "./match-assets-to-slides";
import { orderAssetsByIds } from "./studio-asset-references";

/** Vision-analyze any assets missing `analysis` and return them in picker order. */
export async function ensureAssetsAnalyzed(
  db: SupabaseClient,
  workspaceId: string,
  assetIds: string[],
  model?: string,
): Promise<AssetWithAnalysis[]> {
  if (assetIds.length === 0) return [];

  const { data: rows } = await db
    .from("assets")
    .select("id, public_url, analysis")
    .eq("workspace_id", workspaceId)
    .in("id", assetIds);

  const ordered = orderAssetsByIds(assetIds, rows ?? []);
  const results: AssetWithAnalysis[] = [];

  for (const row of ordered) {
    let analysis: unknown = row.analysis;
    if (!parseAssetBlueprint(analysis)) {
      const fresh = await persistAssetAnalysis(
        db,
        row.id,
        row.public_url,
        model,
      );
      if (fresh) analysis = fresh;
    }
    results.push({
      id: row.id,
      public_url: row.public_url,
      analysis,
    });
  }

  return results;
}
