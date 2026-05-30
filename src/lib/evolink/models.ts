import type { ImageGenerationParams, ModelConfig } from "./types";

// ── Model registry ──────────────────────────────────────────────────────

export const IMAGE_MODELS: Record<string, ModelConfig> = {
  "gpt-image-2": {
    slug: "gpt-image-2",
    name: "GPT Image 2",
    maxPromptLength: 32_000,
    sizes: {
      values: [
        "auto",
        "1:1",
        "1:2",
        "2:1",
        "1:3",
        "3:1",
        "2:3",
        "3:2",
        "3:4",
        "4:3",
        "4:5",
        "5:4",
        "9:16",
        "16:9",
        "9:21",
        "21:9",
      ],
      default: "1:1",
    },
    quality: {
      values: ["low", "medium", "high"],
      default: "medium",
    },
    resolution: {
      values: ["1K", "2K", "4K"],
      default: "1K",
    },
    maxImages: 16,
    maxN: 10,
    supportsModelParams: false,
  },

  // Nano Banana 2 (Gemini 3.1 Flash Image) — the default image model. Strong
  // reference/template style-transfer and renders real people from a reference
  // photo, at lower cost than Pro. IMPORTANT: 2,000-char prompt cap (vs Pro's
  // 32k), so studio prompts are kept tight.
  "gemini-3.1-flash-image-preview": {
    slug: "gemini-3.1-flash-image-preview",
    name: "Nano Banana 2",
    maxPromptLength: 2_000,
    sizes: {
      values: [
        "auto",
        "1:1",
        "1:4",
        "4:1",
        "1:8",
        "8:1",
        "2:3",
        "3:2",
        "3:4",
        "4:3",
        "4:5",
        "5:4",
        "9:16",
        "16:9",
        "21:9",
      ],
      default: "1:1",
    },
    quality: {
      values: ["0.5K", "1K", "2K", "4K"],
      default: "2K",
    },
    resolution: null,
    maxImages: 14,
    maxN: 1,
    supportsModelParams: true,
  },

  // Nano Banana Pro (Gemini 3 Pro Image). Unlike gpt-image-2 it strongly honors
  // reference images (true template style-transfer) and will render real people
  // from a reference photo — so brand assets (hooks/logo/template) actually show
  // up in the output. NOTE: its quality scale is resolution-based, so a registry
  // entry is required for buildImagePayload to clamp the pipeline's "medium" to a
  // valid value (2K) instead of sending an invalid param.
  "gemini-3-pro-image-preview": {
    slug: "gemini-3-pro-image-preview",
    name: "Nano Banana Pro",
    maxPromptLength: 32_000,
    sizes: {
      values: [
        "auto",
        "1:1",
        "2:3",
        "3:2",
        "3:4",
        "4:3",
        "4:5",
        "5:4",
        "9:16",
        "16:9",
        "21:9",
      ],
      default: "1:1",
    },
    quality: {
      values: ["standard", "hd", "1K", "2K", "4K"],
      default: "2K",
    },
    resolution: null,
    maxImages: 14,
    maxN: 1,
    supportsModelParams: true,
  },
};

export const MODEL_SLUGS = Object.keys(IMAGE_MODELS);

const SLUG_ALIASES: Record<string, string> = {
  nanobanana: "gemini-3.1-flash-image-preview",
  "nanobanana-2": "gemini-3.1-flash-image-preview",
  "gpt-image": "gpt-image-2",
  "nano-banana-pro": "gemini-3-pro-image-preview",
  "nanobanana-pro": "gemini-3-pro-image-preview",
};

// ── Helpers ─────────────────────────────────────────────────────────────

export function resolveModelSlug(input: string): string {
  return SLUG_ALIASES[input] ?? input;
}

export function getModelConfig(slug: string): ModelConfig | undefined {
  return IMAGE_MODELS[resolveModelSlug(slug)];
}

export function isValidModel(slug: string): boolean {
  return resolveModelSlug(slug) in IMAGE_MODELS;
}

// ── Parameter validation & normalization ─────────────────────────────────

function clampToSet<T>(value: T, allowed: T[], fallback: T): T {
  return allowed.includes(value) ? value : fallback;
}

export interface ValidatedParams {
  payload: ImageGenerationParams;
  errors: string[];
}

export function buildImagePayload(
  model: string,
  prompt: string,
  opts: {
    size?: string;
    quality?: string;
    resolution?: string;
    n?: number;
    image_urls?: string[];
  } = {},
): ValidatedParams {
  const resolved = resolveModelSlug(model);
  const config = IMAGE_MODELS[resolved];
  const errors: string[] = [];

  if (!config) {
    // Model isn't in the local registry (e.g. an admin-configured slug). Pass
    // the provided options through unvalidated so generation still respects the
    // requested aspect ratio / quality and lets EvoLink apply its own defaults.
    const passthrough: ImageGenerationParams = { model: resolved, prompt };
    if (opts.size) passthrough.size = opts.size;
    if (opts.quality) passthrough.quality = opts.quality;
    if (opts.resolution) passthrough.resolution = opts.resolution;
    if (opts.n) passthrough.n = Math.max(1, opts.n);
    if (opts.image_urls?.length) passthrough.image_urls = opts.image_urls;
    return {
      payload: passthrough,
      errors: [`Unknown model: ${model}`],
    };
  }

  if (prompt.length > config.maxPromptLength) {
    errors.push(
      `Prompt exceeds max length (${prompt.length}/${config.maxPromptLength})`,
    );
  }

  const size = clampToSet(
    opts.size ?? config.sizes.default,
    config.sizes.values,
    config.sizes.default,
  );

  const quality = clampToSet(
    opts.quality ?? config.quality.default,
    config.quality.values,
    config.quality.default,
  );

  const n = Math.max(1, Math.min(opts.n ?? 1, config.maxN));

  if (opts.image_urls && opts.image_urls.length > config.maxImages) {
    errors.push(
      `Too many images (${opts.image_urls.length}/${config.maxImages})`,
    );
  }

  const payload: ImageGenerationParams = {
    model: resolved,
    prompt,
    size,
    quality,
    n,
  };

  if (config.resolution && opts.resolution) {
    payload.resolution = clampToSet(
      opts.resolution,
      config.resolution.values,
      config.resolution.default,
    );
  }

  if (opts.image_urls?.length) {
    payload.image_urls = opts.image_urls.slice(0, config.maxImages);
  }

  return { payload, errors };
}
