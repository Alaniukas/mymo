import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getModelSettings } from "@/lib/settings/service";
import {
  persistTemplateBlueprint,
  slideImageUrlsFromTemplate,
  TemplateBlueprintError,
} from "@/lib/carousel/persist-template-blueprint";

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const rateLimited = rateLimit(request, { limit: 10, windowMs: 60_000 });
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

    let force = false;
    try {
      const body = await request.json();
      force = Boolean(body?.force);
    } catch {
      // empty body is fine
    }

    const { data: template } = await supabase
      .from("carousel_templates")
      .select("id, workspace_id, slides, caption")
      .eq("id", templateId)
      .single();

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const isGlobal = template.workspace_id === null;
    if (isGlobal) {
      if (!isAdminEmail(user.email)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (!isServiceRoleConfigured()) {
        return NextResponse.json(
          {
            error:
              "SUPABASE_SECRET_KEY must be configured to analyze global templates.",
          },
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

    const imageUrls = slideImageUrlsFromTemplate(template.slides);
    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Template has no slide images to analyze." },
        { status: 422 },
      );
    }

    const settings = await getModelSettings(supabase);
    const db = isGlobal ? createAdminClient() : supabase;

    const { blueprint, analyzedAt } = await persistTemplateBlueprint(
      db,
      templateId,
      {
        imageUrls,
        caption: template.caption,
        model: settings.text_model,
        force,
      },
    );

    return NextResponse.json({
      blueprint_analyzed: true,
      blueprint_analyzed_at: analyzedAt,
      slide_count: blueprint.slideCount,
      blueprint,
    });
  } catch (error) {
    if (error instanceof TemplateBlueprintError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("[templates/analyze-blueprint] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
