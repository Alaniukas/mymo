import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { buildFullBrandContext } from "@/lib/carousel/prompts";
import type { BrandProfile } from "@/lib/carousel/variables";
import type {
  StoryCarouselMediaMode,
  StoryCarouselPlan,
  StoryCarouselSlidePlan,
  StoryNarrativeAngle,
} from "./types";

const TEXT_ONLY_SYSTEM = `You are a viral Instagram/TikTok story-carousel writer. You craft serial narratives that build followers through swipeable text slides — simple black/white typography, punchy copy, strong story line.

Output JSON:
{
  "title": "short internal title",
  "postCaption": "feed caption (2-4 sentences, hooks the story)",
  "hashtags": ["#tag1", ...],
  "storyLine": "one sentence: the narrative thread from slide 1 to last",
  "visualTheme": "unused for text-only — leave empty string",
  "slides": [{
    "position": 1,
    "role": "hook"|"value"|"cta",
    "caption": "on-slide text — short, dramatic, conversational",
    "visualBrief": "unused — leave empty",
    "layout": "text_only",
    "textPlacement": "top"|"center"|"bottom"|"card",
    "textStyle": "headline"|"body"|"list"|"cta",
    "textAlignment": "left"|"center"|"right",
    "backgroundColor": "#000000"|"#FFFFFF"|"#F5F5F0",
    "textColor": "#FFFFFF"|"#000000"
  }]
}

Rules:
- Slide 1 = scroll-stopping hook that opens a story people MUST finish.
- Middle slides = one beat each — tension, twist, payoff. Never repeat the hook.
- Last slide = soft CTA or cliffhanger that earns a follow/save.
- Alternate or vary backgroundColor (#000000 black, #FFFFFF white, #F5F5F0 cream) for visual rhythm.
- textColor MUST contrast: white text on dark bg, black text on light bg.
- Vary textPlacement and textAlignment across slides (not every slide centered).
- Write like a human storyteller — not corporate marketing.
- Output exactly the requested slide count.`;

const WITH_IMAGES_SYSTEM = `You are a viral Instagram/TikTok story-carousel creator. You plan serial narratives with AI-generated imagery — each slide's photo continues the SAME story, same characters/setting/mood.

Output JSON:
{
  "title": "short internal title",
  "postCaption": "feed caption (2-4 sentences)",
  "hashtags": ["#tag1", ...],
  "storyLine": "one sentence: the narrative thread",
  "visualTheme": "shared visual style: palette, lighting, era, character look — repeat on every slide brief",
  "slides": [{
    "position": 1,
    "role": "hook"|"value"|"cta",
    "caption": "on-slide text overlay",
    "visualBrief": "scene description ONLY — no text. Must continue the story from previous slide. Same characters/setting as visualTheme.",
    "layout": "fullbleed_dark_overlay"|"text_only",
    "textPlacement": "top"|"center"|"bottom"|"card",
    "textStyle": "headline"|"body"|"list"|"cta",
    "textAlignment": "left"|"center"|"right",
    "backgroundColor": "#000000",
    "textColor": "#FFFFFF"
  }]
}

Rules:
- visualBrief on each slide references the ongoing plot beat — images must feel like frames from one story.
- visualTheme is identical in spirit across all visualBriefs (same protagonist, location thread, color grade).
- At most 1–2 slides may be layout "text_only" for dramatic text beats; rest use fullbleed_dark_overlay.
- NO readable text in visualBrief — overlay handles typography.
- Output exactly the requested slide count.`;

function angleBlock(angle: StoryNarrativeAngle): string {
  if (angle === "brand_experience") {
    return `
Narrative angle: BRAND EXPERIENCE STORY
- Craft a dramatized, scroll-stopping client/customer experience tied to the brand's world.
- It can be fictionalized ("based on a real vibe") — the goal is insane engagement, not a legal testimonial.
- Show a before → chaos → transformation arc that mirrors what the brand sells.
- Stay on-brand in tone and category; never name real people unless provided in context.
- Make it feel like "you won't believe what happened" without being cringe.`;
  }
  return `
Narrative angle: FOLLOWER GROWTH STORY
- Pure serial storytelling optimized for saves, shares, and follows.
- Open loops, micro-cliffhangers between slides, satisfying or teasing ending.
- Topics: founder confessions, industry secrets, day-in-the-life arcs, hot takes with a story spine.
- No hard sell until the last slide — earn attention first.`;
}

const BG_COLORS = ["#000000", "#FFFFFF", "#F5F5F0"] as const;

function contrastText(bg: string): string {
  const b = bg.toUpperCase();
  if (b === "#000000" || b.startsWith("#0") || b.startsWith("#1") || b.startsWith("#2")) {
    return "#FFFFFF";
  }
  return "#000000";
}

function normalizeBg(raw: unknown, position: number): string {
  if (typeof raw === "string" && BG_COLORS.includes(raw.toUpperCase() as (typeof BG_COLORS)[number])) {
    return raw.toUpperCase();
  }
  return BG_COLORS[(position - 1) % BG_COLORS.length]!;
}

function normalizeSlide(
  raw: Record<string, unknown>,
  position: number,
  total: number,
  mediaMode: StoryCarouselMediaMode,
): StoryCarouselSlidePlan {
  const role =
    position === 1 ? "hook" : position === total ? "cta" : "value";
  const backgroundColor = normalizeBg(raw.backgroundColor ?? raw.background_color, position);
  const textColor =
    typeof raw.textColor === "string" && raw.textColor.startsWith("#")
      ? raw.textColor
      : typeof raw.text_color === "string" && raw.text_color.startsWith("#")
        ? raw.text_color
        : contrastText(backgroundColor);

  const layout =
    mediaMode === "text_only"
      ? "text_only"
      : raw.layout === "text_only"
        ? "text_only"
        : "fullbleed_dark_overlay";

  const placement = ["top", "center", "bottom", "card"].includes(String(raw.textPlacement))
    ? (raw.textPlacement as StoryCarouselSlidePlan["textPlacement"])
    : "center";

  return {
    position,
    role: (raw.role === "hook" || raw.role === "cta" ? raw.role : role) as StoryCarouselSlidePlan["role"],
    caption: typeof raw.caption === "string" ? raw.caption.trim() : "",
    visualBrief:
      typeof raw.visualBrief === "string"
        ? raw.visualBrief.trim()
        : typeof raw.visual_brief === "string"
          ? raw.visual_brief.trim()
          : "",
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
    backgroundColor,
    textColor,
  };
}

export async function planStoryCarousel(opts: {
  brand: BrandProfile;
  mediaMode: StoryCarouselMediaMode;
  narrativeAngle: StoryNarrativeAngle;
  topic: string;
  context?: string;
  slideCount: number;
  platform: string;
  model?: string;
}): Promise<StoryCarouselPlan> {
  const count = Math.min(Math.max(Math.round(opts.slideCount) || 5, 3), 10);
  const brandContext = buildFullBrandContext(opts.brand);
  const contextBlock = opts.context?.trim()
    ? `\n\nExtra context:\n${opts.context.trim().slice(0, 4000)}`
    : "";

  const system =
    opts.mediaMode === "text_only" ? TEXT_ONLY_SYSTEM : WITH_IMAGES_SYSTEM;

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: opts.model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 4096,
    temperature: 0.82,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Brand:\n${brandContext}\n\n${angleBlock(opts.narrativeAngle)}\n\nMedia mode: ${opts.mediaMode}\nTopic/seed: ${opts.topic || "(derive a compelling story from brand)"}\nPlatform: ${opts.platform}\nSlides: ${count}${contextBlock}\n\nPlan the carousel as JSON:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) throw new Error("Empty response planning story carousel");

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];

  const slides: StoryCarouselSlidePlan[] = Array.from({ length: count }, (_, i) => {
    const raw = (rawSlides[i] ?? {}) as Record<string, unknown>;
    return normalizeSlide(raw, i + 1, count, opts.mediaMode);
  });

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 80)
        : opts.topic.slice(0, 80) || "Story carousel",
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
    storyLine:
      typeof parsed.storyLine === "string"
        ? parsed.storyLine.trim()
        : typeof parsed.story_line === "string"
          ? parsed.story_line.trim()
          : "",
    slides,
  };
}
