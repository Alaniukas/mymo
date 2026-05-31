import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { getModelSettings, isMissingHookVideoModelColumn } from "@/lib/settings/service";
import { isValidModelSlug, type ModelSettings } from "@/lib/settings/models";

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

  return { supabase };
}

export async function GET() {
  const { error, supabase } = await requireAdmin();
  if (error) return error;

  const settings = await getModelSettings(supabase!);
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server is missing a Supabase secret key (SUPABASE_SECRET_KEY). Add it to your environment to save settings.",
      },
      { status: 500 },
    );
  }

  let body: Partial<ModelSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const textModel = typeof body.text_model === "string" ? body.text_model.trim() : "";
  const imageModel = typeof body.image_model === "string" ? body.image_model.trim() : "";
  const rawVideo = typeof body.video_model === "string" ? body.video_model.trim() : "";
  const rawHookVideo =
    typeof body.hook_video_model === "string" ? body.hook_video_model.trim() : "";

  if (!isValidModelSlug(textModel)) {
    return NextResponse.json({ error: "Invalid text model" }, { status: 400 });
  }
  if (!isValidModelSlug(imageModel)) {
    return NextResponse.json({ error: "Invalid image model" }, { status: 400 });
  }
  if (rawVideo && !isValidModelSlug(rawVideo)) {
    return NextResponse.json({ error: "Invalid video model" }, { status: 400 });
  }
  if (rawHookVideo && !isValidModelSlug(rawHookVideo)) {
    return NextResponse.json({ error: "Invalid hook video model" }, { status: 400 });
  }

  const baseUpdate = {
    id: 1,
    text_model: textModel,
    image_model: imageModel,
    video_model: rawVideo || null,
  };

  const hookVideoValue = rawHookVideo || null;

  try {
    const admin = createAdminClient();

    let { data, error: writeError } = await admin
      .from("app_settings")
      .upsert({ ...baseUpdate, hook_video_model: hookVideoValue }, { onConflict: "id" })
      .select("text_model, image_model, video_model, hook_video_model")
      .single();

    if (writeError && isMissingHookVideoModelColumn(writeError.message)) {
      const retry = await admin
        .from("app_settings")
        .upsert(baseUpdate, { onConflict: "id" })
        .select("text_model, image_model, video_model")
        .single();

      if (retry.error) {
        console.error("[admin/settings] write failed:", retry.error);
        return NextResponse.json({ error: retry.error.message }, { status: 500 });
      }

      return NextResponse.json({
        settings: {
          ...retry.data,
          hook_video_model: hookVideoValue,
        },
        warning:
          "Text and image models were saved. Hook animation model needs database migration 027_app_settings_hook_video_model.sql — run it in Supabase SQL Editor, then save again.",
      });
    }

    if (writeError) {
      console.error("[admin/settings] write failed:", writeError);
      return NextResponse.json({ error: writeError.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("[admin/settings] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
