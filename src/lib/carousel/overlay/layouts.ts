import type { SKRSContext2D } from "@napi-rs/canvas";
import {
  FONT_FAMILY_BODY,
  drawStars,
  drawVerticalScrim,
  drawWrappedText,
  fitText,
  normalizeColor,
  roundedRectPath,
  safeInsets,
} from "./primitives";

// Named layouts the renderer owns coordinates for. Each draws caption text (and
// any UI chrome) onto an already-drawn background, respecting the platform safe
// zones so nothing lands under the feed UI.

export interface LayoutContext {
  layout: string;
  role: string;
  caption: string;
  width: number;
  height: number;
  aspect: string;
  brandColor?: string | null;
}

export function drawLayout(ctx: SKRSContext2D, lc: LayoutContext): void {
  switch (lc.layout) {
    case "testimonial_card":
      return drawTestimonialCard(ctx, lc);
    case "notification_mock":
      return drawNotificationMock(ctx, lc);
    case "split_compare":
      return drawSplitCompare(ctx, lc);
    case "text_only":
      return drawFullbleed(ctx, lc, 0.42);
    case "fullbleed_dark_overlay":
    default:
      return drawFullbleed(ctx, lc, 0.55);
  }
}

function startFont(role: string, width: number): number {
  if (role === "hook") return width * 0.11;
  if (role === "cta") return width * 0.092;
  return width * 0.078;
}

// Centered headline text over a soft scrim, clamped inside the safe area.
function drawFullbleed(ctx: SKRSContext2D, lc: LayoutContext, scrim: number): void {
  const { width, height, caption, role, aspect } = lc;
  drawVerticalScrim(ctx, width, height, scrim);

  const ins = safeInsets(width, height, aspect);
  const boxW = width - ins.left - ins.right;
  const boxH = height - ins.top - ins.bottom;
  const layout = fitText(ctx, caption, boxW, boxH, startFont(role, width), width * 0.042);
  drawWrappedText(ctx, layout, width / 2, ins.top + boxH / 2);
}

// Caption in a top banner; a faint divider hints at the side-by-side split.
function drawSplitCompare(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption, aspect } = lc;
  const ins = safeInsets(width, height, aspect);

  const bandH = ins.top + height * 0.17;
  const grad = ctx.createLinearGradient(0, 0, 0, bandH);
  grad.addColorStop(0, "rgba(0,0,0,0.6)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, bandH);

  // Subtle vertical divider down the middle to read as a split composition.
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.setLineDash([width * 0.02, width * 0.02]);
  ctx.beginPath();
  ctx.moveTo(width / 2, bandH);
  ctx.lineTo(width / 2, height - ins.bottom);
  ctx.stroke();
  ctx.restore();

  const boxW = width - ins.left - ins.right;
  const layout = fitText(ctx, caption, boxW, height * 0.16, width * 0.072, width * 0.04);
  drawWrappedText(ctx, layout, width / 2, ins.top + height * 0.085);
}

// A fake-native review card: stars, quote, attribution.
function drawTestimonialCard(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption } = lc;
  drawVerticalScrim(ctx, width, height, 0.4);

  const cardW = width * 0.82;
  const cardH = Math.min(height * 0.58, width * 0.82);
  const cardX = (width - cardW) / 2;
  const cardY = (height - cardH) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = width * 0.03;
  ctx.shadowOffsetY = width * 0.012;
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, width * 0.05);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();

  drawStars(ctx, width / 2, cardY + cardH * 0.16, width * 0.022);

  const [quoteRaw, attribution] = splitAttribution(caption);
  const quote = stripQuotes(quoteRaw);

  const innerW = cardW * 0.84;
  const quoteLayout = fitText(
    ctx,
    quote,
    innerW,
    cardH * 0.52,
    width * 0.055,
    width * 0.03,
    FONT_FAMILY_BODY,
  );
  drawWrappedText(ctx, quoteLayout, width / 2, cardY + cardH * 0.5, {
    fill: "#111111",
    stroke: null,
    shadow: false,
    family: FONT_FAMILY_BODY,
  });

  if (attribution) {
    const attrLayout = fitText(
      ctx,
      `— ${attribution}`,
      innerW,
      cardH * 0.12,
      width * 0.034,
      width * 0.022,
      FONT_FAMILY_BODY,
    );
    drawWrappedText(ctx, attrLayout, width / 2, cardY + cardH * 0.82, {
      fill: "#666666",
      stroke: null,
      shadow: false,
      family: FONT_FAMILY_BODY,
    });
  }
}

// A phone notification / message bubble near the top of the frame.
function drawNotificationMock(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption, aspect, brandColor } = lc;
  drawVerticalScrim(ctx, width, height, 0.5);

  const ins = safeInsets(width, height, aspect);
  const msg = stripQuotes(caption.replace(/^notification:\s*/i, "").trim());

  const bubbleW = width * 0.88;
  const bubbleX = (width - bubbleW) / 2;
  const bubbleY = ins.top + height * 0.02;
  const pad = bubbleW * 0.06;
  const iconSize = bubbleW * 0.12;

  const msgLayout = fitText(
    ctx,
    msg,
    bubbleW - pad * 2,
    height * 0.22,
    width * 0.05,
    width * 0.03,
    FONT_FAMILY_BODY,
  );
  const textBlock = msgLayout.lines.length * msgLayout.lineHeight;
  const bubbleH = pad * 2 + iconSize + bubbleW * 0.04 + textBlock;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = width * 0.03;
  ctx.shadowOffsetY = width * 0.01;
  roundedRectPath(ctx, bubbleX, bubbleY, bubbleW, bubbleH, width * 0.045);
  ctx.fillStyle = "rgba(250,250,252,0.97)";
  ctx.fill();
  ctx.restore();

  // App icon + label row.
  roundedRectPath(ctx, bubbleX + pad, bubbleY + pad, iconSize, iconSize, iconSize * 0.28);
  ctx.fillStyle = normalizeColor(brandColor, "#5B3DF5");
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111111";
  ctx.font = `${Math.round(width * 0.032)}px "${FONT_FAMILY_BODY}"`;
  ctx.fillText("Messages", bubbleX + pad * 2 + iconSize, bubbleY + pad + iconSize * 0.38);
  ctx.fillStyle = "#9AA0A6";
  ctx.font = `${Math.round(width * 0.026)}px "${FONT_FAMILY_BODY}"`;
  ctx.fillText("now", bubbleX + pad * 2 + iconSize, bubbleY + pad + iconSize * 0.74);

  const textTop = bubbleY + pad + iconSize + bubbleW * 0.04;
  drawWrappedText(
    ctx,
    msgLayout,
    bubbleX + pad,
    textTop + textBlock / 2,
    {
      fill: "#111111",
      stroke: null,
      shadow: false,
      family: FONT_FAMILY_BODY,
      align: "left",
    },
  );
}

// "quote — Name, Title" -> ["quote", "Name, Title"]; tolerant of hyphen dashes.
function splitAttribution(text: string): [string, string | null] {
  const m = text.split(/\s+[—–-]\s+/);
  if (m.length >= 2) {
    const attribution = m.slice(1).join(" - ").trim();
    return [m[0].trim(), attribution || null];
  }
  return [text.trim(), null];
}

function stripQuotes(text: string): string {
  return text.replace(/^[“"']+/, "").replace(/[”"']+$/, "").trim();
}
