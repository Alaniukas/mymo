import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_MODEL_SETTINGS,
  normalizeModelSettings,
  type ModelSettings,
} from "./models";

/** PostgREST error when migration 027 (hook_video_model) is not applied yet. */
export function isMissingHookVideoModelColumn(message: string): boolean {
  return (
    /hook_video_model/i.test(message) &&
    (/schema cache/i.test(message) || /column/i.test(message))
  );
}

/**
 * Reads the active app-wide model settings (singleton row id = 1).
 *
 * Resilient by design: any error (table missing before the migration is
 * applied, missing row, RLS, network) falls back to the code defaults so
 * content generation never breaks because of settings.
 */
export async function getModelSettings(
  supabase: SupabaseClient,
): Promise<ModelSettings> {
  try {
    let res = await supabase
      .from("app_settings")
      .select("text_model, image_model, video_model, hook_video_model")
      .eq("id", 1)
      .maybeSingle();

    if (res.error && isMissingHookVideoModelColumn(res.error.message)) {
      res = await supabase
        .from("app_settings")
        .select("text_model, image_model, video_model")
        .eq("id", 1)
        .maybeSingle();
    }

    const { data, error } = res;

    if (error || !data) {
      return { ...DEFAULT_MODEL_SETTINGS };
    }

    return normalizeModelSettings(data);
  } catch {
    return { ...DEFAULT_MODEL_SETTINGS };
  }
}
