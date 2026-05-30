import type { VideoGenerationParams } from "./types";

// ── Video model registry (EvoLink image-to-video) ───────────────────────
//
// Mirrors the image registry in ./models.ts but for the async video API
// (POST /v1/videos/generations). These models animate a still image (the
// "first frame") into a short clip, which is exactly how video carousels
// turn each generated slide image into a video.

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

export const VIDEO_MODELS: Record<string, VideoModelConfig> = {
  "seedance-2.0-fast-image-to-video": {
    slug: "seedance-2.0-fast-image-to-video",
    name: "Seedance 2.0 Fast (image-to-video)",
    maxPromptLength: 4_000,
    durations: { min: 4, max: 15, default: 5 },
    qualities: { values: ["480p", "720p"], default: "720p" },
    aspectRatios: {
      values: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
      default: "adaptive",
    },
    maxImages: 2,
    supportsAudio: true,
  },

  "kling-v3-image-to-video": {
    slug: "kling-v3-image-to-video",
    name: "Kling V3 (image-to-video)",
    maxPromptLength: 2_500,
    durations: { min: 5, max: 10, default: 5 },
    qualities: { values: ["720p", "1080p"], default: "720p" },
    aspectRatios: { values: ["16:9", "9:16", "1:1"], default: "9:16" },
    maxImages: 2,
    supportsAudio: false,
  },

  "wan2.7-image-to-video": {
    slug: "wan2.7-image-to-video",
    name: "WAN 2.7 (image-to-video)",
    maxPromptLength: 2_000,
    durations: { min: 5, max: 10, default: 5 },
    qualities: { values: ["480p", "720p", "1080p"], default: "720p" },
    aspectRatios: { values: ["16:9", "9:16", "1:1"], default: "9:16" },
    maxImages: 2,
    supportsAudio: false,
  },
};

export const DEFAULT_VIDEO_MODEL = "seedance-2.0-fast-image-to-video";

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
