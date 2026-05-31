import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { invalidateHookTemplatesCache } from "@/lib/hook-templates/service";
import type { HookTemplateInput, HookTemplateKind } from "@/lib/hook-templates/types";

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

function parseInput(body: Record<string, unknown>): HookTemplateInput | null {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const hook_line = typeof body.hook_line === "string" ? body.hook_line.trim() : "";
  const creator_prompt =
    typeof body.creator_prompt === "string" ? body.creator_prompt.trim() : "";
  const motion_prompt =
    typeof body.motion_prompt === "string" ? body.motion_prompt.trim() : "";
  const kind =
    body.kind === "premade" || body.kind === "template" ? body.kind : null;

  if (!title || !hook_line || !creator_prompt || !motion_prompt || !kind) {
    return null;
  }

  return {
    title,
    hook_line,
    creator_prompt,
    motion_prompt,
    kind: kind as HookTemplateKind,
    preview_image_url:
      typeof body.preview_image_url === "string" ? body.preview_image_url.trim() : null,
    preview_video_url:
      typeof body.preview_video_url === "string" ? body.preview_video_url.trim() : null,
    published: body.published !== false,
    sort_order:
      typeof body.sort_order === "number" ? Math.round(body.sort_order) : 0,
  };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ templates: [] });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hook_templates")
    .select("*")
    .order("kind")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY required to manage hook templates." },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parseInput(body);
  if (!input) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("hook_templates").insert(input).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateHookTemplatesCache();
  return NextResponse.json({ template: data });
}
