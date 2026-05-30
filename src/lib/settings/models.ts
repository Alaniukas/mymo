// App-wide model settings: shared types, code defaults, and the catalog of
// selectable EvoLink models surfaced in the /admin settings UI.
//
// Slugs below are real EvoLink model identifiers. The admin can also enter a
// custom slug for any model their gateway supports that isn't listed here.

export type ModelKind = "text" | "image" | "video";

export interface ModelSettings {
  text_model: string;
  image_model: string;
  /** Image-to-video model that animates carousel slide images into clips. */
  video_model: string | null;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  text_model: "gemini-3.5-flash",
  // Nano Banana 2 (Gemini 3.1 Flash Image): strong reference/template style-transfer
  // and renders brand photos / real people from references (which gpt-image-2 refuses),
  // at lower cost than Nano Banana Pro. Note: 2,000-char prompt limit — keep prompts tight.
  image_model: "gemini-3.1-flash-image-preview",
  video_model: "seedance-2.0-fast-image-to-video",
};

export interface ModelOption {
  slug: string;
  label: string;
  note?: string;
}

// Text / chat-completion models reachable through EvoLink's OpenAI-compatible
// endpoint (direct.evolink.ai). Used for crawl parsing and caption writing.
export const TEXT_MODEL_OPTIONS: ModelOption[] = [
  { slug: "gemini-3.5-flash", label: "Gemini 3.5 Flash", note: "Default · fast & low-cost" },
  { slug: "gemini-3.0-flash", label: "Gemini 3.0 Flash" },
  { slug: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
  { slug: "gemini-3.0-pro", label: "Gemini 3.0 Pro" },
  { slug: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { slug: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { slug: "gpt-5.5", label: "GPT-5.5" },
  { slug: "gpt-5.4", label: "GPT-5.4" },
  { slug: "gpt-5.2", label: "GPT-5.2" },
  { slug: "gpt-5.1", label: "GPT-5.1" },
  { slug: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { slug: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { slug: "minimax-m2.5", label: "MiniMax M2.5" },
];

// Image models reachable through EvoLink's async image API (api.evolink.ai).
// Used for carousel slide image generation.
export const IMAGE_MODEL_OPTIONS: ModelOption[] = [
  {
    slug: "gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
    note: "Default · 2K · closely matches templates + renders brand photos · low cost",
  },
  {
    slug: "gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
    note: "Highest fidelity · 2K · 32k-char prompts · pricier",
  },
  { slug: "gpt-image-2", label: "GPT Image 2", note: "Up to 16 refs · ignores refs, blocks real faces" },
  { slug: "gpt-image-1.5", label: "GPT Image 1.5" },
  { slug: "doubao-seedream-4.5", label: "Seedream 4.5" },
  { slug: "doubao-seedream-4.0", label: "Seedream 4.0" },
  { slug: "wan2.5-text-to-image", label: "WAN 2.5 (text-to-image)" },
  { slug: "z-image-turbo", label: "Z Image Turbo" },
];

// Image-to-video models reachable through EvoLink's async video API
// (POST /v1/videos/generations). Video carousels animate each generated slide
// IMAGE into a clip, so these must be image-to-video (not text-to-video) models.
export const VIDEO_MODEL_OPTIONS: ModelOption[] = [
  {
    slug: "seedance-2.0-fast-image-to-video",
    label: "Seedance 2.0 Fast",
    note: "Default · fast image-to-video with synced audio",
  },
  { slug: "seedance-2.0-image-to-video", label: "Seedance 2.0" },
  { slug: "kling-v3-image-to-video", label: "Kling V3 (image-to-video)" },
  { slug: "kling-o3-image-to-video", label: "Kling O3 (image-to-video)" },
  { slug: "wan2.7-image-to-video", label: "WAN 2.7 (image-to-video)" },
];

export const MODEL_OPTIONS: Record<ModelKind, ModelOption[]> = {
  text: TEXT_MODEL_OPTIONS,
  image: IMAGE_MODEL_OPTIONS,
  video: VIDEO_MODEL_OPTIONS,
};

const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

/** A model slug is valid if it's a non-empty, reasonably-shaped identifier. */
export function isValidModelSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Normalize an arbitrary value into a ModelSettings, falling back to defaults. */
export function normalizeModelSettings(
  input: Partial<Record<keyof ModelSettings, unknown>> | null | undefined,
): ModelSettings {
  const text = typeof input?.text_model === "string" ? input.text_model.trim() : "";
  const image = typeof input?.image_model === "string" ? input.image_model.trim() : "";
  const video = typeof input?.video_model === "string" ? input.video_model.trim() : "";

  return {
    text_model: text || DEFAULT_MODEL_SETTINGS.text_model,
    image_model: image || DEFAULT_MODEL_SETTINGS.image_model,
    video_model: video || null,
  };
}
