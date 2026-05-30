import { createCanvas, loadImage } from "@napi-rs/canvas";
import type OpenAI from "openai";
import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { fetchMediaBuffer } from "./storage";
import type { AssetRef } from "./prompts";
import {
  buildStudioReferenceUrls,
  TEMPLATE_LAYOUT_GUIDE_PROMPT,
  USER_ASSET_PRIMARY_PROMPT,
} from "./studio-asset-references";

/** Overlay layouts the canvas renderer supports. */
export type OverlayLayout =
  | "fullbleed_dark_overlay"
  | "split_compare"
  | "editorial_split"
  | "testimonial_card"
  | "notification_mock"
  | "text_only";

export type PhotoCount = 1 | 2 | 3 | "grid";

export type PhotoLayout =
  | "single_full"
  | "split_vertical"
  | "split_horizontal"
  | "inset"
  | "collage";

export type SubjectZone =
  | "top"
  | "center"
  | "bottom"
  | "left"
  | "right"
  | "full";

export type TextAlignment = "left" | "center" | "right";

export type DecorAssetKind =
  | "sticker"
  | "logo"
  | "icon"
  | "ui_frame"
  | "graphic";

export interface DecorAssetBBox {
  /** Left edge, 0–1 relative to slide width */
  x: number;
  /** Top edge, 0–1 relative to slide height */
  y: number;
  w: number;
  h: number;
}

/** Reusable non-text graphic extracted from a template slide (logos, stickers, icons). */
export interface TemplateDecorAsset {
  id: string;
  kind: DecorAssetKind;
  bbox: DecorAssetBBox;
  /** When true, skip extraction — user caption replaces this region at finalize. */
  containsText?: boolean;
  label?: string;
  /** Filled after server-side crop + upload at blueprint analysis time. */
  imageUrl?: string;
  storagePath?: string;
}

export interface TemplateSlideBlueprint {
  position: number;
  role: "hook" | "value" | "cta";
  narrativePurpose: string;
  layout: OverlayLayout;
  /** AI-measured rectangles where user photos are placed (normalized 0–1). Primary compose driver. */
  photoSlots?: DecorAssetBBox[];
  /** Solid-color regions measured from the template (white panels, cards, bands). */
  backgroundPanels?: BackgroundPanelSpec[];
  composition: {
    photoCount: PhotoCount;
    photoLayout: PhotoLayout;
    subjectZone: SubjectZone;
    hasPerson: boolean;
    hasProduct: boolean;
    hasScreenshot: boolean;
    hasUIChrome: boolean;
  };
  textZone: {
    placement: "top" | "center" | "bottom" | "card" | "none";
    style: "headline" | "body" | "list" | "quote" | "cta";
    lengthHint: "short" | "medium" | "long";
    alignment?: TextAlignment;
    /** AI-measured bounding box of the primary text block (normalized 0–1). */
    bbox?: DecorAssetBBox;
  };
  typography?: {
    weight: "regular" | "bold" | "extra_bold";
    case: "sentence" | "title" | "upper";
    fontHint: "sans" | "serif" | "display" | "mono";
  };
  colors?: {
    textColor: string;
    accentColor: string;
    overlayStrength: "light" | "medium" | "heavy";
  };
  visualStyle: string;
  backgroundType: "photo" | "gradient" | "solid" | "blurred";
  /** Stickers, logos, icons, and other non-text graphics to preserve when remixing. */
  decorAssets?: TemplateDecorAsset[];
}

export interface BackgroundPanelSpec {
  bbox: DecorAssetBBox;
  color: string;
  role?: "text_panel" | "accent" | "background";
}

export interface TemplateBlueprint {
  summary: string;
  arcType: string;
  slideCount: number;
  globalVisualStyle: string;
  copyPattern: string;
  slides: TemplateSlideBlueprint[];
}

const VALID_LAYOUTS = new Set<string>([
  "fullbleed_dark_overlay",
  "split_compare",
  "editorial_split",
  "testimonial_card",
  "notification_mock",
  "text_only",
]);

const BLUEPRINT_SYSTEM = `You are a social-media creative analyst. You are given the slide images of a carousel TEMPLATE, in order. Reverse-engineer its STRUCTURE so a different brand can replicate the same format with their own photos and copy.

PRIMARY TASK — MEASURE GEOMETRY FROM EACH SLIDE IMAGE (required for every slide):
The renderer places user content using your measured regions, NOT predefined layout names. Observe each slide and output precise normalized coordinates (0–1 decimals, top-left origin):

1. photoSlots — array of { x, y, w, h } for every rectangular region where a USER photo should appear:
   - Full-bleed photo → one slot covering the photo area (often { x:0, y:0, w:1, h:1 } or the visible photo panel only)
   - Top/bottom or side-by-side splits → one slot per distinct photo panel (measure exact panel edges)
   - Inset photo on blurred background → slot for the sharp inset rectangle only
   - Do NOT include circular texture swatches, crop-preview dots, or decorative circles as photoSlots

2. textZone.bbox — { x, y, w, h } bounding box of the PRIMARY readable text block (headline, body paragraph, or label cluster). One box covering all lines of that block.

3. backgroundPanels — array of { bbox: { x, y, w, h }, color: "#hex", role } for solid-color regions:
   - role "text_panel" — white/light band behind typography
   - role "accent" — colored card or band
   - role "background" — full or partial solid backdrop
   Measure exact panel edges and dominant fill color.

SECONDARY — semantic metadata (still required, but geometry drives rendering):

For EACH slide analyze:
1. narrativePurpose — structural job in the story arc (NOT literal topic)
2. layout — closest legacy hint (pick ONE):
   - "fullbleed_dark_overlay" — photo with text overlay
   - "split_compare" — ONLY side-by-side before/after (two photos left/right)
   - "editorial_split" — stacked text panel + photo panel (top/bottom)
   - "testimonial_card" — centered card / Notes-style editor
   - "notification_mock" — push/DM bubble at top
   - "text_only" — typography-only slide
3. composition — photoCount, photoLayout, subjectZone, hasPerson, hasProduct, hasScreenshot, hasUIChrome
4. textZone — placement, style, lengthHint, alignment (plus bbox above)
5. typography — weight, case, fontHint
6. colors — textColor, accentColor, overlayStrength
7. visualStyle, backgroundType, role
8. decorAssets — reusable NON-TEXT graphics (logos, stickers, ui_frame chrome). Max 6. bbox normalized 0–1. EXCLUDE photo areas, readable text, and circular swatch markers.

Also provide: summary, arcType, globalVisualStyle, copyPattern (pattern only — do NOT copy literal text).

Rules:
- Do NOT copy literal text, brand names, or product names.
- GEOMETRY MUST match what you SEE — if a white panel occupies the top 45%, photoSlots and backgroundPanels must reflect that exactly.
- Every slide needs at least one of: photoSlots (≥1 entry), textZone.bbox, or backgroundPanels describing the layout.
- Side-by-side photos → two photoSlots + optional caption textZone.bbox above/below.
- Stacked journal slides → backgroundPanels for the text band + photoSlots for the photo half + textZone.bbox inside the text band.
- Centered Notes/review card → textZone.bbox around card text area; ui_frame decor for icon bar if visible.
- Hook with inset portrait → backgroundType "blurred", photoSlots for inset rect only.
- Do NOT extract circular texture swatches as decorAssets.
- Each slide usually differs in geometry — measure individually.
- Output exactly one slides[] entry per input slide image, in order.
- Output valid JSON only.`;

function normalizeRole(
  role: unknown,
  position: number,
  total: number,
): "hook" | "value" | "cta" {
  if (position === 1) return "hook";
  if (position === total) return "cta";
  if (role === "value") return "value";
  return "value";
}

function normalizeLayout(layout: unknown): OverlayLayout {
  if (typeof layout === "string" && VALID_LAYOUTS.has(layout)) {
    return layout as OverlayLayout;
  }
  return "fullbleed_dark_overlay";
}

function normalizePhotoCount(v: unknown): PhotoCount {
  if (v === 2 || v === 3) return v;
  if (v === "grid") return "grid";
  return 1;
}

function normalizePhotoLayout(v: unknown): PhotoLayout {
  const valid: PhotoLayout[] = [
    "single_full",
    "split_vertical",
    "split_horizontal",
    "inset",
    "collage",
  ];
  if (typeof v === "string" && valid.includes(v as PhotoLayout)) {
    return v as PhotoLayout;
  }
  return "single_full";
}

function normalizeSubjectZone(v: unknown): SubjectZone {
  const valid: SubjectZone[] = [
    "top",
    "center",
    "bottom",
    "left",
    "right",
    "full",
  ];
  if (typeof v === "string" && valid.includes(v as SubjectZone)) {
    return v as SubjectZone;
  }
  return "center";
}

function normalizeTextPlacement(
  v: unknown,
): TemplateSlideBlueprint["textZone"]["placement"] {
  const valid = ["top", "center", "bottom", "card", "none"] as const;
  if (typeof v === "string" && (valid as readonly string[]).includes(v)) {
    return v as TemplateSlideBlueprint["textZone"]["placement"];
  }
  return "center";
}

function normalizeTextStyle(
  v: unknown,
): TemplateSlideBlueprint["textZone"]["style"] {
  const valid = ["headline", "body", "list", "quote", "cta"] as const;
  if (typeof v === "string" && (valid as readonly string[]).includes(v)) {
    return v as TemplateSlideBlueprint["textZone"]["style"];
  }
  return "headline";
}

function normalizeLengthHint(
  v: unknown,
): TemplateSlideBlueprint["textZone"]["lengthHint"] {
  if (v === "medium" || v === "long") return v;
  return "short";
}

function normalizeTextAlignment(v: unknown): TextAlignment {
  if (v === "left" || v === "right") return v;
  return "center";
}

function normalizeTypography(
  raw: unknown,
): TemplateSlideBlueprint["typography"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  const weight =
    t.weight === "regular" || t.weight === "extra_bold" ? t.weight : "bold";
  const textCase =
    t.case === "title" || t.case === "upper" ? t.case : "sentence";
  const fontHint =
    t.fontHint === "serif" ||
    t.font_hint === "serif" ||
    t.fontHint === "display" ||
    t.font_hint === "display" ||
    t.fontHint === "mono" ||
    t.font_hint === "mono"
      ? ((t.fontHint ?? t.font_hint) as "serif" | "display" | "mono")
      : "sans";
  return { weight, case: textCase, fontHint };
}

function normalizeColors(
  raw: unknown,
): TemplateSlideBlueprint["colors"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const textColor =
    typeof c.textColor === "string"
      ? c.textColor.trim()
      : typeof c.text_color === "string"
        ? c.text_color.trim()
        : "";
  const accentColor =
    typeof c.accentColor === "string"
      ? c.accentColor.trim()
      : typeof c.accent_color === "string"
        ? c.accent_color.trim()
        : "";
  const overlayStrength =
    c.overlayStrength === "light" ||
    c.overlay_strength === "light" ||
    c.overlayStrength === "heavy" ||
    c.overlay_strength === "heavy"
      ? ((c.overlayStrength ?? c.overlay_strength) as "light" | "heavy")
      : "medium";
  if (!textColor && !accentColor) return undefined;
  return {
    textColor: textColor || "#FFFFFF",
    accentColor: accentColor || "#FFFFFF",
    overlayStrength,
  };
}

function normalizeBackgroundType(
  v: unknown,
): TemplateSlideBlueprint["backgroundType"] {
  const valid = ["photo", "gradient", "solid", "blurred"] as const;
  if (typeof v === "string" && (valid as readonly string[]).includes(v)) {
    return v as TemplateSlideBlueprint["backgroundType"];
  }
  return "photo";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeDecorBBox(raw: unknown): DecorAssetBBox | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  let x = Number(b.x);
  let y = Number(b.y);
  let w = Number(b.w ?? b.width);
  let h = Number(b.h ?? b.height);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (w > 1 || h > 1 || x > 1 || y > 1) {
    x /= 100;
    y /= 100;
    w /= 100;
    h /= 100;
  }
  w = clamp01(w);
  h = clamp01(h);
  x = clamp01(x);
  y = clamp01(y);
  if (w < 0.015 || h < 0.015) return null;
  if (x + w > 1.02) w = Math.max(0.015, 1 - x);
  if (y + h > 1.02) h = Math.max(0.015, 1 - y);
  return { x, y, w, h };
}

function normalizeDecorKind(v: unknown): DecorAssetKind {
  const valid: DecorAssetKind[] = [
    "sticker",
    "logo",
    "icon",
    "ui_frame",
    "graphic",
  ];
  if (typeof v === "string" && valid.includes(v as DecorAssetKind)) {
    return v as DecorAssetKind;
  }
  return "graphic";
}

export function normalizeDecorAssets(raw: unknown): TemplateDecorAsset[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateDecorAsset[] = [];
  for (let i = 0; i < Math.min(raw.length, 6); i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const bbox = normalizeDecorBBox(o.bbox);
    if (!bbox) continue;
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim().slice(0, 40)
        : `decor-${i + 1}`;
    out.push({
      id,
      kind: normalizeDecorKind(o.kind),
      bbox,
      containsText: Boolean(o.containsText ?? o.contains_text),
      label:
        typeof o.label === "string" ? o.label.trim().slice(0, 80) : undefined,
      imageUrl:
        typeof o.imageUrl === "string"
          ? o.imageUrl
          : typeof o.image_url === "string"
            ? o.image_url
            : undefined,
      storagePath:
        typeof o.storagePath === "string"
          ? o.storagePath
          : typeof o.storage_path === "string"
            ? o.storage_path
            : undefined,
    });
  }
  return out;
}

function normalizePhotoSlots(raw: unknown): DecorAssetBBox[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const slots: DecorAssetBBox[] = [];
  for (const item of raw.slice(0, 6)) {
    const bbox = normalizeDecorBBox(item);
    if (bbox) slots.push(bbox);
  }
  return slots.length > 0 ? slots : undefined;
}

function normalizeBackgroundPanels(raw: unknown): BackgroundPanelSpec[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const panels: BackgroundPanelSpec[] = [];
  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const bbox = normalizeDecorBBox(o.bbox);
    if (!bbox) continue;
    const colorRaw =
      typeof o.color === "string"
        ? o.color.trim()
        : typeof o.fill === "string"
          ? o.fill.trim()
          : "";
    panels.push({
      bbox,
      color: colorRaw.startsWith("#") ? colorRaw : "#FFFFFF",
      role:
        o.role === "text_panel" || o.role === "accent" || o.role === "background"
          ? o.role
          : undefined,
    });
  }
  return panels.length > 0 ? panels : undefined;
}

function parseSlideBlueprint(
  raw: Record<string, unknown>,
  position: number,
  total: number,
): TemplateSlideBlueprint {
  const comp = (raw.composition ?? {}) as Record<string, unknown>;
  const text = (raw.textZone ?? raw.text_zone ?? {}) as Record<string, unknown>;

  return {
    position,
    role: normalizeRole(raw.role, position, total),
    narrativePurpose:
      typeof raw.narrativePurpose === "string"
        ? raw.narrativePurpose.trim()
        : typeof raw.narrative_purpose === "string"
          ? raw.narrative_purpose.trim()
          : typeof raw.purpose === "string"
            ? raw.purpose.trim()
            : "",
    layout: normalizeLayout(raw.layout),
    photoSlots: normalizePhotoSlots(raw.photoSlots ?? raw.photo_slots),
    backgroundPanels: normalizeBackgroundPanels(
      raw.backgroundPanels ?? raw.background_panels,
    ),
    composition: {
      photoCount: normalizePhotoCount(comp.photoCount ?? comp.photo_count),
      photoLayout: normalizePhotoLayout(comp.photoLayout ?? comp.photo_layout),
      subjectZone: normalizeSubjectZone(comp.subjectZone ?? comp.subject_zone),
      hasPerson: Boolean(comp.hasPerson ?? comp.has_person),
      hasProduct: Boolean(comp.hasProduct ?? comp.has_product),
      hasScreenshot: Boolean(comp.hasScreenshot ?? comp.has_screenshot),
      hasUIChrome: Boolean(comp.hasUIChrome ?? comp.has_ui_chrome),
    },
    textZone: {
      placement: normalizeTextPlacement(text.placement),
      style: normalizeTextStyle(text.style),
      lengthHint: normalizeLengthHint(text.lengthHint ?? text.length_hint),
      alignment: normalizeTextAlignment(text.alignment),
      bbox: normalizeDecorBBox(text.bbox) ?? undefined,
    },
    typography: normalizeTypography(raw.typography),
    colors: normalizeColors(raw.colors),
    visualStyle:
      typeof raw.visualStyle === "string"
        ? raw.visualStyle.trim()
        : typeof raw.visual_style === "string"
          ? raw.visual_style.trim()
          : "",
    backgroundType: normalizeBackgroundType(
      raw.backgroundType ?? raw.background_type,
    ),
    decorAssets: normalizeDecorAssets(raw.decorAssets ?? raw.decor_assets),
  };
}

/** Parse and validate a blueprint from raw JSON (DB or LLM output). */
export function parseTemplateBlueprint(raw: unknown): TemplateBlueprint | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rawSlides = Array.isArray(obj.slides) ? obj.slides : [];
  if (rawSlides.length === 0) return null;

  const slides = rawSlides.map((s, i) =>
    parseSlideBlueprint(
      (s ?? {}) as Record<string, unknown>,
      typeof (s as Record<string, unknown>)?.position === "number"
        ? ((s as Record<string, unknown>).position as number)
        : i + 1,
      rawSlides.length,
    ),
  );

  return {
    summary:
      typeof obj.summary === "string" ? obj.summary.trim() : "",
    arcType:
      typeof obj.arcType === "string"
        ? obj.arcType.trim()
        : typeof obj.arc_type === "string"
          ? obj.arc_type.trim()
          : "",
    slideCount:
      typeof obj.slideCount === "number"
        ? obj.slideCount
        : typeof obj.slide_count === "number"
          ? obj.slide_count
          : slides.length,
    globalVisualStyle:
      typeof obj.globalVisualStyle === "string"
        ? obj.globalVisualStyle.trim()
        : typeof obj.global_visual_style === "string"
          ? obj.global_visual_style.trim()
          : "",
    copyPattern:
      typeof obj.copyPattern === "string"
        ? obj.copyPattern.trim()
        : typeof obj.copy_pattern === "string"
          ? obj.copy_pattern.trim()
          : "",
    slides,
  };
}

const MAX_VISION_EDGE = 1024;

/** Resize + embed as data URL so the vision model never has to fetch storage URLs. */
async function bufferToVisionDataUrl(buffer: Buffer): Promise<string | null> {
  try {
    const image = await loadImage(buffer);
    let w = image.width;
    let h = image.height;
    const maxEdge = Math.max(w, h);
    if (maxEdge > MAX_VISION_EDGE) {
      const scale = MAX_VISION_EDGE / maxEdge;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, w, h);
      const jpeg = canvas.toBuffer("image/jpeg");
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.warn("[template-blueprint] vision encode failed:", err);
    return null;
  }
}

async function loadVisionImagePart(
  url: string,
): Promise<OpenAI.Chat.Completions.ChatCompletionContentPart | null> {
  const media = await fetchMediaBuffer(url);
  if (!media) return null;
  const dataUrl = await bufferToVisionDataUrl(media.buffer);
  if (!dataUrl) return null;
  return { type: "image_url", image_url: { url: dataUrl } };
}

/** Minimal blueprint so a template stays usable when vision analysis fails. */
export function buildFallbackBlueprint(slideCount: number): TemplateBlueprint {
  const count = Math.max(Math.min(slideCount, 20), 1);
  const slides: TemplateSlideBlueprint[] = Array.from({ length: count }, (_, i) => {
    const position = i + 1;
    const role = normalizeRole(undefined, position, count);
    const isMiddle = position > 1 && position < count;
    const evenMiddle = isMiddle && position % 2 === 0;
    const isHook = role === "hook";
    return {
      position,
      role,
      narrativePurpose:
        role === "hook"
          ? "Stop the scroll"
          : role === "cta"
            ? "Drive action"
            : "Deliver value",
      layout: isHook
        ? "fullbleed_dark_overlay"
        : evenMiddle || role === "cta"
          ? "testimonial_card"
          : "fullbleed_dark_overlay",
      composition: {
        photoCount: 1,
        photoLayout: isHook ? "inset" : "single_full",
        subjectZone: "center",
        hasPerson: isHook,
        hasProduct: false,
        hasScreenshot: false,
        hasUIChrome: !isHook && (evenMiddle || role === "cta"),
      },
      textZone: {
        placement: isHook ? "center" : evenMiddle || role === "cta" ? "card" : "center",
        style: role === "cta" ? "cta" : evenMiddle ? "body" : "headline",
        lengthHint: isHook ? "short" : evenMiddle ? "medium" : "short",
        alignment: isHook ? "left" : "center",
      },
      visualStyle: "",
      backgroundType: isHook ? "blurred" : evenMiddle || role === "cta" ? "blurred" : "photo",
    };
  });

  return {
    summary: "Imported carousel template",
    arcType: count <= 2 ? "story-hook" : "listicle",
    slideCount: count,
    globalVisualStyle: "",
    copyPattern: "Hook → value slides → CTA",
    slides,
  };
}

/**
 * Deep multimodal analysis of template slides at import time.
 * Images are fetched server-side and sent as data URLs (storage URLs are often
 * unreachable from the LLM provider). Returns null on failure.
 */
export async function analyzeTemplateBlueprint(
  imageUrls: string[],
  postCaption?: string | null,
  model?: string,
): Promise<TemplateBlueprint | null> {
  const urls = imageUrls
    .filter((u) => typeof u === "string" && u.trim())
    .slice(0, 20);
  if (urls.length === 0) return null;

  const visionParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  for (let i = 0; i < urls.length; i++) {
    const part = await loadVisionImagePart(urls[i]!);
    if (!part) {
      console.warn(
        `[template-blueprint] could not load slide ${i + 1} for analysis:`,
        urls[i],
      );
      continue;
    }
    visionParts.push({ type: "text", text: `Slide ${i + 1}:` });
    visionParts.push(part);
  }

  if (visionParts.length === 0) {
    console.warn("[template-blueprint] no slide images could be loaded for analysis");
    return null;
  }

  const slideCount = visionParts.filter((p) => p.type === "image_url").length;
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: postCaption?.trim()
        ? `Post caption (for context only — do NOT copy):\n${postCaption.trim().slice(0, 500)}\n\nTemplate slides, in order (${slideCount} images):`
        : `Template slides, in order (${slideCount} images):`,
    },
    ...visionParts,
    {
      type: "text",
      text: `Analyze all ${slideCount} slides. Return JSON: { "summary", "arcType", "slideCount", "globalVisualStyle", "copyPattern", "slides": [{ ..., "decorAssets": [...] }] }`,
    },
  ];

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      ...EVOLINK_CHAT_DEFAULTS,
      model: model || EVOLINK_CHAT_DEFAULTS.model,
      reasoning_effort: "low",
      max_completion_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: "system", content: BLUEPRINT_SYSTEM },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    });

    const text = extractMessageText(completion);
    if (!text) {
      console.warn("[template-blueprint] LLM returned empty response");
      return null;
    }

    const parsed = JSON.parse(text);
    const blueprint = parseTemplateBlueprint(parsed);
    if (!blueprint) {
      console.warn("[template-blueprint] LLM JSON did not parse as blueprint");
      return null;
    }

    blueprint.slideCount = blueprint.slides.length;
    blueprint.slides = blueprint.slides.map((s, i) => ({
      ...s,
      position: i + 1,
      role: normalizeRole(s.role, i + 1, blueprint.slides.length),
    }));

    return blueprint;
  } catch (err) {
    console.warn("[template-blueprint] analysis failed:", err);
    return null;
  }
}

/** Reference images for AI generation — never includes the template slide (avoids copying its subject/text). */
export function selectBlueprintAiReferences(opts: {
  slideAssetUrl?: string;
  slideAssetUrls?: string[];
  slideBlueprint: TemplateSlideBlueprint;
  assets: AssetRef[];
}): string[] {
  const userUrls =
    opts.slideAssetUrls && opts.slideAssetUrls.length > 0
      ? opts.slideAssetUrls
      : opts.slideAssetUrl
        ? [opts.slideAssetUrl]
        : [];

  if (userUrls.length > 0) {
    return userUrls.slice(0, 4);
  }

  const hooks = opts.assets
    .filter((a) => a.type === "hook")
    .map((a) => a.public_url);
  const demos = opts.assets
    .filter((a) => a.type === "demo")
    .map((a) => a.public_url);

  const { composition } = opts.slideBlueprint;
  const needsMultiple =
    composition.photoCount === 2 ||
    composition.photoCount === 3 ||
    composition.photoCount === "grid" ||
    composition.photoLayout === "split_vertical" ||
    composition.photoLayout === "split_horizontal" ||
    composition.photoLayout === "collage";

  const refs: string[] = [];
  if (composition.hasPerson && hooks[0]) refs.push(hooks[0]);
  if (composition.hasProduct || composition.hasScreenshot) {
    refs.push(...demos.slice(0, needsMultiple ? 2 : 1));
  } else if (needsMultiple && demos.length > 0) {
    refs.push(...demos.slice(0, 2));
  } else if (!composition.hasPerson && hooks[0] && opts.slideBlueprint.role !== "value") {
    refs.push(hooks[0]);
  } else if (demos[0] && opts.slideBlueprint.role === "value") {
    refs.push(demos[0]);
  }

  return Array.from(new Set(refs)).slice(0, 4);
}

/** Reference images for a slide based on blueprint composition + user assets. */
export function selectBlueprintReferences(opts: {
  templateUrl?: string;
  slideAssetUrl?: string;
  slideAssetUrls?: string[];
  slideBlueprint: TemplateSlideBlueprint;
  assets: AssetRef[];
}): string[] {
  const userUrls =
    opts.slideAssetUrls && opts.slideAssetUrls.length > 0
      ? opts.slideAssetUrls
      : opts.slideAssetUrl
        ? [opts.slideAssetUrl]
        : [];

  if (userUrls.length > 0) {
    return buildStudioReferenceUrls({
      slideAssetUrl: userUrls[0],
      templateUrl: undefined,
      extraAssetUrls: userUrls.slice(1),
    });
  }

  return selectBlueprintAiReferences(opts);
}

const PHOTO_LAYOUT_DESC: Record<PhotoLayout, string> = {
  single_full: "single full-bleed photo",
  split_vertical: "two photos stacked vertically (top/bottom split)",
  split_horizontal: "two photos side-by-side (left/right split)",
  inset: "inset photo within a card or frame",
  collage: "multi-photo collage or grid",
};

const SUBJECT_ZONE_DESC: Record<SubjectZone, string> = {
  top: "subject in the top third",
  center: "subject centered",
  bottom: "subject in the bottom third",
  left: "subject on the left",
  right: "subject on the right",
  full: "subject fills the frame",
};

/**
 * Compact image prompt for Nano Banana 2 (≤1500 chars target).
 * Template ref is always image #1 — instruct model to match its layout exactly.
 */
export function buildBlueprintImagePrompt(opts: {
  brief: string;
  role: string;
  position: number;
  totalSlides: number;
  platform: string;
  brandTone: string;
  slideBlueprint: TemplateSlideBlueprint;
  globalVisualStyle: string;
  slideAssetUrl?: string;
}): string {
  const {
    brief,
    role,
    position,
    totalSlides,
    platform,
    brandTone,
    slideBlueprint,
    globalVisualStyle,
    slideAssetUrl,
  } = opts;

  const aspect =
    platform === "tiktok" ? "9:16" : platform === "both" ? "4:5" : "1:1";
  const { composition, backgroundType } = slideBlueprint;
  const layoutDesc = PHOTO_LAYOUT_DESC[composition.photoLayout];
  const zoneDesc = SUBJECT_ZONE_DESC[composition.subjectZone];

  const subjectParts: string[] = [];
  if (composition.hasPerson) subjectParts.push("person from reference photo");
  if (composition.hasProduct) subjectParts.push("product from reference");
  if (composition.hasScreenshot) subjectParts.push("app/product screenshot from reference");

  const layoutLead = slideAssetUrl
    ? `${USER_ASSET_PRIMARY_PROMPT} Follow the blueprint layout spec below — same panel geometry and text-zone spacing. Do NOT copy any template's subject, logos, or on-image text.`
    : "Follow the blueprint layout spec below — same panel geometry, inset frames, and background treatment. Generate a clean background only";

  const parts = [
    `${aspect} carousel slide ${position}/${totalSlides} BACKGROUND. ${layoutLead}: ${layoutDesc}, ${zoneDesc}.`,
    `Photos in frame: ${composition.photoCount}. Background: ${backgroundType}.`,
    globalVisualStyle ? `Style: ${globalVisualStyle.slice(0, 120)}.` : "",
    slideBlueprint.visualStyle
      ? `Slide look: ${slideBlueprint.visualStyle.slice(0, 80)}.`
      : "",
    `Scene: ${brief.slice(0, 200)}.`,
    subjectParts.length > 0
      ? slideAssetUrl
        ? "Use the reference photo as the only visual content — fit it into the layout described above."
        : `Include ${subjectParts.join(" and ")} recognizably from reference images.`
      : slideAssetUrl
        ? "Use the reference photo as the only visual content — fit it into the layout described above."
        : "",
    composition.hasUIChrome
      ? "Leave clean negative space where UI card/notification will be composited — no fake UI."
      : "Reserve calm middle band for text overlay.",
    "NO text, letters, numbers, logos, or watermarks.",
    `Tone: ${brandTone}. Role: ${role}.`,
  ];

  return parts.filter(Boolean).join(" ");
}
