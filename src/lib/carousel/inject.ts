import {
  EVOLINK_CHAT_DEFAULTS,
  extractMessageText,
  getOpenAIClient,
} from "@/lib/openai/client";
import {
  formatVariablesForPrompt,
  resolveVariables,
  type BrandProfile,
} from "./variables";
import type {
  AssetSlot,
  Framework,
  LayoutName,
  SlideRole,
} from "./frameworks";
import { PRODUCTION_RULES } from "./production-rules";
import { IMPERFECT_CAPTION_GUIDANCE } from "./prompts";

// The injection engine. Given a framework skeleton + the Brain Variable
// Dictionary, it resolves every [Bracket] text slot into on-brand copy (one LLM
// pass, obeying the production rules), then carries each slide's layout + asset
// slot through. "Resolve text before assets" — text is filled here; the asset
// {Curly_Brace} slots are routed by the mixing engine at generation time.

export interface ResolvedSlide {
  position: number;
  role: SlideRole;
  layout: LayoutName;
  asset?: AssetSlot;
  caption: string;
}

export interface ResolvedFramework {
  slides: ResolvedSlide[];
  caption: string;
  hashtags: string[];
}

// Local fallback / deterministic fill: substitute [Key] tokens from the
// dictionary and strip {Asset} tokens (they are images, never words).
function fillTokens(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\[([A-Za-z0-9_]+)\]/g, (_, key: string) => vars[key] ?? "")
    .replace(/\{[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Turn a hashtag template (e.g. "#[App_Category]") into a clean, single-token
// hashtag, dropping it entirely when its variable resolves to nothing.
function resolveHashtags(
  raw: string[],
  vars: Record<string, string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of raw) {
    const body = fillTokens(h, vars)
      .replace(/^#/, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    if (!body) continue;
    const tag = `#${body}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

const SYSTEM_PROMPT = `You are an expert short-form social copywriter. You fill a fixed carousel template's on-screen text slots using a brand's Variable Dictionary, producing native, scroll-stopping copy.

${PRODUCTION_RULES}

Output rules:
- Replace every [Placeholder] with the brand's REAL value from the dictionary. If a placeholder has no value, rewrite the line naturally without it — NEVER output literal square brackets.
- {Curly_Brace} tokens are images (handled elsewhere). Never write them as words.
- Keep each slide SHORT — it renders as large text on an image. Hooks: 3-10 words. Value: 5-15 words. CTA: 3-10 words.
- Preserve the intent and role of each slide. Match the brand voice exactly.
- Output valid JSON only.`;

interface RawResolved {
  slides?: { position?: number; caption?: string }[];
  caption?: string;
}

/**
 * Resolves a framework's text slots against the brand profile. Falls back to
 * deterministic token substitution for any slide the model omits, so callers
 * always get one resolved caption per slide.
 */
export async function resolveFramework(
  framework: Framework,
  brand: BrandProfile,
  opts: { model?: string; imperfect?: boolean } = {},
): Promise<ResolvedFramework> {
  const vars = resolveVariables(brand);
  const dictionary = formatVariablesForPrompt(brand);

  const skeleton = framework.slides.map((s) => ({
    position: s.n,
    role: s.role,
    skeleton: s.text,
  }));

  const systemPrompt = opts.imperfect
    ? `${SYSTEM_PROMPT}\n\n${IMPERFECT_CAPTION_GUIDANCE}`
    : SYSTEM_PROMPT;

  const userPrompt = `Brand Variable Dictionary:\n${dictionary || "(sparse — infer tastefully from the brand voice, never invent specifics)"}\n\nFramework: ${framework.name} — ${framework.goal}\n\nFill each slide's on-screen text from its skeleton, and write the post caption from the caption template (keep it under ~150 words, end with the CTA + handle).\n\nSlides:\n${JSON.stringify(skeleton)}\n\nCaption template: ${framework.caption}\n\nReturn JSON exactly as: { "slides": [{ "position": number, "caption": string }], "caption": string }`;

  let raw: RawResolved = {};
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      ...EVOLINK_CHAT_DEFAULTS,
      model: opts.model || EVOLINK_CHAT_DEFAULTS.model,
      max_completion_tokens: 2048,
      temperature: opts.imperfect ? 0.9 : 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    const text = extractMessageText(completion);
    if (text) raw = JSON.parse(text) as RawResolved;
  } catch (err) {
    // Fall back to deterministic substitution below — never block generation.
    console.error("[inject] resolveFramework LLM pass failed:", err);
  }

  const byPosition = new Map<number, string>();
  for (const s of raw.slides ?? []) {
    if (typeof s?.position === "number" && typeof s?.caption === "string") {
      byPosition.set(s.position, s.caption.trim());
    }
  }

  const slides: ResolvedSlide[] = framework.slides.map((s) => ({
    position: s.n,
    role: s.role,
    layout: s.layout,
    asset: s.asset,
    caption: byPosition.get(s.n) || fillTokens(s.text, vars),
  }));

  const caption =
    (raw.caption && raw.caption.trim()) || fillTokens(framework.caption, vars);
  const hashtags = resolveHashtags(framework.hashtags, vars);

  return { slides, caption, hashtags };
}
