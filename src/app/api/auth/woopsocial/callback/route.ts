import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fromWoopPlatform,
  getAppBaseUrl,
  listSocialAccounts,
} from "@/lib/social/woopsocial";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";

// Handles the redirect back from WoopSocial after a social-account OAuth flow.
// WoopSocial appends: status, projectId, platform, socialAccountIds (or error).
export async function GET(request: NextRequest) {
  const base = getAppBaseUrl();
  const connectionsUrl = (params: string) =>
    `${base}/dashboard/connections?${params}`;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const projectId = searchParams.get("projectId");
  const woopPlatform = searchParams.get("platform");
  const oauthError = searchParams.get("error");
  const socialAccountIds = (searchParams.get("socialAccountIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const appPlatform = woopPlatform ? fromWoopPlatform(woopPlatform) : null;

  if (status !== "success" || oauthError || !projectId || !appPlatform) {
    const message = oauthError || "Connection was cancelled or failed";
    return NextResponse.redirect(
      connectionsUrl(`error=${encodeURIComponent(message)}`),
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${base}/auth/login`);

    const activeProjectId = await resolveActiveWorkspaceId(supabase, user.id);

    if (!activeProjectId) {
      return NextResponse.redirect(
        connectionsUrl(`error=${encodeURIComponent("No project selected")}`),
      );
    }
    const workspace = { id: activeProjectId };

    // Fetch full account details and keep only the accounts just connected.
    const accounts = await listSocialAccounts(projectId);
    const connected = socialAccountIds.length
      ? accounts.filter((a) => socialAccountIds.includes(a.id))
      : accounts;

    if (!connected.length) {
      return NextResponse.redirect(
        connectionsUrl(`error=${encodeURIComponent("No accounts were connected")}`),
      );
    }

    for (const account of connected) {
      const platform = fromWoopPlatform(account.platform);
      if (!platform) continue;
      await supabase.from("social_connections").upsert(
        {
          workspace_id: workspace.id,
          platform,
          provider: "woopsocial",
          woopsocial_account_id: account.id,
          woopsocial_project_id: projectId,
          platform_user_id: account.externalAccountId,
          platform_username: account.username,
          avatar_url: account.imageUrl,
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          scopes: null,
        },
        { onConflict: "workspace_id,platform" },
      );
    }

    return NextResponse.redirect(
      connectionsUrl(`success=${encodeURIComponent(appPlatform)}`),
    );
  } catch (error) {
    console.error("[auth/woopsocial/callback] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save connection";
    return NextResponse.redirect(
      connectionsUrl(`error=${encodeURIComponent(message)}`),
    );
  }
}
