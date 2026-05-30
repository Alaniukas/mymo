import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { buildFullBrandContext } from "@/lib/carousel/prompts";
import type { BrandProfile } from "@/lib/carousel/variables";
import { getMemeFormat, MEME_FORMATS, type MemeFormat, type ViralGoal } from "./formats";

export interface ViralSlidePlan {
  position: number;
  role: "hook" | "value" | "cta";
  caption: string;
  visualBrief: string;
  layout: "fullbleed_dark_overlay" | "text_only" | "split_compare";
  textPlacement: "top" | "center" | "bottom";
  textStyle: "headline" | "body" | "cta";
  textAlignment: "left" | "center" | "right";
  useUserPhoto: boolean;
  memeTone: "funny" | "spicy" | "wholesome";
}

export interface ViralMemePlan {
  title: string;
  postCaption: string;
  hashtags: string[];
  formatId: string;
  slides: ViralSlidePlan[];
}

const VIRAL_PLAN_SYSTEM = `You plan viral-leaning static carousels for social feeds.

Mix meme culture (relatable, punchy, slightly unhinged) with a brand/product tie-in on the final slide(s).

Output JSON:
{
  "title": "short title",
  "postCaption": "feed caption with hook + CTA",
  "hashtags": ["#..."],
  "slides": [{
    "position": 1,
    "role": "hook"|"value"|"cta",
    "caption": "BIG on-slide text — meme energy, short lines",
    "visualBrief": "background image only — no readable text in image",
    "layout": "fullbleed_dark_overlay"|"text_only"|"split_compare",
    "textPlacement": "top"|"center"|"bottom",
    "textStyle": "headline"|"body"|"cta",
    "textAlignment": "left"|"center"|"right",
    "useUserPhoto": boolean,
    "memeTone": "funny"|"spicy"|"wholesome"
  }]
}

Rules:
- First slide must stop the scroll — meme hook, not corporate.
- Product/brand mention lands on slide 3+ or final slide (not slide 1 unless subtle).
- useUserPhoto=true when showing product, founder face, or real UGC-style shot.
- Keep captions SHORT (meme length, not essay).
- Match the meme format structure provided.`;

export async function planViralMeme(opts: {
  brand: BrandProfile;
  format: MemeFormat;
  goal: ViralGoal;
  topic: string;
  platform: string;
  model?: string;
  vibeContext?: string;
  memeTemplateNames?: string[];
}): Promise<ViralMemePlan> {
  const count = opts.format.slideCount;
  const brandContext = buildFullBrandContext(opts.brand);
  const vibeBlock = opts.vibeContext?.trim()
    ? `\n\nSaved social vibe (match caption voice & energy on product slides):\n${opts.vibeContext}`
    : "";
  const memeBlock =
    opts.memeTemplateNames && opts.memeTemplateNames.length > 0
      ? `\n\nUser picked meme templates: ${opts.memeTemplateNames.join(", ")}. Write hook captions that fit these formats (use line breaks for multi-panel memes like Drake).`
      : "";

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: opts.model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 4096,
    temperature: 0.9,
    messages: [
      { role: "system", content: VIRAL_PLAN_SYSTEM },
      {
        role: "user",
        content: `Brand (for product tie-in only — don't kill the meme with corporate tone early):\n${brandContext}${vibeBlock}${memeBlock}\n\nMeme format: ${opts.format.title}\nStructure: ${opts.format.structure}\nHook style hint: ${opts.format.hookStyle}\nViral goal: ${opts.goal}\nTopic angle: ${opts.topic || "(pick a relatable angle for this brand)"}\nPlatform: ${opts.platform}\nSlides: ${count}\n\nPlan JSON:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) throw new Error("Empty response planning viral meme carousel");

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];

  const slides: ViralSlidePlan[] = Array.from({ length: count }, (_, i) => {
    const raw = (rawSlides[i] ?? {}) as Record<string, unknown>;
    const pos = i + 1;
    return {
      position: pos,
      role: pos === 1 ? "hook" : pos === count ? "cta" : "value",
      caption: typeof raw.caption === "string" ? raw.caption.trim() : "",
      visualBrief:
        typeof raw.visualBrief === "string"
          ? raw.visualBrief.trim()
          : "meme-style bold background, high contrast",
      layout:
        raw.layout === "text_only" || raw.layout === "split_compare"
          ? raw.layout
          : "fullbleed_dark_overlay",
      textPlacement:
        raw.textPlacement === "top" || raw.textPlacement === "bottom"
          ? raw.textPlacement
          : "center",
      textStyle: pos === count ? "cta" : "headline",
      textAlignment:
        raw.textAlignment === "left" || raw.textAlignment === "right"
          ? raw.textAlignment
          : "center",
      useUserPhoto: Boolean(raw.useUserPhoto ?? raw.use_user_photo),
      memeTone:
        raw.memeTone === "spicy" || raw.memeTone === "wholesome"
          ? raw.memeTone
          : "funny",
    };
  });

  return {
    title:
      typeof parsed.title === "string" ? parsed.title.trim().slice(0, 80) : opts.format.title,
    postCaption:
      typeof parsed.postCaption === "string"
        ? parsed.postCaption.trim()
        : typeof parsed.post_caption === "string"
          ? parsed.post_caption.trim()
          : "",
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((h): h is string => typeof h === "string").slice(0, 15)
      : [],
    formatId: opts.format.id,
    slides,
  };
}

export function resolveMemeFormat(formatId: string): MemeFormat {
  return getMemeFormat(formatId) ?? MEME_FORMATS[0]!;
}
