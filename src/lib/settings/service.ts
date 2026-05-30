import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_MODEL_SETTINGS,
  normalizeModelSettings,
  type ModelSettings,
} from "./models";

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
    const { data, error } = await supabase
      .from("app_settings")
      .select("text_model, image_model, video_model")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return { ...DEFAULT_MODEL_SETTINGS };
    }

    return normalizeModelSettings(data);
  } catch {
    return { ...DEFAULT_MODEL_SETTINGS };
  }
}
