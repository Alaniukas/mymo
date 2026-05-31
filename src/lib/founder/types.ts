// Founder Hook Reels — shared types.
//
// The Founder Hook Reels engine produces several short vertical reels that each
// open with an AI-generated, ultra-realistic UGC "creator" video hook and then
// cut to the founder's own uploaded app demo clips. Every reel shares the same
// stitched app body + storyline captions; only the hook differs, so founders can
// A/B test which hook stops the scroll.

/** One A/B hook variant: the creator visual + how it animates + the on-screen line. */
export interface HookVariant {
  /**
   * Creative description of the ultra-realistic female UGC creator for the
   * image model (look, wardrobe, setting, lighting, mood). NO on-image text —
   * the engine adds the technical constraints (photoreal, vertical, no text).
   */
  creatorPrompt: string;
  /** How the still animates into a silent reaction clip (image-to-video prompt). */
  motionPrompt: string;
  /** The scroll-stopping hook line, burned onto the clip as a minimalist caption. */
  hookLine: string;
}

/** The full plan returned by the LLM planner. */
export interface FounderHookPlan {
  /** Short internal title for the reel set. */
  title: string;
  /** Feed caption (hook + CTA) reused across every variant. */
  postCaption: string;
  hashtags: string[];
  /** One scroll-stopping hook variant per reel (A/B set). */
  hookVariants: HookVariant[];
  /** One short caption line per uploaded app clip, in clip order (sound-off friendly). */
  storyline: string[];
}
