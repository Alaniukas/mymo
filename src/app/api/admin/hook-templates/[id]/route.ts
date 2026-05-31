import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { invalidateHookTemplatesCache } from "@/lib/hook-templates/service";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {};
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY required." },
      { status: 500 },
    );
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.hook_line === "string") patch.hook_line = body.hook_line.trim();
  if (typeof body.creator_prompt === "string") {
    patch.creator_prompt = body.creator_prompt.trim();
  }
  if (typeof body.motion_prompt === "string") {
    patch.motion_prompt = body.motion_prompt.trim();
  }
  if (typeof body.preview_image_url === "string") {
    patch.preview_image_url = body.preview_image_url.trim() || null;
  }
  if (typeof body.preview_video_url === "string") {
    patch.preview_video_url = body.preview_video_url.trim() || null;
  }
  if (body.kind === "premade" || body.kind === "template") patch.kind = body.kind;
  if (typeof body.published === "boolean") patch.published = body.published;
  if (typeof body.sort_order === "number") patch.sort_order = Math.round(body.sort_order);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hook_templates")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateHookTemplatesCache();
  return NextResponse.json({ template: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY required." },
      { status: 500 },
    );
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("hook_templates").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateHookTemplatesCache();
  return NextResponse.json({ ok: true });
}
