// ── EvoLink task lifecycle ───────────────────────────────────────────────

export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface TaskError {
  code: string;
  message: string;
}

export interface EvolinkTask {
  id: string;
  object: string;
  model: string;
  status: TaskStatus;
  progress: number;
  results?: string[];
  error?: TaskError;
  task_info?: {
    can_cancel: boolean;
    estimated_time: number;
  };
}

// ── Image generation request ────────────────────────────────────────────

export interface NanobananaModelParams {
  web_search?: boolean;
  image_search?: boolean;
  thinking_level?: "auto" | "min" | "high";
}

export interface ImageGenerationParams {
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  resolution?: string;
  n?: number;
  image_urls?: string[];
  mask_url?: string;
  model_params?: NanobananaModelParams;
  callback_url?: string;
}

// ── Video generation request ────────────────────────────────────────────

export interface VideoGenerationParams {
  model: string;
  prompt: string;
  /** First frame (1 url) or first + last frame (2 urls), per the image-to-video model. */
  image_urls: string[];
  duration?: number;
  quality?: string;
  aspect_ratio?: string;
  generate_audio?: boolean;
  callback_url?: string;
}

// ── Model configuration ─────────────────────────────────────────────────

export interface SizeSpec {
  values: string[];
  default: string;
}

export interface QualitySpec {
  values: string[];
  default: string;
}

export interface ResolutionSpec {
  values: string[];
  default: string;
}

export interface ModelConfig {
  slug: string;
  name: string;
  maxPromptLength: number;
  sizes: SizeSpec;
  quality: QualitySpec;
  resolution: ResolutionSpec | null;
  maxImages: number;
  maxN: number;
  supportsModelParams: boolean;
}

// ── Client errors ───────────────────────────────────────────────────────

export const CLIENT_ERROR_CODES = [
  "content_policy_violation",
  "invalid_parameters",
  "image_processing_error",
  "image_dimension_mismatch",
  "request_cancelled",
] as const;

export const SERVER_ERROR_CODES = [
  "generation_failed_no_content",
  "service_error",
  "generation_timeout",
  "resource_exhausted",
  "quota_exceeded",
  "service_unavailable",
  "resource_not_found",
  "unknown_error",
] as const;

export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];
export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];
export type EvolinkErrorCode = ClientErrorCode | ServerErrorCode;

export function isRetryableError(code: string): boolean {
  return (SERVER_ERROR_CODES as readonly string[]).includes(code);
}
