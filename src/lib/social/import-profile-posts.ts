import type { createClient } from "@/lib/supabase/server";
import { reuploadImage } from "@/lib/carousel/storage";
import type { ScrapedProfilePost } from "@/lib/social/scrape-profile";
import { buildContextFromPosts } from "@/lib/social/scrape-profile";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const SOCIAL_PREFIX = "From social:";

export interface ImportedSocialAssets {
  assetIds: string[];
  context: string;
  imported: number;
}

/**
 * Download scraped post images into the workspace asset pool.
 */
export async function importProfilePostsToWorkspace(
  supabase: ServerSupabaseClient,
  workspaceId: string,
  posts: ScrapedProfilePost[],
): Promise<ImportedSocialAssets> {
  const assetIds: string[] = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]!;
    const path = `${workspaceId}/hooks/${crypto.randomUUID()}.jpg`;
    const up = await reuploadImage(supabase, post.imageUrl, path, "assets");
    if (!up.ok) continue;

    const name = `${SOCIAL_PREFIX} post ${i + 1}`;
    const { data: row, error } = await supabase
      .from("assets")
      .insert({
        workspace_id: workspaceId,
        type: "hook",
        name,
        storage_path: up.storagePath,
        public_url: up.publicUrl,
        mime_type: "image/jpeg",
      })
      .select("id")
      .single();

    if (!error && row?.id) assetIds.push(row.id);
  }

  return {
    assetIds,
    context: buildContextFromPosts(posts),
    imported: assetIds.length,
  };
}
