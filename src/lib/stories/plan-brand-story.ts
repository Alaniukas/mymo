import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { buildFullBrandContext } from "@/lib/carousel/prompts";
import type { BrandProfile } from "@/lib/carousel/variables";
import type { BrandStoryGoal, BrandStoryPlan, BrandStorySlidePlan } from "./types";

const BRAND_STORY_SYSTEM = `You are a brand storyteller for Instagram/TikTok static carousels.

Given a brand profile, a goal, optional context (past posts, reel descriptions, events), and slide count, plan a cohesive carousel that sounds like THIS brand — not generic marketing.

Output JSON:
{
  "title": "short internal title",
  "postCaption": "feed caption (2-4 sentences, brand voice)",
  "hashtags": ["#tag1", ...],
  "visualTheme": "one sentence: shared palette, mood, photography style",
  "slides": [{
    "position": 1,
    "role": "hook"|"value"|"cta",
    "caption": "on-slide text (short, punchy, brand voice)",
    "visualBrief": "background image description ONLY — no text in image",
    "layout": "fullbleed_dark_overlay"|"editorial_split"|"text_only",
    "textPlacement": "top"|"center"|"bottom"|"card",
    "textStyle": "headline"|"body"|"list"|"cta",
    "textAlignment": "left"|"center"|"right",
    "useUserPhoto": boolean
  }]
}

Rules:
- Slide 1 = scroll-stopping hook tied to the goal/context.
- Last slide = CTA aligned with brand (soft or direct per tone).
- Middle slides = one idea each, building the narrative.
- useUserPhoto=true on slides that benefit from real brand photos (team, product, event, behind-the-scenes). At least 1 slide should use user photos when the goal is event/recap/story.
- editorial_split = white text panel + photo half (journal aesthetic).
- Do NOT copy pasted context verbatim — adapt to brand voice.
- Output exactly the requested slide count.`;

function normalizeSlide(raw: Record<string, unknown>, position: number, total: number): BrandStorySlidePlan {
  const role =
    position === 1 ? "hook" : position === total ? "cta" : "value";
  const layout = raw.layout === "editorial_split" || raw.layout === "text_only"
    ? raw.layout
    : "fullbleed_dark_overlay";
  const placement = ["top", "center", "bottom", "card"].includes(String(raw.textPlacement))
    ? (raw.textPlacement as BrandStorySlidePlan["textPlacement"])
    : layout === "editorial_split"
      ? "top"
      : "center";
  return {
    position,
    role: (raw.role === "hook" || raw.role === "cta" ? raw.role : role) as BrandStorySlidePlan["role"],
    caption: typeof raw.caption === "string" ? raw.caption.trim() : "",
    visualBrief:
      typeof raw.visualBrief === "string"
        ? raw.visualBrief.trim()
        : typeof raw.visual_brief === "string"
          ? raw.visual_brief.trim()
          : "on-brand lifestyle photo",
    layout,
    textPlacement: placement,
    textStyle:
      raw.textStyle === "body" ||
      raw.textStyle === "list" ||
      raw.textStyle === "cta"
        ? raw.textStyle
        : position === total
          ? "cta"
          : "headline",
    textAlignment:
      raw.textAlignment === "left" || raw.textAlignment === "right"
        ? raw.textAlignment
        : "center",
    useUserPhoto: Boolean(raw.useUserPhoto ?? raw.use_user_photo),
  };
}

export async function planBrandStory(opts: {
  brand: BrandProfile;
  goal: BrandStoryGoal;
  topic: string;
  context?: string;
  slideCount: number;
  platform: string;
  model?: string;
}): Promise<BrandStoryPlan> {
  const count = Math.min(Math.max(Math.round(opts.slideCount) || 5, 3), 10);
  const brandContext = buildFullBrandContext(opts.brand);
  const contextBlock = opts.context?.trim()
    ? `\n\nAdditional context (reels, events, past posts — adapt, don't copy):\n${opts.context.trim().slice(0, 4000)}`
    : "";

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: opts.model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 4096,
    temperature: 0.75,
    messages: [
      { role: "system", content: BRAND_STORY_SYSTEM },
      {
        role: "user",
        content: `Brand:\n${brandContext}\n\nGoal: ${opts.goal}\nTopic/focus: ${opts.topic || "(derive from brand + context)"}\nPlatform: ${opts.platform}\nSlides: ${count}${contextBlock}\n\nPlan the carousel as JSON:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) throw new Error("Empty response planning brand story");

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];

  const slides: BrandStorySlidePlan[] = Array.from({ length: count }, (_, i) => {
    const raw = (rawSlides[i] ?? {}) as Record<string, unknown>;
    return normalizeSlide(raw, i + 1, count);
  });

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 80)
        : opts.topic.slice(0, 80) || "Brand story",
    postCaption:
      typeof parsed.postCaption === "string"
        ? parsed.postCaption.trim()
        : typeof parsed.post_caption === "string"
          ? parsed.post_caption.trim()
          : "",
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((h): h is string => typeof h === "string").slice(0, 12)
      : [],
    visualTheme:
      typeof parsed.visualTheme === "string"
        ? parsed.visualTheme.trim()
        : typeof parsed.visual_theme === "string"
          ? parsed.visual_theme.trim()
          : "",
    slides,
  };
}
