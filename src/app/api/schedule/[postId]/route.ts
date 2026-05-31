import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { deletePost } from "@/lib/social/woopsocial";

export const runtime = "nodejs";

/** Cancels a still-scheduled post: removes it from WoopSocial and marks it canceled. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { postId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS already scopes social_posts to the user's workspaces, so a row only
    // comes back when they own it.
    const { data: post } = await supabase
      .from("social_posts")
      .select("id, status, platform_post_id")
      .eq("id", postId)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Scheduled post not found" }, { status: 404 });
    }
    if (post.status !== "scheduled") {
      return NextResponse.json(
        { error: "Only scheduled posts can be canceled" },
        { status: 400 },
      );
    }

    // Best-effort removal from WoopSocial; we cancel locally regardless so the
    // queue stays clean even if the remote post was already cleared.
    if (post.platform_post_id) {
      try {
        await deletePost(post.platform_post_id);
      } catch (err) {
        console.error("[schedule:cancel] WoopSocial delete failed:", err);
      }
    }

    await supabase
      .from("social_posts")
      .update({ status: "canceled" })
      .eq("id", postId);

    return NextResponse.json({ status: "canceled" });
  } catch (error) {
    console.error("[schedule:DELETE] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
