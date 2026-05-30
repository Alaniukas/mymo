import type { SupabaseClient } from "@supabase/supabase-js";

export interface CarouselTemplateRow {
  id: string;
  workspace_id: string | null;
  niche: string;
  title: string;
  source_url: string | null;
  source_platform: string | null;
  caption: string | null;
  slides: unknown[];
  blueprint?: unknown | null;
}

const BASE_COLUMNS =
  "id, workspace_id, niche, title, source_url, source_platform, caption, slides";

/**
 * Loads carousel templates with graceful fallback when optional columns
 * (e.g. blueprint from migration 016) are not applied yet.
 */
export async function fetchCarouselTemplates(
  supabase: SupabaseClient,
  opts?: { workspaceId?: string },
): Promise<CarouselTemplateRow[]> {
  let query = supabase
    .from("carousel_templates")
    .select(`${BASE_COLUMNS}, blueprint`)
    .order("created_at", { ascending: false });

  if (opts?.workspaceId) {
    query = query.eq("workspace_id", opts.workspaceId);
  }

  const withBlueprint = await query;

  if (!withBlueprint.error) {
    return (withBlueprint.data ?? []) as CarouselTemplateRow[];
  }

  let basicQuery = supabase
    .from("carousel_templates")
    .select(BASE_COLUMNS)
    .order("created_at", { ascending: false });

  if (opts?.workspaceId) {
    basicQuery = basicQuery.eq("workspace_id", opts.workspaceId);
  }

  const basic = await basicQuery;

  if (basic.error) {
    console.error("[fetchCarouselTemplates]", basic.error);
    return [];
  }

  return (basic.data ?? []) as CarouselTemplateRow[];
}
