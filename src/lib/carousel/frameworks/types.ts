import type { NicheSlug } from "../niches";

// Structured Content Template Frameworks (the spec's §05 library). Each
// framework is a fixed skeleton with two kinds of slots:
//   [Square_Brackets] -> text, resolved from the Brain Variable Dictionary.
//   {Curly_Braces}     -> assets, resolved by the combinatorial mixing engine.
// Stored as data (not prose) so the LLM fills text, the mixing engine fills
// assets, and the renderer lays out slides deterministically per ratio.

/** Named layouts the renderer owns exact coordinates for (per ratio). */
export type LayoutName =
  | "fullbleed_dark_overlay"
  | "split_compare"
  | "testimonial_card"
  | "notification_mock"
  | "text_only";

export type SlideRole = "hook" | "value" | "cta";

/** Which asset bucket a slide features — drives per-slide asset routing. */
export type AssetSlot = "hook" | "demo" | "logo";

export type FrameworkFormat = "carousel" | "single_image" | "video";

export interface FrameworkSlide {
  n: number;
  role: SlideRole;
  /** On-screen text skeleton, with [Bracket] text slots and {Asset} slots. */
  text: string;
  layout: LayoutName;
  /** Primary asset this slide features (split layouts use hook + demo). */
  asset?: AssetSlot;
  visual: string;
  audio: string;
}

export interface Framework {
  /** Stable id (T1..T9 carousels, V1..V2 video). */
  id: string;
  /** Machine angle key used for analytics tagging. */
  angle: string;
  name: string;
  goal: string;
  bestFor: string;
  format: FrameworkFormat;
  /** Aspect ratios this framework is authored for. */
  ratios: string[];
  slideCount: number;
  /** Niche cards this angle surfaces under in the picker. */
  niches: NicheSlug[];
  slides: FrameworkSlide[];
  /** Post caption template (text slots + hashtags). */
  caption: string;
  hashtags: string[];
  proTip: string;
  /** Video templates ship as data but stay disabled in the UI. */
  disabled?: boolean;
}
