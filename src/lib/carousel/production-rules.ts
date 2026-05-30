// The six production rules every generated post obeys (spec §04). They are
// baked into the template structures and also steer the caption / injection
// prompts so the output reads as native content, not generic AI filler.

export const PRODUCTION_RULES = `Production rules — every slide and caption must obey these:
1. Win the first 1.5 seconds. Slide 1 leads with the boldest claim, the sharpest pain, or the most surprising number. Never open with a logo or a slow intro.
2. Design for sound-off. The message must land as on-screen text alone; treat audio as a bonus layer, never the only carrier.
3. One idea per slide. Each slide carries a single thought. If it needs two sentences to explain, tighten it.
4. Outcomes over features. "Get 10 hours back" beats "15 productivity features." Lead with the outcome; mention the feature lower.
5. Specific, verb-first CTA. "Download free" / "Try it now" beat "Learn more." Always close on the CTA + handle.
6. Native, not polished. Slightly raw, UGC-style phrasing outperforms glossy ad copy.`;

export interface SafeZone {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Safe-zone insets (in canvas px) per aspect ratio, per the spec's platform
// map. For 9:16 the top 220px and bottom 420px are covered by platform UI, so
// overlay text must stay clear of them. Values are sized to the canvas
// dimensions returned by overlayDimsForAspect (e.g. 1080x1920 for 9:16).
export function safeZoneForAspect(aspect: string): SafeZone {
  switch (aspect) {
    case "9:16":
      return { top: 220, bottom: 420, left: 72, right: 72 };
    case "4:5":
    case "3:4":
      return { top: 96, bottom: 140, left: 72, right: 72 };
    case "1:1":
    default:
      return { top: 72, bottom: 72, left: 64, right: 64 };
  }
}
