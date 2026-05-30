import type OpenAI from "openai";
import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import { PRODUCTION_RULES } from "./production-rules";
import {
  formatVariablesForPrompt,
  type BrandProfile,
} from "./variables";
import type {
  TemplateBlueprint,
  TemplateSlideBlueprint,
} from "./template-blueprint";
import {
  buildStudioReferenceUrls,
  TEMPLATE_LAYOUT_GUIDE_PROMPT,
  USER_ASSET_PRIMARY_PROMPT,
} from "./studio-asset-references";

export interface BrandIdentity {
  brand_tone: string | null;
  target_audience: string | null;
  value_propositions: string[] | null;
  llm_summary: string | null;
}

export interface SlideCaption {
  position: number;
  role: string;
  caption: string;
}

export interface StorylineBeat {
  position: number;
  role: string;
  /** A short VISUAL brief for the slide background — never written on the image. */
  brief: string;
  /** Per-slide overlay layout from template blueprint (studio mode). */
  layout?: string;
  /** Full slide blueprint metadata when available. */
  slideBlueprint?: TemplateSlideBlueprint;
}

/** The full planned storyline: a shared visual world + the per-slide beats. */
export interface Storyline {
  /** Shared palette/style/motif applied to EVERY slide so the set is cohesive. */
  visualTheme: string;
  beats: StorylineBeat[];
}

/** A single slide's structural job within a reference template's narrative arc. */
export interface TemplateBeat {
  position: number;
  role: string;
  /** The slide's structural purpose (e.g. "agitate the problem"), not its literal topic. */
  purpose: string;
}

/** The narrative arc reverse-engineered from a reference template's slides. */
export interface TemplateStoryline {
  summary: string;
  /** The template's actual visual look (palette, lighting, mood, composition) —
   * used as the shared style so generated slides resemble the template. */
  visualStyle: string;
  beats: TemplateBeat[];
}

const PLATFORM_SIZES: Record<string, string> = {
  instagram: "1:1",
  tiktok: "9:16",
  both: "4:5",
};

export function getSizeForPlatform(platform: string): string {
  return PLATFORM_SIZES[platform] ?? "1:1";
}

function buildBrandContext(brand: BrandIdentity): string {
  const valueProps = Array.isArray(brand.value_propositions)
    ? brand.value_propositions.join(", ")
    : "";

  return [
    brand.brand_tone && `Brand tone: ${brand.brand_tone}`,
    brand.target_audience && `Target audience: ${brand.target_audience}`,
    valueProps && `Value propositions: ${valueProps}`,
    brand.llm_summary && `Product summary: ${brand.llm_summary}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Full brandbook context including Variable Dictionary keys. */
export function buildFullBrandContext(brand: BrandProfile): string {
  const dict = formatVariablesForPrompt(brand);
  return dict || buildBrandContext({
    brand_tone: brand.brand_tone,
    target_audience: brand.target_audience,
    value_propositions: brand.value_propositions,
    llm_summary: brand.llm_summary,
  });
}

// ── Step 1: Generate editable captions (text that goes ON the slides) ────

const CAPTION_SYSTEM = `You are an expert social media carousel copywriter. Given a brand identity and an overall post caption, generate SHORT text captions for each slide of a carousel.

Rules:
- Each caption is the TEXT that will be rendered ON TOP of the slide image as an overlay.
- Slide 1 (hook): a bold, punchy headline that stops the scroll. 3-8 words max.
- Middle slides (value): one key point per slide. 5-15 words each.
- Final slide (cta): a clear call-to-action. 3-10 words.
- Match the brand's tone exactly.
- Be concise — these appear as large text on images, not paragraphs.
- Output valid JSON only — an array of objects with "position" (1-indexed), "role" (hook/value/cta), and "caption" fields.`;

// Appended to the system prompt when the user enables "imperfect copy". The
// goal is content that reads like a real person typed it on their phone —
// authentic and un-AI — without becoming unreadable or sloppy.
export const IMPERFECT_CAPTION_GUIDANCE = `AUTHENTICITY MODE — write copy that feels like a real human typed it fast, NOT polished marketing:
- Lean lowercase with casual (or missing) punctuation.
- Use natural slang, contractions and abbreviations that fit the audience (e.g. "u", "rn", "ngl", "bc").
- Include subtle, believable typos — at most ONE or TWO per caption (e.g. "teh", "youre", a doubled or dropped letter). Keep every caption easy to read and the meaning crystal clear.
- Do NOT overdo it or make it look like spam, and NEVER misspell the brand name, product name, or a call-to-action people must act on.
The vibe is organic and slightly imperfect, like a creator's own caption.`;

export async function generateSlideCaptions(
  brand: BrandIdentity,
  postCaption: string,
  platform: string,
  slideCount: number,
  model?: string,
  imperfect = false,
): Promise<SlideCaption[]> {
  const brandContext = buildBrandContext(brand);
  const base = `${CAPTION_SYSTEM}\n\n${PRODUCTION_RULES}`;
  const systemPrompt = imperfect
    ? `${base}\n\n${IMPERFECT_CAPTION_GUIDANCE}`
    : base;

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 2048,
    temperature: imperfect ? 0.9 : 0.7,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Brand context:\n${brandContext}\n\nOverall post caption:\n${postCaption}\n\nPlatform: ${platform}\nNumber of slides: ${slideCount}\n\nGenerate the slide captions as a JSON array:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) {
    throw new Error("LLM returned empty response for slide captions");
  }

  const parsed = JSON.parse(text);
  const raw: SlideCaption[] = Array.isArray(parsed)
    ? parsed
    : parsed.slides ?? parsed.captions ?? [];

  if (raw.length === 0) {
    throw new Error("LLM returned no slide captions");
  }

  const trimmed = raw.slice(0, slideCount);

  return trimmed.map((s, i) => ({
    position: i + 1,
    role: i === 0 ? "hook" : i === trimmed.length - 1 ? "cta" : "value",
    caption: s.caption,
  }));
}

// ── Step 1b: Caption already-generated slides (multi-asset mode) ─────────────
// For carousels whose images are generated FIRST (one per selected asset), the
// overlay caption is written to fit each ACTUAL slide. We pass the generated
// slide image to the (multimodal) model so the copy matches what's shown, and
// fall back to the slide's visual brief if the gateway rejects image inputs.

export interface GeneratedSlideRef {
  position: number;
  role: string;
  /** The visual brief used to generate the image (fallback context). */
  prompt: string | null;
  /** The generated (clean, text-free) slide image. */
  imageUrl: string | null;
}

const FIT_CAPTION_SYSTEM = `You are an expert social media carousel copywriter. You are given a brand identity and a set of ALREADY-GENERATED carousel slide images (each with the visual brief used to make it). Write the SHORT on-image caption that best fits each ACTUAL slide.

Rules:
- Each caption is the TEXT that will be rendered ON TOP of that slide image as an overlay — it must fit what the slide actually shows.
- Slide with role "hook": a bold, punchy headline that stops the scroll. 3-8 words max.
- Slides with role "value": one key point per slide. 5-15 words each.
- Slide with role "cta": a clear call-to-action. 3-10 words.
- Match the brand's tone exactly. Be concise — these appear as large text on images, not paragraphs.
- Output valid JSON only: { "captions": [{ "position": number, "caption": string }] }`;

export async function generateCaptionsForSlides(
  brand: BrandIdentity,
  platform: string,
  slides: GeneratedSlideRef[],
  topic: string,
  model?: string,
  imperfect = false,
): Promise<SlideCaption[]> {
  const ordered = [...slides].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return [];

  const brandContext = buildBrandContext(brand);
  const base = `${FIT_CAPTION_SYSTEM}\n\n${PRODUCTION_RULES}`;
  const systemPrompt = imperfect
    ? `${base}\n\n${IMPERFECT_CAPTION_GUIDANCE}`
    : base;

  const intro = `Brand context:\n${brandContext}\n\nOverall topic: ${
    topic || "(none)"
  }\nPlatform: ${platform}\nNumber of slides: ${ordered.length}\n\nWrite a fitting on-image caption for EACH slide. Return JSON as { "captions": [{ "position": number, "caption": string }] }.`;

  const briefLine = (s: GeneratedSlideRef) =>
    `Slide ${s.position} (role: ${s.role}). Visual brief: ${s.prompt ?? "(n/a)"}.`;

  // Multimodal content: a brief line + the actual slide image for each slide.
  const multimodalContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: intro },
  ];
  for (const s of ordered) {
    multimodalContent.push({ type: "text", text: briefLine(s) });
    if (s.imageUrl) {
      multimodalContent.push({ type: "image_url", image_url: { url: s.imageUrl } });
    }
  }

  const textOnlyContent = `${intro}\n\nSlides:\n${ordered
    .map(briefLine)
    .join("\n")}`;

  const openai = getOpenAIClient();

  const run = async (
    content: string | OpenAI.Chat.Completions.ChatCompletionContentPart[],
  ): Promise<SlideCaption[]> => {
    const completion = await openai.chat.completions.create({
      ...EVOLINK_CHAT_DEFAULTS,
      model: model || EVOLINK_CHAT_DEFAULTS.model,
      max_completion_tokens: 2048,
      temperature: imperfect ? 0.9 : 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    });

    const text = extractMessageText(completion);
    if (!text) throw new Error("LLM returned empty response for slide captions");

    const parsed = JSON.parse(text);
    const raw: { position?: number; caption?: string }[] = Array.isArray(parsed)
      ? parsed
      : parsed.captions ?? parsed.slides ?? [];

    const byPosition = new Map<number, string>();
    for (const r of raw) {
      if (typeof r?.position === "number" && typeof r?.caption === "string") {
        byPosition.set(r.position, r.caption.trim());
      }
    }

    return ordered.map((s) => ({
      position: s.position,
      role: s.role,
      caption: byPosition.get(s.position) ?? "",
    }));
  };

  // Prefer multimodal (the caption fits the ACTUAL image). Fall back to the
  // text-only visual briefs if the gateway rejects image inputs or returns
  // nothing usable, so caption generation never blocks the flow.
  try {
    const result = await run(multimodalContent);
    if (result.some((r) => r.caption)) return result;
  } catch (err) {
    console.warn(
      "[prompts] multimodal slide captioning failed, falling back to briefs:",
      err,
    );
  }

  return run(textOnlyContent);
}

// ── Step 0a: Extract a reference template's narrative arc ─────────────────────
// Before planning the new storyline, look at the chosen template's actual slides
// and reverse-engineer the ARC it follows (hook → how the middle builds → CTA),
// so the generated carousel reuses a proven structure, not just per-slide styling.

const TEMPLATE_ARC_SYSTEM = `You are a social-media creative strategist. You are given the slide images of a high-performing carousel TEMPLATE, in order. Reverse-engineer (1) its NARRATIVE ARC and (2) its VISUAL STYLE so both can be reused for a DIFFERENT brand.

Rules:
- Identify the structural job of EACH slide: the hook, how the middle builds (e.g. agitate the problem, reveal steps one by one, stack proof), and how it closes (the CTA).
- Describe each slide's PURPOSE structurally — do NOT copy its literal words, topic, or product.
- Give a one-line "summary" of the overall arc/approach.
- Give a one-sentence "visual_style": the template's recurring look — color palette, lighting, background, framing/composition, and overall aesthetic — so new slides can be made to match it. Describe the look only; do NOT mention any specific person's identity.
- Output valid JSON only: { "summary": string, "visual_style": string, "beats": [{ "position": number, "role": "hook"|"value"|"cta", "purpose": string }] }`;

export async function extractTemplateStoryline(
  templateImageUrls: string[],
  model?: string,
): Promise<TemplateStoryline | null> {
  const urls = templateImageUrls
    .filter((u) => typeof u === "string" && u)
    .slice(0, 10);
  if (urls.length === 0) return null;

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: "Here are the template's slides, in order:" },
  ];
  urls.forEach((url, i) => {
    content.push({ type: "text", text: `Slide ${i + 1}:` });
    content.push({ type: "image_url", image_url: { url } });
  });
  content.push({
    type: "text",
    text: "Reverse-engineer the narrative arc as JSON.",
  });

  // Best-effort: if the gateway rejects image inputs or returns nothing usable,
  // return null so storyline planning proceeds without the template arc.
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      ...EVOLINK_CHAT_DEFAULTS,
      model: model || EVOLINK_CHAT_DEFAULTS.model,
      // Up to 10 beats + summary + visual_style for a long template; give enough
      // room so the JSON isn't truncated (reasoning_effort low still uses some).
      max_completion_tokens: 2800,
      temperature: 0.4,
      messages: [
        { role: "system", content: TEMPLATE_ARC_SYSTEM },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    });

    const text = extractMessageText(completion);
    if (!text) return null;

    const parsed = JSON.parse(text);
    const rawBeats: { position?: number; role?: string; purpose?: string }[] =
      Array.isArray(parsed) ? parsed : parsed.beats ?? parsed.slides ?? [];

    const beats: TemplateBeat[] = rawBeats
      .filter((b) => typeof b?.purpose === "string" && b.purpose.trim())
      .map((b, i) => ({
        position: typeof b.position === "number" ? b.position : i + 1,
        role: b.role === "hook" || b.role === "cta" ? b.role : "value",
        purpose: (b.purpose as string).trim(),
      }));

    if (beats.length === 0) return null;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      visualStyle:
        typeof parsed.visual_style === "string"
          ? parsed.visual_style.trim()
          : typeof parsed.visualStyle === "string"
            ? parsed.visualStyle.trim()
            : "",
      beats,
    };
  } catch (err) {
    console.warn("[prompts] template arc extraction failed:", err);
    return null;
  }
}

// ── Step 0b: Plan the visual storyline (images-first flow) ────────────────────
// Before any image is generated, design a coherent slide-by-slide narrative
// (hook → value → cta) from the brand + topic — optionally reusing a template's
// extracted arc. Each beat is a VISUAL brief that guides the slide background
// only; the on-image caption is written afterward (generateCaptionsForSlides).
// The whole set shares one visualTheme so it reads as one continuous story.

const STORYLINE_SYSTEM = `You are a creative director for social media carousels. Given a brand, a topic, and a desired number of slides, design a coherent slide-by-slide VISUAL storyline that flows as ONE continuous narrative from the first slide to the last: a scroll-stopping hook, a middle that builds value one idea at a time, and a final call-to-action that pays off the hook.

Rules:
- ONE continuous story: every slide must follow directly from the previous one so the viewer keeps swiping, and the final slide should resolve the tension set up by the hook. No slide should feel interchangeable or out of order.
- Keep a CONSISTENT visual world across every slide — the same color palette, lighting, art style, and a recurring motif — so the slides read as a single set, not random images. Describe that shared look once in "visual_theme".
- For EACH slide, write a short VISUAL brief (one sentence) for that slide's background imagery, mood, and composition. Make each brief visually continuous with its neighbours (shared palette/motif) while advancing the story.
- Do NOT write the on-image caption/headline — only describe the visuals.
- Slide 1 is the hook (most striking). The final slide is the CTA. Middle slides each deliver one point of value.
- Output valid JSON only: { "visual_theme": string, "beats": [{ "position": number, "role": "hook"|"value"|"cta", "brief": string }] }`;

export async function generateStoryline(
  brand: BrandIdentity,
  topic: string,
  platform: string,
  slideCount: number,
  model?: string,
  imperfect = false,
  templateStoryline?: TemplateStoryline | null,
): Promise<Storyline> {
  const count = Math.min(Math.max(Math.round(slideCount) || 5, 2), 10);
  const brandContext = buildBrandContext(brand);
  const systemPrompt = `${STORYLINE_SYSTEM}\n\n${PRODUCTION_RULES}`;

  // When a template arc was extracted, instruct the model to reuse that proven
  // structure (adapted to this brand) rather than inventing a fresh structure,
  // AND to make the shared visual_theme match the template's actual look so the
  // generated carousel closely resembles the template.
  const arcBlock =
    templateStoryline && templateStoryline.beats.length > 0
      ? `\n\nReuse this PROVEN narrative arc from a reference template (adapt it to the brand and topic, and map it across ${count} slides — do NOT copy the template's literal topic or wording):\nArc summary: ${
          templateStoryline.summary || "(structured hook → value → CTA)"
        }\n${templateStoryline.beats
          .map((b) => `- ${b.role}: ${b.purpose}`)
          .join("\n")}${
          templateStoryline.visualStyle
            ? `\n\nThe template's visual style is: ${templateStoryline.visualStyle}\nSet "visual_theme" to closely match this template style (same palette, lighting, mood, composition), only lightly adapted to the brand, and keep every slide's brief consistent with it.`
            : ""
        }`
      : "";

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 2048,
    temperature: 0.8,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Brand context:\n${brandContext}\n\nTopic: ${
          topic || "(use the brand's core value proposition)"
        }\nPlatform: ${platform}\nNumber of slides: ${count}${
          imperfect
            ? "\nTone: candid and authentic, like a real creator's post."
            : ""
        }${arcBlock}\n\nDesign the visual storyline as JSON:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) throw new Error("LLM returned empty response for storyline");

  const parsed = JSON.parse(text);
  const raw: { position?: number; brief?: string }[] = Array.isArray(parsed)
    ? parsed
    : parsed.beats ?? parsed.slides ?? [];

  const orderedBriefs = raw
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((b) => (typeof b.brief === "string" ? b.brief.trim() : ""))
    .filter((s) => s.length > 0);

  const fallback = topic.trim() || "on-brand lifestyle visual";
  const llmTheme =
    typeof parsed.visual_theme === "string"
      ? parsed.visual_theme.trim()
      : typeof parsed.visualTheme === "string"
        ? parsed.visualTheme.trim()
        : "";
  // Prefer the template's extracted look as the shared theme so the whole
  // carousel resembles the template; fall back to the model's invented theme.
  const visualTheme = templateStoryline?.visualStyle?.trim() || llmTheme;

  // Always return exactly `count` beats with enforced roles, so the storyline
  // (and slide count) never depends on how many briefs the model returned.
  const beats: StorylineBeat[] = Array.from({ length: count }, (_, i) => ({
    position: i + 1,
    role: i === 0 ? "hook" : i === count - 1 ? "cta" : "value",
    brief: orderedBriefs[i] ?? orderedBriefs[orderedBriefs.length - 1] ?? fallback,
  }));

  return { visualTheme, beats };
}

// ── Blueprint-driven storyline planning (studio mode) ─────────────────────────

const BLUEPRINT_PLAN_SYSTEM = `You are a creative director. Given a brand, topic, and a TEMPLATE BLUEPRINT (structural analysis of a proven carousel), write a per-slide VISUAL brief for a NEW carousel that replicates the template's format for this brand.

Rules:
- Keep EXACTLY the same number of slides and the same structural job per slide (narrativePurpose).
- Match each slide's composition type (single photo vs split vs collage) in your brief.
- Adapt content to the brand and topic — do NOT copy the template's literal topic.
- Do NOT write on-image captions — only describe visuals for the background image.
- Output valid JSON: { "visual_theme": string, "beats": [{ "position": number, "brief": string }] }`;

export async function planSlidesFromBlueprint(
  blueprint: TemplateBlueprint,
  brand: BrandProfile,
  topic: string,
  platform: string,
  model?: string,
): Promise<Storyline> {
  const brandContext = buildFullBrandContext(brand);
  const slideSpec = blueprint.slides
    .map(
      (s) =>
        `Slide ${s.position} (${s.role}): purpose="${s.narrativePurpose}", layout=${s.layout}, photos=${s.composition.photoCount}/${s.composition.photoLayout}, text=${s.textZone.style}@${s.textZone.placement}`,
    )
    .join("\n");

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 2048,
    temperature: 0.7,
    messages: [
      { role: "system", content: `${BLUEPRINT_PLAN_SYSTEM}\n\n${PRODUCTION_RULES}` },
      {
        role: "user",
        content: `Brand:\n${brandContext}\n\nTopic: ${topic || "(use brand value proposition)"}\nPlatform: ${platform}\n\nTemplate arc: ${blueprint.summary}\nArc type: ${blueprint.arcType}\nCopy pattern: ${blueprint.copyPattern}\nGlobal style: ${blueprint.globalVisualStyle}\n\nPer-slide structure:\n${slideSpec}\n\nWrite visual briefs as JSON:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  const fallback = topic.trim() || "on-brand lifestyle visual";
  const visualTheme =
    blueprint.globalVisualStyle.trim() ||
    (text ? (JSON.parse(text).visual_theme ?? "") : "");

  let briefs: string[] = [];
  if (text) {
    const parsed = JSON.parse(text);
    const raw: { position?: number; brief?: string }[] = Array.isArray(parsed)
      ? parsed
      : parsed.beats ?? parsed.slides ?? [];
    briefs = raw
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((b) => (typeof b.brief === "string" ? b.brief.trim() : ""))
      .filter(Boolean);
  }

  const beats: StorylineBeat[] = blueprint.slides.map((slide, i) => ({
    position: slide.position,
    role: slide.role,
    brief: briefs[i] ?? briefs[briefs.length - 1] ?? fallback,
    layout: slide.layout,
    slideBlueprint: slide,
  }));

  return { visualTheme, beats };
}

// ── Blueprint-aware caption generation (studio mode) ────────────────────────

const BLUEPRINT_CAPTION_SYSTEM = `You are an expert social media carousel copywriter. Write on-image captions for slides that follow a TEMPLATE'S copy pattern but with THIS brand's content.

Rules:
- Match the template's copyPattern (e.g. question hook → numbered tips → CTA) — same structure, new brand content.
- Per slide, respect textZone style and lengthHint from the blueprint.
- When textZone.style is "list", line 1 is the title; each bullet on its own following line (no bullet chars).
- When textZone.style is "body" and placement is "card", put a short bold title on line 1, a blank line, then the body paragraph (like a Notes app card).
- Each caption is rendered ON TOP of the slide image as overlay text.
- Match brand tone. Do NOT copy template literal text.
- Output valid JSON: { "captions": [{ "position": number, "caption": string }] }`;

export async function generateCaptionsFromBlueprint(
  brand: BrandProfile,
  platform: string,
  slides: GeneratedSlideRef[],
  topic: string,
  blueprint: TemplateBlueprint,
  model?: string,
  imperfect = false,
): Promise<SlideCaption[]> {
  const ordered = [...slides].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return [];

  const brandContext = buildFullBrandContext(brand);
  const base = `${BLUEPRINT_CAPTION_SYSTEM}\n\n${PRODUCTION_RULES}`;
  const systemPrompt = imperfect
    ? `${base}\n\n${IMPERFECT_CAPTION_GUIDANCE}`
    : base;

  const slideHints = blueprint.slides
    .map(
      (s) =>
        `Slide ${s.position}: text style=${s.textZone.style}, placement=${s.textZone.placement}, alignment=${s.textZone.alignment ?? "center"}, length=${s.textZone.lengthHint}, purpose=${s.narrativePurpose}${s.typography ? `, typography=${s.typography.weight}/${s.typography.case}` : ""}${s.colors ? `, overlay=${s.colors.overlayStrength}` : ""}`,
    )
    .join("\n");

  const intro = `Brand:\n${brandContext}\n\nTopic: ${topic || "(none)"}\nPlatform: ${platform}\n\nTemplate copy pattern: ${blueprint.copyPattern}\nTemplate arc: ${blueprint.summary}\n\nPer-slide text guidance:\n${slideHints}\n\nWrite captions matching the pattern. Return JSON { "captions": [{ "position", "caption" }] }.`;

  const briefLine = (s: GeneratedSlideRef) =>
    `Slide ${s.position} (role: ${s.role}). Visual brief: ${s.prompt ?? "(n/a)"}.`;

  const multimodalContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: intro },
  ];
  for (const s of ordered) {
    multimodalContent.push({ type: "text", text: briefLine(s) });
    if (s.imageUrl) {
      multimodalContent.push({ type: "image_url", image_url: { url: s.imageUrl } });
    }
  }

  const textOnlyContent = `${intro}\n\nSlides:\n${ordered.map(briefLine).join("\n")}`;

  const openai = getOpenAIClient();

  const run = async (
    content: string | OpenAI.Chat.Completions.ChatCompletionContentPart[],
  ): Promise<SlideCaption[]> => {
    const completion = await openai.chat.completions.create({
      ...EVOLINK_CHAT_DEFAULTS,
      model: model || EVOLINK_CHAT_DEFAULTS.model,
      max_completion_tokens: 2048,
      temperature: imperfect ? 0.9 : 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    });

    const text = extractMessageText(completion);
    if (!text) throw new Error("LLM returned empty response for blueprint captions");

    const parsed = JSON.parse(text);
    const raw: { position?: number; caption?: string }[] = Array.isArray(parsed)
      ? parsed
      : parsed.captions ?? parsed.slides ?? [];

    const byPosition = new Map<number, string>();
    for (const r of raw) {
      if (typeof r?.position === "number" && typeof r?.caption === "string") {
        byPosition.set(r.position, r.caption.trim());
      }
    }

    return ordered.map((s) => ({
      position: s.position,
      role: s.role,
      caption: byPosition.get(s.position) ?? "",
    }));
  };

  try {
    const result = await run(multimodalContent);
    if (result.some((r) => r.caption)) return result;
  } catch (err) {
    console.warn("[prompts] blueprint multimodal captions failed:", err);
  }

  return run(textOnlyContent);
}

// ── Social post caption (IG/TikTok publish text) ───────────────────────────

export function formatHashtagsForPublish(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const body = String(t)
      .replace(/^#+/, "")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .toLowerCase();
    if (!body) continue;
    const tag = `#${body}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** Normalize list-style slide captions to title + bullet lines for overlay renderers. */
export function normalizeListSlideCaption(caption: string): string {
  return caption
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-–→]+/, "").trim())
    .filter(Boolean)
    .join("\n");
}

export interface PostCaptionResult {
  post_caption: string;
  hashtags: string[];
}

const POST_CAPTION_SYSTEM = `You are an expert social media copywriter. Write the POST caption (the text below the carousel on Instagram/TikTok), NOT the on-slide overlay text.

Rules:
- Open with a strong hook (1-2 sentences) that matches the carousel story.
- Add 2-4 short value lines or a mini-summary of what the carousel teaches.
- End with a clear CTA (save, follow, comment, link in bio — match brand).
- Match brand tone exactly. Do NOT use placeholder brackets.
- Keep total length under platform limit (Instagram ~2200 chars, TikTok ~400 chars for caption body).
- hashtags: 5-10 relevant tags WITHOUT the # prefix (we add it). Mix niche + broad.
- Output valid JSON: { "post_caption": string, "hashtags": string[] }`;

export async function generatePostCaption(
  brand: BrandProfile,
  platform: string,
  topic: string,
  slideCaptions: SlideCaption[],
  copyPattern?: string,
  model?: string,
): Promise<PostCaptionResult> {
  const brandContext = buildFullBrandContext(brand);
  const maxLen = platform === "tiktok" ? 400 : 2200;
  const slidesText = slideCaptions
    .sort((a, b) => a.position - b.position)
    .map((s) => `Slide ${s.position} (${s.role}): ${s.caption}`)
    .join("\n");

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    ...EVOLINK_CHAT_DEFAULTS,
    model: model || EVOLINK_CHAT_DEFAULTS.model,
    max_completion_tokens: 1024,
    temperature: 0.7,
    messages: [
      { role: "system", content: `${POST_CAPTION_SYSTEM}\n\n${PRODUCTION_RULES}` },
      {
        role: "user",
        content: `Brand:\n${brandContext}\n\nTopic: ${topic || "(use brand value prop)"}\nPlatform: ${platform}\nMax caption length: ~${maxLen} chars\n${copyPattern ? `Copy pattern: ${copyPattern}\n` : ""}\nOn-slide captions:\n${slidesText}\n\nWrite post caption JSON:`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = extractMessageText(completion);
  if (!text) {
    const fallback = slideCaptions.map((s) => s.caption).filter(Boolean).join(" ");
    return {
      post_caption: (topic || fallback).slice(0, maxLen),
      hashtags: formatHashtagsForPublish([brand.app_category ?? "content"].filter(Boolean)),
    };
  }

  const parsed = JSON.parse(text) as {
    post_caption?: string;
    caption?: string;
    hashtags?: string[];
  };
  const post_caption = (
    parsed.post_caption ??
    parsed.caption ??
    topic ??
    ""
  )
    .trim()
    .slice(0, maxLen);
  const hashtags = formatHashtagsForPublish(
    Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
  );

  return { post_caption, hashtags };
}

/** Build a publish caption from slide overlay text when post_caption is missing. */
export function aggregateSlideCaptionsForPublish(
  slides: { position: number; caption: string | null }[],
): string {
  const lines = slides
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => (s.caption ?? "").trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0]!;
  const hook = lines[0]!;
  const body = lines.slice(1, -1).join("\n\n");
  const cta = lines.length > 1 ? lines[lines.length - 1]! : "";
  return [hook, body, cta].filter(Boolean).join("\n\n").slice(0, 2200);
}

// ── Step 2: Build image generation prompt ────────────────────────────────────
// The model produces a CLEAN, text-free background only. The caption is burned
// on afterward as a crisp overlay (see lib/carousel/overlay.ts) so the text is
// sharp, correctly spelled, and consistent across every slide.

export interface AssetRef {
  type: "hook" | "demo";
  name: string;
  public_url: string;
}

// Layout-specific background guidance. The overlay step (lib/carousel/overlay)
// draws the text and any UI chrome (review cards, notification mocks), so the AI
// background must stay clean and leave room for that composite.
function layoutGuidance(layout?: string): string {
  switch (layout) {
    case "split_compare":
      return "Compose as a balanced two-sided / split-screen background suggesting a before-vs-after or this-vs-that contrast.";
    case "testimonial_card":
      return "Produce a soft, simple, low-detail backdrop — a styled review card will be composited on top, so keep it uncluttered.";
    case "notification_mock":
      return "Produce a softly blurred, simple lifestyle backdrop — a phone notification / message UI will be composited on top, so keep it calm and uncluttered.";
    case "text_only":
      return "Produce a clean, minimal solid or subtly-gradient background (ideally in the brand color) with no busy imagery — the message is carried by large text alone.";
    default:
      return "";
  }
}

export function buildImagePrompt(
  caption: string,
  role: string,
  position: number,
  totalSlides: number,
  brand: BrandIdentity,
  platform: string,
  assets: AssetRef[],
  useTemplateStyle = false,
  frameworkVisual?: string,
  layout?: string,
  sharedVisualTheme?: string,
  slideAssetUrl?: string,
): string {
  const aspect = getSizeForPlatform(platform);
  const tone = brand.brand_tone ?? "professional and modern";

  const hookAssets = assets.filter((a) => a.type === "hook");
  const demoAssets = assets.filter((a) => a.type === "demo");

  let assetContext = "";
  if (slideAssetUrl) {
    assetContext = `${USER_ASSET_PRIMARY_PROMPT} `;
  } else if ((role === "hook" || role === "cta") && hookAssets.length > 0) {
    assetContext = `Feature the subject from the reference photo (the creator or lifestyle scene) prominently and recognizably in the composition. `;
  } else if (role === "value" && demoAssets.length > 0) {
    assetContext = `Incorporate the product/demo visual from the reference into the composition. `;
  }

  const templateContext = useTemplateStyle
    ? slideAssetUrl
      ? `${TEMPLATE_LAYOUT_GUIDE_PROMPT} `
      : `CLOSELY REPLICATE the FIRST reference image (the template) as the master style guide — match its layout, framing, composition, color grading, lighting and overall aesthetic so this slide looks like it belongs to the SAME carousel series. Adapt only the subject/content to the theme below, and copy NONE of its text. `
    : "";

  // A shared style sentence repeated on every slide keeps the whole carousel
  // visually consistent from the first slide to the last.
  const sharedThemeContext =
    sharedVisualTheme && sharedVisualTheme.trim()
      ? `Consistent carousel style across all slides (keep this identical on every slide): ${sharedVisualTheme.trim()}. `
      : "";

  // Framework layouts (split_compare, testimonial_card, …) carry their own
  // composition guidance and a UI card is composited on top, so they get a
  // gentle negative-space note. The default full-bleed studio slide gets the
  // stronger "reserve a calm band through the middle for the headline" rule.
  const lg = layoutGuidance(layout);
  const composition = lg
    ? `Composition: leave generous, low-detail negative space with even contrast where the overlay text and any UI card sit, so they stay readable.`
    : `Composition: this is part of a multi-slide set. Reserve a calm, low-detail band through the MIDDLE of the frame (a darker gradient or simple area) for a large centered text headline, and push the main subject and any busy detail toward the top and bottom edges. Keep strong, even contrast where the text sits so it stays readable.`;

  const parts = [
    `Create a ${aspect} social media carousel slide BACKGROUND image (slide ${position} of ${totalSlides}).`,
    templateContext,
    sharedThemeContext,
    `Theme/mood of this slide: "${caption}". Use this ONLY to guide the imagery and atmosphere — do NOT write it on the image.`,
    frameworkVisual ? `Art direction: ${frameworkVisual}.` : "",
    lg,
    `CRITICAL: The image must contain NO text, words, letters, numbers, captions, labels, watermarks, or logos of any kind. It is purely a background — a text caption is composited on afterward.`,
    composition,
    assetContext,
    `Visual tone: ${tone}. Use rich gradients, lifestyle imagery, textures, or product visuals as appropriate.`,
    role === "hook"
      ? "This is the HOOK slide — make it visually striking and attention-grabbing."
      : role === "cta"
        ? "This is the CTA slide — make it warm, inviting, and action-oriented."
        : "This is a VALUE slide — keep it clean and visually uncluttered.",
  ];

  return parts.filter(Boolean).join(" ");
}

export function collectAssetUrls(assets: AssetRef[]): string[] {
  return assets.map((a) => a.public_url);
}

/**
 * Per-slide reference routing for studio mode. The matching template slide
 * always leads (it drives the layout/composition). The brand's people/lifestyle
 * (hooks) ride only the hook + CTA slides so the creator isn't pasted onto every
 * slide; product (demo) shots back the value slides. Capped small so a
 * reference-faithful model composes a clean scene instead of collaging
 * every input.
 */
export function selectStudioReferences(opts: {
  templateUrl?: string;
  slideAssetUrl?: string;
  assets: AssetRef[];
  role: string;
}): string[] {
  if (opts.slideAssetUrl) {
    return buildStudioReferenceUrls({
      slideAssetUrl: opts.slideAssetUrl,
      templateUrl: opts.templateUrl,
    });
  }

  const hooks = opts.assets
    .filter((a) => a.type === "hook")
    .map((a) => a.public_url);
  const demos = opts.assets
    .filter((a) => a.type === "demo")
    .map((a) => a.public_url);

  const refs: string[] = [];
  if (opts.templateUrl) refs.push(opts.templateUrl);
  if (opts.role === "hook" || opts.role === "cta") {
    if (hooks[0]) refs.push(hooks[0]);
  } else {
    refs.push(...demos.slice(0, 2));
  }
  return Array.from(new Set(refs)).slice(0, 4);
}
