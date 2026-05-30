import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { templateId } = await params;

  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS lets the user read global + own templates.
    const { data: template } = await supabase
      .from("carousel_templates")
      .select("id, workspace_id, slides")
      .eq("id", templateId)
      .single();

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Decide which client may delete this template. Own templates use the user's
    // client (RLS); global templates (workspace_id null) require an admin.
    const isGlobal = template.workspace_id === null;

    if (isGlobal) {
      if (!isAdminEmail(user.email)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (!isServiceRoleConfigured()) {
        return NextResponse.json(
          { error: "SUPABASE_SECRET_KEY must be configured to manage global templates." },
          { status: 500 },
        );
      }
    } else {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("id", template.workspace_id)
        .eq("user_id", user.id)
        .single();

      if (!workspace) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    const db = isGlobal ? createAdminClient() : supabase;

    const slides = (template.slides ?? []) as {
      storage_path?: string | null;
      video_storage_path?: string | null;
    }[];
    const storagePaths = slides
      .flatMap((s) => [s.storage_path, s.video_storage_path])
      .filter((p): p is string => Boolean(p));

    if (storagePaths.length > 0) {
      const { error: storageError } = await db.storage
        .from("templates")
        .remove(storagePaths);

      if (storageError) {
        console.error("[delete-template] storage remove:", storageError);
      }
    }

    const { error: deleteError } = await db
      .from("carousel_templates")
      .delete()
      .eq("id", templateId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[delete-template] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
