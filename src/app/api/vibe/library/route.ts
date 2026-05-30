import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActiveWorkspaceId } from "@/lib/workspace/active";
import { getActiveBrandVibe, listBrandVibeSnapshots } from "@/lib/vibe/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await resolveActiveWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "No project selected" }, { status: 404 });
    }

    const [active, snapshots] = await Promise.all([
      getActiveBrandVibe(supabase, workspaceId),
      listBrandVibeSnapshots(supabase, workspaceId, 8),
    ]);

    return NextResponse.json({ active, snapshots });
  } catch (err) {
    console.error("[vibe/library]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load vibe library" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await resolveActiveWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "No project selected" }, { status: 404 });
    }

    const body = await request.json();
    const vibeId = typeof body?.vibe_id === "string" ? body.vibe_id : "";

    if (!vibeId) {
      return NextResponse.json({ error: "vibe_id is required" }, { status: 400 });
    }

    await supabase
      .from("brand_vibe_snapshots")
      .update({ is_active: false })
      .eq("workspace_id", workspaceId);

    const { error } = await supabase
      .from("brand_vibe_snapshots")
      .update({ is_active: true })
      .eq("id", vibeId)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const active = await getActiveBrandVibe(supabase, workspaceId);
    return NextResponse.json({ active });
  } catch (err) {
    console.error("[vibe/library POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to set active vibe" },
      { status: 500 },
    );
  }
}
