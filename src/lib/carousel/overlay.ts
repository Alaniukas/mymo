import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import ffmpegPath from "ffmpeg-static";
import { aspectFromDims, ensureFonts, overlayDimsForAspect } from "./overlay/primitives";
import { drawLayout } from "./overlay/layouts";

/**
 * Burns crisp, TikTok/Instagram-style text overlays onto carousel media.
 *
 * The AI image model only produces a clean, text-free background; the caption
 * text (and any UI chrome — review cards, notification mocks) is rendered HERE
 * so it is sharp, legible, spelled exactly as written, respects the platform
 * safe zones, and is identical across slides, images and video clips. Text is
 * composited onto the stored asset so it survives download and publishing.
 *
 * The per-layout coordinate logic lives in overlay/layouts.ts; shared text and
 * shape primitives live in overlay/primitives.ts.
 */

const execFileAsync = promisify(execFile);

export { overlayDimsForAspect };

export interface OverlayOptions {
  /** Named layout (fullbleed_dark_overlay | split_compare | testimonial_card | notification_mock | text_only). */
  layout?: string;
  /** Blueprint text placement — overrides default center text when set. */
  textPlacement?: "top" | "center" | "bottom" | "card" | "none";
  /** Blueprint text style — list renders bullet lines; body uses smaller type. */
  textStyle?: "headline" | "body" | "list" | "quote" | "cta";
  /** Horizontal alignment for on-image text. */
  textAlignment?: "left" | "center" | "right";
  /** Dominant caption color from blueprint (hex). */
  textColor?: string | null;
  /** Accent / card tint from blueprint (hex). */
  accentColor?: string | null;
  /** How heavy the dark scrim behind text should be. */
  overlayStrength?: "light" | "medium" | "heavy";
  /** Whether the slide uses review stars or similar UI chrome. */
  hasUIChrome?: boolean;
  /** Normalized 0–1 caption region from template AI analysis. */
  textBBox?: { x: number; y: number; w: number; h: number };
  /** Aspect label; inferred from pixel dimensions when omitted. */
  aspect?: string;
  /** Brand color (hex) used to tint UI chrome where relevant. */
  brandColor?: string | null;
}

function compose(
  ctx: SKRSContext2D,
  caption: string,
  role: string,
  width: number,
  height: number,
  opts?: OverlayOptions,
): void {
  const clean = (caption ?? "").trim();
  if (!clean) return;
  ensureFonts();
  drawLayout(ctx, {
    layout: opts?.layout ?? "fullbleed_dark_overlay",
    role,
    caption: clean,
    width,
    height,
    aspect: opts?.aspect ?? aspectFromDims(width, height),
    brandColor: opts?.brandColor ?? null,
    textPlacement: opts?.textPlacement,
    textStyle: opts?.textStyle,
    textAlignment: opts?.textAlignment,
    textColor: opts?.textColor,
    accentColor: opts?.accentColor,
    overlayStrength: opts?.overlayStrength,
    hasUIChrome: opts?.hasUIChrome,
    textBBox: opts?.textBBox,
  });
}

// ── Public renderers ────────────────────────────────────────────────────────

/** Composites the caption onto an image, returning a PNG buffer. */
export async function renderImageWithOverlay(
  imageBuffer: Buffer,
  caption: string,
  role: string,
  opts?: OverlayOptions,
): Promise<Buffer> {
  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, image.width, image.height);
  compose(ctx, caption, role, image.width, image.height, opts);
  return canvas.toBuffer("image/png");
}

/** Renders the caption as a transparent PNG, used as a video overlay layer. */
export function renderOverlayPng(
  width: number,
  height: number,
  caption: string,
  role: string,
  opts?: OverlayOptions,
): Buffer {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  compose(ctx, caption, role, width, height, opts);
  return canvas.toBuffer("image/png");
}

/**
 * Burns the caption onto a video clip via ffmpeg. The overlay is rendered at
 * the clip's aspect and scaled to its exact size, so the text stays perfectly
 * static and crisp regardless of the animation motion.
 */
export async function renderVideoWithOverlay(
  videoBuffer: Buffer,
  caption: string,
  role: string,
  aspect: string,
  opts?: { layout?: string; brandColor?: string | null },
): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not available");
  if (!caption?.trim()) return videoBuffer;

  const { width, height } = overlayDimsForAspect(aspect);
  const overlayPng = renderOverlayPng(width, height, caption, role, {
    aspect,
    layout: opts?.layout,
    brandColor: opts?.brandColor,
  });

  const dir = await mkdtemp(path.join(tmpdir(), "carousel-overlay-"));
  const inPath = path.join(dir, "in.mp4");
  const overlayPath = path.join(dir, "overlay.png");
  const outPath = path.join(dir, "out.mp4");

  try {
    await writeFile(inPath, videoBuffer);
    await writeFile(overlayPath, overlayPng);

    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-i", inPath,
        "-i", overlayPath,
        "-filter_complex",
        "[1:v][0:v]scale2ref[ovr][base];[base][ovr]overlay=0:0[out]",
        "-map", "[out]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "veryfast",
        "-movflags", "+faststart",
        outPath,
      ],
      { maxBuffer: 1024 * 1024 * 64 },
    );

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
