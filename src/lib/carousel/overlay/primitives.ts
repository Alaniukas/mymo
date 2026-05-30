import path from "node:path";
import { GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { safeZoneForAspect } from "../production-rules";

// Shared drawing primitives for the overlay renderer: font loading, text
// measuring / wrapping / fitting, and a few UI shapes (rounded cards, stars,
// scrims). Kept separate so overlay.ts and overlay/layouts.ts can both use them
// without a circular import.

export const FONT_FAMILY = "InterOverlay"; // ExtraBold — punchy headlines
export const FONT_FAMILY_BODY = "InterOverlayBody"; // Bold — card/body text

let fontsReady = false;
export function ensureFonts(): void {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), "src", "lib", "carousel", "fonts");
  GlobalFonts.registerFromPath(path.join(dir, "Inter-ExtraBold.ttf"), FONT_FAMILY);
  GlobalFonts.registerFromPath(path.join(dir, "Inter-Bold.ttf"), FONT_FAMILY_BODY);
  fontsReady = true;
}

export function overlayDimsForAspect(aspect: string): { width: number; height: number } {
  switch (aspect) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "3:4":
      return { width: 1080, height: 1440 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "1:1":
    default:
      return { width: 1080, height: 1080 };
  }
}

/** Best-effort aspect label from raw pixel dimensions. */
export function aspectFromDims(width: number, height: number): string {
  const r = width / height;
  if (r < 0.62) return "9:16";
  if (r < 0.92) return "4:5";
  return "1:1";
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Safe-area insets in actual-image pixels. The spec defines the 9:16 safe zone
 * in 1080x1920 px; we scale those to the real image size so text stays clear of
 * the platform UI regardless of the model's output resolution.
 */
export function safeInsets(width: number, height: number, aspect: string): Insets {
  const ref = overlayDimsForAspect(aspect);
  const sz = safeZoneForAspect(aspect);
  return {
    top: (sz.top / ref.height) * height,
    bottom: (sz.bottom / ref.height) * height,
    left: (sz.left / ref.width) * width,
    right: (sz.right / ref.width) * width,
  };
}

function wrapLines(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface TextLayout {
  fontSize: number;
  lineHeight: number;
  lines: string[];
}

/**
 * Shrinks the font until the wrapped block fits the given box. `startFont` is
 * the largest size to try; it steps down to `minFont`.
 */
export function fitText(
  ctx: SKRSContext2D,
  text: string,
  boxW: number,
  boxH: number,
  startFont: number,
  minFont: number,
  family: string = FONT_FAMILY,
): TextLayout {
  let fontSize = startFont;
  let lines: string[] = [];
  while (fontSize >= minFont) {
    ctx.font = `${fontSize}px "${family}"`;
    lines = wrapLines(ctx, text, boxW);
    const lineHeight = fontSize * 1.16;
    const fitsHeight = lines.length * lineHeight <= boxH;
    const fitsWidth = lines.every((l) => ctx.measureText(l).width <= boxW);
    if (fitsHeight && fitsWidth) break;
    fontSize -= Math.max(2, Math.round(fontSize * 0.06));
  }
  ctx.font = `${fontSize}px "${family}"`;
  return { fontSize, lineHeight: fontSize * 1.16, lines };
}

export interface DrawTextOpts {
  fill?: string;
  stroke?: string | null;
  strokeRatio?: number;
  shadow?: boolean;
  family?: string;
  align?: CanvasTextAlign;
}

/** Draws a wrapped text block centered on (centerX, centerY). */
export function drawWrappedText(
  ctx: SKRSContext2D,
  layout: TextLayout,
  centerX: number,
  centerY: number,
  opts: DrawTextOpts = {},
): void {
  const {
    fill = "#FFFFFF",
    stroke = "rgba(0,0,0,0.92)",
    strokeRatio = 0.16,
    shadow = true,
    family = FONT_FAMILY,
    align = "center",
  } = opts;

  const { fontSize, lineHeight, lines } = layout;
  ctx.font = `${fontSize}px "${family}"`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const blockHeight = lines.length * lineHeight;
  const startY = centerY - blockHeight / 2 + lineHeight / 2;
  const x = align === "left" ? centerX - 0 : centerX;

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    if (stroke) {
      ctx.save();
      if (shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = fontSize * 0.18;
        ctx.shadowOffsetY = fontSize * 0.04;
      }
      ctx.lineWidth = Math.max(2, fontSize * strokeRatio);
      ctx.strokeStyle = stroke;
      ctx.strokeText(line, x, y);
      ctx.restore();
    }
    ctx.fillStyle = fill;
    ctx.fillText(line, x, y);
  });
}

export function roundedRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** A soft top→bottom vertical scrim to keep light text legible on any image. */
export function drawVerticalScrim(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  strength = 0.55,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, `rgba(0,0,0,${strength * 0.5})`);
  grad.addColorStop(0.5, `rgba(0,0,0,${strength * 0.25})`);
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/** Draws `count` five-pointed stars in a centered row. */
export function drawStars(
  ctx: SKRSContext2D,
  centerX: number,
  centerY: number,
  size: number,
  count = 5,
  color = "#FFB800",
): void {
  const gap = size * 0.45;
  const totalWidth = count * size * 2 + (count - 1) * gap;
  let x = centerX - totalWidth / 2 + size;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    drawStar(ctx, x, centerY, size, size / 2);
    x += size * 2 + gap;
  }
}

function drawStar(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Normalizes a brand color to a usable CSS hex, falling back to a dark slate. */
export function normalizeColor(color: string | null | undefined, fallback = "#0F172A"): string {
  if (!color) return fallback;
  const c = color.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) return c;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) return `#${c}`;
  return fallback;
}
