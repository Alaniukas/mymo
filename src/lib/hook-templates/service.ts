import type { SupabaseClient } from "@supabase/supabase-js";
import type { HookTemplateKind } from "./types";

export type PublishedHookTemplate = {
  id: string;
  title: string;
  hook_line: string;
  creator_prompt: string;
  motion_prompt: string;
  preview_image_url: string | null;
  preview_video_url: string | null;
  kind: HookTemplateKind;
  sort_order: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; templates: PublishedHookTemplate[] }>();

function cacheKey(kind: HookTemplateKind | null) {
  return kind ?? "all";
}

export function invalidateHookTemplatesCache() {
  cache.clear();
}

export async function getPublishedHookTemplates(
  supabase: SupabaseClient,
  kind: HookTemplateKind | null,
): Promise<PublishedHookTemplate[]> {
  const key = cacheKey(kind);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.templates;
  }

  let query = supabase
    .from("hook_templates")
    .select(
      "id, title, hook_line, creator_prompt, motion_prompt, preview_image_url, preview_video_url, kind, sort_order",
    )
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (kind) {
    query = query.eq("kind", kind);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("hook_templates")) {
      return [];
    }
    throw error;
  }

  const templates = (data ?? []) as PublishedHookTemplate[];
  cache.set(key, { at: Date.now(), templates });
  return templates;
}
