import type { VideoGenerationParams } from "./types";

// ── Video model registry (EvoLink image-to-video) ───────────────────────
//
// Mirrors the image registry in ./models.ts but for the async video API
// (POST /v1/videos/generations). These models animate a still image (the
// "first frame") into a short clip, which is exactly how video carousels
// turn each generated slide image into a video.
//
// Slugs match EvoLink docs: https://docs.evolink.ai/llms.txt

export interface VideoModelConfig {
  slug: string;
  name: string;
  maxPromptLength: number;
  durations: { min: number; max: number; default: number };
  qualities: { values: string[]; default: string };
  aspectRatios: { values: string[]; default: string };
  /** Max reference frames accepted (1 = first frame, 2 = first + last frame). */
  maxImages: number;
  supportsAudio: boolean;
}

type VideoModelConfigInput = Omit<VideoModelConfig, "slug" | "name">;

const SEEDANCE_2_I2V: VideoModelConfigInput = {
  maxPromptLength: 4_000,
  durations: { min: 4, max: 15, default: 5 },
  qualities: { values: ["480p", "720p", "1080p"], default: "720p" },
  aspectRatios: {
    values: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
    default: "adaptive",
  },
  maxImages: 2,
  supportsAudio: true,
};

const SEEDANCE_15_PRO: VideoModelConfigInput = {
  maxPromptLength: 2_000,
  durations: { min: 4, max: 12, default: 5 },
  qualities: { values: ["480p", "720p", "1080p"], default: "720p" },
  aspectRatios: {
    values: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
    default: "9:16",
  },
  maxImages: 2,
  supportsAudio: true,
};

const KLING_V3_LIKE: VideoModelConfigInput = {
  maxPromptLength: 2_500,
  durations: { min: 5, max: 10, default: 5 },
  qualities: { values: ["720p", "1080p"], default: "720p" },
  aspectRatios: { values: ["16:9", "9:16", "1:1"], default: "9:16" },
  maxImages: 2,
  supportsAudio: false,
};

const KLING_O3_LIKE: VideoModelConfigInput = {
  maxPromptLength: 2_500,
  durations: { min: 3, max: 15, default: 5 },
  qualities: { values: ["720p", "1080p"], default: "720p" },
  aspectRatios: { values: ["16:9", "9:16", "1:1"], default: "9:16" },
  maxImages: 2,
  supportsAudio: false,
};

const WAN_27_LIKE: VideoModelConfigInput = {
  maxPromptLength: 2_000,
  durations: { min: 5, max: 10, default: 5 },
  qualities: { values: ["480p", "720p", "1080p"], default: "720p" },
  aspectRatios: { values: ["16:9", "9:16", "1:1"], default: "9:16" },
  maxImages: 2,
  supportsAudio: false,
};

const WAN_26_I2V: VideoModelConfigInput = {
  maxPromptLength: 1_500,
  durations: { min: 2, max: 15, default: 5 },
  qualities: { values: ["720p", "1080p"], default: "720p" },
  aspectRatios: { values: ["16:9", "9:16", "1:1"], default: "9:16" },
  maxImages: 1,
  supportsAudio: false,
};

const VEO_LIKE: VideoModelConfigInput = {
  maxPromptLength: 2_000,
  durations: { min: 4, max: 8, default: 5 },
  qualities: { values: ["720p", "1080p"], default: "720p" },
  aspectRatios: { values: ["16:9", "9:16", "1:1"], default: "9:16" },
  maxImages: 1,
  supportsAudio: true,
};

function entry(
  slug: string,
  name: string,
  config: VideoModelConfigInput,
): [string, VideoModelConfig] {
  return [slug, { slug, name, ...config }];
}

export const VIDEO_MODELS: Record<string, VideoModelConfig> = Object.fromEntries([
  // ── Seedance ──
  entry("seedance-1.5-pro", "Seedance 1.5 Pro", SEEDANCE_15_PRO),
  entry(
    "doubao-seedance-1.0-pro-fast",
    "Seedance 1.0 Pro Fast",
    {
      ...SEEDANCE_15_PRO,
      durations: { min: 4, max: 12, default: 5 },
      maxPromptLength: 2_000,
    },
  ),
  entry("seedance-2.0-fast-image-to-video", "Seedance 2.0 Fast", SEEDANCE_2_I2V),
  entry("seedance-2.0-image-to-video", "Seedance 2.0", SEEDANCE_2_I2V),
  // ── Kling ──
  entry("kling-v3-image-to-video", "Kling V3", KLING_V3_LIKE),
  entry("kling-o3-image-to-video", "Kling O3", KLING_O3_LIKE),
  entry("kling-o1-image-to-video", "Kling O1", KLING_V3_LIKE),
  // ── WAN ──
  entry("wan2.7-image-to-video", "WAN 2.7", WAN_27_LIKE),
  entry("wan2.6-image-to-video", "WAN 2.6", WAN_26_I2V),
  entry("wan2.6-image-to-video-flash", "WAN 2.6 Flash", {
    ...WAN_26_I2V,
    durations: { min: 2, max: 10, default: 5 },
  }),
  entry("wan2.5-image-to-video", "WAN 2.5", WAN_27_LIKE),
  // ── Google Veo ──
  entry("veo-3.1-fast", "Veo 3.1 Fast", VEO_LIKE),
  entry("veo3.1-pro-beta", "Veo 3.1 Pro", VEO_LIKE),
  entry("veo-3.1-fast-generate-preview", "Veo 3.1 Fast Preview", VEO_LIKE),
  // ── Other ──
  entry("grok-imagine-image-to-video-beta", "Grok Imagine", {
    ...KLING_V3_LIKE,
    maxPromptLength: 2_000,
  }),
]);

export const DEFAULT_VIDEO_MODEL = "seedance-2.0-fast-image-to-video";

/** All registered image-to-video slugs (for admin UI ordering). */
export const VIDEO_MODEL_SLUGS = Object.keys(VIDEO_MODELS);

// Custom slugs an admin may set fall back to the default model's limits so the
// payload is still well-formed (our own inputs always satisfy these).
const FALLBACK_CONFIG = VIDEO_MODELS[DEFAULT_VIDEO_MODEL];

export function getVideoModelConfig(slug: string): VideoModelConfig | undefined {
  return VIDEO_MODELS[slug];
}

// ── Parameter validation & normalization ─────────────────────────────────

function clampNumber(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampToSet<T>(value: T | undefined, allowed: T[], fallback: T): T {
  return value !== undefined && allowed.includes(value) ? value : fallback;
}

export interface ValidatedVideoParams {
  payload: VideoGenerationParams;
  errors: string[];
}

export function buildVideoPayload(
  model: string,
  prompt: string,
  opts: {
    imageUrls: string[];
    aspect?: string;
    duration?: number;
    quality?: string;
    generateAudio?: boolean;
  },
): ValidatedVideoParams {
  const config = VIDEO_MODELS[model] ?? FALLBACK_CONFIG;
  const errors: string[] = [];

  if (prompt.length > config.maxPromptLength) {
    errors.push(
      `Prompt exceeds max length (${prompt.length}/${config.maxPromptLength})`,
    );
  }

  if (opts.imageUrls.length === 0) {
    errors.push("At least one image URL (first frame) is required");
  }

  const payload: VideoGenerationParams = {
    model,
    prompt,
    image_urls: opts.imageUrls.slice(0, config.maxImages),
    duration: clampNumber(
      opts.duration ?? config.durations.default,
      config.durations.min,
      config.durations.max,
      config.durations.default,
    ),
    quality: clampToSet(
      opts.quality,
      config.qualities.values,
      config.qualities.default,
    ),
    aspect_ratio: clampToSet(
      opts.aspect,
      config.aspectRatios.values,
      config.aspectRatios.default,
    ),
  };

  if (config.supportsAudio) {
    payload.generate_audio = opts.generateAudio ?? true;
  }

  return { payload, errors };
}
