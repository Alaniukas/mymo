import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandVibePayload, BrandVibeSnapshot } from "./types";
import { parseBrandVibePayload } from "./types";

type DB = SupabaseClient;

export async function getActiveBrandVibe(
  supabase: DB,
  workspaceId: string,
): Promise<BrandVibeSnapshot | null> {
  const { data } = await supabase
    .from("brand_vibe_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const vibe = parseBrandVibePayload(data.vibe);
  if (!vibe) return null;

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    source_type: data.source_type,
    source_url: data.source_url,
    title: data.title,
    vibe,
    asset_ids: Array.isArray(data.asset_ids) ? data.asset_ids : [],
    is_active: data.is_active,
    created_at: data.created_at,
  };
}

export async function listBrandVibeSnapshots(
  supabase: DB,
  workspaceId: string,
  limit = 10,
): Promise<BrandVibeSnapshot[]> {
  const { data } = await supabase
    .from("brand_vibe_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .map((row) => {
      const vibe = parseBrandVibePayload(row.vibe);
      if (!vibe) return null;
      return {
        id: row.id,
        workspace_id: row.workspace_id,
        source_type: row.source_type,
        source_url: row.source_url,
        title: row.title,
        vibe,
        asset_ids: Array.isArray(row.asset_ids) ? row.asset_ids : [],
        is_active: row.is_active,
        created_at: row.created_at,
      } satisfies BrandVibeSnapshot;
    })
    .filter((x): x is BrandVibeSnapshot => x !== null);
}

export async function saveBrandVibeSnapshot(
  supabase: DB,
  opts: {
    workspaceId: string;
    sourceType: string;
    sourceUrl?: string;
    title: string;
    vibe: BrandVibePayload;
    assetIds?: string[];
    setActive?: boolean;
  },
): Promise<BrandVibeSnapshot | null> {
  if (opts.setActive !== false) {
    await supabase
      .from("brand_vibe_snapshots")
      .update({ is_active: false })
      .eq("workspace_id", opts.workspaceId)
      .eq("is_active", true);
  }

  const { data, error } = await supabase
    .from("brand_vibe_snapshots")
    .insert({
      workspace_id: opts.workspaceId,
      source_type: opts.sourceType,
      source_url: opts.sourceUrl ?? null,
      title: opts.title,
      vibe: opts.vibe,
      asset_ids: opts.assetIds ?? [],
      is_active: opts.setActive !== false,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  const vibe = parseBrandVibePayload(data.vibe);
  if (!vibe) return null;

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    source_type: data.source_type,
    source_url: data.source_url,
    title: data.title,
    vibe,
    asset_ids: Array.isArray(data.asset_ids) ? data.asset_ids : [],
    is_active: data.is_active,
    created_at: data.created_at,
  };
}
