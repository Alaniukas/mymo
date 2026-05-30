import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createAuthorizationUrl,
  createProject,
  getAppBaseUrl,
  isSupportedPlatform,
  isWoopSocialConfigured,
  toWoopPlatform,
} from "@/lib/social/woopsocial";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

// Initiates connecting a social account through WoopSocial. Redirects the
// browser to the platform's OAuth screen; WoopSocial returns to the callback.
export async function GET(request: NextRequest) {
  const base = getAppBaseUrl();
  const connectionsUrl = (msg: string) =>
    `${base}/dashboard/connections?error=${encodeURIComponent(msg)}`;

  const platform = new URL(request.url).searchParams.get("platform");

  try {
    if (!isWoopSocialConfigured()) {
      return NextResponse.redirect(
        connectionsUrl("Publishing is not configured (missing WOOPSOCIAL_API_KEY)"),
      );
    }

    if (!platform || !isSupportedPlatform(platform)) {
      return NextResponse.redirect(connectionsUrl("Unsupported platform"));
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${base}/auth/login`);

    const activeProjectId = await resolveActiveWorkspaceId(supabase, user.id);

    if (!activeProjectId) {
      return NextResponse.redirect(connectionsUrl("No project selected"));
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, name, woopsocial_project_id")
      .eq("id", activeProjectId)
      .single();

    if (!workspace) {
      return NextResponse.redirect(connectionsUrl("No workspace found"));
    }

    // Each workspace maps to its own WoopSocial project so connected accounts,
    // media and posts stay isolated per tenant. Create it on first connect.
    let projectId: string | null = workspace.woopsocial_project_id;
    if (!projectId) {
      const project = await createProject(`Mymo — ${workspace.name || workspace.id}`);
      projectId = project.id;
      await supabase
        .from("workspaces")
        .update({ woopsocial_project_id: projectId })
        .eq("id", workspace.id);
    }

    const { url } = await createAuthorizationUrl({
      projectId,
      platform: toWoopPlatform(platform),
      redirectUrl: `${base}/api/auth/woopsocial/callback`,
    });

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[auth/woopsocial] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to start connection";
    return NextResponse.redirect(connectionsUrl(message));
  }
}
