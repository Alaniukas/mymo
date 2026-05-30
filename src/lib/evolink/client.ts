import type {
  EvolinkTask,
  ImageGenerationParams,
  VideoGenerationParams,
} from "./types";
import { isRetryableError } from "./types";

const BASE_URL =
  process.env.EVOLINK_BASE_URL || "https://api.evolink.ai/v1";
const API_KEY = process.env.EVOLINK_API_KEY || "";

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ── Errors ──────────────────────────────────────────────────────────────

export class EvolinkError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "EvolinkError";
  }

  get retryable(): boolean {
    return this.code ? isRetryableError(this.code) : this.status >= 500;
  }
}

// ── Submit image generation ─────────────────────────────────────────────

export async function submitImageGeneration(
  params: ImageGenerationParams,
): Promise<EvolinkTask> {
  if (!API_KEY) {
    throw new EvolinkError("EVOLINK_API_KEY not configured", 500);
  }

  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new EvolinkError(
      data?.error?.message || "Image generation request failed",
      res.status,
      data?.error?.code,
    );
  }

  return data as EvolinkTask;
}

// ── Submit video generation ─────────────────────────────────────────────

export async function submitVideoGeneration(
  params: VideoGenerationParams,
): Promise<EvolinkTask> {
  if (!API_KEY) {
    throw new EvolinkError("EVOLINK_API_KEY not configured", 500);
  }

  const res = await fetch(`${BASE_URL}/videos/generations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new EvolinkError(
      data?.error?.message || "Video generation request failed",
      res.status,
      data?.error?.code,
    );
  }

  return data as EvolinkTask;
}

// ── Check task status ───────────────────────────────────────────────────

export async function checkTaskStatus(taskId: string): Promise<EvolinkTask> {
  if (!API_KEY) {
    throw new EvolinkError("EVOLINK_API_KEY not configured", 500);
  }

  const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new EvolinkError(
      data?.error?.message || "Status check failed",
      res.status,
      data?.error?.code,
    );
  }

  return (await res.json()) as EvolinkTask;
}

// ── Poll until terminal state ───────────────────────────────────────────

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (task: EvolinkTask) => void;
}

export async function pollUntilComplete(
  taskId: string,
  opts: PollOptions = {},
): Promise<EvolinkTask> {
  const { intervalMs = 3_000, timeoutMs = 300_000, onProgress } = opts;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const task = await checkTaskStatus(taskId);
    onProgress?.(task);

    if (task.status === "completed" || task.status === "failed") {
      return task;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new EvolinkError("Task polling timed out", 408, "generation_timeout");
}
