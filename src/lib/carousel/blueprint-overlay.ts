import type {
  DecorAssetBBox,
  TemplateSlideBlueprint,
  TextAlignment,
} from "./template-blueprint";
import { shouldUseGeometryRenderer } from "./slide-geometry";

export type TextPlacement = TemplateSlideBlueprint["textZone"]["placement"];
export type TextStyle = TemplateSlideBlueprint["textZone"]["style"];

/** Height ratio of the solid text panel in editorial_split layouts. */
export const EDITORIAL_TEXT_BAND = 0.46;

export interface BlueprintOverlaySpec {
  layout: string;
  textPlacement: TextPlacement;
  textStyle: TextStyle;
  textAlignment: TextAlignment;
  textColor?: string;
  accentColor?: string;
  overlayStrength?: "light" | "medium" | "heavy";
  hasUIChrome?: boolean;
  /** Normalized text region from AI template analysis — drives geometry renderer. */
  textBBox?: DecorAssetBBox;
}

function photoCountOf(slide: TemplateSlideBlueprint): number {
  const c = slide.composition.photoCount;
  if (c === "grid") return 4;
  return typeof c === "number" ? c : 1;
}

/**
 * Correct common LLM mislabels — e.g. journal top/bottom stacks tagged as split_compare.
 */
export function resolveSlideLayout(slide: TemplateSlideBlueprint): string {
  const { layout, composition, textZone, backgroundType } = slide;
  const count = photoCountOf(slide);

  const sideBySideCompare =
    layout === "split_compare" &&
    count >= 2 &&
    composition.photoLayout === "split_horizontal";

  if (sideBySideCompare) return "split_compare";

  if (layout === "split_compare") return "editorial_split";

  if (layout === "editorial_split") return "editorial_split";

  const stackedTextPanel =
    (textZone.placement === "top" || textZone.placement === "bottom") &&
    count <= 1 &&
    (backgroundType === "solid" ||
      composition.photoLayout === "split_vertical" ||
      slide.typography?.fontHint === "serif");

  if (stackedTextPanel && layout === "fullbleed_dark_overlay") {
    return "editorial_split";
  }

  return layout;
}

/** Solid text-panel rectangle for editorial_split compose + overlay. */
export function editorialPanelRect(
  slide: TemplateSlideBlueprint,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const bandH = height * EDITORIAL_TEXT_BAND;
  const placement = slide.textZone.placement;
  if (placement === "bottom") {
    return { x: 0, y: height - bandH, w: width, h: bandH };
  }
  return { x: 0, y: 0, w: width, h: bandH };
}

/** Photo half for editorial_split (user image fills this, text panel is separate). */
export function editorialPhotoRect(
  slide: TemplateSlideBlueprint,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const bandH = height * EDITORIAL_TEXT_BAND;
  const placement = slide.textZone.placement;
  if (placement === "bottom") {
    return { x: 0, y: 0, w: width, h: height - bandH };
  }
  return { x: 0, y: bandH, w: width, h: height - bandH };
}

export function editorialPanelColor(slide: TemplateSlideBlueprint): string {
  const c = slide.colors?.accentColor;
  if (c?.startsWith("#") && !c.toLowerCase().startsWith("#000")) return c;
  return "#FFFFFF";
}

/** Resolve overlay chrome + text placement from a per-slide blueprint entry. */
export function overlaySpecFromBlueprint(
  slideBlueprint?: TemplateSlideBlueprint | null,
  fallbackLayout = "fullbleed_dark_overlay",
): BlueprintOverlaySpec {
  if (!slideBlueprint) {
    return {
      layout: fallbackLayout,
      textPlacement: "center",
      textStyle: "headline",
      textAlignment: "center",
    };
  }

  const tz = slideBlueprint.textZone;
  const alignment = tz?.alignment ?? "center";

  let resolvedLayout = resolveSlideLayout(slideBlueprint);

  if (
    resolvedLayout === "notification_mock" &&
    (tz?.placement === "card" ||
      tz?.style === "body" ||
      tz?.style === "list") &&
    slideBlueprint.composition?.hasUIChrome === false
  ) {
    resolvedLayout = "testimonial_card";
  }

  // Center card / body slides — not editorial or bottom white bar.
  if (
    resolvedLayout === "fullbleed_dark_overlay" &&
    alignment !== "left" &&
    alignment !== "right" &&
    (tz?.placement === "card" ||
      tz?.style === "body" ||
      tz?.style === "list" ||
      tz?.style === "quote")
  ) {
    resolvedLayout = "testimonial_card";
  }

  const isNotesStyleCard =
    resolvedLayout === "testimonial_card" &&
    tz?.style !== "quote" &&
    (tz?.style === "body" || tz?.style === "list" || tz?.placement === "card");

  const hasUIChrome =
    isNotesStyleCard || slideBlueprint.composition?.hasUIChrome === true;

  if (shouldUseGeometryRenderer(slideBlueprint)) {
    const onPanel =
      slideBlueprint.backgroundPanels?.some((p) => p.role === "text_panel") ||
      slideBlueprint.backgroundType === "solid";
    const textColor =
      slideBlueprint.colors?.textColor?.startsWith("#")
        ? slideBlueprint.colors.textColor
        : onPanel
          ? "#111111"
          : "#FFFFFF";

    return {
      layout: "geometry",
      textPlacement: tz?.placement ?? "center",
      textStyle: tz?.style ?? "headline",
      textAlignment: tz?.alignment ?? "center",
      textColor,
      accentColor: slideBlueprint.colors?.accentColor,
      overlayStrength: slideBlueprint.colors?.overlayStrength,
      hasUIChrome: false,
      textBBox: tz?.bbox,
    };
  }

  const textColor =
    resolvedLayout === "editorial_split" &&
    !slideBlueprint.colors?.textColor?.startsWith("#")
      ? "#111111"
      : slideBlueprint.colors?.textColor;

  return {
    layout: resolvedLayout,
    textPlacement: slideBlueprint.textZone?.placement ?? "center",
    textStyle: slideBlueprint.textZone?.style ?? "headline",
    textAlignment: slideBlueprint.textZone?.alignment ?? "center",
    textColor,
    accentColor: slideBlueprint.colors?.accentColor,
    overlayStrength: slideBlueprint.colors?.overlayStrength,
    hasUIChrome,
    textBBox: tz?.bbox,
  };
}

export function parseStoredTextZone(
  raw: unknown,
): TemplateSlideBlueprint["textZone"] | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const placement = o.placement;
  const style = o.style;
  const alignment = o.alignment;
  const validPlacement = ["top", "center", "bottom", "card", "none"] as const;
  const validStyle = ["headline", "body", "list", "quote", "cta"] as const;
  const validAlignment = ["left", "center", "right"] as const;
  if (
    typeof placement !== "string" ||
    !(validPlacement as readonly string[]).includes(placement)
  ) {
    return null;
  }
  return {
    placement: placement as TextPlacement,
    style:
      typeof style === "string" &&
      (validStyle as readonly string[]).includes(style)
        ? (style as TextStyle)
        : "headline",
    lengthHint: "short",
    alignment:
      typeof alignment === "string" &&
      (validAlignment as readonly string[]).includes(alignment)
        ? (alignment as TextAlignment)
        : undefined,
  };
}

/** Colors and overlay strength persisted on carousel_slides.text_zone. */
export function parseStoredSlideColors(raw: unknown): {
  textColor?: string;
  overlayStrength?: "light" | "medium" | "heavy";
} {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const textColor =
    typeof o.textColor === "string" && o.textColor.startsWith("#")
      ? o.textColor
      : undefined;
  const os = o.overlayStrength;
  const overlayStrength =
    os === "light" || os === "medium" || os === "heavy" ? os : undefined;
  return { textColor, overlayStrength };
}
