import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import {
  buildFullBrandContext,
  IMPERFECT_CAPTION_GUIDANCE,
} from "@/lib/carousel/prompts";
import type { BrandProfile } from "@/lib/carousel/variables";
import type { FounderHookPlan, HookVariant } from "./types";

// Distinct fallback creators so a thin/garbled LLM response still yields varied
// A/B hooks rather than five identical clips. Each leads with an authentic
// EMOTION (the starting facial expression is the clip's first frame) and a
// motionPrompt that describes the emotional performance/transition, because the
// motionPrompt now drives the image->video animation.
const FALLBACK_CREATORS: { creatorPrompt: string; motionPrompt: string }[] = [
  {
    creatorPrompt:
      "early-20s woman with natural makeup and messy bun, oversized hoodie, sitting in a cozy sunlit bedroom, eyes glassy and welling up with happy tears, overwhelmed-with-relief expression",
    motionPrompt:
      "her eyes well up and a tear rolls down, then she breaks into a joyful, relieved smile and silent laugh through the happy tears while looking at the camera, mouth relaxed",
  },
  {
    creatorPrompt:
      "mid-20s woman in athleisure with a high ponytail in a bright modern kitchen, wide-eyed surprised expression, hand near her mouth",
    motionPrompt:
      "her jaw drops in genuine surprise, eyebrows lift, then an excited disbelieving grin spreads across her face while she looks at the camera silently",
  },
  {
    creatorPrompt:
      "20s woman with sleek straight hair and minimal gold jewelry in a neutral-toned apartment with soft window light, calm but visibly moved expression",
    motionPrompt:
      "she takes a slow emotional breath, eyes softening and glistening, then a warm grateful smile as she nods at the camera, lips still",
  },
  {
    creatorPrompt:
      "20s woman in a denim jacket on a city street at golden hour, beaming, eyes bright with excitement",
    motionPrompt:
      "she lights up with an ear-to-ear excited smile, small silent laugh and a little shoulder bounce while looking at the camera, mouth closed",
  },
  {
    creatorPrompt:
      "early-20s woman in a cropped tee at a tidy desk with a laptop, soft ring-light glow, on the verge of happy tears",
    motionPrompt:
      "her eyes glisten and well up, lip trembling into a smile, then she wipes a happy tear and gives a silent relieved laugh at the camera",
  },
];

const FOUNDER_HOOK_SYSTEM = `You are a short-form growth strategist for app founders running UGC-style hook ads on TikTok and Instagram Reels.

You design a set of A/B test reels. Every reel opens with a different ultra-realistic female creator showing a silent emotional reaction straight to camera (no speaking on camera), then cuts to the founder's own app demo clips while short on-screen lines narrate the product.

Output strict JSON:
{
  "title": "short internal title",
  "postCaption": "feed caption: scroll-stopping hook + clear CTA",
  "hashtags": ["#..."],
  "hookVariants": [
    {
      "hookLine": "the spoken + on-screen hook line (SHORT, sound-off friendly, stops the scroll)",
      "creatorPrompt": "ultra-realistic description of the female creator AND her STARTING facial expression/emotion (this is the clip's first frame): age range, hair, wardrobe, setting, lighting, and the emotion on her face — NO text, just the visual",
      "motionPrompt": "the SILENT EMOTIONAL PERFORMANCE she shows on camera (facial expression + small head/shoulder movement only) — NO speaking, NO lip-sync, NO mouth movement as if talking. Example: 'eyes well up, a tear falls, then she breaks into a joyful relieved smile'. Describe emotion and face, not dialogue."
    }
  ],
  "storyline": ["one short caption line per app clip, in order — narrates the demo, sound-off friendly"]
}

Rules:
- Emotion is what stops the scroll. Favor authentic, expressive SILENT reactions (tears of joy, relief, shock, overwhelm, excitement) — never describe her speaking, lip-syncing, or mouthing words. The hook line is added as on-screen text later; she reacts silently to camera. The creatorPrompt sets the starting emotion (first frame) and the motionPrompt performs/resolves it without speech.
- If the Topic/angle below specifies a creative direction, emotion, or character (for example "a girl crying tears of joy"), EVERY variant's creatorPrompt and motionPrompt MUST embody it — vary only the surface details (look, setting, exact wording) across variants, not the core emotional idea.
- hookLine: spoken-style, punchy, max ~10 words. Curiosity, pain, or bold emotional claim. Never corporate.
- creatorPrompt: photogenic, believable everyday creator — NOT a glamour model. Vary ethnicity, hair, and setting across variants. Never include any text, captions, logos, or watermarks in the description.
- storyline lines: one per app clip, in clip order, and TIED to the hook's emotion — the demo should explain/pay off why she reacts that way, and the last line nudges the CTA. Each line is a single short thought that makes the demo make sense without sound.
- Lead with outcomes and feelings, not feature lists. Keep everything native and UGC, not polished ad copy.`;

const IMPERFECT_HOOK_EXTRA = `Apply the same authenticity to every hookLine and every storyline caption (the short on-screen demo lines).`;

export async function planFounderHook(opts: {
  brand: BrandProfile;
  topic: string;
  appClipCount: number;
  variantCount: number;
  platform: string;
  model?: string;
  /** Subtle typos + casual tone on hook lines and storyline captions. */
  imperfect?: boolean;
}): Promise<FounderHookPlan> {
  const variantCount = Math.max(1, Math.min(opts.variantCount, 5));
  const clipCount = Math.max(1, opts.appClipCount);
  const brandContext = buildFullBrandContext(opts.brand);

  const system = opts.imperfect
    ? `${FOUNDER_HOOK_SYSTEM}\n\n${IMPERFECT_CAPTION_GUIDANCE}\n${IMPERFECT_HOOK_EXTRA}`
    : FOUNDER_HOOK_SYSTEM;

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: opts.model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 4096,
    temperature: opts.imperfect ? 0.98 : 0.95,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Founder's app/brand:\n${brandContext}\n\nApp demo clips uploaded (in order): ${clipCount}\nTopic / angle: ${
          opts.topic || "(pick the strongest growth angle for this app)"
        }\nPlatform: ${opts.platform}\nNumber of hook variants to write: ${variantCount}\nNumber of storyline lines (one per app clip): ${clipCount}\n\nPlan JSON:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) throw new Error("Empty response planning founder hook reels");

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const rawVariants = Array.isArray(parsed.hookVariants) ? parsed.hookVariants : [];
  const rawStoryline = Array.isArray(parsed.storyline) ? parsed.storyline : [];

  const hookVariants: HookVariant[] = Array.from(
    { length: variantCount },
    (_, i) => {
      const raw = (rawVariants[i] ?? {}) as Record<string, unknown>;
      const fallback = FALLBACK_CREATORS[i % FALLBACK_CREATORS.length]!;
      return {
        hookLine:
          typeof raw.hookLine === "string" && raw.hookLine.trim()
            ? raw.hookLine.trim()
            : "I wish I found this app sooner",
        creatorPrompt:
          typeof raw.creatorPrompt === "string" && raw.creatorPrompt.trim()
            ? raw.creatorPrompt.trim()
            : fallback.creatorPrompt,
        motionPrompt:
          typeof raw.motionPrompt === "string" && raw.motionPrompt.trim()
            ? raw.motionPrompt.trim()
            : fallback.motionPrompt,
      };
    },
  );

  const storyline: string[] = Array.from({ length: clipCount }, (_, i) => {
    const line = rawStoryline[i];
    return typeof line === "string" && line.trim() ? line.trim() : "";
  });

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 80)
        : "Founder hook reels",
    postCaption:
      typeof parsed.postCaption === "string"
        ? parsed.postCaption.trim()
        : typeof parsed.post_caption === "string"
          ? (parsed.post_caption as string).trim()
          : "",
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .filter((h): h is string => typeof h === "string")
          .slice(0, 15)
      : [],
    hookVariants,
    storyline,
  };
}

const STORYLINE_ONLY_SYSTEM = `You write short on-screen captions for an app demo reel on TikTok/Instagram.

Output strict JSON:
{
  "title": "short internal title",
  "postCaption": "feed caption with hook + CTA",
  "hashtags": ["#..."],
  "storyline": ["one short caption per app clip, in order — sound-off friendly, ties to the hooks' emotion"]
}

Rules:
- One line per app clip. Each is a single short thought that makes the demo make sense without sound.
- Lead with feelings/outcomes, not feature lists. Keep native UGC tone.
- Last line nudges a soft CTA.`;

/** Plans only the shared demo body copy when hooks come from the template library. */
export async function planFounderHookStoryline(opts: {
  brand: BrandProfile;
  topic: string;
  appClipCount: number;
  platform: string;
  model?: string;
  imperfect?: boolean;
}): Promise<Pick<FounderHookPlan, "title" | "postCaption" | "hashtags" | "storyline">> {
  const clipCount = Math.max(1, opts.appClipCount);
  const brandContext = buildFullBrandContext(opts.brand);
  const system = opts.imperfect
    ? `${STORYLINE_ONLY_SYSTEM}\n\n${IMPERFECT_CAPTION_GUIDANCE}`
    : STORYLINE_ONLY_SYSTEM;

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: opts.model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 2048,
    temperature: opts.imperfect ? 0.9 : 0.82,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Founder's app/brand:\n${brandContext}\n\nApp demo clips (in order): ${clipCount}\nTopic / angle: ${
          opts.topic || "(strongest growth angle for this app)"
        }\nPlatform: ${opts.platform}\nStoryline lines needed: ${clipCount}\n\nPlan JSON:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) throw new Error("Empty response planning hook storyline");

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const rawStoryline = Array.isArray(parsed.storyline) ? parsed.storyline : [];

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 80)
        : "Founder hook reels",
    postCaption:
      typeof parsed.postCaption === "string"
        ? parsed.postCaption.trim()
        : typeof parsed.post_caption === "string"
          ? (parsed.post_caption as string).trim()
          : "",
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((h): h is string => typeof h === "string").slice(0, 15)
      : [],
    storyline: Array.from({ length: clipCount }, (_, i) => {
      const line = rawStoryline[i];
      return typeof line === "string" && line.trim() ? line.trim() : "";
    }),
  };
}
