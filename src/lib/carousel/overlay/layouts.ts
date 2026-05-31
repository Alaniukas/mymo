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
  textPlacement?: "top" | "center" | "bottom" | "card" | "none";
  textStyle?: "headline" | "body" | "list" | "quote" | "cta";
  textAlignment?: "left" | "center" | "right";
  textColor?: string | null;
  accentColor?: string | null;
  overlayStrength?: "light" | "medium" | "heavy";
  hasUIChrome?: boolean;
  /** Normalized 0–1 text region from template analysis. */
  textBBox?: { x: number; y: number; w: number; h: number };
}

export function drawLayout(ctx: SKRSContext2D, lc: LayoutContext): void {
  if (lc.textPlacement === "none") return;

  switch (lc.layout) {
    case "geometry":
      return drawGeometryText(ctx, lc);
    case "testimonial_card":
      return drawTestimonialCard(ctx, lc);
    case "notification_mock":
      return drawNotificationMock(ctx, lc);
    case "editorial_split":
      return drawEditorialSplit(ctx, lc);
    case "split_compare":
      return drawSplitCompare(ctx, lc);
    case "tiktok_caption":
      return drawTikTokCaption(ctx, lc);
    case "text_only":
      return drawFullbleed(ctx, lc, scrimAlpha(lc, 0));
    case "fullbleed_dark_overlay":
    default:
      return drawBlueprintText(ctx, lc);
  }
}

/** Text fitted inside AI-measured textZone.bbox — works for any template style. */
function drawGeometryText(ctx: SKRSContext2D, lc: LayoutContext): void {
  const bbox = lc.textBBox;
  if (!bbox) return drawBlueprintText(ctx, lc);

  const { width, height, caption, role } = lc;
  const align = lc.textAlignment ?? "left";
  const fill = captionFill(lc, "#111111");
  const padX = width * 0.04;
  const padY = height * 0.02;

  const boxX = bbox.x * width + padX;
  const boxY = bbox.y * height + padY;
  const boxW = Math.max(1, bbox.w * width - padX * 2);
  const boxH = Math.max(1, bbox.h * height - padY * 2);

  const fontScale =
    lc.textStyle === "body" || lc.textStyle === "list" ? 0.78 : 1;
  const layout = fitText(
    ctx,
    caption,
    boxW,
    boxH,
    startFont(role, width) * fontScale,
    width * 0.028,
    FONT_FAMILY_BODY,
  );

  const textX =
    align === "center"
      ? boxX + boxW / 2
      : align === "right"
        ? boxX + boxW
        : boxX;
  const textY = boxY + boxH / 2;

  drawWrappedText(ctx, layout, textX, textY, {
    fill,
    stroke: null,
    shadow: !lc.textColor?.startsWith("#1") && bbox.y < 0.35,
    family: FONT_FAMILY_BODY,
    align,
  });
}

/** Per-slide text from template blueprint — placement + style vary per slide. */
function drawBlueprintText(ctx: SKRSContext2D, lc: LayoutContext): void {
  const placement = lc.textPlacement ?? "center";
  const style = lc.textStyle ?? "headline";
  const alignment = lc.textAlignment ?? "center";

  if (placement === "top") {
    if (style === "list") return drawTopList(ctx, lc);
    return drawTopHeadline(ctx, lc);
  }
  if (placement === "card") {
    if (lc.textStyle === "body" || lc.textStyle === "list" || lc.textStyle === "quote") {
      return drawStepContentCard(ctx, lc);
    }
  }
  if (placement === "bottom") {
    return drawBottomCard(ctx, lc);
  }
  if (style === "list") return drawCenterList(ctx, lc);
  if (alignment === "left" || alignment === "right") {
    return drawSideAccentText(ctx, lc);
  }
  if (style === "body") return drawFullbleed(ctx, lc, scrimAlpha(lc, 0.35));
  return drawFullbleed(ctx, lc, scrimAlpha(lc, 0.55));
}

function scrimAlpha(
  lc: LayoutContext,
  fallback: number,
): number {
  switch (lc.overlayStrength) {
    case "light":
      return 0;
    case "heavy":
      return Math.max(fallback, 0.62);
    default:
      return fallback;
  }
}

function captionFill(lc: LayoutContext, fallback = "#FFFFFF"): string {
  return normalizeColor(lc.textColor ?? undefined, fallback);
}

function prefersDarkCard(lc: LayoutContext): boolean {
  const tc = (lc.textColor ?? "").toLowerCase();
  if (tc === "#ffffff" || tc === "#fff" || tc.startsWith("#f")) return true;
  if (lc.textStyle === "body" || lc.textStyle === "list") return true;
  return false;
}

function startFont(role: string, width: number): number {
  if (role === "hook") return width * 0.11;
  if (role === "cta") return width * 0.092;
  return width * 0.078;
}

/**
 * Minimalist TikTok / Instagram Reels caption: a single rounded, semi-transparent
 * black "sticker" sized to the text, with bold white type centered horizontally.
 * Used by the Founder Hook Reels engine for the AI hook clip and the app-demo
 * storyline lines. Anchored in the lower-middle of the safe area (clear of the
 * platform feed UI) so it reads like a native caption rather than an ad banner.
 */
function drawTikTokCaption(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, aspect } = lc;
  const clean = lc.caption.trim();
  if (!clean) return;

  const ins = safeInsets(width, height, aspect);
  const usableTop = ins.top;
  const usableBottom = height - ins.bottom;
  const usableH = Math.max(1, usableBottom - usableTop);

  const maxBoxW = width - ins.left - ins.right;
  const padX = width * 0.038;
  const padY = width * 0.024;

  const layout = fitText(
    ctx,
    clean,
    maxBoxW - padX * 2,
    usableH * 0.5,
    width * 0.058,
    width * 0.032,
    FONT_FAMILY_BODY,
  );

  // Size the sticker to the actual rendered text so it hugs the caption.
  ctx.font = `${layout.fontSize}px "${FONT_FAMILY_BODY}"`;
  const widestLine = layout.lines.reduce(
    (w, line) => Math.max(w, ctx.measureText(line).width),
    0,
  );
  const textBlockH = layout.lines.length * layout.lineHeight;

  const boxW = Math.min(maxBoxW, widestLine + padX * 2);
  const boxH = textBlockH + padY * 2;
  const boxX = (width - boxW) / 2;

  // Anchor ~62% down the safe area, clamped so the sticker stays inside it.
  const desiredCenter = usableTop + usableH * 0.62;
  const centerY = Math.min(
    Math.max(desiredCenter, usableTop + boxH / 2),
    usableBottom - boxH / 2,
  );
  const boxY = centerY - boxH / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = width * 0.018;
  ctx.shadowOffsetY = width * 0.004;
  roundedRectPath(ctx, boxX, boxY, boxW, boxH, width * 0.024);
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fill();
  ctx.restore();

  drawWrappedText(ctx, layout, width / 2, centerY, {
    fill: captionFill(lc, "#FFFFFF"),
    stroke: null,
    shadow: false,
    family: FONT_FAMILY_BODY,
    align: "center",
  });
}

// Centered headline text over a soft scrim, clamped inside the safe area.
function drawFullbleed(ctx: SKRSContext2D, lc: LayoutContext, scrim: number): void {
  const { width, height, caption, role, aspect } = lc;
  if (scrim > 0) drawVerticalScrim(ctx, width, height, scrim);

  const ins = safeInsets(width, height, aspect);
  const boxW = width - ins.left - ins.right;
  const boxH = height - ins.top - ins.bottom;
  const layout = fitText(ctx, caption, boxW, boxH, startFont(role, width), width * 0.042);
  drawWrappedText(ctx, layout, width / 2, ins.top + boxH / 2, {
    fill: captionFill(lc),
  });
}

/** Left- or right-aligned accent text on a full-bleed photo (no centered scrim). */
function drawSideAccentText(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption, role, aspect } = lc;
  const alignment = lc.textAlignment ?? "left";
  const ins = safeInsets(width, height, aspect);
  const boxW = width * 0.72;
  const boxH = height * 0.45;
  const scrim = scrimAlpha(lc, 0.18);

  if (scrim > 0) {
    const grad = ctx.createLinearGradient(
      alignment === "left" ? 0 : width,
      0,
      alignment === "left" ? width * 0.85 : width * 0.15,
      0,
    );
    grad.addColorStop(0, `rgba(0,0,0,${scrim})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  const textX =
    alignment === "right"
      ? width - ins.right - boxW * 0.04
      : ins.left + boxW * 0.04;
  const textY = height * 0.38;
  const layout = fitText(
    ctx,
    caption,
    boxW,
    boxH,
    startFont(role, width) * (lc.textStyle === "body" ? 0.88 : 1),
    width * 0.038,
  );
  drawWrappedText(ctx, layout, textX, textY, {
    fill: captionFill(lc, normalizeColor(lc.accentColor ?? undefined, "#D4FF00")),
    stroke: scrim > 0 ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.75)",
    align: alignment,
  });
}

function captionLines(caption: string): string[] {
  return caption
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-–→]+/, "").trim())
    .filter(Boolean);
}

/** Split card copy into a bold title + body (notes-app style). */
function splitCardCaption(
  caption: string,
  textStyle: LayoutContext["textStyle"],
): { title: string | null; body: string } {
  const trimmed = caption.trim();
  if (textStyle === "list") {
    const lines = captionLines(trimmed);
    if (lines.length > 1) {
      return { title: lines[0]!, body: lines.slice(1).join("\n") };
    }
  }

  const parts = trimmed.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { title: parts[0]!, body: parts.slice(1).join("\n\n") };
  }

  if (textStyle === "body" || textStyle === "list") {
    const sentenceBreak = trimmed.match(/^(.{4,72}?[.!?])\s+([\s\S]+)$/);
    if (sentenceBreak) {
      return { title: sentenceBreak[1]!.trim(), body: sentenceBreak[2]!.trim() };
    }
  }

  return { title: null, body: trimmed };
}

/** iOS Notes–style icon row at the top of dark step cards. */
function drawNotesAppHeader(
  ctx: SKRSContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  padY: number,
  width: number,
  dark: boolean,
): number {
  const headerH = width * 0.048;
  const cy = cardY + padY + headerH * 0.55;
  const stroke = dark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.55)";
  const lw = Math.max(2, width * 0.003);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const lx = cardX + cardW * 0.05;
  ctx.beginPath();
  ctx.moveTo(lx + width * 0.016, cy);
  ctx.lineTo(lx, cy - width * 0.011);
  ctx.lineTo(lx, cy + width * 0.011);
  ctx.stroke();

  let rx = cardX + cardW * 0.72;
  ctx.beginPath();
  ctx.arc(rx, cy, width * 0.011, Math.PI * 0.2, Math.PI * 1.4);
  ctx.stroke();

  rx += width * 0.038;
  ctx.strokeRect(rx, cy - width * 0.01, width * 0.016, width * 0.016);
  ctx.beginPath();
  ctx.moveTo(rx + width * 0.008, cy - width * 0.014);
  ctx.lineTo(rx + width * 0.008, cy - width * 0.022);
  ctx.stroke();

  rx += width * 0.038;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(rx + i * width * 0.012, cy, width * 0.004, 0, Math.PI * 2);
    ctx.fill();
  }

  const checkX = cardX + cardW * 0.93;
  ctx.fillStyle = "#F5C542";
  ctx.beginPath();
  ctx.arc(checkX, cy, width * 0.024, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(2, width * 0.0035);
  ctx.beginPath();
  ctx.moveTo(checkX - width * 0.009, cy);
  ctx.lineTo(checkX - width * 0.002, cy + width * 0.008);
  ctx.lineTo(checkX + width * 0.01, cy - width * 0.008);
  ctx.stroke();

  return headerH + padY * 0.35;
}

function drawTopHeadline(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption, role, aspect } = lc;
  const ins = safeInsets(width, height, aspect);
  const bandH = ins.top + height * 0.28;
  const grad = ctx.createLinearGradient(0, 0, 0, bandH);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, bandH);

  const boxW = width - ins.left - ins.right;
  const layout = fitText(
    ctx,
    caption,
    boxW,
    height * 0.2,
    startFont(role, width),
    width * 0.042,
  );
  drawWrappedText(ctx, layout, width / 2, ins.top + height * 0.11);
}

function drawTopList(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption, aspect } = lc;
  const ins = safeInsets(width, height, aspect);
  const lines = captionLines(caption);
  const title = lines[0] ?? caption;
  const bullets = lines.slice(1);

  const bandH = ins.top + height * (bullets.length > 0 ? 0.42 : 0.28);
  const grad = ctx.createLinearGradient(0, 0, 0, bandH);
  grad.addColorStop(0, "rgba(255,255,255,0.92)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, bandH);

  const boxW = width - ins.left - ins.right;
  const titleLayout = fitText(
    ctx,
    title,
    boxW,
    height * 0.12,
    width * 0.078,
    width * 0.04,
    FONT_FAMILY_BODY,
  );
  drawWrappedText(ctx, titleLayout, ins.left + boxW / 2, ins.top + height * 0.07, {
    fill: "#111111",
    stroke: null,
    shadow: false,
    family: FONT_FAMILY_BODY,
  });

  let y = ins.top + height * 0.16;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const bullet of bullets.slice(0, 5)) {
    ctx.fillStyle = "#333333";
    ctx.font = `${Math.round(width * 0.034)}px "${FONT_FAMILY_BODY}"`;
    ctx.fillText(`→  ${bullet}`, ins.left + boxW * 0.02, y);
    y += height * 0.055;
  }
}

function drawCenterList(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption, aspect } = lc;
  drawVerticalScrim(ctx, width, height, 0.5);
  const ins = safeInsets(width, height, aspect);
  const lines = captionLines(caption);
  const boxW = width - ins.left - ins.right;
  let y = ins.top + height * 0.22;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const line of lines.slice(0, 6)) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.round(width * 0.038)}px "${FONT_FAMILY_BODY}"`;
    ctx.fillText(`→  ${line}`, ins.left + boxW * 0.05, y);
    y += height * 0.065;
  }
}

// White rounded caption card anchored to the bottom — common IG carousel format.
function drawBottomCard(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption, role, aspect } = lc;
  const ins = safeInsets(width, height, aspect);

  const cardW = width - ins.left - ins.right;
  const padX = cardW * 0.08;
  const padY = cardW * 0.06;
  const maxTextH = height * 0.22;

  const textLayout = fitText(
    ctx,
    caption,
    cardW - padX * 2,
    maxTextH,
    startFont(role, width) * 0.72,
    width * 0.038,
  );
  const textBlock = textLayout.lines.length * textLayout.lineHeight;
  const cardH = padY * 2 + textBlock;
  const cardX = ins.left;
  const cardY = height - ins.bottom - cardH - height * 0.02;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = width * 0.02;
  ctx.shadowOffsetY = width * 0.008;
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, width * 0.04);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();

  drawWrappedText(ctx, textLayout, cardX + cardW / 2, cardY + padY + textBlock / 2, {
    fill: "#111111",
    stroke: null,
    shadow: false,
    family: FONT_FAMILY_BODY,
  });
}

// Caption in a top banner; side-by-side before/after only (never editorial stacks).
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

/** Magazine/journal stacked panel — black text on solid white band, photo stays clean. */
function drawEditorialSplit(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption, role, aspect } = lc;
  const ins = safeInsets(width, height, aspect);
  const placement = lc.textPlacement ?? "top";
  const bandH = height * 0.46;
  const panelTop = placement === "bottom" ? height - bandH : 0;
  const align = lc.textAlignment ?? "left";
  const fill = captionFill(lc, "#111111");

  const padX = width * 0.08;
  const boxW = width - padX * 2;
  const boxH = bandH * 0.78;
  const textY = panelTop + bandH * 0.48;

  const fontScale =
    lc.textStyle === "body" || lc.textStyle === "list" ? 0.72 : 1;
  const layout = fitText(
    ctx,
    caption,
    boxW,
    boxH,
    startFont(role, width) * fontScale,
    width * 0.032,
    FONT_FAMILY_BODY,
  );

  const textX =
    align === "center"
      ? width / 2
      : align === "right"
        ? width - ins.right - padX * 0.5
        : ins.left + padX;

  drawWrappedText(ctx, layout, textX, textY, {
    fill,
    stroke: null,
    shadow: false,
    family: FONT_FAMILY_BODY,
    align,
  });
}

// A centered content card — step/info slides (white or dark) or star review quotes.
function drawTestimonialCard(ctx: SKRSContext2D, lc: LayoutContext): void {
  if (lc.textStyle === "quote" && lc.hasUIChrome !== false) {
    drawReviewQuoteCard(ctx, lc);
    return;
  }
  drawStepContentCard(ctx, lc);
}

function drawStepContentCard(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption } = lc;
  const dark = prefersDarkCard(lc);
  const showNotesChrome = lc.hasUIChrome === true && lc.textStyle !== "quote";

  const cardW = width * 0.84;
  const padX = cardW * 0.08;
  const padY = cardW * 0.07;
  const maxTextH = height * 0.52;
  const innerW = cardW - padX * 2;

  const split = splitCardCaption(caption, lc.textStyle);
  const isList = lc.textStyle === "list" && split.title !== null;
  const bodyText = isList ? split.body : split.body;
  const title = split.title;

  let headerBlock = 0;
  if (showNotesChrome) {
    headerBlock = width * 0.048 + padY * 0.35;
  }

  let titleBlock = 0;
  if (title) {
    const titleLayout = fitText(
      ctx,
      title,
      innerW,
      height * 0.12,
      width * 0.062,
      width * 0.036,
      FONT_FAMILY_BODY,
    );
    titleBlock = titleLayout.lines.length * titleLayout.lineHeight + height * 0.02;
  }

  const textLayout = fitText(
    ctx,
    bodyText,
    innerW,
    maxTextH - titleBlock - headerBlock,
    width * 0.046,
    width * 0.028,
    FONT_FAMILY_BODY,
  );
  const textBlock = textLayout.lines.length * textLayout.lineHeight;
  const cardH = padY * 2 + headerBlock + titleBlock + textBlock;
  const cardX = (width - cardW) / 2;
  const cardY = (height - cardH) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = width * 0.03;
  ctx.shadowOffsetY = width * 0.012;
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, width * 0.05);
  ctx.fillStyle = dark ? "#111111" : "#FFFFFF";
  ctx.fill();
  ctx.restore();

  const textFill = dark ? "#F5F5F5" : "#111111";
  let y = cardY + padY;

  if (showNotesChrome) {
    y += drawNotesAppHeader(ctx, cardX, cardY, cardW, padY, width, dark);
  }

  if (title) {
    const titleLayout = fitText(
      ctx,
      title,
      innerW,
      height * 0.12,
      width * 0.062,
      width * 0.036,
      FONT_FAMILY_BODY,
    );
    const titleH = titleLayout.lines.length * titleLayout.lineHeight;
    drawWrappedText(ctx, titleLayout, cardX + padX, y + titleH / 2, {
      fill: textFill,
      stroke: null,
      shadow: false,
      family: FONT_FAMILY_BODY,
      align: "left",
    });
    y += titleH + height * 0.02;
  }

  drawWrappedText(
    ctx,
    textLayout,
    cardX + padX,
    y + textBlock / 2,
    {
      fill: textFill,
      stroke: null,
      shadow: false,
      family: FONT_FAMILY_BODY,
      align: "left",
    },
  );
}

function drawReviewQuoteCard(ctx: SKRSContext2D, lc: LayoutContext): void {
  const { width, height, caption } = lc;
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
  const scrim = scrimAlpha(lc, 0.12);
  if (scrim > 0) drawVerticalScrim(ctx, width, height, scrim);

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
