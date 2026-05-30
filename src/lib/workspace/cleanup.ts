// Best-effort storage cleanup for project (workspace) deletion.
//
// Deleting a `workspaces` row cascades all its child rows via foreign keys, but
// Supabase Storage objects are not covered by that cascade. This module gathers
// the storage paths a project owns and removes them from their buckets BEFORE
// the row delete (after which the paths would be unrecoverable). Every step is
// non-fatal: storage failures are logged and ignored so they never block the
// actual project deletion.

import type { SupabaseClient } from "@supabase/supabase-js";

async function removeAssetStorage(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase
    .from("assets")
    .select("storage_path")
    .eq("workspace_id", workspaceId);

  const paths = (data ?? [])
    .map((a) => a.storage_path as string | null)
    .filter((p): p is string => Boolean(p));

  if (paths.length > 0) {
    await supabase.storage.from("assets").remove(paths);
  }
}

async function removeCarouselStorage(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data: carousels } = await supabase
    .from("carousels")
    .select("id")
    .eq("workspace_id", workspaceId);

  const ids = (carousels ?? []).map((c) => c.id as string);
  if (ids.length === 0) return;

  const paths: string[] = [];

  // Slide images + clips (video_storage_path added in migration 005).
  let slides:
    | { storage_path: string | null; video_storage_path?: string | null }[]
    | null = null;
  const withVideo = await supabase
    .from("carousel_slides")
    .select("storage_path, video_storage_path")
    .in("carousel_id", ids);
  if (withVideo.error) {
    const basic = await supabase
      .from("carousel_slides")
      .select("storage_path")
      .in("carousel_id", ids);
    slides = basic.data;
  } else {
    slides = withVideo.data;
  }

  for (const s of slides ?? []) {
    if (s.storage_path) paths.push(s.storage_path);
    if (s.video_storage_path) paths.push(s.video_storage_path);
  }

  // Exported slideshow MP4s (column added in migration 008); tolerate absence.
  const exportRows = await supabase
    .from("carousels")
    .select("export_video_storage_path")
    .in("id", ids);
  if (!exportRows.error) {
    for (const r of exportRows.data ?? []) {
      const p = (r as { export_video_storage_path?: string | null })
        .export_video_storage_path;
      if (typeof p === "string" && p) paths.push(p);
    }
  }

  if (paths.length > 0) {
    await supabase.storage.from("carousels").remove(paths);
  }
}

async function removeTemplateStorage(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data } = await supabase
    .from("carousel_templates")
    .select("slides")
    .eq("workspace_id", workspaceId);

  const paths: string[] = [];
  for (const t of data ?? []) {
    const slides = (t.slides ?? []) as {
      storage_path?: string | null;
      video_storage_path?: string | null;
    }[];
    for (const s of slides) {
      if (s.storage_path) paths.push(s.storage_path);
      if (s.video_storage_path) paths.push(s.video_storage_path);
    }
  }

  if (paths.length > 0) {
    await supabase.storage.from("templates").remove(paths);
  }
}

/**
 * Removes a project's storage objects across the `assets`, `carousels`, and
 * `templates` buckets. Best-effort: each bucket is handled independently and
 * failures are swallowed (logged) so deletion always proceeds.
 */
export async function cleanupProjectStorage(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<void> {
  const results = await Promise.allSettled([
    removeAssetStorage(supabase, workspaceId),
    removeCarouselStorage(supabase, workspaceId),
    removeTemplateStorage(supabase, workspaceId),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.warn("[workspace/cleanup] storage cleanup failed:", r.reason);
    }
  }
}
